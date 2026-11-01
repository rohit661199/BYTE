import { WebSocket } from 'ws';
import { IMarketDataProvider } from './IMarketDataProvider.js';
import { MarketQuote, ProviderHealthStatus, Candle, CandleInterval } from '../../types/marketData.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { InstrumentRegistry } from '../InstrumentRegistry.js';

export class BinanceMarketDataProvider implements IMarketDataProvider {
  public readonly name = 'BinanceMarketDataProvider';
  public readonly supportedSymbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];

  private readonly symbolToPairMap: Record<string, string> = {
    'BTC-USD': 'BTCUSDT',
    'ETH-USD': 'ETHUSDT',
    'SOL-USD': 'SOLUSDT',
  };

  private readonly pairToSymbolMap: Record<string, string> = {
    BTCUSDT: 'BTC-USD',
    ETHUSDT: 'ETH-USD',
    SOLUSDT: 'SOL-USD',
  };

  private ws: WebSocket | null = null;
  private isStreaming = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectDelay = 30000;
  private lastQuoteMap = new Map<string, MarketQuote>();
  private lastUpdateTimestamp = 0;
  private lastError?: string;
  private onQuoteCallback: ((quote: MarketQuote) => void) | null = null;

  public async initialize(): Promise<void> {
    try {
      await this.fetchRestSnapshot();
      logger.info('[BinanceProvider] Initialized successfully via public REST snapshot.');
    } catch (err: any) {
      this.lastError = err.message || 'REST snapshot failed';
      logger.warn(`[BinanceProvider] Initial REST snapshot warning: ${this.lastError}. Will fallback to streaming or baseline.`);
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

  public async getHistoricalCandles(symbol: string, interval: CandleInterval, limit = 100): Promise<Candle[]> {
    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    const pair = this.symbolToPairMap[canonical];
    if (!pair) {
      logger.warn(`[BinanceProvider] Unsupported crypto symbol for historical candles: ${symbol}`);
      return [];
    }

    const intervalMap: Record<CandleInterval, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
      '1w': '1w',
    };

    const binanceInterval = intervalMap[interval] || '1h';
    const clampedLimit = Math.min(Math.max(limit, 1), 1000);
    const url = `${config.binance.restUrl}/api/v3/klines?symbol=${pair}&interval=${binanceInterval}&limit=${clampedLimit}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        logger.warn(`[BinanceProvider] Historical klines HTTP error: ${res.status}`);
        return [];
      }

      const data = (await res.json()) as any[];
      if (!Array.isArray(data)) return [];

      return data.map((item: any[]) => ({
        timestamp: Number(item[0]),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
        source: 'BINANCE_PUBLIC',
      })).sort((a, b) => a.timestamp - b.timestamp);
    } catch (err: any) {
      logger.warn(`[BinanceProvider] Failed to fetch historical candles for ${symbol}: ${err.message}`);
      return [];
    }
  }


  public async startStreaming(onQuote: (quote: MarketQuote) => void): Promise<void> {
    this.onQuoteCallback = onQuote;
    this.isStreaming = true;
    this.connectWebSocket();
  }

  public async stopStreaming(): Promise<void> {
    this.isStreaming = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.on('error', () => {});
        this.ws.removeAllListeners();
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        } else {
          this.ws.terminate();
        }
      } catch (_) {
        // Safe close
      }
      this.ws = null;
    }
    logger.info('[BinanceProvider] Stopped streaming.');
  }

  public getStatus(): ProviderHealthStatus {
    const isConnected = this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    return {
      name: this.name,
      connected: isConnected,
      status: isConnected ? 'LIVE' : this.lastQuoteMap.size > 0 ? 'DELAYED' : 'UNAVAILABLE',
      lastUpdateTimestamp: this.lastUpdateTimestamp,
      error: this.lastError,
    };
  }

  public async fetchRestSnapshot(): Promise<void> {
    const pairs = Object.values(this.symbolToPairMap);
    const symbolsParam = encodeURIComponent(JSON.stringify(pairs));
    const url = `${config.binance.restUrl}/api/v3/ticker/24hr?symbols=${symbolsParam}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Binance HTTP error: ${res.status}`);
    const data = await res.json() as any[];
    if (!Array.isArray(data)) return;

    for (const item of data) {
      const canonical = this.pairToSymbolMap[item.symbol];
      if (!canonical) continue;

      const quote = this.normalizeTickerData({
        s: item.symbol,
        c: item.lastPrice,
        o: item.openPrice,
        h: item.highPrice,
        l: item.lowPrice,
        v: item.volume,
        p: item.priceChange,
        P: item.priceChangePercent,
        x: item.prevClosePrice,
        E: item.closeTime || Date.now(),
      });

      this.lastQuoteMap.set(canonical, quote);
      this.lastUpdateTimestamp = Date.now();
      if (this.onQuoteCallback) {
        this.onQuoteCallback(quote);
      }
    }
  }

  private connectWebSocket(): void {
    if (!this.isStreaming) return;

    const streams = Object.values(this.symbolToPairMap)
      .map((p) => `${p.toLowerCase()}@ticker`)
      .join('/');

    const wsUrl = `${config.binance.wsUrl}/stream?streams=${streams}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        logger.info('[BinanceProvider] WebSocket connected to public multiplex stream.');
        this.reconnectAttempts = 0;
        this.lastError = undefined;
      });

      this.ws.on('message', (data: any) => {
        try {
          const raw = JSON.parse(data.toString());
          if (raw?.data && raw.data.s) {
            const canonical = this.pairToSymbolMap[raw.data.s];
            if (canonical) {
              const quote = this.normalizeTickerData(raw.data);
              this.lastQuoteMap.set(canonical, quote);
              this.lastUpdateTimestamp = Date.now();
              if (this.onQuoteCallback) {
                this.onQuoteCallback(quote);
              }
            }
          }
        } catch (err: any) {
          logger.debug(`[BinanceProvider] WS message parse error: ${err.message}`);
        }
      });

      this.ws.on('error', (err: any) => {
        this.lastError = err.message || 'WebSocket error';
        logger.warn(`[BinanceProvider] WebSocket error: ${this.lastError}`);
      });

      this.ws.on('close', () => {
        this.ws = null;
        if (this.isStreaming && config.marketData.reconnect) {
          this.scheduleReconnect();
        }
      });
    } catch (err: any) {
      this.lastError = err.message || 'WebSocket connection creation failed';
      logger.error(`[BinanceProvider] Connection failed: ${this.lastError}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.isStreaming) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    logger.info(`[BinanceProvider] Reconnecting in ${delay}ms (attempt #${this.reconnectAttempts})...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  public normalizeTickerData(raw: {
    s: string;
    c: string;
    o?: string;
    h?: string;
    l?: string;
    v?: string;
    p?: string;
    P?: string;
    x?: string;
    E?: number;
  }): MarketQuote {
    const canonical = this.pairToSymbolMap[raw.s] || raw.s;
    const priceNum = parseFloat(raw.c) || 0;
    const openNum = raw.o ? parseFloat(raw.o) : undefined;
    const highNum = raw.h ? parseFloat(raw.h) : undefined;
    const lowNum = raw.l ? parseFloat(raw.l) : undefined;
    const volNum = raw.v ? parseFloat(raw.v) : undefined;
    const changeNum = raw.p ? parseFloat(raw.p) : undefined;
    const changePercentNum = raw.P ? parseFloat(raw.P) : undefined;
    const prevCloseNum = raw.x ? parseFloat(raw.x) : undefined;

    return {
      symbol: canonical,
      exchange: 'BINANCE',
      assetType: 'CRYPTO',
      currency: 'USD',
      price: priceNum,
      priceStr: priceNum.toFixed(2),
      previousClose: prevCloseNum,
      open: openNum,
      high: highNum,
      low: lowNum,
      volume: volNum,
      change: changeNum,
      changePercent: changePercentNum,
      source: 'BINANCE_PUBLIC',
      sourceTimestamp: raw.E || Date.now(),
      receivedTimestamp: Date.now(),
      status: 'LIVE',
    };
  }

  private populateBaselineQuotes(): void {
    for (const sym of this.supportedSymbols) {
      if (!this.lastQuoteMap.has(sym)) {
        const inst = InstrumentRegistry.getInstrument(sym);
        const baseline = inst?.baselinePrice || 100;
        this.lastQuoteMap.set(sym, {
          symbol: sym,
          exchange: 'BINANCE',
          assetType: 'CRYPTO',
          currency: 'USD',
          price: baseline,
          priceStr: baseline.toFixed(2),
          open: baseline,
          high: baseline * 1.01,
          low: baseline * 0.99,
          volume: 50000,
          change: 0,
          changePercent: 0,
          source: 'BINANCE_PUBLIC',
          sourceTimestamp: Date.now(),
          receivedTimestamp: Date.now(),
          status: 'PREVIEW',
        });
      }
    }
  }
}
