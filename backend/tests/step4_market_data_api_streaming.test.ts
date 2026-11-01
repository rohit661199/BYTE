import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initDatabase, db } from '../src/database/db.js';
import { InstrumentRegistry } from '../src/services/InstrumentRegistry.js';
import { HistoricalDataService } from '../src/services/market-data/HistoricalDataService.js';
import { MarketDataStreamingService } from '../src/services/market-data/MarketDataStreamingService.js';
import { WebSocketService } from '../src/services/websocketService.js';
import { UpstoxMarketDataProvider } from '../src/services/market-data/UpstoxMarketDataProvider.js';
import { config } from '../src/config/env.js';
import { IMarketDataProvider } from '../src/services/market-data/IMarketDataProvider.js';
import { MarketQuote, ProviderHealthStatus, Candle, CandleInterval, DataStatus } from '../src/types/marketData.js';

// ─── Mock Provider Factory ─────────────────────────────────────────────────

function createMockProvider(config: {
  name: string;
  symbols: string[];
  status?: DataStatus;
  connected?: boolean;
  quotes?: MarketQuote[];
  candles?: Candle[];
  failInit?: boolean;
  failStream?: boolean;
}): IMarketDataProvider {
  let streamCallback: ((q: MarketQuote) => void) | null = null;
  let streaming = false;

  const defaultQuotes: MarketQuote[] = config.quotes || config.symbols.map((sym) => ({
    symbol: sym,
    exchange: 'TEST',
    assetType: 'EQUITY' as const,
    currency: 'USD' as const,
    price: 100,
    priceStr: '100.00',
    source: config.name,
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: config.status || 'LIVE',
  }));

  return {
    name: config.name,
    supportedSymbols: config.symbols,

    async initialize(): Promise<void> {
      if (config.failInit) throw new Error(`${config.name} init failed`);
    },

    async getLatestQuote(symbol: string): Promise<MarketQuote | null> {
      return defaultQuotes.find((q) => q.symbol === symbol) || null;
    },

    async getLatestQuotes(): Promise<MarketQuote[]> {
      return defaultQuotes;
    },

    async getHistoricalCandles(_symbol: string, _interval: CandleInterval, _limit?: number): Promise<Candle[]> {
      return config.candles || [];
    },

    async startStreaming(onQuote: (quote: MarketQuote) => void): Promise<void> {
      if (config.failStream) throw new Error(`${config.name} stream failed`);
      streamCallback = onQuote;
      streaming = true;
    },

    async stopStreaming(): Promise<void> {
      streamCallback = null;
      streaming = false;
    },

    getStatus(): ProviderHealthStatus {
      return {
        name: config.name,
        connected: config.connected ?? true,
        status: config.status || 'LIVE',
        lastUpdateTimestamp: Date.now(),
      };
    },

    // Expose for test control
    get _streamCallback() { return streamCallback; },
    get _isStreaming() { return streaming; },
    emitQuote(q: MarketQuote) { if (streamCallback) streamCallback(q); },
  } as any;
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Step 4: Market Data API Endpoints & Live WebSocket Streaming', () => {
  let broadcastSpy: ReturnType<typeof vi.spyOn>;
  let broadcastWithAudienceSpy: ReturnType<typeof vi.spyOn>;
  let broadcastToPrivateSpy: ReturnType<typeof vi.spyOn>;
  let broadcastToPublicSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    initDatabase();
    // Spy on WebSocketService broadcast methods to capture events without a real WS server
    broadcastSpy = vi.spyOn(WebSocketService, 'broadcast').mockImplementation(() => {});
    broadcastWithAudienceSpy = vi.spyOn(WebSocketService, 'broadcastWithAudience').mockImplementation(() => {});
    broadcastToPrivateSpy = vi.spyOn(WebSocketService, 'broadcastToPrivate').mockImplementation(() => {});
    broadcastToPublicSpy = vi.spyOn(WebSocketService, 'broadcastToPublic').mockImplementation(() => {});
  });

  afterAll(() => {
    broadcastSpy.mockRestore();
    broadcastWithAudienceSpy.mockRestore();
    broadcastToPrivateSpy.mockRestore();
    broadcastToPublicSpy.mockRestore();
    HistoricalDataService.setInstance(null);
    MarketDataStreamingService.setInstance(null);
  });

  beforeEach(() => {
    broadcastSpy.mockClear();
    broadcastWithAudienceSpy.mockClear();
    broadcastToPrivateSpy.mockClear();
    broadcastToPublicSpy.mockClear();
    MarketDataStreamingService.setInstance(null);
    HistoricalDataService.setInstance(null);
  });

  // ─── 1. MarketDataStreamingService Lifecycle ────────────────────────────

  describe('MarketDataStreamingService Lifecycle', () => {
    it('should start and stop without errors', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });

      await service.start();
      expect((mockBinance as any)._isStreaming).toBe(true);
      expect((mockAlpaca as any)._isStreaming).toBe(true);
      expect((mockUpstox as any)._isStreaming).toBe(true);

      await service.stop();
      expect((mockBinance as any)._isStreaming).toBe(false);
      expect((mockAlpaca as any)._isStreaming).toBe(false);
      expect((mockUpstox as any)._isStreaming).toBe(false);
    });

    it('should isolate provider initialization failures', async () => {
      const mockGood = createMockProvider({ name: 'MockGood', symbols: ['AAPL'] });
      const mockBad = createMockProvider({ name: 'MockBad', symbols: ['BTC-USD'], failInit: true });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBad,
        alpacaProvider: mockGood,
        upstoxProvider: mockUpstox,
      });

      // Should not throw even though one provider fails
      await expect(service.start()).resolves.toBeUndefined();
      // Good provider should still be streaming
      expect((mockGood as any)._isStreaming).toBe(true);

      await service.stop();
    });

    it('should isolate provider streaming failures', async () => {
      const mockGood = createMockProvider({ name: 'MockGood', symbols: ['AAPL'] });
      const mockBadStream = createMockProvider({ name: 'MockBadStream', symbols: ['BTC-USD'], failStream: true });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBadStream,
        alpacaProvider: mockGood,
        upstoxProvider: mockUpstox,
      });

      await expect(service.start()).resolves.toBeUndefined();
      expect((mockGood as any)._isStreaming).toBe(true);
      expect((mockBadStream as any)._isStreaming).toBe(false);

      await service.stop();
    });
  });

  // ─── 2. Quote Broadcasting via WebSocketService ─────────────────────────

  describe('Quote Broadcasting via WebSocketService', () => {
    it('should broadcast MARKET_QUOTE_UPDATE when a provider emits a quote', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      const testQuote: MarketQuote = {
        symbol: 'BTC-USD',
        exchange: 'BINANCE',
        assetType: 'CRYPTO',
        currency: 'USD',
        price: 67500.00,
        priceStr: '67500.00',
        source: 'BINANCE_PUBLIC',
        sourceTimestamp: Date.now(),
        receivedTimestamp: Date.now(),
        status: 'LIVE',
      };

      (mockBinance as any).emitQuote(testQuote);

      // Should have broadcast a MARKET_QUOTE_UPDATE and a CANDLE_UPDATE
      expect(broadcastSpy).toHaveBeenCalledWith('MARKET_QUOTE_UPDATE', testQuote);
      expect(broadcastSpy).toHaveBeenCalledWith(
        'CANDLE_UPDATE',
        expect.objectContaining({
          symbol: 'BTC-USD',
          interval: '1m',
          isForming: true,
          candle: expect.objectContaining({ close: 67500.00 }),
        })
      );

      await service.stop();
    });

    it('should update latest quote cache correctly', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      const q1: MarketQuote = {
        symbol: 'BTC-USD',
        exchange: 'BINANCE',
        assetType: 'CRYPTO',
        currency: 'USD',
        price: 67000,
        priceStr: '67000.00',
        source: 'BINANCE_PUBLIC',
        sourceTimestamp: Date.now(),
        receivedTimestamp: Date.now(),
        status: 'LIVE',
      };

      const q2: MarketQuote = {
        symbol: 'BTC-USD',
        exchange: 'BINANCE',
        assetType: 'CRYPTO',
        currency: 'USD',
        price: 67500,
        priceStr: '67500.00',
        source: 'BINANCE_PUBLIC',
        sourceTimestamp: Date.now(),
        receivedTimestamp: Date.now(),
        status: 'LIVE',
      };

      (mockBinance as any).emitQuote(q1);
      expect(service.getLatestQuote('BTC-USD')?.price).toBe(67000);

      (mockBinance as any).emitQuote(q2);
      expect(service.getLatestQuote('BTC-USD')?.price).toBe(67500);

      await service.stop();
    });

    it('should maintain quotes from independent providers simultaneously', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      (mockBinance as any).emitQuote({
        symbol: 'BTC-USD', exchange: 'BINANCE', assetType: 'CRYPTO', currency: 'USD',
        price: 67000, priceStr: '67000.00', source: 'BINANCE_PUBLIC',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE',
      });
      (mockAlpaca as any).emitQuote({
        symbol: 'AAPL', exchange: 'NASDAQ', assetType: 'EQUITY', currency: 'USD',
        price: 195.50, priceStr: '195.50', source: 'ALPACA_IEX',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE',
      });
      (mockUpstox as any).emitQuote({
        symbol: 'RELIANCE', exchange: 'NSE', assetType: 'EQUITY', currency: 'INR',
        price: 2950.00, priceStr: '2950.00', source: 'UPSTOX_V3',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE',
        regulatoryNotice: 'Personal use only',
      });

      const all = service.getAllLatestQuotes(true);
      expect(all.length).toBe(3);
      expect(service.getLatestQuote('BTC-USD')?.price).toBe(67000);
      expect(service.getLatestQuote('AAPL')?.price).toBe(195.50);
      expect(service.getLatestQuote('RELIANCE', true)?.price).toBe(2950.00);
      expect(service.getLatestQuote('RELIANCE', false)?.status).toBe('PREVIEW');

      await service.stop();
    });

    it('should filter quotes by asset type', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      (mockBinance as any).emitQuote({
        symbol: 'BTC-USD', exchange: 'BINANCE', assetType: 'CRYPTO', currency: 'USD',
        price: 67000, priceStr: '67000.00', source: 'BINANCE_PUBLIC',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE',
      });
      (mockAlpaca as any).emitQuote({
        symbol: 'AAPL', exchange: 'NASDAQ', assetType: 'EQUITY', currency: 'USD',
        price: 195.50, priceStr: '195.50', source: 'ALPACA_IEX',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE',
      });

      const crypto = service.getQuotesByAssetType('CRYPTO');
      expect(crypto.length).toBe(1);
      expect(crypto[0].symbol).toBe('BTC-USD');

      const equities = service.getQuotesByAssetType('EQUITY');
      expect(equities.length).toBe(1);
      expect(equities[0].symbol).toBe('AAPL');

      await service.stop();
    });
  });

  // ─── 3. Forming Candle Updates ──────────────────────────────────────────

  describe('Forming Candle Updates', () => {
    it('should create a forming candle from the first quote', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      (mockBinance as any).emitQuote({
        symbol: 'BTC-USD', exchange: 'BINANCE', assetType: 'CRYPTO', currency: 'USD',
        price: 67000, priceStr: '67000.00', source: 'BINANCE_PUBLIC',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE', volume: 100,
      });

      const forming = service.getFormingCandle('BTC-USD', '1m');
      expect(forming).not.toBeNull();
      expect(forming!.open).toBe(67000);
      expect(forming!.close).toBe(67000);
      expect(forming!.high).toBe(67000);
      expect(forming!.low).toBe(67000);

      await service.stop();
    });

    it('should update forming candle OHLCV correctly with subsequent quotes', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      const baseQuote = (price: number, volume = 10) => ({
        symbol: 'BTC-USD', exchange: 'BINANCE', assetType: 'CRYPTO' as const, currency: 'USD' as const,
        price, priceStr: price.toFixed(2), source: 'BINANCE_PUBLIC',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE' as const, volume,
      });

      (mockBinance as any).emitQuote(baseQuote(67000, 10));
      (mockBinance as any).emitQuote(baseQuote(67500, 20)); // new high
      (mockBinance as any).emitQuote(baseQuote(66800, 15)); // new low
      (mockBinance as any).emitQuote(baseQuote(67200, 25)); // close

      const forming = service.getFormingCandle('BTC-USD', '1m');
      expect(forming).not.toBeNull();
      expect(forming!.open).toBe(67000);     // First quote
      expect(forming!.high).toBe(67500);     // Highest
      expect(forming!.low).toBe(66800);      // Lowest
      expect(forming!.close).toBe(67200);    // Last quote
      expect(forming!.volume).toBe(70);      // 10+20+15+25

      await service.stop();
    });

    it('should not corrupt completed candles when forming candle updates', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      // Insert a historical candle manually
      const histService = HistoricalDataService.getInstance();
      const historicalCandle: Candle = {
        timestamp: Date.now() - 120000, // 2 minutes ago
        open: 66000,
        high: 66500,
        low: 65500,
        close: 66200,
        volume: 500,
        source: 'BINANCE_PUBLIC',
      };
      histService.saveCandlesToCache('BTC-USD', '1m', [historicalCandle], 'BINANCE_PUBLIC');

      // Emit a new quote (current minute bucket)
      (mockBinance as any).emitQuote({
        symbol: 'BTC-USD', exchange: 'BINANCE', assetType: 'CRYPTO', currency: 'USD',
        price: 67000, priceStr: '67000.00', source: 'BINANCE_PUBLIC',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE', volume: 10,
      });

      // Verify the historical candle is untouched
      const cached = histService.getCachedCandles('BTC-USD', '1m');
      const oldCandle = cached.find((c) => c.timestamp === historicalCandle.timestamp);
      expect(oldCandle).toBeDefined();
      expect(oldCandle!.close).toBe(66200); // Not corrupted
      expect(oldCandle!.high).toBe(66500);  // Not corrupted

      await service.stop();
    });

    it('should broadcast CANDLE_UPDATE with isForming=true', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();
      broadcastSpy.mockClear();

      (mockBinance as any).emitQuote({
        symbol: 'ETH-USD', exchange: 'BINANCE', assetType: 'CRYPTO', currency: 'USD',
        price: 3200, priceStr: '3200.00', source: 'BINANCE_PUBLIC',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE', volume: 5,
      });

      const candleCalls = broadcastSpy.mock.calls.filter(
        (call) => call[0] === 'CANDLE_UPDATE'
      );
      expect(candleCalls.length).toBeGreaterThanOrEqual(1);
      const payload = candleCalls[0][1] as any;
      expect(payload.isForming).toBe(true);
      expect(payload.symbol).toBe('ETH-USD');
      expect(payload.candle.close).toBe(3200);

      await service.stop();
    });
  });

  // ─── 4. Provider Health Status ──────────────────────────────────────────

  describe('Provider Health Status', () => {
    it('should return status for all providers', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'], status: 'LIVE', connected: true });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'], status: 'PREVIEW', connected: false });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'], status: 'UNAVAILABLE', connected: false });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);

      const statuses = service.getProviderStatuses();
      expect(statuses.length).toBe(3);

      const binanceStatus = statuses.find((s) => s.name === 'MockBinance');
      expect(binanceStatus?.connected).toBe(true);
      expect(binanceStatus?.status).toBe('LIVE');

      const alpacaStatus = statuses.find((s) => s.name === 'MockAlpaca');
      expect(alpacaStatus?.connected).toBe(false);
      expect(alpacaStatus?.status).toBe('PREVIEW');

      const upstoxStatus = statuses.find((s) => s.name === 'MockUpstox');
      expect(upstoxStatus?.status).toBe('UNAVAILABLE');
    });
  });

  // ─── 5. Provider Isolation ──────────────────────────────────────────────

  describe('Provider Isolation', () => {
    it('one provider crash should not affect others', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'], failInit: true, failStream: true });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      // Binance and Upstox should still work
      (mockBinance as any).emitQuote({
        symbol: 'BTC-USD', exchange: 'BINANCE', assetType: 'CRYPTO', currency: 'USD',
        price: 67000, priceStr: '67000.00', source: 'BINANCE_PUBLIC',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE',
      });
      (mockUpstox as any).emitQuote({
        symbol: 'RELIANCE', exchange: 'NSE', assetType: 'EQUITY', currency: 'INR',
        price: 2950.00, priceStr: '2950.00', source: 'UPSTOX_V3',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE',
      });

      expect(service.getLatestQuote('BTC-USD')?.price).toBe(67000);
      expect(service.getLatestQuote('RELIANCE', true)?.price).toBe(2950.00);
      expect(service.getLatestQuote('RELIANCE', false)?.status).toBe('PREVIEW');
      expect(service.getLatestQuote('AAPL')).toBeNull();

      await service.stop();
    });
  });

  // ─── 6. WebSocket Event Types ─────────────────────────────────────────

  describe('WebSocket Event Types', () => {
    it('MARKET_QUOTE_UPDATE event should carry accurate timestamps and source', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();
      broadcastSpy.mockClear();

      const now = Date.now();
      (mockBinance as any).emitQuote({
        symbol: 'BTC-USD', exchange: 'BINANCE', assetType: 'CRYPTO', currency: 'USD',
        price: 67000, priceStr: '67000.00', source: 'BINANCE_PUBLIC',
        sourceTimestamp: now, receivedTimestamp: now, status: 'LIVE',
      });

      const quoteCalls = broadcastSpy.mock.calls.filter(
        (call) => call[0] === 'MARKET_QUOTE_UPDATE'
      );
      expect(quoteCalls.length).toBe(1);
      const payload = quoteCalls[0][1] as MarketQuote;
      expect(payload.source).toBe('BINANCE_PUBLIC');
      expect(payload.sourceTimestamp).toBe(now);
      expect(payload.status).toBe('LIVE');
      expect(payload.currency).toBe('USD');

      await service.stop();
    });

    it('CANDLE_UPDATE event should include interval and symbol', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();
      broadcastSpy.mockClear();

      (mockAlpaca as any).emitQuote({
        symbol: 'AAPL', exchange: 'NASDAQ', assetType: 'EQUITY', currency: 'USD',
        price: 196, priceStr: '196.00', source: 'ALPACA_IEX',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE', volume: 50,
      });

      const candleCalls = broadcastSpy.mock.calls.filter(
        (call) => call[0] === 'CANDLE_UPDATE'
      );
      expect(candleCalls.length).toBe(1);
      const payload = candleCalls[0][1] as any;
      expect(payload.symbol).toBe('AAPL');
      expect(payload.interval).toBe('1m');
      expect(typeof payload.candle.timestamp).toBe('number');

      await service.stop();
    });
  });

  // ─── 7. Data Status Accuracy ──────────────────────────────────────────

  describe('Data Status Accuracy', () => {
    it('should preserve PREVIEW status for quotes from uncredentialed providers', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      (mockAlpaca as any).emitQuote({
        symbol: 'AAPL', exchange: 'NASDAQ', assetType: 'EQUITY', currency: 'USD',
        price: 195, priceStr: '195.00', source: 'ALPACA_IEX',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'PREVIEW',
      });

      const quote = service.getLatestQuote('AAPL');
      expect(quote?.status).toBe('PREVIEW');

      await service.stop();
    });

    it('should preserve regulatory notice for Upstox personal-use data', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      const notice = 'NSE market data via Upstox is restricted to personal account use.';
      (mockUpstox as any).emitQuote({
        symbol: 'RELIANCE', exchange: 'NSE', assetType: 'EQUITY', currency: 'INR',
        price: 2950, priceStr: '2950.00', source: 'UPSTOX_V3',
        sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE',
        regulatoryNotice: notice,
      });

      const quote = service.getLatestQuote('RELIANCE');
      expect(quote?.regulatoryNotice).toBe(notice);

      // Verify audience broadcast carries the notice for both private and public recipients
      const audienceCalls = broadcastWithAudienceSpy.mock.calls.filter(
        (call) => call[0] === 'MARKET_QUOTE_UPDATE'
      );
      expect(audienceCalls.length).toBeGreaterThanOrEqual(1);
      const { publicPayload, privatePayload } = audienceCalls[0][1] as any;
      expect(publicPayload.regulatoryNotice).toBe(notice);
      expect(privatePayload.regulatoryNotice).toBe(notice);

      await service.stop();
    });

    it('should never fabricate prices — only genuine provider data or PREVIEW baseline', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      // No quotes emitted — should have nothing cached
      const unknownQuote = service.getLatestQuote('FAKE-SYMBOL');
      expect(unknownQuote).toBeNull();

      await service.stop();
    });
  });

  // ─── 8. Singleton Pattern ────────────────────────────────────────────

  describe('Singleton Pattern', () => {
    it('getInstance should return the same instance', () => {
      MarketDataStreamingService.setInstance(null);
      const a = MarketDataStreamingService.getInstance();
      const b = MarketDataStreamingService.getInstance();
      expect(a).toBe(b);
      MarketDataStreamingService.setInstance(null);
    });

    it('setInstance should override the singleton', () => {
      const custom = new MarketDataStreamingService();
      MarketDataStreamingService.setInstance(custom);
      expect(MarketDataStreamingService.getInstance()).toBe(custom);
      MarketDataStreamingService.setInstance(null);
    });
  });

  // ─── 9. HistoricalDataService Integration ─────────────────────────────

  describe('HistoricalDataService Integration', () => {
    it('getCandles should return cached candles', async () => {
      const histService = HistoricalDataService.getInstance();
      const candles: Candle[] = [
        { timestamp: 1000, open: 100, high: 105, low: 95, close: 102, volume: 500, source: 'TEST' },
        { timestamp: 2000, open: 102, high: 110, low: 100, close: 108, volume: 600, source: 'TEST' },
      ];
      histService.saveCandlesToCache('BTC-USD', '1d', candles, 'TEST');

      const result = histService.getCachedCandles('BTC-USD', '1d');
      expect(result.length).toBeGreaterThanOrEqual(2);
      const last = result[result.length - 1];
      expect(last.close).toBe(108);
    });

    it('forming candle should not overwrite completed historical candles', () => {
      const histService = HistoricalDataService.getInstance();

      // Insert two historical candles
      const now = Date.now();
      const completedTs = Math.floor((now - 180000) / 60000) * 60000; // 3 min ago bucket

      histService.saveCandlesToCache('ETH-USD', '1m', [
        { timestamp: completedTs, open: 3100, high: 3150, low: 3050, close: 3120, volume: 200, source: 'TEST' },
      ], 'TEST');

      // Simulate a forming candle in current bucket
      const currentTs = Math.floor(now / 60000) * 60000;
      histService.saveCandlesToCache('ETH-USD', '1m', [
        { timestamp: currentTs, open: 3200, high: 3220, low: 3180, close: 3210, volume: 50, source: 'STREAMING' },
      ], 'STREAMING');

      const allCandles = histService.getCachedCandles('ETH-USD', '1m');
      const completed = allCandles.find((c) => c.timestamp === completedTs);
      expect(completed).toBeDefined();
      expect(completed!.close).toBe(3120); // Untouched
    });
  });

  // ─── 10. Stale Data Detection ─────────────────────────────────────────

  describe('Stale Data Detection', () => {
    it('should return null for symbols with no data', () => {
      const service = new MarketDataStreamingService();
      const quote = service.getLatestQuote('NONEXISTENT');
      expect(quote).toBeNull();
    });

    it('should return empty array for getQuotesByAssetType with no data', () => {
      const service = new MarketDataStreamingService();
      const result = service.getQuotesByAssetType('UTILITY');
      expect(result).toEqual([]);
    });
  });

  // ─── 11. Multiple Provider Quotes ─────────────────────────────────────

  describe('Multiple Simultaneous Provider Quotes', () => {
    it('should handle rapid-fire quotes without data loss', async () => {
      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });

      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      // Emit 10 rapid quotes
      for (let i = 0; i < 10; i++) {
        (mockBinance as any).emitQuote({
          symbol: 'BTC-USD', exchange: 'BINANCE', assetType: 'CRYPTO', currency: 'USD',
          price: 67000 + i * 10, priceStr: `${67000 + i * 10}.00`, source: 'BINANCE_PUBLIC',
          sourceTimestamp: Date.now(), receivedTimestamp: Date.now(), status: 'LIVE', volume: 5,
        });
      }

      // Should have the last price
      expect(service.getLatestQuote('BTC-USD')?.price).toBe(67090);

      // Forming candle should reflect all 10 quotes
      const forming = service.getFormingCandle('BTC-USD', '1m');
      expect(forming).not.toBeNull();
      expect(forming!.open).toBe(67000); // First
      expect(forming!.close).toBe(67090); // Last
      expect(forming!.high).toBe(67090);
      expect(forming!.low).toBe(67000);
      expect(forming!.volume).toBe(50); // 10 * 5

      await service.stop();
    });
  });

  // ─── 12. WebSocketService Type Extension ──────────────────────────────

  describe('WebSocketService Type Extension', () => {
    it('MARKET_QUOTE_UPDATE should be a valid WsEventType', () => {
      // This is a compile-time check; if it compiles, the type extension works
      const eventType: import('../src/services/websocketService.js').WsEventType = 'MARKET_QUOTE_UPDATE';
      expect(eventType).toBe('MARKET_QUOTE_UPDATE');
    });

    it('CANDLE_UPDATE should be a valid WsEventType', () => {
      const eventType: import('../src/services/websocketService.js').WsEventType = 'CANDLE_UPDATE';
      expect(eventType).toBe('CANDLE_UPDATE');
    });

    it('existing event types should still be valid', () => {
      const types: import('../src/services/websocketService.js').WsEventType[] = [
        'ORDER_BOOK_UPDATE', 'TRADE_EXECUTED', 'STATS_UPDATE', 'INIT',
      ];
      expect(types.length).toBe(4);
    });
  });

  // ─── 13. Upstox Regulatory & Private Session Restrictions ───────────────

  describe('Upstox Regulatory & Private Session Restrictions', () => {
    it('should NEVER broadcast personal Upstox data to public WebSocket clients without commercial rights', async () => {
      config.upstox.commercialRedistribution = false;

      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });
      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      const personalLiveQuote: MarketQuote = {
        symbol: 'RELIANCE',
        exchange: 'NSE',
        assetType: 'EQUITY',
        currency: 'INR',
        price: 2950.50, // Personal live tick from Upstox
        priceStr: '2950.50',
        source: 'UPSTOX_V3',
        sourceTimestamp: Date.now(),
        receivedTimestamp: Date.now(),
        status: 'LIVE',
      };

      (mockUpstox as any).emitQuote(personalLiveQuote);

      // Verify that broadcastWithAudience was called
      expect(broadcastWithAudienceSpy).toHaveBeenCalled();
      const call = broadcastWithAudienceSpy.mock.calls.find((c) => c[0] === 'MARKET_QUOTE_UPDATE');
      expect(call).toBeDefined();

      const { publicPayload, privatePayload } = call![1] as any;

      // Public clients MUST receive PREVIEW or UNAVAILABLE, NEVER personal live price
      expect(publicPayload).toBeDefined();
      expect(publicPayload.status).toBe('PREVIEW');
      expect(publicPayload.price).not.toBe(personalLiveQuote.price);
      expect(publicPayload.price).toBe(2985.50); // Safe baseline price from InstrumentRegistry
      expect(publicPayload.regulatoryNotice).toBe(UpstoxMarketDataProvider.REGULATORY_DISCLAIMER);

      // Private session MUST receive the genuine live quote
      expect(privatePayload).toBeDefined();
      expect(privatePayload.price).toBe(2950.50);
      expect(privatePayload.status).toBe('LIVE');

      // Verify forming candle update is restricted to private sessions only
      expect(broadcastToPrivateSpy).toHaveBeenCalledWith('CANDLE_UPDATE', expect.objectContaining({
        symbol: 'RELIANCE',
        isForming: true,
      }));

      await service.stop();
    });

    it('should restrict public API clients to PREVIEW for Upstox quotes', async () => {
      config.upstox.commercialRedistribution = false;

      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });
      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      (mockUpstox as any).emitQuote({
        symbol: 'RELIANCE',
        exchange: 'NSE',
        assetType: 'EQUITY',
        currency: 'INR',
        price: 2950.50,
        priceStr: '2950.50',
        source: 'UPSTOX_V3',
        sourceTimestamp: Date.now(),
        receivedTimestamp: Date.now(),
        status: 'LIVE',
      });

      // Public client request (isPrivate = false)
      const publicQuote = service.getLatestQuote('RELIANCE', false);
      expect(publicQuote).not.toBeNull();
      expect(publicQuote!.status).toBe('PREVIEW');
      expect(publicQuote!.price).toBe(2985.50); // Baseline price from InstrumentRegistry
      expect(publicQuote!.price).not.toBe(2950.50);

      // Authorized private session request (isPrivate = true)
      const privateQuote = service.getLatestQuote('RELIANCE', true);
      expect(privateQuote).not.toBeNull();
      expect(privateQuote!.status).toBe('LIVE');
      expect(privateQuote!.price).toBe(2950.50);

      await service.stop();
    });

    it('should permit public broadcast only when commercial redistribution is confirmed', async () => {
      config.upstox.commercialRedistribution = true;

      const mockBinance = createMockProvider({ name: 'MockBinance', symbols: ['BTC-USD'] });
      const mockAlpaca = createMockProvider({ name: 'MockAlpaca', symbols: ['AAPL'] });
      const mockUpstox = createMockProvider({ name: 'MockUpstox', symbols: ['RELIANCE'] });
      const service = new MarketDataStreamingService({
        binanceProvider: mockBinance,
        alpacaProvider: mockAlpaca,
        upstoxProvider: mockUpstox,
      });
      MarketDataStreamingService.setInstance(service);
      await service.start();

      (mockUpstox as any).emitQuote({
        symbol: 'RELIANCE',
        exchange: 'NSE',
        assetType: 'EQUITY',
        currency: 'INR',
        price: 2950.50,
        priceStr: '2950.50',
        source: 'UPSTOX_V3',
        sourceTimestamp: Date.now(),
        receivedTimestamp: Date.now(),
        status: 'LIVE',
      });

      // With commercial redistribution confirmed, broadcast is open to all clients
      expect(broadcastSpy).toHaveBeenCalledWith('MARKET_QUOTE_UPDATE', expect.objectContaining({
        symbol: 'RELIANCE',
        price: 2950.50,
      }));

      // Public quote returns the live price
      const publicQuote = service.getLatestQuote('RELIANCE', false);
      expect(publicQuote!.price).toBe(2950.50);

      await service.stop();

      // Reset config
      config.upstox.commercialRedistribution = false;
    });
  });
});

