import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BinanceMarketDataProvider } from '../src/services/market-data/BinanceMarketDataProvider.js';
import { AlpacaMarketDataProvider } from '../src/services/market-data/AlpacaMarketDataProvider.js';
import { UpstoxMarketDataProvider } from '../src/services/market-data/UpstoxMarketDataProvider.js';
import { config } from '../src/config/env.js';

describe('Phase 03 — Step 2: Market Data Provider Integrations', () => {
  let originalAlpacaKey: string;
  let originalAlpacaSecret: string;
  let originalUpstoxToken: string;

  beforeEach(() => {
    originalAlpacaKey = config.alpaca.apiKey;
    originalAlpacaSecret = config.alpaca.apiSecret;
    originalUpstoxToken = config.upstox.accessToken;
  });

  afterEach(() => {
    config.alpaca.apiKey = originalAlpacaKey;
    config.alpaca.apiSecret = originalAlpacaSecret;
    config.upstox.accessToken = originalUpstoxToken;
    vi.restoreAllMocks();
  });

  describe('1. BinanceMarketDataProvider (Crypto: 24/7 Public Spot)', () => {
    it('initializes supported symbols: BTC-USD, ETH-USD, SOL-USD', () => {
      const provider = new BinanceMarketDataProvider();
      expect(provider.name).toBe('BinanceMarketDataProvider');
      expect(provider.supportedSymbols).toEqual(['BTC-USD', 'ETH-USD', 'SOL-USD']);
    });

    it('normalizes raw Binance 24hr ticker data into standardized MarketQuote', () => {
      const provider = new BinanceMarketDataProvider();

      const raw = {
        s: 'BTCUSDT',
        c: '88532.41',
        o: '87280.00',
        h: '89100.00',
        l: '86950.00',
        v: '48250.5',
        p: '1252.41',
        P: '1.43',
        x: '87280.00',
        E: 1730000000000,
      };

      const quote = provider.normalizeTickerData(raw);

      expect(quote.symbol).toBe('BTC-USD');
      expect(quote.exchange).toBe('BINANCE');
      expect(quote.assetType).toBe('CRYPTO');
      expect(quote.currency).toBe('USD');
      expect(quote.price).toBe(88532.41);
      expect(quote.priceStr).toBe('88532.41');
      expect(quote.open).toBe(87280.00);
      expect(quote.high).toBe(89100.00);
      expect(quote.low).toBe(86950.00);
      expect(quote.volume).toBe(48250.5);
      expect(quote.change).toBe(1252.41);
      expect(quote.changePercent).toBe(1.43);
      expect(quote.source).toBe('BINANCE_PUBLIC');
      expect(quote.status).toBe('LIVE');
    });

    it('populates baseline fallback quotes if network is unreachable during startup', async () => {
      const provider = new BinanceMarketDataProvider();
      vi.spyOn(provider, 'fetchRestSnapshot').mockRejectedValue(new Error('Network timeout'));

      await provider.initialize();

      const btcQuote = await provider.getLatestQuote('BTC-USD');
      expect(btcQuote).not.toBeNull();
      expect(btcQuote?.symbol).toBe('BTC-USD');
      expect(btcQuote?.status).toBe('PREVIEW');
      expect(btcQuote?.price).toBeGreaterThan(0);

      const status = provider.getStatus();
      expect(status.status).toBe('DELAYED');
      expect(status.error).toContain('Network timeout');
    });
  });

  describe('2. AlpacaMarketDataProvider (US Equities: Free IEX Feed)', () => {
    it('initializes supported symbols: AAPL, MSFT, NVDA, TSLA, AMZN', () => {
      const provider = new AlpacaMarketDataProvider();
      expect(provider.name).toBe('AlpacaMarketDataProvider');
      expect(provider.supportedSymbols).toEqual(['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN']);
    });

    it('operates safely in PREVIEW mode when credentials are not configured', async () => {
      config.alpaca.apiKey = '';
      config.alpaca.apiSecret = '';

      const provider = new AlpacaMarketDataProvider();
      expect(provider.hasCredentials()).toBe(false);

      await provider.initialize();

      const aaplQuote = await provider.getLatestQuote('AAPL');
      expect(aaplQuote).not.toBeNull();
      expect(aaplQuote?.symbol).toBe('AAPL');
      expect(aaplQuote?.status).toBe('PREVIEW');
      expect(aaplQuote?.currency).toBe('USD');
      expect(aaplQuote?.source).toBe('ALPACA_IEX');
      expect(aaplQuote?.regulatoryNotice).toContain('Preview market data');

      const status = provider.getStatus();
      expect(status.connected).toBe(false);
      expect(status.status).toBe('PREVIEW');
      expect(status.error).toContain('Missing ALPACA_API_KEY');
    });

    it('normalizes Alpaca IEX bar data with explicit unconsolidated disclosure', () => {
      config.alpaca.apiKey = 'test_key';
      config.alpaca.apiSecret = 'test_secret';

      const provider = new AlpacaMarketDataProvider();

      const barData = {
        c: 228.1,
        o: 226.5,
        h: 229.0,
        l: 226.0,
        v: 154200,
        t: '2026-10-31T19:59:00Z',
      };

      const quote = provider.normalizeBarData('AAPL', barData);

      expect(quote.symbol).toBe('AAPL');
      expect(quote.exchange).toBe('NASDAQ');
      expect(quote.assetType).toBe('EQUITY');
      expect(quote.currency).toBe('USD');
      expect(quote.price).toBe(228.1);
      expect(quote.open).toBe(226.5);
      expect(quote.high).toBe(229.0);
      expect(quote.low).toBe(226.0);
      expect(quote.volume).toBe(154200);
      expect(quote.change).toBeCloseTo(1.6, 2);
      expect(quote.source).toBe('ALPACA_IEX');
      expect(quote.status).toBe('LIVE');
      expect(quote.regulatoryNotice).toContain('Unconsolidated IEX market data');
    });
  });

  describe('3. UpstoxMarketDataProvider (Indian Equities: NSE V3)', () => {
    it('initializes 15 NSE instruments', () => {
      const provider = new UpstoxMarketDataProvider();
      expect(provider.name).toBe('UpstoxMarketDataProvider');
      expect(provider.supportedSymbols.length).toBe(15);
      expect(provider.supportedSymbols).toContain('RELIANCE');
      expect(provider.supportedSymbols).toContain('TCS');
      expect(provider.supportedSymbols).toContain('TATAMOTORS');
    });

    it('operates in compliant PREVIEW mode with official disclaimer when token is absent', async () => {
      config.upstox.accessToken = '';

      const provider = new UpstoxMarketDataProvider();
      expect(provider.hasCredentials()).toBe(false);

      await provider.initialize();

      const relQuote = await provider.getLatestQuote('RELIANCE');
      expect(relQuote).not.toBeNull();
      expect(relQuote?.symbol).toBe('RELIANCE');
      expect(relQuote?.currency).toBe('INR');
      expect(relQuote?.status).toBe('PREVIEW');
      expect(relQuote?.source).toBe('UPSTOX_V3');
      expect(relQuote?.regulatoryNotice).toBe(UpstoxMarketDataProvider.REGULATORY_DISCLAIMER);

      const status = provider.getStatus();
      expect(status.connected).toBe(false);
      expect(status.status).toBe('PREVIEW');
      expect(status.redistributionNotice).toContain('restricted to personal account use');
    });

    it('normalizes Upstox LTP quote data to INR with appropriate fields', () => {
      config.upstox.accessToken = 'test_token';

      const provider = new UpstoxMarketDataProvider();

      const upstoxItem = {
        instrument_token: 'NSE_EQ|INE002A01018',
        last_price: 2985.5,
        cp: 2950.0,
        volume: 3450000,
      };

      const quote = provider.normalizeUpstoxItem('RELIANCE', upstoxItem);

      expect(quote.symbol).toBe('RELIANCE');
      expect(quote.exchange).toBe('NSE');
      expect(quote.assetType).toBe('EQUITY');
      expect(quote.currency).toBe('INR');
      expect(quote.price).toBe(2985.5);
      expect(quote.priceStr).toBe('2985.50');
      expect(quote.previousClose).toBe(2950.0);
      expect(quote.change).toBe(35.5);
      expect(quote.changePercent).toBeCloseTo(1.203, 2);
      expect(quote.source).toBe('UPSTOX_V3');
      expect(quote.status).toBe('LIVE');
      expect(quote.regulatoryNotice).toBe(UpstoxMarketDataProvider.REGULATORY_DISCLAIMER);
    });
  });

  describe('4. Provider Fault Isolation & Graceful Coexistence', () => {
    it('ensures failure in Alpaca or Upstox does not affect Binance or crash the system', async () => {
      // Simulate Alpaca missing keys and Upstox network error
      config.alpaca.apiKey = '';
      config.alpaca.apiSecret = '';
      config.upstox.accessToken = 'invalid_expired_token';

      const binance = new BinanceMarketDataProvider();
      const alpaca = new AlpacaMarketDataProvider();
      const upstox = new UpstoxMarketDataProvider();

      vi.spyOn(upstox, 'fetchRestSnapshot').mockRejectedValue(
        new Error('Upstox token expired')
      );

      // Initialize all concurrently
      await Promise.all([binance.initialize(), alpaca.initialize(), upstox.initialize()]);

      // Alpaca operates in preview
      expect(alpaca.getStatus().status).toBe('PREVIEW');

      // Upstox operates in preview with auth error logged
      expect(upstox.getStatus().status).toBe('PREVIEW');
      expect(upstox.getStatus().error).toContain('Upstox token expired');

      // Binance crypto quotes are available independently
      const btc = await binance.getLatestQuote('BTC-USD');
      expect(btc).not.toBeNull();
      expect(btc?.symbol).toBe('BTC-USD');

      // Stop all streams cleanly
      await Promise.all([binance.stopStreaming(), alpaca.stopStreaming(), upstox.stopStreaming()]);
    });
  });
});
