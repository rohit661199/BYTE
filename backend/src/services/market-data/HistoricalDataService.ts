import { db } from '../../database/db.js';
import { Candle, CandleInterval } from '../../types/marketData.js';
import { InstrumentRegistry } from '../InstrumentRegistry.js';
import { IMarketDataProvider } from './IMarketDataProvider.js';
import { BinanceMarketDataProvider } from './BinanceMarketDataProvider.js';
import { AlpacaMarketDataProvider } from './AlpacaMarketDataProvider.js';
import { UpstoxMarketDataProvider } from './UpstoxMarketDataProvider.js';
import { ExchangeCalendar } from '../ExchangeCalendar.js';
import { NseExchangeCalendar } from '../NseExchangeCalendar.js';
import { logger } from '../../utils/logger.js';

export interface HistoricalDataServiceOptions {
  binanceProvider?: IMarketDataProvider;
  alpacaProvider?: IMarketDataProvider;
  upstoxProvider?: IMarketDataProvider;
}

export class HistoricalDataService {
  private static instance: HistoricalDataService | null = null;

  private readonly providers = new Map<string, IMarketDataProvider>();

  constructor(options?: HistoricalDataServiceOptions) {
    const binance = options?.binanceProvider || new BinanceMarketDataProvider();
    this.providers.set('BINANCE', binance);
    this.providers.set('CRYPTO_SIM', binance);
    this.providers.set('NASDAQ', options?.alpacaProvider || new AlpacaMarketDataProvider());
    this.providers.set('NYSE', options?.alpacaProvider || new AlpacaMarketDataProvider());
    this.providers.set('NSE', options?.upstoxProvider || new UpstoxMarketDataProvider());
  }

  public static getInstance(options?: HistoricalDataServiceOptions): HistoricalDataService {
    if (!HistoricalDataService.instance) {
      HistoricalDataService.instance = new HistoricalDataService(options);
    }
    return HistoricalDataService.instance;
  }

  public static setInstance(service: HistoricalDataService | null): void {
    HistoricalDataService.instance = service;
  }

  /**
   * Register or override a provider for a specific venue (e.g. for testing).
   */
  public registerProvider(venue: string, provider: IMarketDataProvider): void {
    const v = venue.toUpperCase();
    this.providers.set(v, provider);
    if (v === 'BINANCE') {
      this.providers.set('CRYPTO_SIM', provider);
    } else if (v === 'CRYPTO_SIM') {
      this.providers.set('BINANCE', provider);
    }
  }


  /**
   * Retrieves OHLCV candles for a given symbol and interval.
   * Transparent write-through cache: checks SQLite `market_candles` first.
   * If cache is fresh, returns cached candles without external network calls.
   * If cache miss or stale, calls provider, stores candles in SQLite, and returns them.
   */
  public async getCandles(
    symbol: string,
    interval: CandleInterval,
    limit = 100,
    forceRefresh = false
  ): Promise<Candle[]> {
    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    const instrument = InstrumentRegistry.getInstrument(canonical);

    if (!instrument) {
      logger.warn(`[HistoricalDataService] Unknown instrument: ${symbol}`);
      return [];
    }

    // 1. Check local SQLite cache
    const cachedCandles = this.getCachedCandles(canonical, interval);

    if (!forceRefresh && this.isCacheFresh(canonical, interval, cachedCandles, limit)) {
      logger.debug(`[HistoricalDataService] Cache HIT for ${canonical} (${interval}). Returning ${cachedCandles.length} candles.`);
      return cachedCandles.slice(-limit);
    }

    logger.debug(`[HistoricalDataService] Cache MISS or STALE for ${canonical} (${interval}). Fetching from provider...`);

    // 2. Route by venue
    if (instrument.venue === 'BYTE_SIM') {
      return this.generateByteSimCandles(canonical, interval, limit);
    }

    const provider = this.providers.get(instrument.venue);
    if (!provider) {
      logger.warn(`[HistoricalDataService] No provider registered for venue ${instrument.venue} (${canonical})`);
      return cachedCandles.slice(-limit);
    }

    try {
      const fetchedCandles = await provider.getHistoricalCandles(canonical, interval, limit);

      if (fetchedCandles && fetchedCandles.length > 0) {
        // Write-through to SQLite cache
        const sourceName = fetchedCandles[0].source || provider.name;
        this.saveCandlesToCache(canonical, interval, fetchedCandles, sourceName);

        // Retrieve unified sorted candles from database
        const updatedCandles = this.getCachedCandles(canonical, interval);
        return updatedCandles.slice(-limit);
      }

      // Provider returned empty: fallback to existing cache
      return cachedCandles.slice(-limit);
    } catch (err: any) {
      logger.warn(`[HistoricalDataService] Provider ${provider.name} failed for ${canonical} (${interval}): ${err.message}. Falling back to cache.`);
      return cachedCandles.slice(-limit);
    }
  }

  /**
   * Reads cached candles from SQLite `market_candles` table.
   * Guaranteed to be sorted chronologically ascending.
   */
  public getCachedCandles(symbol: string, interval: CandleInterval, limit?: number): Candle[] {
    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    try {
      const stmt = db.prepare(`
        SELECT timestamp, open, high, low, close, volume, source
        FROM market_candles
        WHERE symbol = ? AND interval = ?
        ORDER BY timestamp ASC
      `);

      const rows = stmt.all(canonical, interval) as Array<{
        timestamp: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        source?: string;
      }>;

      if (!rows || rows.length === 0) return [];

      const candles: Candle[] = rows.map((r) => ({
        timestamp: Number(r.timestamp),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume),
        source: r.source || 'CACHE',
      }));

      return limit && limit > 0 ? candles.slice(-limit) : candles;
    } catch (err: any) {
      logger.error(`[HistoricalDataService] Error querying SQLite market_candles: ${err.message}`);
      return [];
    }
  }

  /**
   * Atomically writes candles into the SQLite `market_candles` table.
   */
  public saveCandlesToCache(symbol: string, interval: CandleInterval, candles: Candle[], source: string): void {
    if (!candles || candles.length === 0) return;
    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);

    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO market_candles (
          symbol, interval, timestamp, open, high, low, close, volume, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((items: Candle[]) => {
        for (const c of items) {
          stmt.run(
            canonical,
            interval,
            c.timestamp,
            c.open,
            c.high,
            c.low,
            c.close,
            c.volume || 0,
            c.source || source
          );
        }
      });

      insertMany(candles);
      logger.debug(`[HistoricalDataService] Cached ${candles.length} candles for ${canonical} (${interval})`);
    } catch (err: any) {
      logger.error(`[HistoricalDataService] Failed to cache candles in SQLite: ${err.message}`);
    }
  }

  /**
   * Checks whether the existing cached candles are sufficiently fresh.
   * Respects market sessions and timezones:
   * - Crypto: Trades 24/7/365. Fresh if latest candle is within interval duration.
   * - US Equities (America/New_York): If market is closed, past session bars are immutable and 100% fresh.
   * - Indian Equities (Asia/Kolkata): If market is closed, past session bars are immutable and 100% fresh.
   */
  public isCacheFresh(
    symbol: string,
    interval: CandleInterval,
    cachedCandles: Candle[],
    limit = 100
  ): boolean {
    if (!cachedCandles || cachedCandles.length === 0) {
      return false;
    }

    if (cachedCandles.length < Math.min(limit, 10)) {
      // Too few candles in cache to consider it populated
      return false;
    }

    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    const instrument = InstrumentRegistry.getInstrument(canonical);
    const intervalMs = HistoricalDataService.getIntervalMs(interval);
    const now = Date.now();
    const latestCandle = cachedCandles[cachedCandles.length - 1];
    const ageMs = now - latestCandle.timestamp;

    if (!instrument) {
      return ageMs < intervalMs * 2;
    }

    // 1. Crypto / Utility: 24/7 market
    if (instrument.sessionType === 'CRYPTO_24_7') {
      return ageMs < intervalMs * 1.5;
    }

    // 2. US Equities (NASDAQ / NYSE)
    if (instrument.venue === 'NASDAQ' || instrument.venue === 'NYSE') {
      const isMarketOpen = ExchangeCalendar.isMarketOpen(new Date());
      if (!isMarketOpen) {
        // Market is currently closed. If we have candles from the most recent session, cache is fresh.
        // Closed session data does not mutate until next open.
        return true;
      }
      return ageMs < intervalMs * 1.5;
    }

    // 3. Indian Equities (NSE)
    if (instrument.venue === 'NSE') {
      const isMarketOpen = NseExchangeCalendar.isMarketOpen(new Date());
      if (!isMarketOpen) {
        // Market is currently closed. Historical data is static.
        return true;
      }
      return ageMs < intervalMs * 1.5;
    }

    // 4. Simulated / Default
    return ageMs < intervalMs * 2;
  }

  /**
   * Returns interval duration in milliseconds.
   */
  public static getIntervalMs(interval: CandleInterval): number {
    switch (interval) {
      case '1m':
        return 60 * 1000;
      case '5m':
        return 5 * 60 * 1000;
      case '15m':
        return 15 * 60 * 1000;
      case '1h':
        return 60 * 60 * 1000;
      case '4h':
        return 4 * 60 * 60 * 1000;
      case '1d':
        return 24 * 60 * 60 * 1000;
      case '1w':
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Universal candle aggregator: collapses smaller timeframe candles into larger timeframe candles.
   * e.g., 1h -> 4h, 1m -> 5m, 1m -> 15m.
   */
  public static aggregateCandles(
    candles: Candle[],
    targetIntervalMs: number,
    sourceName = 'AGGREGATED'
  ): Candle[] {
    if (!candles || candles.length === 0 || targetIntervalMs <= 0) {
      return [];
    }

    const buckets = new Map<number, Candle[]>();

    for (const c of candles) {
      const bucketTimestamp = Math.floor(c.timestamp / targetIntervalMs) * targetIntervalMs;
      let list = buckets.get(bucketTimestamp);
      if (!list) {
        list = [];
        buckets.set(bucketTimestamp, list);
      }
      list.push(c);
    }

    const aggregated: Candle[] = [];
    const sortedBucketKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

    for (const bucketTs of sortedBucketKeys) {
      const list = buckets.get(bucketTs)!;
      list.sort((a, b) => a.timestamp - b.timestamp);

      const open = list[0].open;
      const close = list[list.length - 1].close;
      let high = list[0].high;
      let low = list[0].low;
      let volume = 0;

      for (const item of list) {
        if (item.high > high) high = item.high;
        if (item.low < low) low = item.low;
        volume += item.volume;
      }

      aggregated.push({
        timestamp: bucketTs,
        open,
        high,
        low,
        close,
        volume,
        source: sourceName || list[0].source,
      });
    }

    return aggregated;
  }

  /**
   * Generates genuine candles for simulated instruments (e.g. BYTE-USD) from the persisted trades table.
   * If no trades exist, returns an empty array (never fabricates fake prices).
   */
  private generateByteSimCandles(symbol: string, interval: CandleInterval, limit = 100): Candle[] {
    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    const intervalMs = HistoricalDataService.getIntervalMs(interval);

    try {
      const stmt = db.prepare(`
        SELECT price, quantity, timestamp
        FROM trades
        WHERE symbol = ? OR symbol = 'BYTE-USD' OR symbol = 'BYTE'
        ORDER BY timestamp ASC
      `);

      const rows = stmt.all(canonical) as Array<{ price: number; quantity: number; timestamp: string }>;

      if (!rows || rows.length === 0) {
        return [];
      }

      // Group trades into interval buckets
      const buckets = new Map<number, Array<{ price: number; quantity: number; timestamp: number }>>();

      for (const row of rows) {
        const ts = new Date(row.timestamp).getTime();
        const bucketTs = Math.floor(ts / intervalMs) * intervalMs;
        let list = buckets.get(bucketTs);
        if (!list) {
          list = [];
          buckets.set(bucketTs, list);
        }
        list.push({ price: Number(row.price), quantity: Number(row.quantity), timestamp: ts });
      }

      const candles: Candle[] = [];
      const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

      for (const bucketTs of sortedKeys) {
        const list = buckets.get(bucketTs)!;
        list.sort((a, b) => a.timestamp - b.timestamp);

        const open = list[0].price;
        const close = list[list.length - 1].price;
        let high = list[0].price;
        let low = list[0].price;
        let volume = 0;

        for (const t of list) {
          if (t.price > high) high = t.price;
          if (t.price < low) low = t.price;
          volume += t.quantity;
        }

        candles.push({
          timestamp: bucketTs,
          open,
          high,
          low,
          close,
          volume,
          source: 'BYTE_TRADES',
        });
      }

      // Cache the computed trade candles
      this.saveCandlesToCache(canonical, interval, candles, 'BYTE_TRADES');

      return candles.slice(-limit);
    } catch (err: any) {
      logger.error(`[HistoricalDataService] Failed to generate candles for simulated trades: ${err.message}`);
      return [];
    }
  }

  /**
   * Utility to clear cached candles (for test isolation and invalidation).
   */
  public clearCache(symbol?: string, interval?: CandleInterval): void {
    try {
      if (symbol && interval) {
        const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
        db.prepare('DELETE FROM market_candles WHERE symbol = ? AND interval = ?').run(canonical, interval);
      } else if (symbol) {
        const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
        db.prepare('DELETE FROM market_candles WHERE symbol = ?').run(canonical);
      } else {
        db.prepare('DELETE FROM market_candles').run();
      }
    } catch (err: any) {
      logger.error(`[HistoricalDataService] Failed to clear market_candles cache: ${err.message}`);
    }
  }
}
