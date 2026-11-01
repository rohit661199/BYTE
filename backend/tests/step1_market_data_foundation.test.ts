import { describe, it, expect, beforeEach } from 'vitest';
import { InstrumentRegistry, normalizeSymbol } from '../src/services/InstrumentRegistry.js';
import { NseExchangeCalendar } from '../src/services/NseExchangeCalendar.js';
import { db, initDatabase, MIGRATIONS } from '../src/database/db.js';

describe('Phase 03 — Step 1: Market Data Foundation & NSE Integration', () => {
  beforeEach(() => {
    initDatabase();
  });

  describe('1. InstrumentRegistry: 15 NSE Listed Equities', () => {
    const expectedNseSymbols = [
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

    it('registers all 15 NSE instruments in the universe', () => {
      const allInstruments = InstrumentRegistry.getAllInstruments();
      const allSymbols = allInstruments.map((i) => i.symbol);

      for (const symbol of expectedNseSymbols) {
        expect(allSymbols).toContain(symbol);
        const inst = InstrumentRegistry.getInstrument(symbol);
        expect(inst).not.toBeNull();
        expect(inst?.venue).toBe('NSE');
        expect(inst?.sessionType).toBe('NSE_EQUITY');
        expect(inst?.currency).toBe('INR');
      }
    });

    it('enforces Indian stock market precision and lot sizing rules', () => {
      for (const symbol of expectedNseSymbols) {
        const inst = InstrumentRegistry.getInstrument(symbol)!;
        expect(inst.tickSize).toBe(0.05);
        expect(inst.tickSizeBasis).toBe(500n); // 0.05 * 10,000 = 500
        expect(inst.minOrderQuantity).toBe(1);
        expect(inst.minOrderQuantityMicro).toBe(1000000n); // 1.0 * 1,000,000
        expect(inst.quantityStep).toBe(1);
        expect(inst.quantityStepMicro).toBe(1000000n);
        expect(inst.fractionalAllowed).toBe(false); // Whole share lots on NSE
        expect(inst.providerKey).toBeDefined();
        expect(inst.providerKey?.startsWith('NSE_EQ|')).toBe(true);
      }
    });

    it('filters instruments accurately by venue', () => {
      const nseInstruments = InstrumentRegistry.getInstrumentsByVenue('NSE');
      expect(nseInstruments.length).toBe(15);
      expect(nseInstruments.every((i) => i.venue === 'NSE')).toBe(true);

      const nasdaqInstruments = InstrumentRegistry.getInstrumentsByVenue('NASDAQ');
      expect(nasdaqInstruments.length).toBe(5); // AAPL, MSFT, NVDA, TSLA, AMZN
    });

    it('normalizes NSE ticker aliases ending in .NS and .NSE', () => {
      expect(normalizeSymbol('RELIANCE.NS')).toBe('RELIANCE');
      expect(normalizeSymbol('tcs.nse')).toBe('TCS');
      expect(normalizeSymbol('infy.ns')).toBe('INFY');

      const relInst = InstrumentRegistry.getInstrument('RELIANCE.NS');
      expect(relInst).not.toBeNull();
      expect(relInst?.symbol).toBe('RELIANCE');
    });

    it('includes complete company fundamentals and baseline prices for NSE stocks', () => {
      const reliance = InstrumentRegistry.getInstrument('RELIANCE')!;
      expect(reliance.name).toBe('Reliance Industries Ltd');
      expect(reliance.baselinePrice).toBe(2985.50);
      expect(reliance.baselinePriceBasis).toBe(29855000n);
      expect(reliance.fundamentals).toBeDefined();
      expect(reliance.fundamentals?.ceo).toBe('Mukesh Ambani');
      expect(reliance.fundamentals?.marketCap).toContain('₹');
      expect(reliance.fundamentals?._isFixture).toBe(true);

      const tcs = InstrumentRegistry.getInstrument('TCS')!;
      expect(tcs.name).toBe('Tata Consultancy Services Ltd');
      expect(tcs.baselinePrice).toBe(4120.00);
      expect(tcs.fundamentals?.ceo).toBe('K. Krithivasan');
    });
  });

  describe('2. NseExchangeCalendar: Trading Sessions & Indian Holidays', () => {
    it('identifies Asia/Kolkata timezone components correctly', () => {
      // 2026-11-02 04:00:00 UTC = 2026-11-02 09:30:00 IST (UTC+5:30)
      const testDate = new Date(Date.UTC(2026, 10, 2, 4, 0, 0));
      const ist = NseExchangeCalendar.getIstParts(testDate);
      expect(ist.year).toBe(2026);
      expect(ist.month).toBe(11);
      expect(ist.day).toBe(2);
      expect(ist.hour).toBe(9);
      expect(ist.minute).toBe(30);
    });

    it('detects weekends as closed in India', () => {
      // 2026-11-07 is Saturday
      const saturday = new Date(Date.UTC(2026, 10, 7, 5, 0, 0));
      expect(NseExchangeCalendar.isWeekend(saturday)).toBe(true);
      expect(NseExchangeCalendar.getSession(saturday)).toBe('CLOSED');
      expect(NseExchangeCalendar.isMarketOpen(saturday)).toBe(false);

      // 2026-11-08 is Sunday
      const sunday = new Date(Date.UTC(2026, 10, 8, 5, 0, 0));
      expect(NseExchangeCalendar.isWeekend(sunday)).toBe(true);
      expect(NseExchangeCalendar.getSession(sunday)).toBe('CLOSED');
    });

    it('evaluates NSE intraday sessions accurately on weekdays', () => {
      // Monday 2026-11-02 (non-holiday)
      // 09:05 IST (03:35 UTC) -> PRE_MARKET
      const preMarket = new Date(Date.UTC(2026, 10, 2, 3, 35, 0));
      expect(NseExchangeCalendar.getSession(preMarket)).toBe('PRE_MARKET');
      expect(NseExchangeCalendar.isMarketOpen(preMarket)).toBe(false);

      // 09:15 IST (03:45 UTC) -> REGULAR
      const openExact = new Date(Date.UTC(2026, 10, 2, 3, 45, 0));
      expect(NseExchangeCalendar.getSession(openExact)).toBe('REGULAR');
      expect(NseExchangeCalendar.isMarketOpen(openExact)).toBe(true);

      // 12:30 IST (07:00 UTC) -> REGULAR
      const midDay = new Date(Date.UTC(2026, 10, 2, 7, 0, 0));
      expect(NseExchangeCalendar.getSession(midDay)).toBe('REGULAR');
      expect(NseExchangeCalendar.isMarketOpen(midDay)).toBe(true);

      // 15:29 IST (09:59 UTC) -> REGULAR
      const beforeClose = new Date(Date.UTC(2026, 10, 2, 9, 59, 0));
      expect(NseExchangeCalendar.getSession(beforeClose)).toBe('REGULAR');
      expect(NseExchangeCalendar.isMarketOpen(beforeClose)).toBe(true);

      // 15:30 IST (10:00 UTC) -> CLOSED
      const atClose = new Date(Date.UTC(2026, 10, 2, 10, 0, 0));
      expect(NseExchangeCalendar.getSession(atClose)).toBe('CLOSED');
      expect(NseExchangeCalendar.isMarketOpen(atClose)).toBe(false);

      // 15:45 IST (10:15 UTC) -> POST_MARKET
      const postMarket = new Date(Date.UTC(2026, 10, 2, 10, 15, 0));
      expect(NseExchangeCalendar.getSession(postMarket)).toBe('POST_MARKET');
      expect(NseExchangeCalendar.isMarketOpen(postMarket)).toBe(false);

      // 16:15 IST (10:45 UTC) -> CLOSED
      const evening = new Date(Date.UTC(2026, 10, 2, 10, 45, 0));
      expect(NseExchangeCalendar.getSession(evening)).toBe('CLOSED');
    });

    it('enforces official Indian national market holidays', () => {
      // Republic Day: 2026-01-26 (Monday)
      const republicDay = new Date(Date.UTC(2026, 0, 26, 5, 0, 0)); // 10:30 IST
      expect(NseExchangeCalendar.isHoliday(republicDay)).toBe(true);
      expect(NseExchangeCalendar.getSession(republicDay)).toBe('CLOSED');
      expect(NseExchangeCalendar.isMarketOpen(republicDay)).toBe(false);

      // Independence Day: 2025-08-15 (Friday)
      const independenceDay = new Date(Date.UTC(2025, 7, 15, 5, 0, 0)); // 10:30 IST
      expect(NseExchangeCalendar.isHoliday(independenceDay)).toBe(true);
      expect(NseExchangeCalendar.getSession(independenceDay)).toBe('CLOSED');

      // Gandhi Jayanti: 2026-10-02 (Friday)
      const gandhiJayanti = new Date(Date.UTC(2026, 9, 2, 5, 0, 0)); // 10:30 IST
      expect(NseExchangeCalendar.isHoliday(gandhiJayanti)).toBe(true);
      expect(NseExchangeCalendar.getSession(gandhiJayanti)).toBe('CLOSED');
    });

    it('calculates getNextSessionOpen accurately across sessions, weekends, and holidays', () => {
      // Tuesday morning at 08:00 IST -> opens today at 09:15 IST
      const tuesdayMorning = new Date(Date.UTC(2026, 10, 3, 2, 30, 0));
      const nextOpen1 = NseExchangeCalendar.getNextSessionOpen(tuesdayMorning);
      const ist1 = NseExchangeCalendar.getIstParts(nextOpen1);
      expect(ist1.day).toBe(3);
      expect(ist1.hour).toBe(9);
      expect(ist1.minute).toBe(15);

      // Friday evening at 18:00 IST -> opens next Monday at 09:15 IST
      const fridayEvening = new Date(Date.UTC(2026, 10, 6, 12, 30, 0));
      const nextOpenWeekend = NseExchangeCalendar.getNextSessionOpen(fridayEvening);
      const istWeekend = NseExchangeCalendar.getIstParts(nextOpenWeekend);
      expect(istWeekend.day).toBe(9); // Monday Nov 9
      expect(istWeekend.hour).toBe(9);
      expect(istWeekend.minute).toBe(15);
    });
  });

  describe('3. Database: Migration 004 & market_candles Table', () => {
    it('registers migration 004 in the active migrations list', () => {
      expect(MIGRATIONS.some((m) => m.version === 4 && m.name === '004_market_candles_cache')).toBe(true);
    });

    it('stores, queries, and updates historical market candles without collision', () => {
      const now = Date.now();

      // Clean existing test candles
      db.prepare('DELETE FROM market_candles').run();

      // Insert candle 1
      db.prepare(`
        INSERT OR REPLACE INTO market_candles 
        (symbol, interval, timestamp, open, high, low, close, volume, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('RELIANCE', '15m', now - 900000, 2980.0, 2990.0, 2975.0, 2985.5, 45200, 'UPSTOX_V3');

      // Insert candle 2 (latest)
      db.prepare(`
        INSERT OR REPLACE INTO market_candles 
        (symbol, interval, timestamp, open, high, low, close, volume, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('RELIANCE', '15m', now, 2985.5, 2995.0, 2982.0, 2992.0, 62100, 'UPSTOX_V3');

      // Query candles
      const rows = db.prepare(`
        SELECT * FROM market_candles WHERE symbol = ? AND interval = ? ORDER BY timestamp ASC
      `).all('RELIANCE', '15m') as any[];

      expect(rows.length).toBe(2);
      expect(rows[0].open).toBe(2980.0);
      expect(rows[0].close).toBe(2985.5);
      expect(rows[1].open).toBe(2985.5);
      expect(rows[1].close).toBe(2992.0);
      expect(rows[1].source).toBe('UPSTOX_V3');

      // Overwrite/Update existing candle with new tick (idempotent replace)
      db.prepare(`
        INSERT OR REPLACE INTO market_candles 
        (symbol, interval, timestamp, open, high, low, close, volume, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('RELIANCE', '15m', now, 2985.5, 2998.0, 2982.0, 2996.5, 71500, 'UPSTOX_V3');

      const updatedRows = db.prepare(`
        SELECT * FROM market_candles WHERE symbol = ? AND interval = ? ORDER BY timestamp ASC
      `).all('RELIANCE', '15m') as any[];

      expect(updatedRows.length).toBe(2); // Still 2 candles, no duplicate row
      expect(updatedRows[1].high).toBe(2998.0);
      expect(updatedRows[1].close).toBe(2996.5);
      expect(updatedRows[1].volume).toBe(71500);
    });
  });
});
