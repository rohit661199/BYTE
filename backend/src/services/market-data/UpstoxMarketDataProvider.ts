import { IMarketDataProvider } from './IMarketDataProvider.js';
import { MarketQuote, ProviderHealthStatus, Candle, CandleInterval } from '../../types/marketData.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { InstrumentRegistry } from '../InstrumentRegistry.js';

export class UpstoxMarketDataProvider implements IMarketDataProvider {
  public readonly name = 'UpstoxMarketDataProvider';
  public readonly supportedSymbols = [
    'RELIANCE',
    'TCS',
    'HDFCBANK',
    'INFY',
    'ICICIBANK',
    'SBIN',
    'BHARTIARTL',
    'ITC',
    'LT',
    'WIPRO',
    'AXISBANK',
    'BAJFINANCE',
    'MARUTI',
    'HINDUNILVR',
    'TATAMOTORS',
  ];

  public static readonly REGULATORY_DISCLAIMER =
    'NSE market data via Upstox is restricted to personal account use under NSE exchange redistribution regulations. Public live dissemination requires an NSE commercial market data license.';

  private lastQuoteMap = new Map<string, MarketQuote>();
  private lastUpdateTimestamp = 0;
  private lastError?: string;
  private isStreaming = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private onQuoteCallback: ((quote: MarketQuote) => void) | null = null;

  public async initialize(): Promise<void> {
    if (!this.hasCredentials()) {
      this.lastError = 'Missing UPSTOX_ACCESS_TOKEN in environment';
      logger.info(`[UpstoxProvider] ${this.lastError}. Operating in compliant PREVIEW mode for NSE.`);
      this.populateBaselineQuotes();
      return;
    }

    try {
      await this.fetchRestSnapshot();
      logger.info('[UpstoxProvider] Initialized successfully via Upstox V3 Market Quote API.');
    } catch (err: any) {
      this.lastError = err.response?.data?.message || err.message || 'REST quote request failed';
      logger.warn(`[UpstoxProvider] Upstox REST initialization warning: ${this.lastError}. Operating in PREVIEW fallback.`);
      this.populateBaselineQuotes();
    }
  }

  public async getLatestQuote(symbol: string): Promise<MarketQuote | null> {
    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    return this.lastQuoteMap.get(canonical) || null;
  }

  public async getLatestQuotes(): Promise<MarketQuote[]> {
    return Array.from(this.lastQuoteMap.values());
  }

  public static aggregateCandles(candles: Candle[], targetIntervalMs: number, sourceName = 'UPSTOX_V3'): Candle[] {
    if (candles.length === 0) return [];
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
        source: sourceName,
      });
    }

    return aggregated;
  }

  public async getHistoricalCandles(symbol: string, interval: CandleInterval, limit = 100): Promise<Candle[]> {
    if (!this.hasCredentials()) {
      logger.info(`[UpstoxProvider] No access token configured. Returning empty historical candles for ${symbol}.`);
      return [];
    }

    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    if (!this.supportedSymbols.includes(canonical)) {
      logger.warn(`[UpstoxProvider] Unsupported NSE equity symbol for historical candles: ${symbol}`);
      return [];
    }

    const inst = InstrumentRegistry.getInstrument(canonical);
    const instrumentKey = inst?.providerKey || `NSE_EQ|${canonical}`;

    // Map BYTE interval to Upstox historical candle unit
    let upstoxInterval = 'day';
    let targetAggregationMs = 0;

    switch (interval) {
      case '1m':
        upstoxInterval = '1minute';
        break;
      case '5m':
        upstoxInterval = '1minute';
        targetAggregationMs = 5 * 60 * 1000;
        break;
      case '15m':
        upstoxInterval = '1minute';
        targetAggregationMs = 15 * 60 * 1000;
        break;
      case '1h':
        upstoxInterval = '30minute';
        targetAggregationMs = 60 * 60 * 1000;
        break;
      case '4h':
        upstoxInterval = '30minute';
        targetAggregationMs = 4 * 60 * 60 * 1000;
        break;
      case '1d':
        upstoxInterval = 'day';
        break;
      case '1w':
        upstoxInterval = 'week';
        break;
    }

    const today = new Date();
    const toDate = today.toISOString().split('T')[0];
    const daysBack = interval === '1d' || interval === '1w' ? 365 : 30;
    const fromDate = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const encodedKey = encodeURIComponent(instrumentKey);
    const url = `${config.upstox.baseUrl}/v2/historical-candle/${encodedKey}/${upstoxInterval}/${toDate}/${fromDate}`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.upstox.accessToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          this.lastError = 'Upstox token expired or unauthorized.';
        }
        logger.warn(`[UpstoxProvider] Historical candle HTTP error: ${res.status}`);
        return [];
      }

      const resJson = (await res.json()) as any;
      const rawCandles = resJson?.data?.candles;
      if (!Array.isArray(rawCandles) || rawCandles.length === 0) return [];

      let candles: Candle[] = rawCandles.map((c: any[]) => ({
        timestamp: new Date(c[0]).getTime(),
        open: Number(c[1]),
        high: Number(c[2]),
        low: Number(c[3]),
        close: Number(c[4]),
        volume: Number(c[5] || 0),
        source: 'UPSTOX_V3',
      })).sort((a, b) => a.timestamp - b.timestamp);

      if (targetAggregationMs > 0) {
        candles = UpstoxMarketDataProvider.aggregateCandles(candles, targetAggregationMs, 'UPSTOX_V3');
      }

      return candles.slice(-limit);
    } catch (err: any) {
      logger.warn(`[UpstoxProvider] Failed to fetch historical candles for ${symbol}: ${err.message}`);
      return [];
    }
  }


  public async startStreaming(onQuote: (quote: MarketQuote) => void): Promise<void> {
    this.onQuoteCallback = onQuote;
    this.isStreaming = true;

    if (!this.hasCredentials()) {
      logger.info('[UpstoxProvider] Skipping live stream (no token). Operating in PREVIEW mode.');
      return;
    }

    // Upstox developer polling for LTP quotes (respects exchange rate limits)
    this.pollInterval = setInterval(async () => {
      try {
        await this.fetchRestSnapshot();
      } catch (err: any) {
        this.lastError = err.response?.data?.message || err.message;
        logger.debug(`[UpstoxProvider] Polling cycle error: ${this.lastError}`);
      }
    }, 10000);
  }

  public async stopStreaming(): Promise<void> {
    this.isStreaming = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    logger.info('[UpstoxProvider] Stopped streaming.');
  }

  public getStatus(): ProviderHealthStatus {
    const hasToken = this.hasCredentials();
    const hasLiveUpdates = this.lastUpdateTimestamp > 0;

    let status: 'LIVE' | 'DELAYED' | 'STALE' | 'PREVIEW' | 'UNAVAILABLE' = 'PREVIEW';
    if (hasToken && hasLiveUpdates) {
      status = this.lastError ? 'DELAYED' : 'LIVE';
    } else {
      status = 'PREVIEW';
    }

    return {
      name: this.name,
      connected: hasToken && hasLiveUpdates && !this.lastError,
      status,
      lastUpdateTimestamp: this.lastUpdateTimestamp,
      error: this.lastError,
      redistributionNotice: UpstoxMarketDataProvider.REGULATORY_DISCLAIMER,
    };
  }

  public hasCredentials(): boolean {
    return Boolean(config.upstox.accessToken && config.upstox.accessToken.trim().length > 0);
  }

  public async fetchRestSnapshot(): Promise<void> {
    if (!this.hasCredentials()) {
      this.populateBaselineQuotes();
      return;
    }

    const instrumentKeys = this.supportedSymbols
      .map((sym) => {
        const inst = InstrumentRegistry.getInstrument(sym);
        return inst?.providerKey || `NSE_EQ|${sym}`;
      })
      .join(',');

    const url = `${config.upstox.baseUrl}/v3/market-quote/ltp?instrument_key=${encodeURIComponent(instrumentKeys)}`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.upstox.accessToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          this.lastError = 'Upstox token expired or unauthorized. Re-authenticate in developer portal.';
        } else {
          this.lastError = `Upstox HTTP error: ${res.status}`;
        }
        this.populateBaselineQuotes();
        return;
      }

      const resJson = await res.json() as any;
      const data = resJson?.data;
      if (!data || typeof data !== 'object') {
        this.populateBaselineQuotes();
        return;
      }

      for (const sym of this.supportedSymbols) {
        const inst = InstrumentRegistry.getInstrument(sym);
        const key = inst?.providerKey || `NSE_EQ|${sym}`;
        const item = data[key] || data[key.replace('|', ':')] || data[`NSE_EQ:${sym}`];

        if (item && typeof item.last_price === 'number') {
          const quote = this.normalizeUpstoxItem(sym, item);
          this.lastQuoteMap.set(sym, quote);
          this.lastUpdateTimestamp = Date.now();
          if (this.onQuoteCallback) {
            this.onQuoteCallback(quote);
          }
        }
      }
      this.lastError = undefined;
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        this.lastError = 'Upstox token expired or unauthorized. Re-authenticate in developer portal.';
      } else {
        this.lastError = err.response?.data?.message || err.message || 'Upstox API request failed';
      }
      this.populateBaselineQuotes();
    }
  }

  public normalizeUpstoxItem(symbol: string, item: any): MarketQuote {
    const inst = InstrumentRegistry.getInstrument(symbol);
    const baseline = inst?.baselinePrice || 1000;
    const priceNum = typeof item.last_price === 'number' ? item.last_price : baseline;
    const prevClose = typeof item.cp === 'number' ? item.cp : undefined;
    const volNum = typeof item.volume === 'number' ? item.volume : undefined;

    const change = prevClose ? priceNum - prevClose : 0;
    const changePercent = prevClose && prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      symbol,
      exchange: 'NSE',
      assetType: 'EQUITY',
      currency: 'INR',
      price: priceNum,
      priceStr: priceNum.toFixed(2),
      previousClose: prevClose,
      volume: volNum,
      change,
      changePercent,
      source: 'UPSTOX_V3',
      sourceTimestamp: Date.now(),
      receivedTimestamp: Date.now(),
      status: this.hasCredentials() && !this.lastError ? 'LIVE' : 'PREVIEW',
      regulatoryNotice: UpstoxMarketDataProvider.REGULATORY_DISCLAIMER,
    };
  }

  public populateBaselineQuotes(): void {
    for (const sym of this.supportedSymbols) {
      if (!this.lastQuoteMap.has(sym)) {
        const inst = InstrumentRegistry.getInstrument(sym);
        const baseline = inst?.baselinePrice || 1000;
        this.lastQuoteMap.set(sym, {
          symbol: sym,
          exchange: 'NSE',
          assetType: 'EQUITY',
          currency: 'INR',
          price: baseline,
          priceStr: baseline.toFixed(2),
          open: baseline,
          high: baseline * 1.01,
          low: baseline * 0.99,
          volume: 1250000,
          change: 0,
          changePercent: 0,
          source: 'UPSTOX_V3',
          sourceTimestamp: Date.now(),
          receivedTimestamp: Date.now(),
          status: 'PREVIEW',
          regulatoryNotice: UpstoxMarketDataProvider.REGULATORY_DISCLAIMER,
        });
      }
    }
  }
}
