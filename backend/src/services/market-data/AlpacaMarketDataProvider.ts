import { WebSocket } from 'ws';
import { IMarketDataProvider } from './IMarketDataProvider.js';
import { MarketQuote, ProviderHealthStatus, Candle, CandleInterval, DataStatus } from '../../types/marketData.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { InstrumentRegistry } from '../InstrumentRegistry.js';

export class AlpacaMarketDataProvider implements IMarketDataProvider {
  public readonly name = 'AlpacaMarketDataProvider';
  public readonly supportedSymbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN'];

  // Shared WebSocket connection singleton across all instances
  public static sharedWs: WebSocket | null = null;
  public static sharedIsConnecting = false;
  public static sharedIsAuthenticated = false;
  public static sharedConnectionLimitExceeded = false;
  public static sharedSubscribedSymbols = new Set<string>();
  public static sharedListeners = new Set<(quote: MarketQuote) => void>();
  public static sharedReconnectTimer: NodeJS.Timeout | null = null;
  public static sharedReconnectAttempts = 0;
  public static readonly maxReconnectDelay = 30000;
  public static lastStreamUpdateTimestamp = 0;
  public static sharedLastError?: string;
  public static initPromise: Promise<void> | null = null;
  public static wsFactory: (url: string) => any = (url: string) => new WebSocket(url);

  public get ws(): WebSocket | null {
    return AlpacaMarketDataProvider.sharedWs;
  }

  public get isAuthenticated(): boolean {
    return AlpacaMarketDataProvider.sharedIsAuthenticated;
  }

  public get reconnectTimer(): NodeJS.Timeout | null {
    return AlpacaMarketDataProvider.sharedReconnectTimer;
  }

  private lastQuoteMap = new Map<string, MarketQuote>();
  private lastUpdateTimestamp = 0;
  private lastError?: string;
  private onQuoteCallback: ((quote: MarketQuote) => void) | null = null;

  public static resetSharedState(): void {
    if (this.sharedReconnectTimer) {
      clearTimeout(this.sharedReconnectTimer);
      this.sharedReconnectTimer = null;
    }
    if (this.sharedWs) {
      try {
        this.sharedWs.on('error', () => {});
        this.sharedWs.removeAllListeners();
        if (this.sharedWs.readyState === WebSocket.OPEN) {
          this.sharedWs.close();
        } else {
          this.sharedWs.terminate();
        }
      } catch (_) {}
      this.sharedWs = null;
    }
    this.sharedIsConnecting = false;
    this.sharedIsAuthenticated = false;
    this.sharedConnectionLimitExceeded = false;
    this.sharedSubscribedSymbols.clear();
    this.sharedListeners.clear();
    this.sharedReconnectAttempts = 0;
    this.lastStreamUpdateTimestamp = 0;
    this.sharedLastError = undefined;
    this.initPromise = null;
  }

  public async initialize(): Promise<void> {
    if (!this.hasCredentials()) {
      this.lastError = 'Missing ALPACA_API_KEY or ALPACA_API_SECRET in environment';
      logger.info(`[AlpacaProvider] ${this.lastError}. Operating in PREVIEW mode with baseline quotes.`);
      this.populateBaselineQuotes();
      return;
    }

    if (AlpacaMarketDataProvider.initPromise) {
      await AlpacaMarketDataProvider.initPromise;
      return;
    }

    AlpacaMarketDataProvider.initPromise = (async () => {
      try {
        await this.fetchRestSnapshot();
        logger.info('[AlpacaProvider] Initialized successfully via Alpaca IEX REST bars.');
      } catch (err: any) {
        this.lastError = err.response?.data?.message || err.message || 'REST bars request failed';
        logger.warn(`[AlpacaProvider] Initial REST snapshot warning: ${this.lastError}. Operating in PREVIEW fallback.`);
        this.populateBaselineQuotes();
      }
    })().finally(() => {
      AlpacaMarketDataProvider.initPromise = null;
    });

    await AlpacaMarketDataProvider.initPromise;
  }

  public async getLatestQuote(symbol: string): Promise<MarketQuote | null> {
    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    return this.lastQuoteMap.get(canonical) || null;
  }

  public async getLatestQuotes(): Promise<MarketQuote[]> {
    return Array.from(this.lastQuoteMap.values());
  }

  public static calculateDateRange(
    interval: CandleInterval,
    limit: number,
    now: Date = new Date()
  ): { start: string; end: string } {
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    let daysBack = 7;

    switch (interval) {
      case '1m':
      case '5m':
      case '15m': {
        const barsPerDay = interval === '1m' ? 390 : interval === '5m' ? 78 : 26;
        const tradingDaysNeeded = Math.ceil(safeLimit / barsPerDay);
        daysBack = Math.max(tradingDaysNeeded * 2 + 4, 7);
        break;
      }
      case '1h': {
        const tradingDaysNeeded = Math.ceil(safeLimit / 6.5);
        daysBack = Math.max(tradingDaysNeeded * 2 + 4, 7);
        break;
      }
      case '4h': {
        const tradingDaysNeeded = Math.ceil((safeLimit * 4) / 6.5);
        daysBack = Math.max(tradingDaysNeeded * 2 + 4, 10);
        break;
      }
      case '1d': {
        daysBack = Math.max(Math.ceil(safeLimit * 2) + 7, 14);
        break;
      }
      case '1w': {
        daysBack = Math.max(Math.ceil(safeLimit * 7 * 1.5) + 14, 30);
        break;
      }
      default:
        daysBack = Math.max(safeLimit * 2, 7);
    }

    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    return {
      start: startDate.toISOString(),
      end: now.toISOString(),
    };
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
    const dateRange = AlpacaMarketDataProvider.calculateDateRange(interval, fetchLimit);

    const url = `${config.alpaca.baseUrl}/v2/stocks/bars?symbols=${canonical}&timeframe=${timeframe}&start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}&limit=${fetchLimit}&feed=${config.alpaca.dataFeed}&sort=desc`;

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
    if (this.onQuoteCallback) {
      AlpacaMarketDataProvider.sharedListeners.delete(this.onQuoteCallback);
    }
    this.onQuoteCallback = onQuote;
    AlpacaMarketDataProvider.sharedListeners.add(onQuote);

    for (const sym of this.supportedSymbols) {
      AlpacaMarketDataProvider.sharedSubscribedSymbols.add(sym);
    }

    if (!this.hasCredentials()) {
      logger.info('[AlpacaProvider] Skipping WebSocket connection (no credentials). Live stream paused.');
      return;
    }

    if (AlpacaMarketDataProvider.sharedConnectionLimitExceeded) {
      // If a caller explicitly calls startStreaming, allow a fresh recovery attempt if not currently active
      if (!AlpacaMarketDataProvider.sharedWs && !AlpacaMarketDataProvider.sharedIsConnecting) {
        logger.info('[AlpacaProvider] Retrying IEX stream connection after previous connection limit error...');
        AlpacaMarketDataProvider.sharedConnectionLimitExceeded = false;
        if (AlpacaMarketDataProvider.sharedReconnectTimer) {
          clearTimeout(AlpacaMarketDataProvider.sharedReconnectTimer);
          AlpacaMarketDataProvider.sharedReconnectTimer = null;
        }
      } else {
        logger.warn('[AlpacaProvider] Connection limit exceeded on Alpaca stream. Skipping connection attempt to protect account.');
        return;
      }
    }

    if (AlpacaMarketDataProvider.sharedWs && AlpacaMarketDataProvider.sharedWs.readyState === WebSocket.OPEN) {
      if (AlpacaMarketDataProvider.sharedIsAuthenticated) {
        this.sendSharedSubscribe();
      }
      return;
    }

    if (AlpacaMarketDataProvider.sharedIsConnecting) {
      return;
    }

    this.connectSharedWebSocket();
  }

  public async stopStreaming(): Promise<void> {
    if (this.onQuoteCallback) {
      AlpacaMarketDataProvider.sharedListeners.delete(this.onQuoteCallback);
      this.onQuoteCallback = null;
    }

    // Only close underlying socket if all listeners across all instances have detached
    if (AlpacaMarketDataProvider.sharedListeners.size === 0) {
      if (AlpacaMarketDataProvider.sharedReconnectTimer) {
        clearTimeout(AlpacaMarketDataProvider.sharedReconnectTimer);
        AlpacaMarketDataProvider.sharedReconnectTimer = null;
      }
      if (AlpacaMarketDataProvider.sharedWs) {
        try {
          AlpacaMarketDataProvider.sharedWs.on('error', () => {});
          AlpacaMarketDataProvider.sharedWs.removeAllListeners();
          if (AlpacaMarketDataProvider.sharedWs.readyState === WebSocket.OPEN) {
            AlpacaMarketDataProvider.sharedWs.close();
          } else {
            AlpacaMarketDataProvider.sharedWs.terminate();
          }
        } catch (_) {}
        AlpacaMarketDataProvider.sharedWs = null;
      }
      AlpacaMarketDataProvider.sharedIsAuthenticated = false;
      AlpacaMarketDataProvider.sharedIsConnecting = false;
      AlpacaMarketDataProvider.sharedConnectionLimitExceeded = false;
      AlpacaMarketDataProvider.sharedSubscribedSymbols.clear();
      logger.info('[AlpacaProvider] Stopped shared streaming socket.');
    }
  }

  public getStatus(): ProviderHealthStatus {
    const hasKeys = this.hasCredentials();
    if (!hasKeys) {
      return {
        name: this.name,
        connected: false,
        status: 'PREVIEW',
        lastUpdateTimestamp: this.lastUpdateTimestamp,
        error: this.lastError,
        redistributionNotice: 'Alpaca free tier provides unconsolidated IEX exchange quotes (not full US consolidated tape).',
      };
    }

    const isConnected = AlpacaMarketDataProvider.sharedWs !== null &&
      AlpacaMarketDataProvider.sharedWs.readyState === WebSocket.OPEN &&
      AlpacaMarketDataProvider.sharedIsAuthenticated;

    const now = Date.now();
    const isStreamFresh = isConnected &&
      AlpacaMarketDataProvider.lastStreamUpdateTimestamp > 0 &&
      (now - AlpacaMarketDataProvider.lastStreamUpdateTimestamp < 60_000);

    let dataStatus: DataStatus = 'UNAVAILABLE';
    if (isStreamFresh) {
      dataStatus = 'LIVE';
    } else if (this.lastQuoteMap.size > 0 || isConnected) {
      dataStatus = 'DELAYED';
    }

    const err = this.lastError || AlpacaMarketDataProvider.sharedLastError;

    return {
      name: this.name,
      connected: isConnected,
      status: AlpacaMarketDataProvider.sharedConnectionLimitExceeded ? 'UNAVAILABLE' : dataStatus,
      lastUpdateTimestamp: Math.max(this.lastUpdateTimestamp, AlpacaMarketDataProvider.lastStreamUpdateTimestamp),
      error: err,
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
        const quote = this.normalizeBarData(symbol, bar, 'DELAYED');
        this.lastQuoteMap.set(symbol, quote);
        this.lastUpdateTimestamp = Date.now();
        if (this.onQuoteCallback) {
          this.onQuoteCallback(quote);
        }
      }
    }
  }

  private connectSharedWebSocket(): void {
    if (!this.hasCredentials() || AlpacaMarketDataProvider.sharedConnectionLimitExceeded) return;

    try {
      AlpacaMarketDataProvider.sharedIsConnecting = true;
      const factory = (this as any).wsConstructor
        ? (url: string) => new (this as any).wsConstructor(url)
        : AlpacaMarketDataProvider.wsFactory;

      const ws = factory(config.alpaca.wsUrl);
      AlpacaMarketDataProvider.sharedWs = ws;

      ws.on('open', () => {
        logger.info('[AlpacaProvider] WebSocket connected to IEX stream. Awaiting connection greeting...');
        AlpacaMarketDataProvider.sharedIsConnecting = false;
        AlpacaMarketDataProvider.sharedReconnectAttempts = 0;
      });

      ws.on('message', (data: any) => {
        try {
          const messages = JSON.parse(data.toString());
          if (!Array.isArray(messages)) return;

          for (const msg of messages) {
            this.handleSharedWebSocketMessage(msg);
          }
        } catch (err: any) {
          logger.debug(`[AlpacaProvider] WS message parse error: ${err.message}`);
        }
      });

      ws.on('error', (err: any) => {
        AlpacaMarketDataProvider.sharedLastError = err.message || 'WebSocket error';
        this.lastError = AlpacaMarketDataProvider.sharedLastError;
        logger.warn(`[AlpacaProvider] WebSocket error: ${AlpacaMarketDataProvider.sharedLastError}`);
      });

      ws.on('close', () => {
        AlpacaMarketDataProvider.sharedWs = null;
        AlpacaMarketDataProvider.sharedIsAuthenticated = false;
        AlpacaMarketDataProvider.sharedIsConnecting = false;

        if (
          !AlpacaMarketDataProvider.sharedConnectionLimitExceeded &&
          config.marketData.reconnect &&
          this.hasCredentials() &&
          AlpacaMarketDataProvider.sharedListeners.size > 0
        ) {
          this.scheduleSharedReconnect();
        }
      });
    } catch (err: any) {
      AlpacaMarketDataProvider.sharedIsConnecting = false;
      AlpacaMarketDataProvider.sharedLastError = err.message || 'WebSocket connection error';
      this.lastError = AlpacaMarketDataProvider.sharedLastError;
      logger.error(`[AlpacaProvider] Connection failed: ${this.lastError}`);
      if (!AlpacaMarketDataProvider.sharedConnectionLimitExceeded) {
        this.scheduleSharedReconnect();
      }
    }
  }

  private sendSharedAuth(): void {
    const ws = AlpacaMarketDataProvider.sharedWs;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const authMsg = {
      action: 'auth',
      key: config.alpaca.apiKey,
      secret: config.alpaca.apiSecret,
    };
    ws.send(JSON.stringify(authMsg));
  }

  private sendSharedSubscribe(): void {
    const ws = AlpacaMarketDataProvider.sharedWs;
    if (!ws || ws.readyState !== WebSocket.OPEN || !AlpacaMarketDataProvider.sharedIsAuthenticated) return;
    for (const sym of this.supportedSymbols) {
      AlpacaMarketDataProvider.sharedSubscribedSymbols.add(sym);
    }
    const symbols = Array.from(AlpacaMarketDataProvider.sharedSubscribedSymbols);
    const subMsg = {
      action: 'subscribe',
      bars: symbols,
      quotes: symbols,
    };
    ws.send(JSON.stringify(subMsg));
    logger.info(`[AlpacaProvider] Subscribed to IEX quotes and bars for: ${symbols.join(', ')}`);
  }

  private handleSharedWebSocketMessage(msg: any): void {
    // 1. Connection established greeting from Alpaca
    if (msg.T === 'success' && msg.msg === 'connected') {
      logger.info('[AlpacaProvider] Connection established with IEX stream. Sending authentication...');
      this.sendSharedAuth();
      return;
    }

    // 2. Authentication confirmed
    if (msg.T === 'success' && msg.msg === 'authenticated') {
      logger.info('[AlpacaProvider] Authentication successful on IEX stream. Subscribing to symbols...');
      AlpacaMarketDataProvider.sharedIsAuthenticated = true;
      AlpacaMarketDataProvider.sharedConnectionLimitExceeded = false;
      AlpacaMarketDataProvider.sharedLastError = undefined;
      this.lastError = undefined;
      this.sendSharedSubscribe();
      return;
    }

    // 3. Error message from Alpaca
    if (msg.T === 'error') {
      const errMsg = `Alpaca Stream Error (${msg.code}): ${msg.msg}`;
      AlpacaMarketDataProvider.sharedLastError = errMsg;
      this.lastError = errMsg;
      logger.warn(`[AlpacaProvider] ${errMsg}`);

      if (msg.code === 406) {
        // Connection limit exceeded — disable auto-reconnect to protect account
        AlpacaMarketDataProvider.sharedConnectionLimitExceeded = true;
        AlpacaMarketDataProvider.sharedIsAuthenticated = false;
        if (AlpacaMarketDataProvider.sharedReconnectTimer) {
          clearTimeout(AlpacaMarketDataProvider.sharedReconnectTimer);
          AlpacaMarketDataProvider.sharedReconnectTimer = null;
        }
        if (AlpacaMarketDataProvider.sharedWs) {
          try {
            AlpacaMarketDataProvider.sharedWs.close();
          } catch (_) {}
        }
        return;
      }

      if (msg.code === 401 || msg.code === 402) {
        AlpacaMarketDataProvider.sharedIsAuthenticated = false;
        if (AlpacaMarketDataProvider.sharedReconnectTimer) {
          clearTimeout(AlpacaMarketDataProvider.sharedReconnectTimer);
          AlpacaMarketDataProvider.sharedReconnectTimer = null;
        }
        return;
      }
      return;
    }

    // 4. Bar update ('b')
    if (msg.T === 'b' && msg.S) {
      const quote = this.normalizeBarData(msg.S, msg, 'LIVE');
      this.lastQuoteMap.set(msg.S, quote);
      this.lastUpdateTimestamp = Date.now();
      AlpacaMarketDataProvider.lastStreamUpdateTimestamp = Date.now();

      for (const listener of AlpacaMarketDataProvider.sharedListeners) {
        try {
          listener(quote);
        } catch (_) {}
      }
      return;
    }

    // 5. Quote update ('q')
    if (msg.T === 'q' && msg.S) {
      const quote = this.normalizeQuoteData(msg.S, msg, 'LIVE');
      this.lastQuoteMap.set(msg.S, quote);
      this.lastUpdateTimestamp = Date.now();
      AlpacaMarketDataProvider.lastStreamUpdateTimestamp = Date.now();

      for (const listener of AlpacaMarketDataProvider.sharedListeners) {
        try {
          listener(quote);
        } catch (_) {}
      }
    }
  }

  private scheduleSharedReconnect(): void {
    if (
      AlpacaMarketDataProvider.sharedReconnectTimer ||
      AlpacaMarketDataProvider.sharedConnectionLimitExceeded ||
      !this.hasCredentials() ||
      AlpacaMarketDataProvider.sharedListeners.size === 0
    ) {
      return;
    }

    AlpacaMarketDataProvider.sharedReconnectAttempts++;
    const delay = Math.min(
      1000 * Math.pow(2, AlpacaMarketDataProvider.sharedReconnectAttempts),
      AlpacaMarketDataProvider.maxReconnectDelay
    );
    logger.info(`[AlpacaProvider] Reconnecting shared socket in ${delay}ms (attempt #${AlpacaMarketDataProvider.sharedReconnectAttempts})...`);
    AlpacaMarketDataProvider.sharedReconnectTimer = setTimeout(() => {
      AlpacaMarketDataProvider.sharedReconnectTimer = null;
      this.connectSharedWebSocket();
    }, delay);
  }

  public normalizeBarData(symbol: string, bar: any, overrideStatus?: DataStatus): MarketQuote {
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
      status: overrideStatus || (this.hasCredentials() ? 'LIVE' : 'PREVIEW'),
      regulatoryNotice: 'Unconsolidated IEX market data. Does not represent complete consolidated US market volume.',
    };
  }

  public normalizeQuoteData(symbol: string, quote: any, overrideStatus?: DataStatus): MarketQuote {
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
      status: overrideStatus || (this.hasCredentials() ? 'LIVE' : 'PREVIEW'),
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
