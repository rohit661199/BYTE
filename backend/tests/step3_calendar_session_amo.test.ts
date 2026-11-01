import { describe, it, expect, beforeEach } from 'vitest';
import { ExchangeCalendar } from '../src/services/ExchangeCalendar.js';
import { MarketSessionManager } from '../src/services/MarketSessionManager.js';
import {
  NoOpFundsReservationAdapter,
  FundsReservationAdapterFactory,
} from '../src/services/FundsReservationAdapter.js';
import { InstrumentRegistry } from '../src/services/InstrumentRegistry.js';
import { EngineManager } from '../src/matching-engine/EngineManager.js';
import { OrderModel } from '../src/models/orderModel.js';
import { runMigrations, db } from '../src/database/db.js';
import { Order } from '../src/types/index.js';

describe('Phase 02 — Step 3: ExchangeCalendar, MarketSessionManager & FundsReservationAdapter Suite', () => {
  beforeEach(() => {
    runMigrations();
    try {
      db.prepare('DELETE FROM amo_dispatch_log').run();
    } catch (_) {}
    db.prepare('DELETE FROM trades').run();
    db.prepare('DELETE FROM orders').run();
    FundsReservationAdapterFactory.resetToDefault();
  });

  describe('1. ExchangeCalendar: Timezone, DST, Holidays & Sessions', () => {
    it('accurately resolves local New York time and dynamic DST offset without hardcoding', () => {
      // Summer date (July) - EDT is UTC-4
      const summerUtc = new Date('2026-07-15T14:30:00.000Z');
      const summerNy = ExchangeCalendar.getNyTime(summerUtc);
      expect(summerNy.month).toBe(7);
      expect(summerNy.day).toBe(15);
      expect(summerNy.hour).toBe(10);
      expect(summerNy.minute).toBe(30);
      expect(summerNy.isDst).toBe(true);
      expect(summerNy.timeZoneOffset).toBe('-04:00');

      // Winter date (January) - EST is UTC-5
      const winterUtc = new Date('2026-01-15T15:30:00.000Z');
      const winterNy = ExchangeCalendar.getNyTime(winterUtc);
      expect(winterNy.month).toBe(1);
      expect(winterNy.day).toBe(15);
      expect(winterNy.hour).toBe(10);
      expect(winterNy.minute).toBe(30);
      expect(winterNy.isDst).toBe(false);
      expect(winterNy.timeZoneOffset).toBe('-05:00');
    });

    it('identifies standard trading sessions on a normal weekday', () => {
      // Wednesday, July 15, 2026 (Summer EDT, -04:00)
      // 03:00 ET -> CLOSED
      const closedNight = new Date('2026-07-15T07:00:00.000Z');
      expect(ExchangeCalendar.getSession(closedNight)).toBe('CLOSED');
      expect(ExchangeCalendar.isMarketOpen(closedNight)).toBe(false);

      // 06:00 ET -> PRE_MARKET
      const preMarket = new Date('2026-07-15T10:00:00.000Z');
      expect(ExchangeCalendar.getSession(preMarket)).toBe('PRE_MARKET');
      expect(ExchangeCalendar.isMarketOpen(preMarket)).toBe(false);

      // 10:00 ET -> REGULAR
      const regularMorning = new Date('2026-07-15T14:00:00.000Z');
      expect(ExchangeCalendar.getSession(regularMorning)).toBe('REGULAR');
      expect(ExchangeCalendar.isMarketOpen(regularMorning)).toBe(true);

      // 15:59 ET -> REGULAR
      const regularAfternoon = new Date('2026-07-15T19:59:00.000Z');
      expect(ExchangeCalendar.getSession(regularAfternoon)).toBe('REGULAR');
      expect(ExchangeCalendar.isMarketOpen(regularAfternoon)).toBe(true);

      // 16:30 ET -> AFTER_HOURS
      const afterHours = new Date('2026-07-15T20:30:00.000Z');
      expect(ExchangeCalendar.getSession(afterHours)).toBe('AFTER_HOURS');
      expect(ExchangeCalendar.isMarketOpen(afterHours)).toBe(false);

      // 21:00 ET -> CLOSED
      const closedEvening = new Date('2026-07-16T01:00:00.000Z');
      expect(ExchangeCalendar.getSession(closedEvening)).toBe('CLOSED');
      expect(ExchangeCalendar.isMarketOpen(closedEvening)).toBe(false);
    });

    it('identifies weekend closures', () => {
      // Saturday, July 18, 2026 at 11:00 ET
      const saturday = new Date('2026-07-18T15:00:00.000Z');
      expect(ExchangeCalendar.getSession(saturday)).toBe('CLOSED');
      expect(ExchangeCalendar.isMarketOpen(saturday)).toBe(false);

      // Sunday, July 19, 2026 at 14:00 ET
      const sunday = new Date('2026-07-19T18:00:00.000Z');
      expect(ExchangeCalendar.getSession(sunday)).toBe('CLOSED');
      expect(ExchangeCalendar.isMarketOpen(sunday)).toBe(false);
    });

    it('identifies all 10 official US market holidays', () => {
      // 1. New Year's Day (Jan 1, 2026)
      const nyd = ExchangeCalendar.createNyDate(2026, 1, 1, 10, 0);
      expect(ExchangeCalendar.isHoliday(nyd).isHoliday).toBe(true);
      expect(ExchangeCalendar.getSession(nyd)).toBe('CLOSED');

      // 2. Martin Luther King Jr. Day (3rd Monday in Jan: Jan 19, 2026)
      const mlk = ExchangeCalendar.createNyDate(2026, 1, 19, 10, 0);
      expect(ExchangeCalendar.isHoliday(mlk).isHoliday).toBe(true);
      expect(ExchangeCalendar.getSession(mlk)).toBe('CLOSED');

      // 3. Washington's Birthday / Presidents' Day (3rd Monday in Feb: Feb 16, 2026)
      const pres = ExchangeCalendar.createNyDate(2026, 2, 16, 10, 0);
      expect(ExchangeCalendar.isHoliday(pres).isHoliday).toBe(true);
      expect(ExchangeCalendar.getSession(pres)).toBe('CLOSED');

      // 4. Good Friday (Easter 2026 is April 5 -> Good Friday is April 3, 2026)
      const gf = ExchangeCalendar.createNyDate(2026, 4, 3, 10, 0);
      expect(ExchangeCalendar.isHoliday(gf).isHoliday).toBe(true);
      expect(ExchangeCalendar.getSession(gf)).toBe('CLOSED');

      // 5. Memorial Day (Last Monday in May: May 25, 2026)
      const mem = ExchangeCalendar.createNyDate(2026, 5, 25, 10, 0);
      expect(ExchangeCalendar.isHoliday(mem).isHoliday).toBe(true);
      expect(ExchangeCalendar.getSession(mem)).toBe('CLOSED');

      // 6. Juneteenth (Friday June 19, 2026)
      const june = ExchangeCalendar.createNyDate(2026, 6, 19, 10, 0);
      expect(ExchangeCalendar.isHoliday(june).isHoliday).toBe(true);
      expect(ExchangeCalendar.getSession(june)).toBe('CLOSED');

      // 7. Independence Day (Friday July 3, 2026 observed when July 4 is Saturday)
      const indepObs = ExchangeCalendar.createNyDate(2026, 7, 3, 10, 0);
      expect(ExchangeCalendar.isHoliday(indepObs).isHoliday).toBe(true);
      expect(ExchangeCalendar.getSession(indepObs)).toBe('CLOSED');

      // 8. Labor Day (1st Monday in Sept: Sept 7, 2026)
      const labor = ExchangeCalendar.createNyDate(2026, 9, 7, 10, 0);
      expect(ExchangeCalendar.isHoliday(labor).isHoliday).toBe(true);
      expect(ExchangeCalendar.getSession(labor)).toBe('CLOSED');

      // 9. Thanksgiving Day (4th Thursday in Nov: Nov 26, 2026)
      const thx = ExchangeCalendar.createNyDate(2026, 11, 26, 10, 0);
      expect(ExchangeCalendar.isHoliday(thx).isHoliday).toBe(true);
      expect(ExchangeCalendar.getSession(thx)).toBe('CLOSED');

      // 10. Christmas Day (Friday Dec 25, 2026)
      const xmas = ExchangeCalendar.createNyDate(2026, 12, 25, 10, 0);
      expect(ExchangeCalendar.isHoliday(xmas).isHoliday).toBe(true);
      expect(ExchangeCalendar.getSession(xmas)).toBe('CLOSED');
    });

    it('correctly follows historical Juneteenth rules (SR-NYSE-2021-56: 2021 regular day, 2022 first observed holiday)', () => {
      // Friday June 18, 2021: NYSE did not observe Juneteenth in 2021 (normal trading day)
      const june18_2021 = ExchangeCalendar.createNyDate(2021, 6, 18, 10, 30);
      expect(ExchangeCalendar.isHoliday(june18_2021).isHoliday).toBe(false);
      expect(ExchangeCalendar.getSession(june18_2021)).toBe('REGULAR');
      expect(ExchangeCalendar.isMarketOpen(june18_2021)).toBe(true);

      // Monday June 20, 2022: First official observed Juneteenth holiday (June 19, 2022 was Sunday)
      const june20_2022 = ExchangeCalendar.createNyDate(2022, 6, 20, 10, 30);
      expect(ExchangeCalendar.isHoliday(june20_2022).isHoliday).toBe(true);
      expect(ExchangeCalendar.isHoliday(june20_2022).name).toBe('Juneteenth (Observed)');
      expect(ExchangeCalendar.getSession(june20_2022)).toBe('CLOSED');
      expect(ExchangeCalendar.isMarketOpen(june20_2022)).toBe(false);

      // Future observed Juneteenth: June 18, 2027 (June 19, 2027 is Saturday -> observed Friday)
      const june18_2027 = ExchangeCalendar.createNyDate(2027, 6, 18, 10, 30);
      expect(ExchangeCalendar.isHoliday(june18_2027).isHoliday).toBe(true);
      expect(ExchangeCalendar.isHoliday(june18_2027).name).toBe('Juneteenth (Observed)');
    });

    it('handles official early close sessions (closing at 13:00 ET)', () => {
      // Black Friday 2026: Friday, November 27, 2026
      const blackFridayMorning = ExchangeCalendar.createNyDate(2026, 11, 27, 11, 0);
      expect(ExchangeCalendar.isEarlyClose(blackFridayMorning).isEarlyClose).toBe(true);
      expect(ExchangeCalendar.getSession(blackFridayMorning)).toBe('REGULAR');
      expect(ExchangeCalendar.isMarketOpen(blackFridayMorning)).toBe(true);

      // 13:30 ET on Black Friday is AFTER_HOURS (not regular)
      const blackFridayAfternoon = ExchangeCalendar.createNyDate(2026, 11, 27, 13, 30);
      expect(ExchangeCalendar.getSession(blackFridayAfternoon)).toBe('AFTER_HOURS');
      expect(ExchangeCalendar.isMarketOpen(blackFridayAfternoon)).toBe(false);

      // 18:00 ET on Black Friday is CLOSED (early after-hours ends at 17:00)
      const blackFridayNight = ExchangeCalendar.createNyDate(2026, 11, 27, 18, 0);
      expect(ExchangeCalendar.getSession(blackFridayNight)).toBe('CLOSED');
      expect(ExchangeCalendar.isMarketOpen(blackFridayNight)).toBe(false);
    });

    it('accurately computes getNextSessionOpen across nights, weekends, and holidays', () => {
      // Case A: Before market open on a trading Wednesday (e.g. 07:00 ET) -> returns today 09:30 ET
      const wedMorning = ExchangeCalendar.createNyDate(2026, 7, 15, 7, 0);
      const nextOpenA = ExchangeCalendar.getNextSessionOpen(wedMorning);
      const nyA = ExchangeCalendar.getNyTime(nextOpenA);
      expect(nyA.year).toBe(2026);
      expect(nyA.month).toBe(7);
      expect(nyA.day).toBe(15);
      expect(nyA.hour).toBe(9);
      expect(nyA.minute).toBe(30);

      // Case B: After market close on a trading Wednesday (e.g. 17:00 ET) -> returns Thursday 09:30 ET
      const wedEvening = ExchangeCalendar.createNyDate(2026, 7, 15, 17, 0);
      const nextOpenB = ExchangeCalendar.getNextSessionOpen(wedEvening);
      const nyB = ExchangeCalendar.getNyTime(nextOpenB);
      expect(nyB.day).toBe(16); // Thursday
      expect(nyB.hour).toBe(9);
      expect(nyB.minute).toBe(30);

      // Case C: Friday evening after close (e.g. Friday 18:00 ET) -> skips weekend, returns Monday 09:30 ET
      const friEvening = ExchangeCalendar.createNyDate(2026, 7, 17, 18, 0);
      const nextOpenC = ExchangeCalendar.getNextSessionOpen(friEvening);
      const nyC = ExchangeCalendar.getNyTime(nextOpenC);
      expect(nyC.day).toBe(20); // Monday
      expect(nyC.hour).toBe(9);
      expect(nyC.minute).toBe(30);

      // Case D: Friday before Memorial Day weekend (Friday May 22, 2026, 18:00 ET)
      // Monday May 25 is Memorial Day holiday -> skips weekend & holiday, returns Tuesday May 26 09:30 ET!
      const memFriEvening = ExchangeCalendar.createNyDate(2026, 5, 22, 18, 0);
      const nextOpenD = ExchangeCalendar.getNextSessionOpen(memFriEvening);
      const nyD = ExchangeCalendar.getNyTime(nextOpenD);
      expect(nyD.month).toBe(5);
      expect(nyD.day).toBe(26); // Tuesday!
      expect(nyD.hour).toBe(9);
      expect(nyD.minute).toBe(30);
    });
  });

  describe('2. MarketSessionManager: Multi-Asset Admission & AMO Queuing', () => {
    it('always permits 24/7 continuous trading for crypto and utility instruments', () => {
      // Test at midnight on a Sunday (Equities closed)
      const sundayMidnight = ExchangeCalendar.createNyDate(2026, 7, 19, 0, 30);

      // BTC-USD (Crypto)
      const btcCheck = MarketSessionManager.canExecuteImmediately('BTC-USD', 'LIMIT', sundayMidnight);
      expect(btcCheck.allowed).toBe(true);
      expect(btcCheck.session).toBe('REGULAR');

      // ETH-USD via alias 'ETH'
      const ethCheck = MarketSessionManager.canExecuteImmediately('ETH', 'MARKET', sundayMidnight);
      expect(ethCheck.allowed).toBe(true);
      expect(ethCheck.canonicalSymbol).toBe('ETH-USD');

      // BYTE-USD via legacy alias 'BYTE'
      const byteCheck = MarketSessionManager.canExecuteImmediately('BYTE', 'LIMIT', sundayMidnight);
      expect(byteCheck.allowed).toBe(true);
      expect(byteCheck.canonicalSymbol).toBe('BYTE-USD');
    });

    it('permits immediate execution for equities during regular market hours', () => {
      const regularTime = ExchangeCalendar.createNyDate(2026, 7, 15, 11, 0); // Wednesday 11:00 ET

      const aaplLimit = MarketSessionManager.canExecuteImmediately('AAPL', 'LIMIT', regularTime);
      expect(aaplLimit.allowed).toBe(true);
      expect(aaplLimit.session).toBe('REGULAR');

      const aaplMarket = MarketSessionManager.canExecuteImmediately('AAPL', 'MARKET', regularTime);
      expect(aaplMarket.allowed).toBe(true);
      expect(aaplMarket.session).toBe('REGULAR');
    });

    it('rejects equity market orders outside regular trading hours', () => {
      // Saturday 12:00 ET
      const weekendTime = ExchangeCalendar.createNyDate(2026, 7, 18, 12, 0);
      const msftMarketWeekend = MarketSessionManager.canExecuteImmediately('MSFT', 'MARKET', weekendTime);
      expect(msftMarketWeekend.allowed).toBe(false);
      expect(msftMarketWeekend.queueAsAmo).toBe(false);
      expect(msftMarketWeekend.reason).toContain('Market orders for equities are rejected');

      // Pre-market (06:00 ET)
      const preMarketTime = ExchangeCalendar.createNyDate(2026, 7, 15, 6, 0);
      const nvdaMarketPre = MarketSessionManager.canExecuteImmediately('NVDA', 'MARKET', preMarketTime);
      expect(nvdaMarketPre.allowed).toBe(false);
      expect(nvdaMarketPre.queueAsAmo).toBe(false);
      expect(nvdaMarketPre.reason).toContain('Market orders for equities are rejected');
    });

    it('queues equity limit orders as AMOs outside regular trading hours', () => {
      // Sunday evening 20:00 ET
      const sundayNight = ExchangeCalendar.createNyDate(2026, 7, 19, 20, 0);
      const tslaLimit = MarketSessionManager.canExecuteImmediately('TSLA', 'LIMIT', sundayNight);

      expect(tslaLimit.allowed).toBe(false);
      expect(tslaLimit.queueAsAmo).toBe(true);
      expect(tslaLimit.reason).toContain('Limit order queued as After-Market Order (AMO)');
    });

    it('rejects orders for unknown or invalid symbols', () => {
      const res = MarketSessionManager.canExecuteImmediately('UNKNOWN_XYZ', 'LIMIT');
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Unknown or untradable instrument');
    });
  });

  describe('3. MarketSessionManager: AMO Revalidation & Price Collars', () => {
    it('validates order tick size and quantity step rules', () => {
      const validAmo: Order = {
        id: 'amo_valid_tick',
        side: 'BUY',
        type: 'LIMIT',
        price: 228.1, // Aligns with tick size 0.01
        quantity: 1.0, // Aligns with step 0.001
        remainingQuantity: 1.0,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T00:00:00Z',
        symbol: 'AAPL',
      };
      const validRes = MarketSessionManager.validateAmoOrder(validAmo, 228.1);
      expect(validRes.valid).toBe(true);

      // Invalid tick size (e.g. 228.105 on $0.01 tick)
      const invalidTickAmo: Order = {
        ...validAmo,
        id: 'amo_bad_tick',
        price: 228.105,
      };
      const tickRes = MarketSessionManager.validateAmoOrder(invalidTickAmo, 228.1);
      expect(tickRes.valid).toBe(false);
      expect(tickRes.reason).toContain('does not align with tick size');

      // Invalid quantity (below minOrderQuantity 0.001)
      const invalidQtyAmo: Order = {
        ...validAmo,
        id: 'amo_bad_qty',
        quantity: 0.0001,
      };
      const qtyRes = MarketSessionManager.validateAmoOrder(invalidQtyAmo, 228.1);
      expect(qtyRes.valid).toBe(false);
      expect(qtyRes.reason).toContain('below minimum allowed');
    });

    it('enforces the ±10% price collar strictly', () => {
      const refPrice = 100.0; // Baseline $100.00 -> Allowed collar: $90.00 - $110.00

      // Exact lower bound ($90.00) -> Allowed
      const atLowerCollar: Order = {
        id: 'amo_collar_low',
        side: 'BUY',
        type: 'LIMIT',
        price: 90.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T00:00:00Z',
        symbol: 'AAPL',
      };
      expect(MarketSessionManager.validateAmoOrder(atLowerCollar, refPrice).valid).toBe(true);

      // Exact upper bound ($110.00) -> Allowed
      const atUpperCollar: Order = {
        ...atLowerCollar,
        id: 'amo_collar_high',
        price: 110.0,
      };
      expect(MarketSessionManager.validateAmoOrder(atUpperCollar, refPrice).valid).toBe(true);

      // Outside lower bound ($89.50) -> Rejected
      const belowCollar: Order = {
        ...atLowerCollar,
        id: 'amo_below_collar',
        price: 89.5,
      };
      const belowRes = MarketSessionManager.validateAmoOrder(belowCollar, refPrice);
      expect(belowRes.valid).toBe(false);
      expect(belowRes.reason).toContain('violates ±10% price collar');

      // Outside upper bound ($115.00) -> Rejected
      const aboveCollar: Order = {
        ...atLowerCollar,
        id: 'amo_above_collar',
        price: 115.0,
      };
      const aboveRes = MarketSessionManager.validateAmoOrder(aboveCollar, refPrice);
      expect(aboveRes.valid).toBe(false);
      expect(aboveRes.reason).toContain('violates ±10% price collar');
    });
  });

  describe('4. Market Session Manager: Market Open Atomic Dispatch Cycle', () => {
    it('dispatches valid AMOs to engine and rejects invalid AMOs at market open', async () => {
      const manager = EngineManager.getInstance();
      const aaplEngine = manager.getEngine('AAPL');
      aaplEngine.reset();

      const reservationAdapter = new NoOpFundsReservationAdapter();

      // 1. Valid AMO (Price $228.10 within ±10% of baseline $228.10)
      OrderModel.create({
        id: 'amo_valid_dispatch',
        side: 'BUY',
        type: 'LIMIT',
        price: 228.1,
        quantity: 10,
        remainingQuantity: 10,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T05:00:00Z',
        symbol: 'AAPL',
      });
      await reservationAdapter.reserveFunds({
        orderId: 'amo_valid_dispatch',
        symbol: 'AAPL',
        side: 'BUY',
        price: 228.1,
        quantity: 10,
      });

      // 2. Invalid AMO (Price $500.00 violates ±10% collar of baseline $228.10)
      OrderModel.create({
        id: 'amo_invalid_collar',
        side: 'BUY',
        type: 'LIMIT',
        price: 500.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T05:01:00Z',
        symbol: 'AAPL',
      });
      await reservationAdapter.reserveFunds({
        orderId: 'amo_invalid_collar',
        symbol: 'AAPL',
        side: 'BUY',
        price: 500.0,
        quantity: 5,
      });

      expect(reservationAdapter.getActiveCount()).toBe(2);

      // Execute market open dispatch
      const summary = await MarketSessionManager.dispatchMarketOpenAmos('AAPL', reservationAdapter);

      expect(summary.total).toBe(2);
      expect(summary.dispatched).toBe(1);
      expect(summary.rejected).toBe(1);

      // 1. Valid AMO is now PENDING and inside AAPL MatchingEngine
      const validDb = OrderModel.findById('amo_valid_dispatch');
      expect(validDb?.status).toBe('PENDING');
      expect(validDb?.dispatchedAt).toBeDefined();

      const aaplBook = aaplEngine.getOrderBookSnapshot();
      expect(aaplBook.bids.length).toBe(1);
      expect(aaplBook.bids[0].price).toBe(228.1);

      // 2. Invalid AMO is now REJECTED in database
      const invalidDb = OrderModel.findById('amo_invalid_collar');
      expect(invalidDb?.status).toBe('REJECTED');

      // Reservations were processed (valid committed, invalid released)
      expect(reservationAdapter.getActiveCount()).toBe(0);
    });

    it('safely skips AMOs that were cancelled before market open', async () => {
      const reservationAdapter = new NoOpFundsReservationAdapter();

      OrderModel.create({
        id: 'amo_to_cancel',
        side: 'BUY',
        type: 'LIMIT',
        price: 228.1,
        quantity: 5,
        remainingQuantity: 5,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T05:00:00Z',
        symbol: 'AAPL',
      });

      // User cancels AMO before market open
      OrderModel.cancel('amo_to_cancel');
      expect(OrderModel.findById('amo_to_cancel')?.status).toBe('CANCELLED');

      // Market open dispatch query finds zero queued AMOs
      const summary = await MarketSessionManager.dispatchMarketOpenAmos('AAPL', reservationAdapter);
      expect(summary.total).toBe(0);
      expect(summary.dispatched).toBe(0);
    });
  });

  describe('5. FundsReservationAdapter: NoOp Preview Behavior & Disclosures', () => {
    it('creates SIMULATED_NOOP reservations with exact BigInt cents calculations', async () => {
      const adapter = new NoOpFundsReservationAdapter();

      // Reserve funds for 10 shares @ $150.25 = $1502.50 = 150250 cents
      const result = await adapter.reserveFunds({
        orderId: 'test_ord_1',
        userId: 'usr_preview',
        symbol: 'AAPL',
        side: 'BUY',
        price: '150.25',
        quantity: '10.0',
      });

      expect(result.success).toBe(true);
      expect(result.reservationId).toBe('noop_res_test_ord_1');
      expect(result.status).toBe('SIMULATED_NOOP');
      expect(result.reservedAmountCents).toBe(150250n);
      expect(result.message).toContain('Simulated NoOp reservation preview (Phase 02)');

      expect(adapter.getActiveCount()).toBe(1);

      // Release reservation
      const releaseSuccess = await adapter.releaseReservation('noop_res_test_ord_1');
      expect(releaseSuccess).toBe(true);
      expect(adapter.getActiveCount()).toBe(0);
    });

    it('factory provides consistent adapter instance and supports test overriding', async () => {
      const defaultAdapter = FundsReservationAdapterFactory.getAdapter();
      expect(defaultAdapter).toBeInstanceOf(NoOpFundsReservationAdapter);

      const customMock: any = {
        reserveFunds: async () => ({
          success: true,
          reservationId: 'mock_res',
          status: 'SIMULATED_NOOP',
          reservedAmountCents: 100n,
        }),
        releaseReservation: async () => true,
        commitReservation: async () => true,
      };

      FundsReservationAdapterFactory.setAdapter(customMock);
      expect(FundsReservationAdapterFactory.getAdapter()).toBe(customMock);

      FundsReservationAdapterFactory.resetToDefault();
      expect(FundsReservationAdapterFactory.getAdapter()).toBeInstanceOf(NoOpFundsReservationAdapter);
    });
  });
});
