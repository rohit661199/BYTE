import { WebSocket } from 'ws';
import { IMarketDataProvider } from './IMarketDataProvider.js';
import { MarketQuote, ProviderHealthStatus, Candle, CandleInterval } from '../../types/marketData.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { InstrumentRegistry } from '../InstrumentRegistry.js';

export class AlpacaMarketDataProvider implements IMarketDataProvider {
  public readonly name = 'AlpacaMarketDataProvider';
  public readonly supportedSymbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN'];

  private ws: WebSocket | null = null;
  private isStreaming = false;
  private isAuthenticated = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectDelay = 30000;
  private lastQuoteMap = new Map<string, MarketQuote>();
  private lastUpdateTimestamp = 0;
  private lastError?: string;
  private onQuoteCallback: ((quote: MarketQuote) => void) | null = null;

  public async initialize(): Promise<void> {
    if (!this.hasCredentials()) {
      this.lastError = 'Missing ALPACA_API_KEY or ALPACA_API_SECRET in environment';
      logger.info(`[AlpacaProvider] ${this.lastError}. Operating in PREVIEW mode with baseline quotes.`);
      this.populateBaselineQuotes();
      return;
    }

    try {
      await this.fetchRestSnapshot();
      logger.info('[AlpacaProvider] Initialized successfully via Alpaca IEX REST bars.');
    } catch (err: any) {
      this.lastError = err.response?.data?.message || err.message || 'REST bars request failed';
      logger.warn(`[AlpacaProvider] Initial REST snapshot warning: ${this.lastError}. Operating in PREVIEW fallback.`);
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

  public static aggregateCandles(candles: Candle[], targetIntervalMs: number, sourceName?: string): Candle[] {
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
        source: sourceName || list[0].source || 'ALPACA_IEX',
      });
    }

    return aggregated;
  }

  public async getHistoricalCandles(symbol: string, interval: CandleInterval, limit = 100): Promise<Candle[]> {
    if (!this.hasCredentials()) {
      logger.info(`[AlpacaProvider] No credentials configured. Returning empty historical bars for ${symbol}.`);
      return [];
    }

    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    if (!this.supportedSymbols.includes(canonical)) {
      logger.warn(`[AlpacaProvider] Unsupported US equity symbol for historical bars: ${symbol}`);
      return [];
    }

    const timeframeMap: Record<CandleInterval, string> = {
      '1m': '1Min',
      '5m': '5Min',
      '15m': '15Min',
      '1h': '1Hour',
      '4h': '1Hour',
      '1d': '1Day',
      '1w': '1Week',
    };

    const timeframe = timeframeMap[interval] || '1Day';
    const fetchLimit = interval === '4h' ? Math.min(Math.max(limit * 4, 4), 1000) : Math.min(Math.max(limit, 1), 1000);
    const url = `${config.alpaca.baseUrl}/v2/stocks/bars?symbols=${canonical}&timeframe=${timeframe}&limit=${fetchLimit}&feed=${config.alpaca.dataFeed}&sort=asc`;

    try {
      const res = await fetch(url, {
        headers: {
          'APCA-API-KEY-ID': config.alpaca.apiKey,
          'APCA-API-SECRET-KEY': config.alpaca.apiSecret,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        logger.warn(`[AlpacaProvider] Historical bars HTTP error: ${res.status}`);
        return [];
      }

      const data = (await res.json()) as any;
      const rawBars = data?.bars?.[canonical];
      if (!Array.isArray(rawBars) || rawBars.length === 0) return [];

      let candles: Candle[] = rawBars.map((b: any) => ({
        timestamp: new Date(b.t).getTime(),
        open: Number(b.o),
        high: Number(b.h),
        low: Number(b.l),
        close: Number(b.c),
        volume: Number(b.v || 0),
        source: 'ALPACA_IEX',
      })).sort((a, b) => a.timestamp - b.timestamp);

      if (interval === '4h') {
        candles = AlpacaMarketDataProvider.aggregateCandles(candles, 4 * 60 * 60 * 1000, 'ALPACA_IEX');
      }

      return candles.slice(-limit);
    } catch (err: any) {
      logger.warn(`[AlpacaProvider] Failed to fetch historical bars for ${symbol}: ${err.message}`);
      return [];
    }
  }


  public async startStreaming(onQuote: (quote: MarketQuote) => void): Promise<void> {
    this.onQuoteCallback = onQuote;
    this.isStreaming = true;

    if (!this.hasCredentials()) {
      logger.info('[AlpacaProvider] Skipping WebSocket connection (no credentials). Live stream paused.');
      return;
    }

    this.connectWebSocket();
  }

  public async stopStreaming(): Promise<void> {
    this.isStreaming = false;
    this.isAuthenticated = false;
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
    logger.info('[AlpacaProvider] Stopped streaming.');
  }

  public getStatus(): ProviderHealthStatus {
    const hasKeys = this.hasCredentials();
    const isConnected = this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated;
    return {
      name: this.name,
      connected: isConnected,
      status: !hasKeys ? 'PREVIEW' : isConnected ? 'LIVE' : this.lastQuoteMap.size > 0 ? 'DELAYED' : 'UNAVAILABLE',
      lastUpdateTimestamp: this.lastUpdateTimestamp,
      error: this.lastError,
      redistributionNotice: 'Alpaca free tier provides unconsolidated IEX exchange quotes (not full US consolidated tape).',
    };
  }

  public hasCredentials(): boolean {
    return Boolean(config.alpaca.apiKey && config.alpaca.apiSecret);
  }

  public async fetchRestSnapshot(): Promise<void> {
    if (!this.hasCredentials()) {
      this.populateBaselineQuotes();
      return;
    }

    const symbolsParam = this.supportedSymbols.join(',');
    const url = `${config.alpaca.baseUrl}/v2/stocks/bars/latest?symbols=${symbolsParam}&feed=${config.alpaca.dataFeed}`;
    const res = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': config.alpaca.apiKey,
        'APCA-API-SECRET-KEY': config.alpaca.apiSecret,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`Alpaca API error: ${res.status}`);
    }

    const data = await res.json() as any;
    const bars = data?.bars;
    if (!bars || typeof bars !== 'object') return;

    for (const symbol of this.supportedSymbols) {
      const bar = bars[symbol];
      if (bar) {
        const quote = this.normalizeBarData(symbol, bar);
        this.lastQuoteMap.set(symbol, quote);
        this.lastUpdateTimestamp = Date.now();
        if (this.onQuoteCallback) {
          this.onQuoteCallback(quote);
        }
      }
    }
  }

  private connectWebSocket(): void {
    if (!this.isStreaming || !this.hasCredentials()) return;

    try {
      this.ws = new WebSocket(config.alpaca.wsUrl);

      this.ws.on('open', () => {
        logger.info('[AlpacaProvider] WebSocket connected. Authenticating with IEX stream...');
        this.reconnectAttempts = 0;
        this.sendAuth();
      });

      this.ws.on('message', (data: any) => {
        try {
          const messages = JSON.parse(data.toString());
          if (!Array.isArray(messages)) return;

          for (const msg of messages) {
            this.handleWebSocketMessage(msg);
          }
        } catch (err: any) {
          logger.debug(`[AlpacaProvider] WS message parse error: ${err.message}`);
        }
      });

      this.ws.on('error', (err: any) => {
        this.lastError = err.message || 'WebSocket error';
        logger.warn(`[AlpacaProvider] WebSocket error: ${this.lastError}`);
      });

      this.ws.on('close', () => {
        this.ws = null;
        this.isAuthenticated = false;
        if (this.isStreaming && config.marketData.reconnect && this.hasCredentials()) {
          this.scheduleReconnect();
        }
      });
    } catch (err: any) {
      this.lastError = err.message || 'WebSocket connection error';
      logger.error(`[AlpacaProvider] Connection failed: ${this.lastError}`);
      this.scheduleReconnect();
    }
  }

  private sendAuth(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const authMsg = {
      action: 'auth',
      key: config.alpaca.apiKey,
      secret: config.alpaca.apiSecret,
    };
    this.ws.send(JSON.stringify(authMsg));
  }

  private sendSubscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const subMsg = {
      action: 'subscribe',
      bars: this.supportedSymbols,
      quotes: this.supportedSymbols,
    };
    this.ws.send(JSON.stringify(subMsg));
    logger.info(`[AlpacaProvider] Subscribed to IEX quotes and bars for: ${this.supportedSymbols.join(', ')}`);
  }

  private handleWebSocketMessage(msg: any): void {
    if (msg.T === 'success' && msg.msg === 'connected') {
      logger.info('[AlpacaProvider] Authentication successful on IEX stream.');
      this.isAuthenticated = true;
      this.lastError = undefined;
      this.sendSubscribe();
      return;
    }

    if (msg.T === 'error') {
      this.lastError = `Alpaca Stream Error (${msg.code}): ${msg.msg}`;
      logger.warn(`[AlpacaProvider] ${this.lastError}`);
      if (msg.code === 402 || msg.code === 406) {
        this.isAuthenticated = false;
      }
      return;
    }

    // Handle bar update ('b')
    if (msg.T === 'b' && msg.S) {
      const quote = this.normalizeBarData(msg.S, msg);
      this.lastQuoteMap.set(msg.S, quote);
      this.lastUpdateTimestamp = Date.now();
      if (this.onQuoteCallback) {
        this.onQuoteCallback(quote);
      }
      return;
    }

    // Handle quote update ('q')
    if (msg.T === 'q' && msg.S) {
      const quote = this.normalizeQuoteData(msg.S, msg);
      this.lastQuoteMap.set(msg.S, quote);
      this.lastUpdateTimestamp = Date.now();
      if (this.onQuoteCallback) {
        this.onQuoteCallback(quote);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.isStreaming || !this.hasCredentials()) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    logger.info(`[AlpacaProvider] Reconnecting in ${delay}ms (attempt #${this.reconnectAttempts})...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  public normalizeBarData(symbol: string, bar: any): MarketQuote {
    const inst = InstrumentRegistry.getInstrument(symbol);
    const baseline = inst?.baselinePrice || 200;
    const priceNum = typeof bar.c === 'number' ? bar.c : baseline;
    const openNum = typeof bar.o === 'number' ? bar.o : undefined;
    const highNum = typeof bar.h === 'number' ? bar.h : undefined;
    const lowNum = typeof bar.l === 'number' ? bar.l : undefined;
    const volNum = typeof bar.v === 'number' ? bar.v : undefined;

    const change = openNum ? priceNum - openNum : 0;
    const changePercent = openNum && openNum > 0 ? (change / openNum) * 100 : 0;
    const timestamp = bar.t ? new Date(bar.t).getTime() : Date.now();

    return {
      symbol,
      exchange: 'NASDAQ',
      assetType: 'EQUITY',
      currency: 'USD',
      price: priceNum,
      priceStr: priceNum.toFixed(2),
      open: openNum,
      high: highNum,
      low: lowNum,
      volume: volNum,
      change,
      changePercent,
      source: 'ALPACA_IEX',
      sourceTimestamp: timestamp,
      receivedTimestamp: Date.now(),
      status: this.hasCredentials() ? 'LIVE' : 'PREVIEW',
      regulatoryNotice: 'Unconsolidated IEX market data. Does not represent complete consolidated US market volume.',
    };
  }

  public normalizeQuoteData(symbol: string, quote: any): MarketQuote {
    const inst = InstrumentRegistry.getInstrument(symbol);
    const baseline = inst?.baselinePrice || 200;
    const bp = typeof quote.bp === 'number' ? quote.bp : 0;
    const ap = typeof quote.ap === 'number' ? quote.ap : 0;
    const midPrice = bp > 0 && ap > 0 ? (bp + ap) / 2 : ap || bp || baseline;
    const timestamp = quote.t ? new Date(quote.t).getTime() : Date.now();

    const existing = this.lastQuoteMap.get(symbol);
    const change = existing?.open ? midPrice - existing.open : existing?.change || 0;
    const changePercent = existing?.open && existing.open > 0 ? (change / existing.open) * 100 : existing?.changePercent || 0;

    return {
      symbol,
      exchange: 'NASDAQ',
      assetType: 'EQUITY',
      currency: 'USD',
      price: midPrice,
      priceStr: midPrice.toFixed(2),
      open: existing?.open,
      high: existing?.high && midPrice > existing.high ? midPrice : existing?.high,
      low: existing?.low && midPrice < existing.low ? midPrice : existing?.low,
      volume: existing?.volume,
      change,
      changePercent,
      source: 'ALPACA_IEX',
      sourceTimestamp: timestamp,
      receivedTimestamp: Date.now(),
      status: this.hasCredentials() ? 'LIVE' : 'PREVIEW',
      regulatoryNotice: 'Unconsolidated IEX market data. Does not represent complete consolidated US market volume.',
    };
  }

  public populateBaselineQuotes(): void {
    for (const sym of this.supportedSymbols) {
      if (!this.lastQuoteMap.has(sym)) {
        const inst = InstrumentRegistry.getInstrument(sym);
        const baseline = inst?.baselinePrice || 200;
        this.lastQuoteMap.set(sym, {
          symbol: sym,
          exchange: 'NASDAQ',
          assetType: 'EQUITY',
          currency: 'USD',
          price: baseline,
          priceStr: baseline.toFixed(2),
          open: baseline,
          high: baseline * 1.005,
          low: baseline * 0.995,
          volume: 2500000,
          change: 0,
          changePercent: 0,
          source: 'ALPACA_IEX',
          sourceTimestamp: Date.now(),
          receivedTimestamp: Date.now(),
          status: 'PREVIEW',
          regulatoryNotice: 'Preview market data. Configure ALPACA_API_KEY and ALPACA_API_SECRET in .env for live IEX feed.',
        });
      }
    }
  }
}
