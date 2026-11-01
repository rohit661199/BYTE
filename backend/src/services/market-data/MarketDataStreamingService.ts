import { IMarketDataProvider } from './IMarketDataProvider.js';
import { BinanceMarketDataProvider } from './BinanceMarketDataProvider.js';
import { AlpacaMarketDataProvider } from './AlpacaMarketDataProvider.js';
import { UpstoxMarketDataProvider } from './UpstoxMarketDataProvider.js';
import { HistoricalDataService } from './HistoricalDataService.js';
import { WebSocketService } from '../websocketService.js';
import { MarketQuote, ProviderHealthStatus, Candle, CandleInterval } from '../../types/marketData.js';
import { InstrumentRegistry } from '../InstrumentRegistry.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/**
 * MarketDataStreamingService
 *
 * Central orchestrator that:
 *  1. Initializes and starts streaming on all market data providers.
 *  2. Routes incoming quotes from providers to BYTE's existing WebSocketService.
 *  3. Updates currently-forming candles without corrupting completed historical candles.
 *  4. Provides unified access to quotes and provider health.
 *
 * Does NOT create a new WebSocket server — reuses WebSocketService.broadcast().
 */
export class MarketDataStreamingService {
  private static instance: MarketDataStreamingService | null = null;

  private readonly providers: Map<string, IMarketDataProvider> = new Map();
  private readonly latestQuotes: Map<string, MarketQuote> = new Map();
  private readonly formingCandles: Map<string, Candle> = new Map(); // key: `${symbol}:${interval}`
  private staleCheckInterval: NodeJS.Timeout | null = null;
  private readonly STALE_THRESHOLD_MS = 60_000; // 60s for crypto, applied conservatively

  constructor(options?: {
    binanceProvider?: IMarketDataProvider;
    alpacaProvider?: IMarketDataProvider;
    upstoxProvider?: IMarketDataProvider;
  }) {
    const binance = options?.binanceProvider || new BinanceMarketDataProvider();
    const alpaca = options?.alpacaProvider || new AlpacaMarketDataProvider();
    const upstox = options?.upstoxProvider || new UpstoxMarketDataProvider();

    this.providers.set('binance', binance);
    this.providers.set('alpaca', alpaca);
    this.providers.set('upstox', upstox);
  }

  public static getInstance(options?: {
    binanceProvider?: IMarketDataProvider;
    alpacaProvider?: IMarketDataProvider;
    upstoxProvider?: IMarketDataProvider;
  }): MarketDataStreamingService {
    if (!MarketDataStreamingService.instance) {
      MarketDataStreamingService.instance = new MarketDataStreamingService(options);
    }
    return MarketDataStreamingService.instance;
  }

  public static setInstance(service: MarketDataStreamingService | null): void {
    MarketDataStreamingService.instance = service;
  }

  /**
   * Initialize all providers and start streaming. Each provider is independent;
   * a failure in one does not affect the others.
   */
  public async start(): Promise<void> {
    logger.info('[MarketDataStreaming] Starting all market data providers...');

    // Initialize each provider independently
    for (const [name, provider] of this.providers) {
      try {
        await provider.initialize();
        logger.info(`[MarketDataStreaming] Provider '${name}' initialized.`);
      } catch (err: any) {
        logger.warn(`[MarketDataStreaming] Provider '${name}' initialization failed: ${err.message}. Continuing without it.`);
      }
    }

    // Start streaming on each provider independently
    for (const [name, provider] of this.providers) {
      try {
        await provider.startStreaming((quote: MarketQuote) => {
          this.handleIncomingQuote(quote);
        });
        logger.info(`[MarketDataStreaming] Provider '${name}' streaming started.`);
      } catch (err: any) {
        logger.warn(`[MarketDataStreaming] Provider '${name}' streaming start failed: ${err.message}. Continuing without it.`);
      }
    }

    // Start stale-data detection interval
    this.staleCheckInterval = setInterval(() => {
      this.detectStaleFeeds();
    }, 30_000);

    logger.info('[MarketDataStreaming] All providers started.');
  }

  /**
   * Stop all streaming and cleanup intervals.
   */
  public async stop(): Promise<void> {
    logger.info('[MarketDataStreaming] Stopping all market data providers...');

    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
      this.staleCheckInterval = null;
    }

    for (const [name, provider] of this.providers) {
      try {
        await provider.stopStreaming();
        logger.info(`[MarketDataStreaming] Provider '${name}' stopped.`);
      } catch (err: any) {
        logger.warn(`[MarketDataStreaming] Provider '${name}' stop failed: ${err.message}.`);
      }
    }
  }

  /**
   * Generates a PREVIEW baseline quote for an NSE symbol when commercial redistribution
   * is not confirmed, ensuring public clients receive compliant preview quotes.
   */
  public getPreviewQuote(symbol: string, existingQuote?: MarketQuote): MarketQuote {
    const inst = InstrumentRegistry.getInstrument(symbol);
    const baseline = inst?.baselinePrice || 1000;
    const isAlreadyPreview = existingQuote?.status === 'PREVIEW';
    const previewPrice = isAlreadyPreview ? existingQuote.price : baseline;

    return {
      symbol,
      exchange: existingQuote?.exchange || 'NSE',
      assetType: existingQuote?.assetType || 'EQUITY',
      currency: existingQuote?.currency || 'INR',
      price: previewPrice,
      priceStr: previewPrice.toFixed(2),
      open: existingQuote?.open || previewPrice,
      high: existingQuote?.high || previewPrice * 1.01,
      low: existingQuote?.low || previewPrice * 0.99,
      volume: isAlreadyPreview ? (existingQuote.volume || 0) : 0,
      change: isAlreadyPreview ? (existingQuote.change || 0) : 0,
      changePercent: isAlreadyPreview ? (existingQuote.changePercent || 0) : 0,
      source: 'UPSTOX_V3',
      sourceTimestamp: existingQuote?.sourceTimestamp || Date.now(),
      receivedTimestamp: Date.now(),
      status: 'PREVIEW',
      regulatoryNotice: existingQuote?.regulatoryNotice || UpstoxMarketDataProvider.REGULATORY_DISCLAIMER,
    };
  }

  /**
   * Central quote handler called by each provider's streaming callback.
   * Updates the local quote cache and broadcasts through BYTE's existing WebSocketService.
   */
  private handleIncomingQuote(quote: MarketQuote): void {
    this.latestQuotes.set(quote.symbol, quote);

    // Update the currently-forming 1m candle for this symbol
    this.updateFormingCandle(quote);

    const isUpstox = quote.source === 'UPSTOX_V3' || quote.exchange === 'NSE';
    const hasCommercialRights = config.upstox.commercialRedistribution;

    if (isUpstox && !hasCommercialRights) {
      if (quote.status === 'LIVE' || quote.status === 'DELAYED') {
        // REGULATORY COMPLIANCE: Personal Upstox data must NEVER reach public WebSocket clients.
        // Restrict live data to authorized private sessions only.
        // Public clients receive PREVIEW or UNAVAILABLE instead.
        const previewQuote = this.getPreviewQuote(quote.symbol, quote);
        WebSocketService.broadcastWithAudience('MARKET_QUOTE_UPDATE' as any, {
          privatePayload: quote,
          publicPayload: previewQuote,
        });
      } else {
        // PREVIEW / UNAVAILABLE quotes are safe to broadcast publicly
        WebSocketService.broadcast('MARKET_QUOTE_UPDATE' as any, quote);
      }
    } else {
      // Unrestricted broadcast (Binance, Alpaca, or confirmed commercial Upstox)
      WebSocketService.broadcast('MARKET_QUOTE_UPDATE' as any, quote);
    }
  }

  /**
   * Updates the currently-forming candle for a symbol.
   * Only modifies the in-progress candle bucket; completed historical candles are untouched.
   */
  private updateFormingCandle(quote: MarketQuote): void {
    const interval: CandleInterval = '1m';
    const intervalMs = HistoricalDataService.getIntervalMs(interval);
    const now = Date.now();
    const currentBucketTs = Math.floor(now / intervalMs) * intervalMs;
    const key = `${quote.symbol}:${interval}`;

    const existing = this.formingCandles.get(key);

    if (existing && existing.timestamp === currentBucketTs) {
      // Update the existing forming candle
      existing.close = quote.price;
      if (quote.price > existing.high) existing.high = quote.price;
      if (quote.price < existing.low) existing.low = quote.price;
      existing.volume += (quote.volume || 0);
    } else {
      // New candle bucket — persist the previous forming candle if it exists
      if (existing) {
        this.persistCompletedFormingCandle(quote.symbol, interval, existing);
      }

      // Start a new forming candle
      this.formingCandles.set(key, {
        timestamp: currentBucketTs,
        open: quote.price,
        high: quote.price,
        low: quote.price,
        close: quote.price,
        volume: quote.volume || 0,
        source: quote.source,
      });
    }

    // Broadcast the forming candle update
    const formingCandle = this.formingCandles.get(key);
    if (formingCandle) {
      const isUpstox = quote.source === 'UPSTOX_V3' || quote.exchange === 'NSE';
      const hasCommercialRights = config.upstox.commercialRedistribution;

      if (isUpstox && !hasCommercialRights) {
        // Forming candles of personal Upstox data are restricted to private sessions only
        WebSocketService.broadcastToPrivate('CANDLE_UPDATE' as any, {
          symbol: quote.symbol,
          interval,
          candle: formingCandle,
          isForming: true,
        });
      } else {
        WebSocketService.broadcast('CANDLE_UPDATE' as any, {
          symbol: quote.symbol,
          interval,
          candle: formingCandle,
          isForming: true,
        });
      }
    }
  }

  /**
   * Persists a completed forming candle into the SQLite cache via HistoricalDataService.
   * Only writes completed candles, never overwrites existing historical data.
   */
  private persistCompletedFormingCandle(symbol: string, interval: CandleInterval, candle: Candle): void {
    try {
      const histService = HistoricalDataService.getInstance();
      histService.saveCandlesToCache(symbol, interval, [candle], candle.source || 'STREAMING');
    } catch (err: any) {
      logger.warn(`[MarketDataStreaming] Failed to persist completed forming candle for ${symbol}: ${err.message}`);
    }
  }

  /**
   * Detects stale feeds. If a provider's last update exceeds the threshold,
   * mark its quotes as STALE and broadcast.
   */
  private detectStaleFeeds(): void {
    const now = Date.now();
    for (const [, provider] of this.providers) {
      const health = provider.getStatus();
      if (health.connected && health.lastUpdateTimestamp) {
        const age = now - health.lastUpdateTimestamp;
        if (age > this.STALE_THRESHOLD_MS) {
          // Mark all quotes from this provider as STALE
          for (const [sym, quote] of this.latestQuotes) {
            if (quote.source === health.name || this.isProviderForSymbol(provider, sym)) {
              if (quote.status === 'LIVE' || quote.status === 'DELAYED') {
                quote.status = 'STALE';
                this.latestQuotes.set(sym, quote);
                const isUpstox = quote.source === 'UPSTOX_V3' || quote.exchange === 'NSE';
                const hasCommercialRights = config.upstox.commercialRedistribution;
                if (isUpstox && !hasCommercialRights) {
                  WebSocketService.broadcastToPrivate('MARKET_QUOTE_UPDATE' as any, quote);
                } else {
                  WebSocketService.broadcast('MARKET_QUOTE_UPDATE' as any, quote);
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Checks if a provider manages a given symbol.
   */
  private isProviderForSymbol(provider: IMarketDataProvider, symbol: string): boolean {
    return provider.supportedSymbols.includes(symbol);
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Get the latest cached quote for a symbol.
   * If the quote is from Upstox and commercial redistribution is not confirmed,
   * public clients receive a PREVIEW quote while authorized sessions receive the live quote.
   */
  public getLatestQuote(symbol: string, isPrivateSession = false): MarketQuote | null {
    const raw = this.latestQuotes.get(symbol);
    if (!raw) return null;

    const isUpstox = raw.source === 'UPSTOX_V3' || raw.exchange === 'NSE';
    const hasCommercialRights = config.upstox.commercialRedistribution;

    if (isUpstox && !hasCommercialRights && !isPrivateSession) {
      if (raw.status === 'LIVE' || raw.status === 'DELAYED') {
        return this.getPreviewQuote(symbol, raw);
      }
    }

    return raw;
  }

  /**
   * Get all latest cached quotes.
   * Upstox quotes are sanitized to PREVIEW for public clients unless commercial rights exist.
   */
  public getAllLatestQuotes(isPrivateSession = false): MarketQuote[] {
    const hasCommercialRights = config.upstox.commercialRedistribution;

    return Array.from(this.latestQuotes.values()).map((q) => {
      const isUpstox = q.source === 'UPSTOX_V3' || q.exchange === 'NSE';
      if (isUpstox && !hasCommercialRights && !isPrivateSession) {
        if (q.status === 'LIVE' || q.status === 'DELAYED') {
          return this.getPreviewQuote(q.symbol, q);
        }
      }
      return q;
    });
  }

  /**
   * Get quotes filtered by asset type.
   */
  public getQuotesByAssetType(assetType: 'EQUITY' | 'CRYPTO' | 'UTILITY', isPrivateSession = false): MarketQuote[] {
    return this.getAllLatestQuotes(isPrivateSession).filter((q) => q.assetType === assetType);
  }

  /**
   * Get the currently-forming candle for a symbol and interval.
   */
  public getFormingCandle(symbol: string, interval: CandleInterval = '1m'): Candle | null {
    const key = `${symbol}:${interval}`;
    return this.formingCandles.get(key) || null;
  }

  /**
   * Get health status for all providers.
   */
  public getProviderStatuses(): ProviderHealthStatus[] {
    const statuses: ProviderHealthStatus[] = [];
    for (const [, provider] of this.providers) {
      statuses.push(provider.getStatus());
    }
    return statuses;
  }

  /**
   * Get a specific provider by name (for testing).
   */
  public getProvider(name: string): IMarketDataProvider | undefined {
    return this.providers.get(name);
  }
}
