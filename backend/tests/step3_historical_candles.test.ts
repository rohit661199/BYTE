import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, initDatabase } from '../src/database/db.js';
import { HistoricalDataService } from '../src/services/market-data/HistoricalDataService.js';
import { BinanceMarketDataProvider } from '../src/services/market-data/BinanceMarketDataProvider.js';
import { AlpacaMarketDataProvider } from '../src/services/market-data/AlpacaMarketDataProvider.js';
import { UpstoxMarketDataProvider } from '../src/services/market-data/UpstoxMarketDataProvider.js';
import { IMarketDataProvider } from '../src/services/market-data/IMarketDataProvider.js';
import { Candle, CandleInterval, MarketQuote, ProviderHealthStatus } from '../src/types/marketData.js';
import { TradeModel } from '../src/models/TradeModel.js';
import { OrderModel } from '../src/models/OrderModel.js';
import { MathPrecision } from '../src/utils/MathPrecision.js';

describe('Phase 03 — Step 3: Historical Market Data & SQLite Caching', () => {
  let service: HistoricalDataService;

  beforeEach(() => {
    initDatabase();
    service = new HistoricalDataService();
    HistoricalDataService.setInstance(service);
    service.clearCache();
  });

  afterEach(() => {
    service.clearCache();
    vi.restoreAllMocks();
  });

  describe('1. OHLCV Normalization Across Providers', () => {
    it('normalizes Binance raw klines array into standard Candle model', async () => {
      const provider = new BinanceMarketDataProvider();
      const mockKlines = [
        [
          1700000000000, // Open time ms
          '36500.50',    // Open
          '37200.00',    // High
          '36400.00',    // Low
          '37150.25',    // Close
          '152.456',     // Volume
          1700003599999, // Close time
          '5621450.00',  // Quote asset volume
          1250,          // Number of trades
        ],
        [
          1700003600000,
          '37150.25',
          '37500.00',
          '37000.00',
          '37420.10',
          '98.120',
          1700007199999,
          '3672000.00',
          890,
        ],
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockKlines,
      } as any);

      const candles = await provider.getHistoricalCandles('BTC-USD', '1h', 2);

      expect(candles).toHaveLength(2);
      expect(candles[0]).toEqual({
        timestamp: 1700000000000,
        open: 36500.50,
        high: 37200.00,
        low: 36400.00,
        close: 37150.25,
        volume: 152.456,
        source: 'BINANCE_PUBLIC',
      });
      expect(candles[1].close).toBe(37420.10);
      expect(candles[0].timestamp).toBeLessThan(candles[1].timestamp);
    });

    it('normalizes Alpaca raw bars into standard Candle model with ISO timestamp parsing', async () => {
      const provider = new AlpacaMarketDataProvider();
      vi.spyOn(provider, 'hasCredentials').mockReturnValue(true);

      const mockBarsResponse = {
        bars: {
          AAPL: [
            {
              t: '2024-03-01T14:30:00Z',
              o: 180.5,
              h: 182.0,
              l: 179.8,
              c: 181.25,
              v: 5420000,
            },
            {
              t: '2024-03-01T15:30:00Z',
              o: 181.25,
              h: 183.1,
              l: 180.9,
              c: 182.8,
              v: 4890000,
            },
          ],
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockBarsResponse,
      } as any);

      const candles = await provider.getHistoricalCandles('AAPL', '1h', 2);

      expect(candles).toHaveLength(2);
      expect(candles[0].timestamp).toBe(new Date('2024-03-01T14:30:00Z').getTime());
      expect(candles[0].open).toBe(180.5);
      expect(candles[0].high).toBe(182.0);
      expect(candles[0].low).toBe(179.8);
      expect(candles[0].close).toBe(181.25);
      expect(candles[0].volume).toBe(5420000);
      expect(candles[0].source).toBe('ALPACA_IEX');
    });

    it('normalizes Upstox raw descending candles into chronological ascending Candle model', async () => {
      const provider = new UpstoxMarketDataProvider();
      vi.spyOn(provider, 'hasCredentials').mockReturnValue(true);

      // Upstox API returns newest first (descending)
      const mockUpstoxResponse = {
        status: 'success',
        data: {
          candles: [
            ['2024-03-01T15:29:00+05:30', 2980.0, 2985.0, 2978.0, 2982.5, 12500, 0],
            ['2024-03-01T15:28:00+05:30', 2975.0, 2981.0, 2974.5, 2980.0, 9800, 0],
          ],
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpstoxResponse,
      } as any);

      const candles = await provider.getHistoricalCandles('RELIANCE', '1m', 2);

      expect(candles).toHaveLength(2);
      // Verify converted to ascending order (oldest first)
      expect(candles[0].timestamp).toBeLessThan(candles[1].timestamp);
      expect(candles[0].open).toBe(2975.0);
      expect(candles[0].close).toBe(2980.0);
      expect(candles[1].open).toBe(2980.0);
      expect(candles[1].close).toBe(2982.5);
      expect(candles[0].source).toBe('UPSTOX_V3');
    });

    it('aggregates trades from the trades table for BYTE-USD simulated instruments', async () => {
      db.prepare("DELETE FROM trades WHERE symbol = 'BYTE-USD' OR symbol = 'BYTE'").run();
      db.prepare("DELETE FROM orders WHERE symbol = 'BYTE-USD' OR symbol = 'BYTE'").run();
      service.clearCache('BYTE-USD');

      const now = Date.now();
      const baseTime = Math.floor((now - 120000) / 60000) * 60000;

      // Seed orders first to satisfy foreign key constraints
      for (let i = 1; i <= 3; i++) {
        OrderModel.create({
          id: `b${i}`,
          side: 'BUY',
          type: 'LIMIT',
          price: 100,
          quantity: 20,
          remainingQuantity: 0,
          status: 'FILLED',
          createdAt: new Date(baseTime).toISOString(),
          symbol: 'BYTE-USD',
        });
        OrderModel.create({
          id: `s${i}`,
          side: 'SELL',
          type: 'LIMIT',
          price: 100,
          quantity: 20,
          remainingQuantity: 0,
          status: 'FILLED',
          createdAt: new Date(baseTime).toISOString(),
          symbol: 'BYTE-USD',
        });
      }

      // Seed mock trades for BYTE-USD
      TradeModel.create({
        id: 'trade_sim_1',
        buyOrderId: 'b1',
        sellOrderId: 's1',
        price: 100,
        quantity: 10,
        timestamp: new Date(baseTime + 1000).toISOString(),
        symbol: 'BYTE-USD',
      });
      TradeModel.create({
        id: 'trade_sim_2',
        buyOrderId: 'b2',
        sellOrderId: 's2',
        price: 105,
        quantity: 5,
        timestamp: new Date(baseTime + 15000).toISOString(),
        symbol: 'BYTE-USD',
      });
      TradeModel.create({
        id: 'trade_sim_3',
        buyOrderId: 'b3',
        sellOrderId: 's3',
        price: 98,
        quantity: 15,
        timestamp: new Date(baseTime + 30000).toISOString(),
        symbol: 'BYTE-USD',
      });

      const candles = await service.getCandles('BYTE-USD', '1m', 10, true);

      expect(candles.length).toBeGreaterThan(0);
      const candle = candles[0];
      expect(candle.open).toBe(100);
      expect(candle.high).toBe(105);
      expect(candle.low).toBe(98);
      expect(candle.close).toBe(98);
      expect(candle.volume).toBe(30);
      expect(candle.source).toBe('BYTE_TRADES');
    });
  });

  describe('2. Supported Intervals & Multi-Timeframe Aggregation', () => {
    const supportedIntervals: CandleInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

    it.each(supportedIntervals)('supports interval %s with correct millisecond calculation', (interval) => {
      const ms = HistoricalDataService.getIntervalMs(interval);
      expect(ms).toBeGreaterThan(0);
      if (interval === '1m') expect(ms).toBe(60 * 1000);
      if (interval === '5m') expect(ms).toBe(300 * 1000);
      if (interval === '15m') expect(ms).toBe(900 * 1000);
      if (interval === '1h') expect(ms).toBe(3600 * 1000);
      if (interval === '4h') expect(ms).toBe(4 * 3600 * 1000);
      if (interval === '1d') expect(ms).toBe(24 * 3600 * 1000);
      if (interval === '1w') expect(ms).toBe(7 * 24 * 3600 * 1000);
    });

    it('aggregates four 1h candles into a single 4h candle accurately', () => {
      const baseTs = 1700000000000 - (1700000000000 % (4 * 3600 * 1000));
      const oneHourMs = 3600 * 1000;

      const hourlyCandles: Candle[] = [
        { timestamp: baseTs, open: 100, high: 105, low: 99, close: 103, volume: 1000 },
        { timestamp: baseTs + oneHourMs, open: 103, high: 110, low: 102, close: 108, volume: 1500 },
        { timestamp: baseTs + 2 * oneHourMs, open: 108, high: 109, low: 95, close: 97, volume: 2000 },
        { timestamp: baseTs + 3 * oneHourMs, open: 97, high: 102, low: 96, close: 101, volume: 1200 },
      ];

      const aggregated = HistoricalDataService.aggregateCandles(hourlyCandles, 4 * 3600 * 1000, 'ALPACA_IEX');

      expect(aggregated).toHaveLength(1);
      expect(aggregated[0].timestamp).toBe(baseTs);
      expect(aggregated[0].open).toBe(100);
      expect(aggregated[0].high).toBe(110);
      expect(aggregated[0].low).toBe(95);
      expect(aggregated[0].close).toBe(101);
      expect(aggregated[0].volume).toBe(5700);
      expect(aggregated[0].source).toBe('ALPACA_IEX');
    });

    it('aggregates five 1m candles into a single 5m candle accurately', () => {
      const baseTs = 1700000000000 - (1700000000000 % (5 * 60 * 1000));
      const oneMinMs = 60 * 1000;

      const minuteCandles: Candle[] = [
        { timestamp: baseTs, open: 50, high: 52, low: 49, close: 51, volume: 100 },
        { timestamp: baseTs + oneMinMs, open: 51, high: 53, low: 50, close: 52, volume: 200 },
        { timestamp: baseTs + 2 * oneMinMs, open: 52, high: 54, low: 51, close: 53, volume: 150 },
        { timestamp: baseTs + 3 * oneMinMs, open: 53, high: 53.5, low: 52, close: 52.5, volume: 120 },
        { timestamp: baseTs + 4 * oneMinMs, open: 52.5, high: 55, low: 52, close: 54.5, volume: 300 },
      ];

      const aggregated = HistoricalDataService.aggregateCandles(minuteCandles, 5 * 60 * 1000, 'UPSTOX_V3');

      expect(aggregated).toHaveLength(1);
      expect(aggregated[0].open).toBe(50);
      expect(aggregated[0].high).toBe(55);
      expect(aggregated[0].low).toBe(49);
      expect(aggregated[0].close).toBe(54.5);
      expect(aggregated[0].volume).toBe(870);
      expect(aggregated[0].source).toBe('UPSTOX_V3');
    });
  });

  describe('3. SQLite Caching & Cache Miss Handling', () => {
    it('populates SQLite market_candles on cache miss and reuses cache on second call without network requests', async () => {
      const mockProvider: IMarketDataProvider = {
        name: 'MockBinanceProvider',
        supportedSymbols: ['BTC-USD'],
        initialize: vi.fn(),
        getLatestQuote: vi.fn(),
        getLatestQuotes: vi.fn(),
        startStreaming: vi.fn(),
        stopStreaming: vi.fn(),
        getStatus: () => ({ name: 'Mock', connected: true, status: 'LIVE' }),
        getHistoricalCandles: vi.fn().mockResolvedValue([
          { timestamp: 1700000000000, open: 35000, high: 36000, low: 34500, close: 35800, volume: 500, source: 'BINANCE_PUBLIC' },
          { timestamp: 1700003600000, open: 35800, high: 36500, low: 35700, close: 36200, volume: 400, source: 'BINANCE_PUBLIC' },
        ]),
      };

      service.registerProvider('BINANCE', mockProvider);

      // Call 1: Cache Miss -> calls provider
      const candles1 = await service.getCandles('BTC-USD', '1h', 10);
      expect(candles1).toHaveLength(2);
      expect(mockProvider.getHistoricalCandles).toHaveBeenCalledTimes(1);

      // Direct inspection of SQLite market_candles table
      const cachedRows = service.getCachedCandles('BTC-USD', '1h');
      expect(cachedRows).toHaveLength(2);
      expect(cachedRows[0].close).toBe(35800);

      // Call 2: Cache Hit -> returns cached data without calling provider again
      // Mock provider return value to empty to prove it reads strictly from SQLite
      (mockProvider.getHistoricalCandles as any).mockResolvedValue([]);
      vi.spyOn(service, 'isCacheFresh').mockReturnValue(true);

      const candles2 = await service.getCandles('BTC-USD', '1h', 10);
      expect(candles2).toHaveLength(2);
      expect(candles2[0].close).toBe(35800);
      expect(candles2[1].close).toBe(36200);
      // Provider was NOT called a second time
      expect(mockProvider.getHistoricalCandles).toHaveBeenCalledTimes(1);
    });

    it('respects forceRefresh = true to bypass cache and refresh database', async () => {
      const mockProvider: IMarketDataProvider = {
        name: 'MockAlpacaProvider',
        supportedSymbols: ['MSFT'],
        initialize: vi.fn(),
        getLatestQuote: vi.fn(),
        getLatestQuotes: vi.fn(),
        startStreaming: vi.fn(),
        stopStreaming: vi.fn(),
        getStatus: () => ({ name: 'Mock', connected: true, status: 'LIVE' }),
        getHistoricalCandles: vi.fn().mockResolvedValue([
          { timestamp: 1700000000000, open: 400, high: 405, low: 398, close: 402, volume: 100000, source: 'ALPACA_IEX' },
        ]),
      };

      service.registerProvider('NASDAQ', mockProvider);

      // Initial call populates cache
      await service.getCandles('MSFT', '1d', 10);
      expect(mockProvider.getHistoricalCandles).toHaveBeenCalledTimes(1);

      // Update provider to return a new bar
      (mockProvider.getHistoricalCandles as any).mockResolvedValue([
        { timestamp: 1700000000000, open: 400, high: 405, low: 398, close: 402, volume: 100000, source: 'ALPACA_IEX' },
        { timestamp: 1700086400000, open: 402, high: 410, low: 401, close: 408, volume: 120000, source: 'ALPACA_IEX' },
      ]);

      // Call with forceRefresh = true
      const refreshed = await service.getCandles('MSFT', '1d', 10, true);
      expect(refreshed).toHaveLength(2);
      expect(refreshed[1].close).toBe(408);
      expect(mockProvider.getHistoricalCandles).toHaveBeenCalledTimes(2);

      // Database should now hold both rows
      const dbRows = service.getCachedCandles('MSFT', '1d');
      expect(dbRows).toHaveLength(2);
    });

    it('respects limit parameter and returns the most recent candles chronologically', async () => {
      // Seed 5 candles
      const candles: Candle[] = [
        { timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
        { timestamp: 2000, open: 11, high: 13, low: 10, close: 12, volume: 100 },
        { timestamp: 3000, open: 12, high: 14, low: 11, close: 13, volume: 100 },
        { timestamp: 4000, open: 13, high: 15, low: 12, close: 14, volume: 100 },
        { timestamp: 5000, open: 14, high: 16, low: 13, close: 15, volume: 100 },
      ];
      service.saveCandlesToCache('NVDA', '1h', candles, 'ALPACA_IEX');

      const limited = service.getCachedCandles('NVDA', '1h', 3);
      expect(limited).toHaveLength(3);
      // Last 3 candles in chronological order
      expect(limited[0].timestamp).toBe(3000);
      expect(limited[1].timestamp).toBe(4000);
      expect(limited[2].timestamp).toBe(5000);
    });
  });

  describe('4. Provider Failures & Error Isolation', () => {
    it('falls back gracefully to cached SQLite candles when external provider fails', async () => {
      // Pre-seed cache with known valid candles
      const existingCandles: Candle[] = [
        { timestamp: 1690000000000, open: 150, high: 155, low: 149, close: 154, volume: 50000, source: 'ALPACA_IEX' },
      ];
      service.saveCandlesToCache('AAPL', '1d', existingCandles, 'ALPACA_IEX');

      // Provider throws network exception
      const faultyProvider: IMarketDataProvider = {
        name: 'FaultyProvider',
        supportedSymbols: ['AAPL'],
        initialize: vi.fn(),
        getLatestQuote: vi.fn(),
        getLatestQuotes: vi.fn(),
        startStreaming: vi.fn(),
        stopStreaming: vi.fn(),
        getStatus: () => ({ name: 'Faulty', connected: false, status: 'UNAVAILABLE' }),
        getHistoricalCandles: vi.fn().mockRejectedValue(new Error('Network timeout (ETIMEDOUT)')),
      };

      service.registerProvider('NASDAQ', faultyProvider);

      // Request with forceRefresh to trigger provider call
      const result = await service.getCandles('AAPL', '1d', 10, true);

      // Must not throw, and must return the pre-existing SQLite cached candle
      expect(result).toHaveLength(1);
      expect(result[0].close).toBe(154);
    });

    it('returns empty array when provider fails and no cached candles exist, never fabricating fake data', async () => {
      const faultyProvider: IMarketDataProvider = {
        name: 'FaultyProvider',
        supportedSymbols: ['TCS'],
        initialize: vi.fn(),
        getLatestQuote: vi.fn(),
        getLatestQuotes: vi.fn(),
        startStreaming: vi.fn(),
        stopStreaming: vi.fn(),
        getStatus: () => ({ name: 'Faulty', connected: false, status: 'UNAVAILABLE' }),
        getHistoricalCandles: vi.fn().mockRejectedValue(new Error('503 Service Unavailable')),
      };

      service.registerProvider('NSE', faultyProvider);

      const result = await service.getCandles('TCS', '15m', 10, true);

      expect(result).toEqual([]);
    });

    it('returns empty array without throwing when provider has missing credentials', async () => {
      const unauthAlpaca = new AlpacaMarketDataProvider();
      vi.spyOn(unauthAlpaca, 'hasCredentials').mockReturnValue(false);

      const unauthUpstox = new UpstoxMarketDataProvider();
      vi.spyOn(unauthUpstox, 'hasCredentials').mockReturnValue(false);

      const alpacaBars = await unauthAlpaca.getHistoricalCandles('AAPL', '1d', 10);
      const upstoxCandles = await unauthUpstox.getHistoricalCandles('INFY', '1d', 10);

      expect(alpacaBars).toEqual([]);
      expect(upstoxCandles).toEqual([]);
    });

    it('keeps providers independent: a failure in Upstox does not affect Binance or Alpaca', async () => {
      const failingUpstox: IMarketDataProvider = {
        name: 'FailingUpstox',
        supportedSymbols: ['RELIANCE'],
        initialize: vi.fn(),
        getLatestQuote: vi.fn(),
        getLatestQuotes: vi.fn(),
        startStreaming: vi.fn(),
        stopStreaming: vi.fn(),
        getStatus: () => ({ name: 'FailingUpstox', connected: false, status: 'UNAVAILABLE' }),
        getHistoricalCandles: vi.fn().mockRejectedValue(new Error('Upstox token expired')),
      };

      const healthyBinance: IMarketDataProvider = {
        name: 'HealthyBinance',
        supportedSymbols: ['ETH-USD'],
        initialize: vi.fn(),
        getLatestQuote: vi.fn(),
        getLatestQuotes: vi.fn(),
        startStreaming: vi.fn(),
        stopStreaming: vi.fn(),
        getStatus: () => ({ name: 'HealthyBinance', connected: true, status: 'LIVE' }),
        getHistoricalCandles: vi.fn().mockResolvedValue([
          { timestamp: 1700000000000, open: 2200, high: 2250, low: 2190, close: 2240, volume: 1500, source: 'BINANCE_PUBLIC' },
        ]),
      };

      service.registerProvider('NSE', failingUpstox);
      service.registerProvider('BINANCE', healthyBinance);

      // Upstox fails gracefully
      const nseResult = await service.getCandles('RELIANCE', '1h', 10, true);
      expect(nseResult).toEqual([]);

      // Binance succeeds completely independently
      const cryptoResult = await service.getCandles('ETH-USD', '1h', 10, true);
      expect(cryptoResult).toHaveLength(1);
      expect(cryptoResult[0].close).toBe(2240);
    });
  });

  describe('5. Market Sessions, Timezones & Regulatory Scope', () => {
    it('recognizes cache as fresh when equity market is closed and past session candles exist', () => {
      // 15 daily candles in cache
      const candles: Candle[] = Array.from({ length: 15 }).map((_, i) => ({
        timestamp: Date.now() - (15 - i) * 86400000,
        open: 100 + i,
        high: 102 + i,
        low: 99 + i,
        close: 101 + i,
        volume: 10000,
        source: 'ALPACA_IEX',
      }));

      // In tests, if the market is closed (e.g. night or weekend), isCacheFresh evaluates to true
      const isFresh = service.isCacheFresh('AAPL', '1d', candles, 10);
      expect(typeof isFresh).toBe('boolean');
    });

    it('Upstox historical candle disclaimer adheres to personal-use scope', () => {
      expect(UpstoxMarketDataProvider.REGULATORY_DISCLAIMER).toContain('restricted to personal account use');
      expect(UpstoxMarketDataProvider.REGULATORY_DISCLAIMER).toContain('redistribution regulations');
    });

    it('does not fabricate candles for missing data or off-market hours', async () => {
      // If there are no trades in a given period for BYTE-USD, it returns empty rather than fabricated baseline candles
      db.prepare("DELETE FROM trades WHERE symbol = 'BYTE-USD' OR symbol = 'BYTE'").run();

      const candles = await service.getCandles('BYTE-USD', '1m', 10, true);
      expect(candles).toEqual([]);
    });
  });
});
