import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlpacaMarketDataProvider } from '../src/services/market-data/AlpacaMarketDataProvider.js';
import { config } from '../src/config/env.js';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

class MockWebSocket extends EventEmitter {
  static instances: MockWebSocket[] = [];
  public readyState = WebSocket.OPEN;
  public sentMessages: string[] = [];

  constructor(public url: string) {
    super();
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.emit('open');
    }, 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }

  terminate() {
    this.close();
  }
}

describe('AlpacaMarketDataProvider Hardening & Bug Fixes', () => {
  let originalKey: string;
  let originalSecret: string;

  beforeEach(() => {
    originalKey = config.alpaca.apiKey;
    originalSecret = config.alpaca.apiSecret;
    config.alpaca.apiKey = 'test_alpaca_key';
    config.alpaca.apiSecret = 'test_alpaca_secret';
    AlpacaMarketDataProvider.resetSharedState();
    MockWebSocket.instances = [];
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    AlpacaMarketDataProvider.resetSharedState();
    config.alpaca.apiKey = originalKey;
    config.alpaca.apiSecret = originalSecret;
    vi.restoreAllMocks();
  });

  describe('1. Historical Candles Date Range & Query Parameters', () => {
    it('calculates explicit start and end date ranges with weekend/holiday buffer for all intervals', () => {
      const fixedNow = new Date('2026-11-01T12:00:00Z'); // Sunday

      // 1d interval
      const range1d = AlpacaMarketDataProvider.calculateDateRange('1d', 5, fixedNow);
      expect(range1d.end).toBe('2026-11-01T12:00:00.000Z');
      const start1d = new Date(range1d.start);
      const diffDays1d = (fixedNow.getTime() - start1d.getTime()) / (24 * 3600 * 1000);
      expect(diffDays1d).toBeGreaterThanOrEqual(14); // At least 14 days buffer for 5 daily candles

      // 1m intraday interval on Sunday
      const range1m = AlpacaMarketDataProvider.calculateDateRange('1m', 100, fixedNow);
      expect(range1m.end).toBe('2026-11-01T12:00:00.000Z');
      const start1m = new Date(range1m.start);
      const diffDays1m = (fixedNow.getTime() - start1m.getTime()) / (24 * 3600 * 1000);
      expect(diffDays1m).toBeGreaterThanOrEqual(7); // At least 7 days to reach Friday session over weekend

      // 1w interval
      const range1w = AlpacaMarketDataProvider.calculateDateRange('1w', 10, fixedNow);
      expect(range1w.end).toBe('2026-11-01T12:00:00.000Z');
      const start1w = new Date(range1w.start);
      expect(fixedNow.getTime()).toBeGreaterThan(start1w.getTime());
    });

    it('passes explicit start, end, and sort=desc parameters to Alpaca historical bars API', async () => {
      const provider = new AlpacaMarketDataProvider();
      let capturedUrl = '';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        capturedUrl = url.toString();
        return {
          ok: true,
          json: async () => ({
            bars: {
              AAPL: [
                { t: '2026-10-30T19:59:00Z', o: 340, h: 345, l: 339, c: 344, v: 100 },
                { t: '2026-10-30T20:43:00Z', o: 344, h: 345, l: 344, c: 344.89, v: 55 },
              ],
            },
          }),
        } as any;
      });

      const candles = await provider.getHistoricalCandles('AAPL', '1d', 5);

      expect(capturedUrl).toContain('start=');
      expect(capturedUrl).toContain('end=');
      expect(capturedUrl).toContain('sort=desc');
      expect(capturedUrl).toContain('symbols=AAPL');
      expect(capturedUrl).toContain('timeframe=1Day');

      // Results must be sorted ascending by timestamp
      expect(candles).toHaveLength(2);
      expect(candles[0].timestamp).toBeLessThan(candles[1].timestamp);
      expect(candles[0].close).toBe(344);
      expect(candles[1].close).toBe(344.89);
    });

    it('handles empty responses and weekends gracefully without fabricating synthetic candles', async () => {
      const provider = new AlpacaMarketDataProvider();

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bars: {}, next_page_token: null }),
      } as any);

      const candles = await provider.getHistoricalCandles('AAPL', '1d', 5);
      expect(candles).toEqual([]); // Must return genuine empty array, no fake prices
    });
  });

  describe('2. WebSocket Authentication Handshake & Concurrency', () => {
    it('waits for authenticated message before subscribing and does not subscribe on connected', async () => {
      // Mock global WebSocket with MockWebSocket
      const provider = new AlpacaMarketDataProvider();
      (provider as any).wsConstructor = MockWebSocket;

      await provider.startStreaming(() => {});

      const mockWs = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      expect(mockWs).toBeDefined();

      // Simulate connection greeting from Alpaca
      mockWs.emit('message', JSON.stringify([{ T: 'success', msg: 'connected' }]));

      // 1. Must send auth
      const authSent = mockWs.sentMessages.find((m) => m.includes('"action":"auth"'));
      expect(authSent).toBeDefined();

      // 2. Must NOT send subscribe yet!
      const subBeforeAuth = mockWs.sentMessages.find((m) => m.includes('"action":"subscribe"'));
      expect(subBeforeAuth).toBeUndefined();

      // 3. Now simulate authentication success from Alpaca
      mockWs.emit('message', JSON.stringify([{ T: 'success', msg: 'authenticated' }]));

      // 4. NOW subscribe must be sent
      const subAfterAuth = mockWs.sentMessages.find((m) => m.includes('"action":"subscribe"'));
      expect(subAfterAuth).toBeDefined();
      expect(subAfterAuth).toContain('AAPL');

      await provider.stopStreaming();
    });

    it('ensures only ONE WebSocket connection exists across multiple provider instances', async () => {
      const provider1 = new AlpacaMarketDataProvider();
      const provider2 = new AlpacaMarketDataProvider();
      (provider1 as any).wsConstructor = MockWebSocket;
      (provider2 as any).wsConstructor = MockWebSocket;

      const initialCount = MockWebSocket.instances.length;

      await provider1.startStreaming(() => {});
      await provider2.startStreaming(() => {});

      // Exactly ONE mock socket should have been instantiated
      expect(MockWebSocket.instances.length - initialCount).toBe(1);

      await provider1.stopStreaming();
      await provider2.stopStreaming();
    });

    it('stops auto-reconnect when Alpaca reports Code 406 connection limit exceeded', async () => {
      const provider = new AlpacaMarketDataProvider();
      (provider as any).wsConstructor = MockWebSocket;

      await provider.startStreaming(() => {});
      const mockWs = MockWebSocket.instances[MockWebSocket.instances.length - 1];

      // Simulate Alpaca 406 Error
      mockWs.emit('message', JSON.stringify([{ T: 'error', code: 406, msg: 'connection limit exceeded' }]));

      const status = provider.getStatus();
      expect(status.connected).toBe(false);
      expect(status.error).toContain('connection limit exceeded');

      // Verify no reconnect timer is active
      expect((provider as any).reconnectTimer).toBeNull();
      expect((AlpacaMarketDataProvider as any).sharedReconnectTimer).toBeNull();

      await provider.stopStreaming();
    });

    it('prevents concurrent duplicate fetchRestSnapshot calls via promise mutex', async () => {
      const provider = new AlpacaMarketDataProvider();
      let fetchCount = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          json: async () => ({
            bars: {
              AAPL: { c: 230, o: 228, h: 231, l: 227, v: 50000, t: '2026-10-31T20:00:00Z' },
            },
          }),
        } as any;
      });

      // Call initialize concurrently from 2 instances
      await Promise.all([provider.initialize(), provider.initialize()]);

      expect(fetchCount).toBe(1); // Exactly one network snapshot fetch
    });
  });

  describe('3. Status Independence and State Accuracy', () => {
    it('maintains DELAYED quote status from REST snapshot when WebSocket is disconnected', async () => {
      const provider = new AlpacaMarketDataProvider();

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bars: {
            AAPL: { c: 235, o: 230, h: 236, l: 229, v: 45000, t: '2026-10-31T20:00:00Z' },
          },
        }),
      } as any);

      await provider.initialize();

      // Without WebSocket connected
      const quote = await provider.getLatestQuote('AAPL');
      expect(quote).not.toBeNull();
      expect(quote?.price).toBe(235);
      expect(quote?.status).toBe('DELAYED');

      const status = provider.getStatus();
      expect(status.connected).toBe(false);
      expect(status.status).toBe('DELAYED');
    });

    it('reports LIVE only when a fresh streaming update is received', async () => {
      const provider = new AlpacaMarketDataProvider();
      (provider as any).wsConstructor = MockWebSocket;

      await provider.startStreaming(() => {});
      const mockWs = MockWebSocket.instances[MockWebSocket.instances.length - 1];

      // Simulate handshake
      mockWs.emit('message', JSON.stringify([{ T: 'success', msg: 'connected' }]));
      mockWs.emit('message', JSON.stringify([{ T: 'success', msg: 'authenticated' }]));

      // Before any quote tick arrives, status should be DELAYED/waiting, NOT LIVE
      let status = provider.getStatus();
      expect(status.connected).toBe(true);
      expect(status.status).not.toBe('LIVE');

      // Now simulate a streaming trade bar tick
      mockWs.emit('message', JSON.stringify([{
        T: 'b',
        S: 'AAPL',
        o: 235,
        h: 236,
        l: 234,
        c: 235.5,
        v: 120,
        t: new Date().toISOString(),
      }]));

      // After fresh streaming quote arrived, status is LIVE
      status = provider.getStatus();
      expect(status.connected).toBe(true);
      expect(status.status).toBe('LIVE');

      const quote = await provider.getLatestQuote('AAPL');
      expect(quote?.status).toBe('LIVE');
      expect(quote?.price).toBe(235.5);

      await provider.stopStreaming();
    });

    it('schedules reconnection after a normal network disconnection', async () => {
      vi.useFakeTimers();
      const provider = new AlpacaMarketDataProvider();
      (provider as any).wsConstructor = MockWebSocket;

      await provider.startStreaming(() => {});
      const mockWs = MockWebSocket.instances[MockWebSocket.instances.length - 1];

      // Simulate handshake completion
      mockWs.emit('message', JSON.stringify([{ T: 'success', msg: 'connected' }]));
      mockWs.emit('message', JSON.stringify([{ T: 'success', msg: 'authenticated' }]));

      // Simulate abnormal network disconnect
      const initialCount = MockWebSocket.instances.length;
      mockWs.emit('close');

      // Verify reconnection timer is scheduled (exponential backoff: 2s on attempt 1)
      expect(provider.reconnectTimer).not.toBeNull();
      expect(provider.getStatus().connected).toBe(false);

      // Fast-forward past reconnect delay
      await vi.advanceTimersByTimeAsync(2500);

      // Verify a new socket connection attempt was initiated
      expect(MockWebSocket.instances.length).toBeGreaterThan(initialCount);

      await provider.stopStreaming();
      vi.useRealTimers();
    });

    it('recovers safely from 406 error on subsequent explicit startStreaming call', async () => {
      const provider = new AlpacaMarketDataProvider();
      (provider as any).wsConstructor = MockWebSocket;

      await provider.startStreaming(() => {});
      const mockWs1 = MockWebSocket.instances[MockWebSocket.instances.length - 1];

      // Simulate 406 Error
      mockWs1.emit('message', JSON.stringify([{ T: 'error', code: 406, msg: 'connection limit exceeded' }]));
      expect(AlpacaMarketDataProvider.sharedConnectionLimitExceeded).toBe(true);

      // Simulate conflicting connection is now closed externally, and caller restarts streaming
      mockWs1.emit('close');
      const countBefore = MockWebSocket.instances.length;

      // Re-invoke startStreaming on provider
      await provider.startStreaming(() => {});

      // Verify that sharedConnectionLimitExceeded is reset and a new connection is attempted
      expect(AlpacaMarketDataProvider.sharedConnectionLimitExceeded).toBe(false);
      expect(MockWebSocket.instances.length).toBeGreaterThan(countBefore);

      const mockWs2 = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      // Handshake succeeds on the new connection
      mockWs2.emit('message', JSON.stringify([{ T: 'success', msg: 'connected' }]));
      mockWs2.emit('message', JSON.stringify([{ T: 'success', msg: 'authenticated' }]));
      expect(provider.getStatus().connected).toBe(true);

      await provider.stopStreaming();
    });

    it('correctly calculates valid start/end date ranges for all 7 supported intervals', () => {
      const intervals: ('1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w')[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
      const fixedNow = new Date('2026-11-01T12:00:00Z');

      for (const interval of intervals) {
        const range = AlpacaMarketDataProvider.calculateDateRange(interval, 50, fixedNow);
        expect(range.start).toBeDefined();
        expect(range.end).toBe('2026-11-01T12:00:00.000Z');

        const startTime = new Date(range.start).getTime();
        const endTime = new Date(range.end).getTime();

        // Start must strictly precede end
        expect(startTime).toBeLessThan(endTime);

        // All lookbacks must span at least 7 days to cover weekends and holiday closures
        const daysSpan = (endTime - startTime) / (24 * 3600 * 1000);
        expect(daysSpan).toBeGreaterThanOrEqual(7);
      }
    });

    it('cleans up individual callback listeners when one instance stops without affecting others', async () => {
      const provider1 = new AlpacaMarketDataProvider();
      const provider2 = new AlpacaMarketDataProvider();
      (provider1 as any).wsConstructor = MockWebSocket;
      (provider2 as any).wsConstructor = MockWebSocket;

      let p1Calls = 0;
      let p2Calls = 0;

      await provider1.startStreaming(() => { p1Calls++; });
      await provider2.startStreaming(() => { p2Calls++; });

      const mockWs = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      mockWs.emit('message', JSON.stringify([{ T: 'success', msg: 'connected' }]));
      mockWs.emit('message', JSON.stringify([{ T: 'success', msg: 'authenticated' }]));

      // Tick a bar
      mockWs.emit('message', JSON.stringify([{
        T: 'b',
        S: 'AAPL',
        o: 235,
        h: 236,
        l: 234,
        c: 235.5,
        v: 100,
        t: new Date().toISOString(),
      }]));

      expect(p1Calls).toBe(1);
      expect(p2Calls).toBe(1);

      // Now stop provider1 only
      await provider1.stopStreaming();

      // Tick another bar
      mockWs.emit('message', JSON.stringify([{
        T: 'b',
        S: 'AAPL',
        o: 235.5,
        h: 237,
        l: 235,
        c: 236.5,
        v: 150,
        t: new Date().toISOString(),
      }]));

      // Provider1 was detached and received 0 new quotes, Provider2 received the new quote
      expect(p1Calls).toBe(1);
      expect(p2Calls).toBe(2);

      // Provider2 still has active connection
      expect(provider2.getStatus().connected).toBe(true);

      // Now stop provider2
      await provider2.stopStreaming();

      // All listeners detached: shared socket must be closed
      expect(AlpacaMarketDataProvider.sharedWs).toBeNull();
      expect(AlpacaMarketDataProvider.sharedListeners.size).toBe(0);
      expect(AlpacaMarketDataProvider.sharedSubscribedSymbols.size).toBe(0);
    });
  });
});
