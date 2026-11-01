import { describe, it, expect } from 'vitest';
import { MathPrecision } from '../src/utils/MathPrecision.js';
import {
  InstrumentRegistry,
  normalizeSymbol,
} from '../src/services/InstrumentRegistry.js';

describe('Step 1: MathPrecision & BigInt Financial Arithmetic', () => {
  describe('Parsing and Formatting', () => {
    it('parses price to basis points (10^4 scale) without floating point loss', () => {
      expect(MathPrecision.parsePriceToBasis('228.10')).toBe(2281000n);
      expect(MathPrecision.parsePriceToBasis('0.01')).toBe(100n);
      expect(MathPrecision.parsePriceToBasis('100')).toBe(1000000n);
      expect(MathPrecision.parsePriceToBasis(135.5)).toBe(1355000n);
    });

    it('parses quantity to micro-units (10^6 scale) without floating point loss', () => {
      expect(MathPrecision.parseQtyToMicro('0.001')).toBe(1000n);
      expect(MathPrecision.parseQtyToMicro('0.0001')).toBe(100n);
      expect(MathPrecision.parseQtyToMicro('1.5')).toBe(1500000n);
      expect(MathPrecision.parseQtyToMicro(5)).toBe(5000000n);
    });

    it('formats basis points to exact price string', () => {
      expect(MathPrecision.formatBasisToPrice(2281000n, 2)).toBe('228.10');
      expect(MathPrecision.formatBasisToPrice(100n, 2)).toBe('0.01');
      expect(MathPrecision.formatBasisToPrice(1000000n, 2)).toBe('100.00');
    });

    it('formats micro-units to exact quantity string', () => {
      expect(MathPrecision.formatMicroToQty(1000n)).toBe('0.001');
      expect(MathPrecision.formatMicroToQty(100n)).toBe('0.0001');
      expect(MathPrecision.formatMicroToQty(1500000n)).toBe('1.5');
      expect(MathPrecision.formatMicroToQty(5000000n)).toBe('5');
    });

    it('formats cash cents to standard USD decimal string', () => {
      expect(MathPrecision.formatCentsToCash(100n)).toBe('1.00');
      expect(MathPrecision.formatCentsToCash(22810n)).toBe('228.10');
      expect(MathPrecision.formatCentsToCash(5n)).toBe('0.05');
    });

    it('throws descriptive error on malformed numeric strings', () => {
      expect(() => MathPrecision.parsePriceToBasis('abc')).toThrow();
      expect(() => MathPrecision.parseQtyToMicro('1.2.3')).toThrow();
    });
  });

  describe('BigInt Notional Calculations & Half-Up Rounding', () => {
    it('calculates notional cash in cents using exact half-up rounding', () => {
      // 1 share of AAPL at $228.10 = $228.10 = 22810 cents
      const p1 = MathPrecision.parsePriceToBasis('228.10');
      const q1 = MathPrecision.parseQtyToMicro('1.0');
      expect(MathPrecision.calculateNotionalCents(p1, q1)).toBe(22810n);

      // Fractional: 0.001 shares of AAPL at $228.10 = $0.2281 -> rounds half-up to 23 cents ($0.23)
      const qFrac = MathPrecision.parseQtyToMicro('0.001');
      expect(MathPrecision.calculateNotionalCents(p1, qFrac)).toBe(23n);

      // 0.001 shares of NVDA at $135.50 = $0.1355 -> rounds half-up to 14 cents ($0.14)
      const pNvda = MathPrecision.parsePriceToBasis('135.50');
      expect(MathPrecision.calculateNotionalCents(pNvda, qFrac)).toBe(14n);
    });

    it('calculates notional USD string helper cleanly', () => {
      expect(MathPrecision.calculateNotionalUsd('228.10', '1.0')).toBe('228.10');
      expect(MathPrecision.calculateNotionalUsd('228.10', '0.001')).toBe('0.23');
      expect(MathPrecision.calculateNotionalUsd('100.00', '5')).toBe('500.00');
    });

    it('safely handles institutional volumes ($100M+) without Number overflow', () => {
      // 1,000,000 shares at $150.00 = $150,000,000 = 15,000,000,000 cents
      const pLarge = MathPrecision.parsePriceToBasis('150.00');
      const qLarge = MathPrecision.parseQtyToMicro('1000000');
      const cents = MathPrecision.calculateNotionalCents(pLarge, qLarge);
      expect(cents).toBe(15_000_000_000n);
      expect(MathPrecision.formatCentsToCash(cents)).toBe('150000000.00');
    });
  });

  describe('Tick Size & Lot Size Validation', () => {
    it('validates price tick sizes correctly', () => {
      const pennyTick = MathPrecision.parsePriceToBasis('0.01'); // 100n
      expect(MathPrecision.isValidTickSize(2281000n, pennyTick)).toBe(true);
      expect(MathPrecision.isValidTickSize(2281050n, pennyTick)).toBe(false); // $228.105 rejected

      const halfDollarTick = MathPrecision.parsePriceToBasis('0.50'); // 5000n
      expect(MathPrecision.isValidTickSize(885000000n, halfDollarTick)).toBe(true); // $88,500.00 valid
      expect(MathPrecision.isValidTickSize(885002500n, halfDollarTick)).toBe(false); // $88,500.25 rejected
    });

    it('validates fractional lot sizes and step sizes', () => {
      const minLot = MathPrecision.parseQtyToMicro('0.001'); // 1000n
      const step = MathPrecision.parseQtyToMicro('0.001'); // 1000n

      // Valid equity quantities
      expect(MathPrecision.isValidQuantity(1000n, minLot, step).valid).toBe(true); // 0.001
      expect(MathPrecision.isValidQuantity(2500n, minLot, step).valid).toBe(false); // 0.0025 invalid step
      expect(MathPrecision.isValidQuantity(500n, minLot, step).valid).toBe(false); // 0.0005 below min lot

      // Whole unit token (BYTE)
      const byteMin = MathPrecision.parseQtyToMicro('1.0'); // 1000000n
      const byteStep = MathPrecision.parseQtyToMicro('1.0');
      expect(MathPrecision.isValidQuantity(1000000n, byteMin, byteStep).valid).toBe(true);
      expect(MathPrecision.isValidQuantity(1500000n, byteMin, byteStep).valid).toBe(false); // 1.5 rejected
    });

    it('validates minimum notional requirement ($1.00 USD)', () => {
      expect(MathPrecision.isValidMinimumNotional(100n)).toBe(true); // $1.00
      expect(MathPrecision.isValidMinimumNotional(150n)).toBe(true); // $1.50
      expect(MathPrecision.isValidMinimumNotional(99n)).toBe(false); // $0.99 rejected
    });
  });
});

describe('Step 1: InstrumentRegistry & Canonical Symbol Normalization', () => {
  describe('Symbol Normalization', () => {
    it('normalizes legacy BYTE and aliases to BYTE-USD', () => {
      expect(normalizeSymbol('BYTE')).toBe('BYTE-USD');
      expect(normalizeSymbol('byte')).toBe('BYTE-USD');
      expect(normalizeSymbol('BYTE-USD')).toBe('BYTE-USD');
      expect(normalizeSymbol('  byte  ')).toBe('BYTE-USD');
      expect(normalizeSymbol('')).toBe('BYTE-USD');
    });

    it('normalizes crypto aliases to canonical pairs', () => {
      expect(normalizeSymbol('BTC')).toBe('BTC-USD');
      expect(normalizeSymbol('btc')).toBe('BTC-USD');
      expect(normalizeSymbol('ETH')).toBe('ETH-USD');
      expect(normalizeSymbol('SOL')).toBe('SOL-USD');
      expect(normalizeSymbol('BTC-USD')).toBe('BTC-USD');
    });

    it('normalizes equity tickers cleanly', () => {
      expect(normalizeSymbol('AAPL')).toBe('AAPL');
      expect(normalizeSymbol('aapl')).toBe('AAPL');
      expect(normalizeSymbol('nvda')).toBe('NVDA');
      expect(normalizeSymbol('msft')).toBe('MSFT');
    });
  });

  describe('Registry Retrieval & Canonical Aliasing', () => {
    it('retrieves canonical BYTE-USD when queried via legacy BYTE alias', () => {
      const instFromAlias = InstrumentRegistry.getInstrument('BYTE');
      const instFromCanonical = InstrumentRegistry.getInstrument('BYTE-USD');

      expect(instFromAlias).not.toBeNull();
      expect(instFromCanonical).not.toBeNull();
      expect(instFromAlias?.symbol).toBe('BYTE-USD');
      expect(instFromCanonical?.symbol).toBe('BYTE-USD');
      expect(instFromAlias).toBe(instFromCanonical); // Exact same reference
    });

    it('retrieves all launch universe instruments', () => {
      const all = InstrumentRegistry.getAllInstruments();
      expect(all.length).toBe(9); // 5 Equities + 3 Crypto + 1 Utility

      const symbols = all.map((i) => i.symbol);
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('MSFT');
      expect(symbols).toContain('NVDA');
      expect(symbols).toContain('TSLA');
      expect(symbols).toContain('AMZN');
      expect(symbols).toContain('BTC-USD');
      expect(symbols).toContain('ETH-USD');
      expect(symbols).toContain('SOL-USD');
      expect(symbols).toContain('BYTE-USD');
    });

    it('filters instruments accurately by asset class', () => {
      const equities = InstrumentRegistry.getInstrumentsByAssetClass('EQUITY');
      expect(equities.length).toBe(5);
      expect(equities.every((e) => e.assetClass === 'EQUITY')).toBe(true);

      const crypto = InstrumentRegistry.getInstrumentsByAssetClass('CRYPTO');
      expect(crypto.length).toBe(3);
      expect(crypto.every((c) => c.assetClass === 'CRYPTO')).toBe(true);

      const utility = InstrumentRegistry.getInstrumentsByAssetClass('UTILITY');
      expect(utility.length).toBe(1);
      expect(utility[0].symbol).toBe('BYTE-USD');
    });

    it('verifies tradability for canonical symbols and aliases', () => {
      expect(InstrumentRegistry.isSymbolTradable('AAPL')).toBe(true);
      expect(InstrumentRegistry.isSymbolTradable('BYTE')).toBe(true);
      expect(InstrumentRegistry.isSymbolTradable('BYTE-USD')).toBe(true);
      expect(InstrumentRegistry.isSymbolTradable('BTC')).toBe(true);
      expect(InstrumentRegistry.isSymbolTradable('UNKNOWN')).toBe(false);
    });

    it('identifies legacy aliases correctly', () => {
      expect(InstrumentRegistry.isLegacyAlias('BYTE')).toBe(true);
      expect(InstrumentRegistry.isLegacyAlias('BYTE-USD')).toBe(false);
      expect(InstrumentRegistry.isLegacyAlias('BTC')).toBe(true);
      expect(InstrumentRegistry.isLegacyAlias('AAPL')).toBe(false);
    });

    it('confirms company fundamentals are clearly marked as development fixtures', () => {
      const aapl = InstrumentRegistry.getInstrument('AAPL');
      expect(aapl?.fundamentals).toBeDefined();
      expect(aapl?.fundamentals?._isFixture).toBe(true);
      expect(aapl?.fundamentals?.ceo).toBe('Tim Cook');
      expect(aapl?.baselinePrice).toBe(228.1);
      expect(aapl?.baselinePriceBasis).toBe(2281000n);
    });
  });
});
