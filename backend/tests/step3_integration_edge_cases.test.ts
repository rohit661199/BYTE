import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'http';
import app from '../src/index.js';
import { db } from '../src/database/db.js';
import { OrderModel } from '../src/models/orderModel.js';
import { TradeModel } from '../src/models/tradeModel.js';
import { OrderService } from '../src/services/orderService.js';
import { MarketSessionManager } from '../src/services/MarketSessionManager.js';
import { ExchangeCalendar } from '../src/services/ExchangeCalendar.js';
import { AmoScheduler } from '../src/services/AmoScheduler.js';
import { FundsReservationAdapterFactory, NoOpFundsReservationAdapter } from '../src/services/FundsReservationAdapter.js';
import { EngineManager } from '../src/matching-engine/EngineManager.js';
import { TimeProvider } from '../src/utils/TimeProvider.js';

describe('Phase 02 — Step 3: Focused Integration & Edge-Case Verification Pass', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Start actual Express HTTP server on ephemeral port for authentic network tests
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    AmoScheduler.stop();
    TimeProvider.reset();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    TimeProvider.reset();
    OrderService.resetExchange();
    FundsReservationAdapterFactory.resetToDefault();
  });

  // =========================================================================
  // 1. ACTUAL ORDER SUBMISSION INTEGRATION (Trace: HTTP -> Validation -> Session -> Engine/AMO -> DB -> Response)
  // =========================================================================
  describe('1. Actual Order Submission API Integration Flow', () => {
    it('should submit an AAPL limit order during regular hours (201 Created, PENDING, X-BYTE-Reservation header)', async () => {
      // Wednesday 10:30 AM ET (14:30 UTC) during regular hours
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          side: 'BUY',
          type: 'LIMIT',
          price: 228.1,
          quantity: 2,
        }),
      });

      expect(res.status).toBe(201);
      expect(res.headers.get('x-byte-reservation')).toBe('simulated-preview');

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.order.symbol).toBe('AAPL');
      expect(body.data.order.status).toBe('PENDING');
      expect(body.data.trades).toEqual([]);
      expect(body.data.reservation).toBeDefined();
      expect(body.data.reservation.status).toBe('SIMULATED_NOOP');
      expect(body.data.reservation.reservedAmountCents).toBe('45620'); // 2 * $228.10 = $456.20 = 45620 cents

      // Verify DB persistence
      const persisted = OrderModel.findById(body.data.order.id);
      expect(persisted).not.toBeNull();
      expect(persisted?.status).toBe('PENDING');
      expect(persisted?.symbol).toBe('AAPL');

      // Verify presence in AAPL matching engine order book
      const book = EngineManager.getInstance().getEngine('AAPL').getOrderBook();
      expect(book.bids.length).toBe(1);
      expect(book.bids[0].price).toBe(228.1);
    });

    it('should queue an AAPL limit order outside regular hours as QUEUED_AMO (201 Created, QUEUED_AMO, not in engine)', async () => {
      // Wednesday 9:00 PM ET (Thursday 01:00 UTC) outside regular hours
      TimeProvider.setMockTime(new Date('2024-07-11T01:00:00Z'));

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          side: 'BUY',
          type: 'LIMIT',
          price: 228.1,
          quantity: 1,
        }),
      });

      expect(res.status).toBe(201);
      expect(res.headers.get('x-byte-reservation')).toBe('simulated-preview');

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('After-Market Order (AMO)');
      expect(body.data.order.status).toBe('QUEUED_AMO');
      expect(body.data.reservation.status).toBe('SIMULATED_NOOP');

      // Verify DB persistence
      const persisted = OrderModel.findById(body.data.order.id);
      expect(persisted?.status).toBe('QUEUED_AMO');

      // Verify order is NOT resting in matching engine yet
      const book = EngineManager.getInstance().getEngine('AAPL').getOrderBook();
      expect(book.bids.length).toBe(0);
    });

    it('should reject an AAPL market order outside regular hours with 400 Bad Request and MARKET_CLOSED', async () => {
      // Saturday 2:00 PM ET (Closed)
      TimeProvider.setMockTime(new Date('2024-07-13T18:00:00Z'));

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          side: 'BUY',
          type: 'MARKET',
          price: 0,
          quantity: 1,
        }),
      });

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MARKET_CLOSED');
      expect(body.error.message).toContain('Market orders for equities are rejected outside regular trading hours');
    });

    it('should allow BTC-USD order during a weekend continuously (201 Created, 24/7 continuous trading)', async () => {
      // Sunday 11:00 AM ET (15:00 UTC)
      TimeProvider.setMockTime(new Date('2024-07-14T15:00:00Z'));

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 65000,
          quantity: 0.5,
        }),
      });

      expect(res.status).toBe(201);
      expect(res.headers.get('x-byte-reservation')).toBe('simulated-preview');

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.order.symbol).toBe('BTC-USD');
      expect(body.data.order.status).toBe('PENDING');

      // Verify presence in BTC-USD engine
      const book = EngineManager.getInstance().getEngine('BTC-USD').getOrderBook();
      expect(book.bids.length).toBe(1);
      expect(book.bids[0].price).toBe(65000);
    });

    it('should prevent client from bypassing market-session restrictions by supplying past regular-hours timestamp in payload', async () => {
      // Server clock is currently on a weekend (Saturday 2:00 PM ET)
      TimeProvider.setMockTime(new Date('2024-07-13T18:00:00Z'));

      // Attacker attempts to spoof a Wednesday regular-hours timestamp (10:30 AM ET)
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'AAPL',
          side: 'BUY',
          type: 'MARKET',
          price: 0,
          quantity: 1,
          submissionTime: '2024-07-10T14:30:00Z', // Attempted timestamp bypass
        }),
      });

      // Must be rejected because server derives timestamp internally from TimeProvider, never client payload
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MARKET_CLOSED');
    });
  });

  // =========================================================================
  // 2. AUTOMATIC AMO DISPATCH & SCHEDULER LIFECYCLE
  // =========================================================================
  describe('2. Automatic AMO Dispatch & Scheduler Lifecycle', () => {
    it('should schedule next session open automatically without manual triggering', () => {
      AmoScheduler.start();
      expect(AmoScheduler.isRunning()).toBe(true);
      AmoScheduler.stop();
      expect(AmoScheduler.isRunning()).toBe(false);
    });

    it('should dispatch all queued AMOs in FIFO order on market open and inject into engine', async () => {
      const adapter = FundsReservationAdapterFactory.getAdapter();

      // Queue 2 AMOs for AAPL while closed
      const order1 = OrderService.createOrder(
        { symbol: 'AAPL', side: 'BUY', type: 'LIMIT', price: 225.0, quantity: 2 },
        new Date('2024-07-11T01:00:00Z') // after-hours
      );
      const order2 = OrderService.createOrder(
        { symbol: 'AAPL', side: 'SELL', type: 'LIMIT', price: 235.0, quantity: 3 },
        new Date('2024-07-11T02:00:00Z') // after-hours
      );

      expect(order1.order.status).toBe('QUEUED_AMO');
      expect(order2.order.status).toBe('QUEUED_AMO');
      expect(OrderModel.getQueuedAmoOrders('AAPL').length).toBe(2);

      // Trigger automatic dispatch
      const summary = await AmoScheduler.triggerNow('AAPL');
      expect(summary.total).toBe(2);
      expect(summary.dispatched).toBe(2);
      expect(summary.rejected).toBe(0);

      // Verify orders transitioned to PENDING in DB
      const dbOrder1 = OrderModel.findById(order1.order.id);
      const dbOrder2 = OrderModel.findById(order2.order.id);
      expect(dbOrder1?.status).toBe('PENDING');
      expect(dbOrder2?.status).toBe('PENDING');

      // Verify orders now rest in AAPL matching engine
      const book = EngineManager.getInstance().getEngine('AAPL').getOrderBook();
      expect(book.bids.length).toBe(1);
      expect(book.bids[0].price).toBe(225.0);
      expect(book.asks.length).toBe(1);
      expect(book.asks[0].price).toBe(235.0);
    });

    it('should catch up and dispatch queued AMOs if server starts during market hours', async () => {
      // Mock market open check to return true
      const isMarketOpenSpy = vi.spyOn(ExchangeCalendar, 'isMarketOpen').mockReturnValue(true);

      // Queue an AMO directly in SQLite (simulating pre-existing database record)
      OrderModel.create({
        id: 'amo_pre_existing_1',
        side: 'BUY',
        type: 'LIMIT',
        price: 228.1,
        quantity: 1,
        remainingQuantity: 1,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10T12:00:00Z',
        symbol: 'AAPL',
      });

      expect(OrderModel.getQueuedAmoOrders('AAPL').length).toBe(1);

      // Start AmoScheduler - should detect market open and dispatch immediately
      AmoScheduler.start();

      // Allow async catch-up to settle
      await new Promise((r) => setTimeout(r, 50));

      const updated = OrderModel.findById('amo_pre_existing_1');
      expect(updated?.status).toBe('PENDING');

      AmoScheduler.stop();
      isMarketOpenSpy.mockRestore();
    });

    it('should prevent duplicate / overlapping dispatch invocations via concurrency lock', async () => {
      let resolveDispatch: () => void = () => {};
      const dispatchPromise = new Promise<void>((r) => (resolveDispatch = r));

      // Spy on dispatchMarketOpenAmos to hang until released
      const originalDispatch = MarketSessionManager.dispatchMarketOpenAmos;
      vi.spyOn(MarketSessionManager, 'dispatchMarketOpenAmos').mockImplementationOnce(async () => {
        await dispatchPromise;
        return { dispatched: 1, rejected: 0, skipped: 0, total: 1, results: [] };
      });

      // Launch invocation 1 (holds lock)
      const run1 = AmoScheduler.triggerNow();
      expect(AmoScheduler.isLocked()).toBe(true);

      // Launch invocation 2 while invocation 1 is locked
      const run2 = await AmoScheduler.triggerNow();
      expect(run2.skipped).toBe(0);
      expect(run2.total).toBe(0); // Safely rejected duplicate run

      // Complete run 1
      resolveDispatch();
      await run1;
      expect(AmoScheduler.isLocked()).toBe(false);

      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // 3. EXCHANGE CALENDAR EDGE CASES
  // =========================================================================
  describe('3. Exchange Calendar Edge Cases', () => {
    it('should handle July 4 on Saturday (2020): Friday July 3 observed holiday, weekend closed', () => {
      // 2020-07-04 was Saturday -> Observed Friday July 3
      const friJul3 = new Date('2020-07-03T16:00:00Z'); // 12:00 ET
      const satJul4 = new Date('2020-07-04T16:00:00Z');
      const sunJul5 = new Date('2020-07-05T16:00:00Z');

      expect(ExchangeCalendar.isHoliday(friJul3).isHoliday).toBe(true);
      expect(ExchangeCalendar.isHoliday(friJul3).name).toBe('Independence Day (Observed)');
      expect(ExchangeCalendar.isEarlyClose(friJul3).isEarlyClose).toBe(false); // Observed holiday, not early close!
      expect(ExchangeCalendar.getSession(friJul3)).toBe('CLOSED');
      expect(ExchangeCalendar.getSession(satJul4)).toBe('CLOSED');
      expect(ExchangeCalendar.getSession(sunJul5)).toBe('CLOSED');
    });

    it('should handle July 4 on Sunday (2021): Monday July 5 observed holiday', () => {
      // 2021-07-04 was Sunday -> Observed Monday July 5
      const sunJul4 = new Date('2021-07-04T16:00:00Z');
      const monJul5 = new Date('2021-07-05T16:00:00Z');

      expect(ExchangeCalendar.getSession(sunJul4)).toBe('CLOSED');
      expect(ExchangeCalendar.isHoliday(monJul5).isHoliday).toBe(true);
      expect(ExchangeCalendar.isHoliday(monJul5).name).toBe('Independence Day (Observed)');
      expect(ExchangeCalendar.getSession(monJul5)).toBe('CLOSED');
    });

    it('should handle Christmas on Saturday (2021): Friday Dec 24 observed holiday, not early close', () => {
      // 2021-12-25 was Saturday -> Observed Friday Dec 24
      const friDec24 = new Date('2021-12-24T16:00:00Z');
      const satDec25 = new Date('2021-12-25T16:00:00Z');

      expect(ExchangeCalendar.isHoliday(friDec24).isHoliday).toBe(true);
      expect(ExchangeCalendar.isHoliday(friDec24).name).toBe('Christmas Day (Observed)');
      expect(ExchangeCalendar.isEarlyClose(friDec24).isEarlyClose).toBe(false); // Must be full closure, not early close
      expect(ExchangeCalendar.getSession(friDec24)).toBe('CLOSED');
      expect(ExchangeCalendar.getSession(satDec25)).toBe('CLOSED');
    });

    it('should handle Christmas on Sunday (2022): Monday Dec 26 observed holiday', () => {
      // 2022-12-25 was Sunday -> Observed Monday Dec 26
      const sunDec25 = new Date('2022-12-25T16:00:00Z');
      const monDec26 = new Date('2022-12-26T16:00:00Z');

      expect(ExchangeCalendar.getSession(sunDec25)).toBe('CLOSED');
      expect(ExchangeCalendar.isHoliday(monDec26).isHoliday).toBe(true);
      expect(ExchangeCalendar.isHoliday(monDec26).name).toBe('Christmas Day (Observed)');
      expect(ExchangeCalendar.getSession(monDec26)).toBe('CLOSED');
    });

    it('should correctly handle historical Juneteenth rules (2021 regular day per SR-NYSE-2021-56, 2022 first observed holiday)', () => {
      // 2021: Friday June 18 was NOT an observed exchange holiday (normal trading day)
      const friJun18_2021 = new Date('2021-06-18T16:00:00Z'); // 12:00 PM ET
      expect(ExchangeCalendar.isHoliday(friJun18_2021).isHoliday).toBe(false);
      expect(ExchangeCalendar.getSession(friJun18_2021)).toBe('REGULAR');
      expect(ExchangeCalendar.isMarketOpen(friJun18_2021)).toBe(true);

      // 2022: June 19 was Sunday -> Monday June 20 was the first official observed holiday closure
      const monJun20_2022 = new Date('2022-06-20T16:00:00Z'); // 12:00 PM ET
      expect(ExchangeCalendar.isHoliday(monJun20_2022).isHoliday).toBe(true);
      expect(ExchangeCalendar.isHoliday(monJun20_2022).name).toBe('Juneteenth (Observed)');
      expect(ExchangeCalendar.getSession(monJun20_2022)).toBe('CLOSED');
      expect(ExchangeCalendar.isMarketOpen(monJun20_2022)).toBe(false);

      // Future observed Juneteenth: June 18, 2027 (June 19, 2027 is Saturday -> observed Friday)
      const friJun18_2027 = new Date('2027-06-18T16:00:00Z');
      expect(ExchangeCalendar.isHoliday(friJun18_2027).isHoliday).toBe(true);
      expect(ExchangeCalendar.isHoliday(friJun18_2027).name).toBe('Juneteenth (Observed)');
    });

    it('should handle July 3 early close applicability (2024: Wednesday July 3 closes at 13:00 ET)', () => {
      // 2024: July 4 is Thursday. Wednesday July 3 is early close at 13:00 ET (17:00 UTC).
      const wedJul3_11am = new Date('2024-07-03T15:00:00Z'); // 11:00 AM ET
      const wedJul3_1330 = new Date('2024-07-03T17:30:00Z'); // 1:30 PM ET

      const earlyClose = ExchangeCalendar.isEarlyClose(wedJul3_11am);
      expect(earlyClose.isEarlyClose).toBe(true);
      expect(earlyClose.closeHour).toBe(13);
      expect(earlyClose.closeMinute).toBe(0);

      // At 11:00 AM ET: Session is REGULAR
      expect(ExchangeCalendar.getSession(wedJul3_11am)).toBe('REGULAR');

      // At 1:30 PM ET: Session is AFTER_HOURS
      expect(ExchangeCalendar.getSession(wedJul3_1330)).toBe('AFTER_HOURS');
    });

    it('should handle Christmas Eve early close (2024: Tuesday Dec 24 closes at 13:00 ET)', () => {
      // 2024: Dec 25 is Wednesday. Tuesday Dec 24 is Christmas Eve early close.
      const tueDec24_10am = new Date('2024-12-24T15:00:00Z'); // 10:00 AM ET
      const tueDec24_1315 = new Date('2024-12-24T18:15:00Z'); // 1:15 PM ET

      const earlyClose = ExchangeCalendar.isEarlyClose(tueDec24_10am);
      expect(earlyClose.isEarlyClose).toBe(true);
      expect(earlyClose.closeHour).toBe(13);

      expect(ExchangeCalendar.getSession(tueDec24_10am)).toBe('REGULAR');
      expect(ExchangeCalendar.getSession(tueDec24_1315)).toBe('AFTER_HOURS');
    });

    it('should handle Black Friday early close (2024: Friday Nov 29 closes at 13:00 ET)', () => {
      // 2024: Thanksgiving is Thursday Nov 28. Black Friday is Friday Nov 29.
      const friNov29_11am = new Date('2024-11-29T16:00:00Z'); // 11:00 AM ET (UTC-5)
      const friNov29_1400 = new Date('2024-11-29T19:00:00Z'); // 2:00 PM ET (UTC-5)

      const earlyClose = ExchangeCalendar.isEarlyClose(friNov29_11am);
      expect(earlyClose.isEarlyClose).toBe(true);
      expect(earlyClose.closeHour).toBe(13);

      expect(ExchangeCalendar.getSession(friNov29_11am)).toBe('REGULAR');
      expect(ExchangeCalendar.getSession(friNov29_1400)).toBe('AFTER_HOURS');
    });

    it('should handle DST transition boundaries correctly in March and November', () => {
      // March 2024: Spring forward on Sunday March 10 (UTC-5 -> UTC-4)
      const beforeMarchDst = new Date('2024-03-08T14:30:00Z'); // Friday 09:30 ET
      const afterMarchDst = new Date('2024-03-11T13:30:00Z'); // Monday 09:30 ET

      const nyBeforeMarch = ExchangeCalendar.getNyTime(beforeMarchDst);
      const nyAfterMarch = ExchangeCalendar.getNyTime(afterMarchDst);

      expect(nyBeforeMarch.isDst).toBe(false);
      expect(nyBeforeMarch.timeZoneOffset).toBe('-05:00');
      expect(nyBeforeMarch.hour).toBe(9);
      expect(nyBeforeMarch.minute).toBe(30);

      expect(nyAfterMarch.isDst).toBe(true);
      expect(nyAfterMarch.timeZoneOffset).toBe('-04:00');
      expect(nyAfterMarch.hour).toBe(9);
      expect(nyAfterMarch.minute).toBe(30);

      // November 2024: Fall back on Sunday Nov 3 (UTC-4 -> UTC-5)
      const beforeNovDst = new Date('2024-11-01T13:30:00Z'); // Friday 09:30 ET
      const afterNovDst = new Date('2024-11-04T14:30:00Z'); // Monday 09:30 ET

      const nyBeforeNov = ExchangeCalendar.getNyTime(beforeNovDst);
      const nyAfterNov = ExchangeCalendar.getNyTime(afterNovDst);

      expect(nyBeforeNov.isDst).toBe(true);
      expect(nyBeforeNov.timeZoneOffset).toBe('-04:00');

      expect(nyAfterNov.isDst).toBe(false);
      expect(nyAfterNov.timeZoneOffset).toBe('-05:00');
    });

    it('should calculate getNextSessionOpen correctly across holidays and long weekends', () => {
      // 1. Friday after-hours -> Monday 09:30 ET
      const friEvening = new Date('2024-07-12T22:00:00Z'); // Friday 18:00 ET
      const nextMon = ExchangeCalendar.getNextSessionOpen(friEvening);
      const nyNextMon = ExchangeCalendar.getNyTime(nextMon);
      expect(nyNextMon.dayOfWeek).toBe(1); // Monday
      expect(nyNextMon.day).toBe(15); // July 15
      expect(nyNextMon.hour).toBe(9);
      expect(nyNextMon.minute).toBe(30);

      // 2. Friday before Memorial Day (Monday May 27, 2024 is holiday) -> Tuesday May 28 09:30 ET
      const friBeforeMemorial = new Date('2024-05-24T22:00:00Z');
      const nextAfterMemorial = ExchangeCalendar.getNextSessionOpen(friBeforeMemorial);
      const nyAfterMemorial = ExchangeCalendar.getNyTime(nextAfterMemorial);
      expect(nyAfterMemorial.dayOfWeek).toBe(2); // Tuesday
      expect(nyAfterMemorial.day).toBe(28); // May 28
      expect(nyAfterMemorial.hour).toBe(9);
      expect(nyAfterMemorial.minute).toBe(30);

      // 3. Wednesday before Thanksgiving (Thursday Nov 28, 2024 is holiday) -> Friday Nov 29 09:30 ET
      const wedBeforeThanksgiving = new Date('2024-11-27T22:00:00Z');
      const nextAfterThanksgiving = ExchangeCalendar.getNextSessionOpen(wedBeforeThanksgiving);
      const nyAfterThanksgiving = ExchangeCalendar.getNyTime(nextAfterThanksgiving);
      expect(nyAfterThanksgiving.dayOfWeek).toBe(5); // Friday
      expect(nyAfterThanksgiving.day).toBe(29); // Nov 29 (Black Friday)
      expect(nyAfterThanksgiving.hour).toBe(9);
      expect(nyAfterThanksgiving.minute).toBe(30);
    });
  });

  // =========================================================================
  // 4. AMO EXECUTION FAILURE SAFETY & RECOVERY
  // =========================================================================
  describe('4. AMO Execution Failure Safety & Recovery', () => {
    it('should catch matching engine execution failure when 0 trades occurred, mark order REJECTED, and release funds reservation', async () => {
      const adapter = FundsReservationAdapterFactory.getAdapter();

      // Queue an AMO
      const order = OrderService.createOrder(
        { symbol: 'AAPL', side: 'BUY', type: 'LIMIT', price: 228.1, quantity: 1 },
        new Date('2024-07-11T01:00:00Z')
      );
      expect(order.order.status).toBe('QUEUED_AMO');

      // Mock matching engine to throw during processOrder
      const engine = EngineManager.getInstance().getEngine('AAPL');
      const processOrderSpy = vi.spyOn(engine, 'processOrder').mockImplementationOnce(() => {
        throw new Error('Fatal SQLite disk error during trade settlement');
      });

      // Dispatch AMO
      const summary = await MarketSessionManager.dispatchMarketOpenAmos('AAPL');

      expect(summary.total).toBe(1);
      expect(summary.dispatched).toBe(0);
      expect(summary.rejected).toBe(1);
      expect(summary.results[0].status).toBe('REJECTED');
      expect(summary.results[0].reason).toContain('Fatal SQLite disk error');

      // Verify DB status is REJECTED (order is NEVER permanently stranded as PENDING or DISPATCHED)
      const dbOrder = OrderModel.findById(order.order.id);
      expect(dbOrder?.status).toBe('REJECTED');

      // Verify funds reservation was safely released
      expect(adapter.getActiveReservation(order.order.id)).toBeUndefined();
      expect(adapter.getActiveCount()).toBe(0);

      processOrderSpy.mockRestore();
    });

    it('should safely handle cancellation race condition before dispatch', async () => {
      // Queue an AMO
      const order = OrderService.createOrder(
        { symbol: 'AAPL', side: 'BUY', type: 'LIMIT', price: 228.1, quantity: 1 },
        new Date('2024-07-11T01:00:00Z')
      );

      // User cancels before dispatch
      OrderService.cancelOrder(order.order.id);
      expect(OrderModel.findById(order.order.id)?.status).toBe('CANCELLED');

      // Market open occurs -> dispatch should skip cancelled order
      const summary = await MarketSessionManager.dispatchMarketOpenAmos('AAPL');
      expect(summary.total).toBe(0); // getQueuedAmoOrders only fetches QUEUED_AMO
      expect(summary.dispatched).toBe(0);

      // Ensure cancelled AMO is never on orderbook
      const book = EngineManager.getInstance().getEngine('AAPL').getOrderBook();
      expect(book.bids.length).toBe(0);
    });

    it('should preserve legitimate partial fills transaction-safely if engine throws after trade execution', async () => {
      const adapter = FundsReservationAdapterFactory.getAdapter();

      // Seed resting counter-order (SELL 4 AAPL @ 225.0) directly in matching engine and DB
      const restingAsk = OrderModel.create({
        id: 'maker_ask_seed_1',
        side: 'SELL',
        type: 'LIMIT',
        price: 225.0,
        quantity: 4,
        remainingQuantity: 4,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        symbol: 'AAPL',
      });
      const engine = EngineManager.getInstance().getEngine('AAPL');
      engine.hydrateFromDatabase();
      expect(engine.getOrderBook().asks.length).toBe(1);

      // Queue an AMO for 10 AAPL @ 225.0 (which would match the 4 resting asks)
      const amoOrder = OrderService.createOrder(
        { symbol: 'AAPL', side: 'BUY', type: 'LIMIT', price: 225.0, quantity: 10 },
        new Date('2024-07-11T01:00:00Z')
      );
      expect(amoOrder.order.status).toBe('QUEUED_AMO');

      // Spy on engine.processOrder to execute real matching (persisting trade for 4 units), then throw
      const realProcess = engine.processOrder.bind(engine);
      const engineSpy = vi.spyOn(engine, 'processOrder').mockImplementationOnce((order) => {
        realProcess(order);
        throw new Error('Simulated post-match database exception');
      });

      // Dispatch AMO
      const summary = await MarketSessionManager.dispatchMarketOpenAmos('AAPL');

      // Crucial: The dispatch result notes the partial fill preservation, NOT a blind rejection!
      expect(summary.total).toBe(1);
      expect(summary.dispatched).toBe(1);
      expect(summary.rejected).toBe(0);

      // Verify the order in DB is PARTIALLY_FILLED (NOT REJECTED!) and remaining quantity is 6
      const persistedAmo = OrderModel.findById(amoOrder.order.id);
      expect(persistedAmo?.status).toBe('PARTIALLY_FILLED');
      expect(persistedAmo?.remainingQuantity).toBe(6);

      // Verify the persisted trade of 4 units was preserved
      const trades = TradeModel.findByOrderId(amoOrder.order.id);
      expect(trades.length).toBe(1);
      expect(trades[0].quantity).toBe(4);
      expect(trades[0].price).toBe(225.0);

      // Verify maker ask was filled
      const updatedMaker = OrderModel.findById('maker_ask_seed_1');
      expect(updatedMaker?.status).toBe('FILLED');
      expect(updatedMaker?.remainingQuantity).toBe(0);

      engineSpy.mockRestore();
    });

    it('should simulate process restart at each critical lifecycle point without duplicate trades or fills', async () => {
      // -----------------------------------------------------------------------
      // Point A: Crash after claim when 0 trades occurred & server restarts when market is CLOSED
      // -----------------------------------------------------------------------
      OrderModel.create({
        id: 'crash_order_closed',
        side: 'BUY',
        type: 'LIMIT',
        price: 228.1,
        quantity: 2,
        remainingQuantity: 2,
        status: 'PENDING',
        dispatchedAt: '2024-07-11 01:00:00',
        createdAt: '2024-07-11 01:00:00',
        symbol: 'AAPL',
      });
      db.prepare(`
        INSERT INTO amo_dispatch_log (order_id, dispatched_at, status)
        VALUES ('crash_order_closed', CURRENT_TIMESTAMP, 'CLAIMED')
      `).run();

      // Restart occurs outside regular hours (market closed)
      TimeProvider.setMockTime(new Date('2024-07-11T02:00:00Z'));
      const recA = await MarketSessionManager.reconcileDispatchedAmos();

      expect(recA.requeued).toBe(1);
      const requeuedOrder = OrderModel.findById('crash_order_closed');
      expect(requeuedOrder?.status).toBe('QUEUED_AMO');
      expect(requeuedOrder?.dispatchedAt).toBeUndefined();

      // -----------------------------------------------------------------------
      // Point B: Crash after claim when 0 trades occurred & server restarts when market is OPEN
      // -----------------------------------------------------------------------
      OrderModel.create({
        id: 'crash_order_open',
        side: 'BUY',
        type: 'LIMIT',
        price: 228.1,
        quantity: 3,
        remainingQuantity: 3,
        status: 'PENDING',
        dispatchedAt: '2024-07-10 14:00:00',
        createdAt: '2024-07-10 14:00:00',
        symbol: 'AAPL',
      });
      db.prepare(`
        INSERT INTO amo_dispatch_log (order_id, dispatched_at, status)
        VALUES ('crash_order_open', CURRENT_TIMESTAMP, 'CLAIMED')
      `).run();

      // Restart occurs during regular hours (Wednesday 10:30 AM ET = 14:30 UTC)
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));
      const recB = await MarketSessionManager.reconcileDispatchedAmos();

      expect(recB.recovered).toBe(1);
      const engine = EngineManager.getInstance().getEngine('AAPL');
      expect(engine.getOrderBook().bids.some((b) => b.price === 228.1)).toBe(true);
      expect(OrderModel.findById('crash_order_open')?.status).toBe('PENDING');

      // Verify idempotency: running recovery a second time does not duplicate order or trades
      const recB2 = await MarketSessionManager.reconcileDispatchedAmos();
      expect(recB2.recovered).toBe(0);

      // -----------------------------------------------------------------------
      // Point C: Crash after partial fill was already executed & persisted in SQLite
      // -----------------------------------------------------------------------
      OrderModel.create({
        id: 'crash_order_partial',
        side: 'BUY',
        type: 'LIMIT',
        price: 228.1,
        quantity: 10,
        remainingQuantity: 10,
        status: 'PENDING',
        dispatchedAt: '2024-07-10 14:00:00',
        createdAt: '2024-07-10 14:00:00',
        symbol: 'AAPL',
      });
      db.prepare(`
        INSERT INTO amo_dispatch_log (order_id, dispatched_at, status)
        VALUES ('crash_order_partial', CURRENT_TIMESTAMP, 'CLAIMED')
      `).run();

      // Pre-existing counter-order and trade of 4 units already persisted
      OrderModel.create({
        id: 'maker_counter_1',
        side: 'SELL',
        type: 'LIMIT',
        price: 228.1,
        quantity: 4,
        remainingQuantity: 0,
        status: 'FILLED',
        createdAt: '2024-07-10 14:00:00',
        symbol: 'AAPL',
      });

      TradeModel.create({
        id: 'crash_persisted_trade_1',
        buyOrderId: 'crash_order_partial',
        sellOrderId: 'maker_counter_1',
        price: 228.1,
        quantity: 4,
        timestamp: '2024-07-10T14:00:05Z',
      });

      const recC = await MarketSessionManager.reconcileDispatchedAmos();
      expect(recC.finalized).toBe(1);

      // Order status finalized to PARTIALLY_FILLED with remainder of 6
      const partialOrder = OrderModel.findById('crash_order_partial');
      expect(partialOrder?.status).toBe('PARTIALLY_FILLED');
      expect(partialOrder?.remainingQuantity).toBe(6);

      // Trades preserved exactly (still 1 trade of 4 units, zero duplicates)
      const partialTrades = TradeModel.findByOrderId('crash_order_partial');
      expect(partialTrades.length).toBe(1);
      expect(partialTrades[0].quantity).toBe(4);

      // -----------------------------------------------------------------------
      // Point D: Completed orders (PROCESSED) are completely skipped
      // -----------------------------------------------------------------------
      const recD = await MarketSessionManager.reconcileDispatchedAmos();
      expect(recD.recovered).toBe(0);
      expect(recD.requeued).toBe(0);
      expect(recD.finalized).toBe(0);
    });

    it('should safely recover accepted resting AMO with zero trades without duplicate order-book entries or re-submission', async () => {
      // 1. Setup clean engine and database
      const engine = EngineManager.getInstance().getEngine('AAPL');
      engine.reset();
      db.prepare("DELETE FROM trades WHERE symbol = 'AAPL'").run();
      db.prepare("DELETE FROM orders WHERE symbol = 'AAPL'").run();
      db.prepare("DELETE FROM amo_dispatch_log").run();

      // 2. Insert AMO BUY order
      const amoId = 'amo_zero_trade_resting';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 220.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });

      // 3. Claim AMO for dispatch
      const claimed = OrderModel.claimAmoDispatch(amoId);
      expect(claimed).toBe(true);

      // 4. Engine accepts order and places it on the book (zero trades generated)
      const res = engine.processOrder({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 220.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'PENDING',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
        dispatchedAt: '2024-07-10 13:30:00',
      });

      expect(res.trades.length).toBe(0);
      expect(res.order.status).toBe('PENDING');

      // Verify engine acceptance was recorded in amo_dispatch_log
      const logBeforeCrash = OrderModel.getAmoDispatchLog(amoId);
      expect(logBeforeCrash).not.toBeNull();
      expect(logBeforeCrash?.status).toBe('CLAIMED');
      expect(logBeforeCrash?.engine_accepted_at).toBeDefined();
      expect(logBeforeCrash?.processed_at).toBeNull();

      // Verify zero trades exist
      expect(TradeModel.findByOrderId(amoId).length).toBe(0);

      // 5. CRASH OCCURS before completeAmoDispatch is called!
      // Server restarts: engine in-memory state is wiped to simulate fresh process
      engine.reset();
      expect(engine.getOrderBook().bids.length).toBe(0);

      // 6. Startup recovery runs
      const rec = await MarketSessionManager.reconcileDispatchedAmos();
      // Must be finalized (NOT recovered by re-submitting to engine, NOT requeued)
      expect(rec.finalized).toBe(1);
      expect(rec.recovered).toBe(0);
      expect(rec.requeued).toBe(0);

      // Verify amo_dispatch_log was marked PROCESSED
      const logAfterRecovery = OrderModel.getAmoDispatchLog(amoId);
      expect(logAfterRecovery?.status).toBe('PROCESSED');
      expect(logAfterRecovery?.processed_at).toBeDefined();

      // 7. Engine hydration occurs as part of startup
      engine.hydrateFromDatabase();

      // Verify order book contains EXACTLY ONE level with quantity 5 and orderCount 1
      const orderBook = engine.getOrderBook();
      expect(orderBook.bids.length).toBe(1);
      expect(orderBook.bids[0].price).toBe(220.0);
      expect(orderBook.bids[0].quantity).toBe(5);
      expect(orderBook.bids[0].orderCount).toBe(1);

      // Verify trades remain 0
      expect(TradeModel.findByOrderId(amoId).length).toBe(0);

      // 8. Multiple startup recovery attempts: verify idempotency
      const rec2 = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec2.finalized).toBe(0);
      expect(rec2.recovered).toBe(0);
      expect(rec2.requeued).toBe(0);

      const rec3 = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec3.finalized).toBe(0);
      expect(rec3.recovered).toBe(0);
      expect(rec3.requeued).toBe(0);

      // Orderbook remains completely unchanged with orderCount 1
      const orderBookAfter = engine.getOrderBook();
      expect(orderBookAfter.bids.length).toBe(1);
      expect(orderBookAfter.bids[0].quantity).toBe(5);
      expect(orderBookAfter.bids[0].orderCount).toBe(1);
    });

    it('should prevent unaccepted claimed AMO from hydrating into matching engine before recovery', async () => {
      const engine = EngineManager.getInstance().getEngine('AAPL');
      engine.reset();
      db.prepare("DELETE FROM trades WHERE symbol = 'AAPL'").run();
      db.prepare("DELETE FROM orders WHERE symbol = 'AAPL'").run();
      db.prepare("DELETE FROM amo_dispatch_log").run();

      const amoId = 'amo_unaccepted_crash';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 221.0,
        quantity: 3,
        remainingQuantity: 3,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });

      // Claim AMO (setting orders.status = 'PENDING' and amo_dispatch_log.status = 'CLAIMED')
      OrderModel.claimAmoDispatch(amoId);

      // CRASH occurs BEFORE engine.processOrder() is called!
      // (engine_accepted_at is NULL)
      const dispatchLog = OrderModel.getAmoDispatchLog(amoId);
      expect(dispatchLog?.engine_accepted_at).toBeNull();

      // Verify getActiveOrders excludes unaccepted claimed AMO
      const activeOrders = OrderModel.getActiveOrders('AAPL');
      expect(activeOrders.some((o) => o.id === amoId)).toBe(false);

      // Engine hydration runs BEFORE recovery
      engine.hydrateFromDatabase();
      expect(engine.getOrderBook().bids.length).toBe(0);

      // Server recovery runs when market is closed (Sunday)
      TimeProvider.setMockTime(new Date('2024-07-14T12:00:00Z'));
      const rec = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec.requeued).toBe(1);

      // Order safely reset back to QUEUED_AMO
      const resetOrder = OrderModel.findById(amoId);
      expect(resetOrder?.status).toBe('QUEUED_AMO');
      expect(resetOrder?.dispatchedAt).toBeUndefined();

      // Engine still has 0 bids
      expect(engine.getOrderBook().bids.length).toBe(0);
    });

    it('should correctly handle partial fill recovery without duplicate trades and maintain correct remaining quantity', async () => {
      const engine = EngineManager.getInstance().getEngine('AAPL');
      engine.reset();
      db.prepare("DELETE FROM trades WHERE symbol = 'AAPL'").run();
      db.prepare("DELETE FROM orders WHERE symbol = 'AAPL'").run();
      db.prepare("DELETE FROM amo_dispatch_log").run();

      // Resting maker ask: 4 units @ $225
      const makerId = 'maker_ask_partial_test';
      OrderModel.create({
        id: makerId,
        side: 'SELL',
        type: 'LIMIT',
        price: 225.0,
        quantity: 4,
        remainingQuantity: 4,
        status: 'PENDING',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });
      engine.processOrder(OrderModel.findById(makerId)!);

      // Incoming AMO BUY: 10 units @ $225
      const amoId = 'amo_partial_fill_test';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 225.0,
        quantity: 10,
        remainingQuantity: 10,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10 12:01:00',
        symbol: 'AAPL',
      });

      OrderModel.claimAmoDispatch(amoId);

      // Engine processes AMO: 4 units fill against maker, 6 units rest as bid
      engine.processOrder({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 225.0,
        quantity: 10,
        remainingQuantity: 10,
        status: 'PENDING',
        createdAt: '2024-07-10 12:01:00',
        symbol: 'AAPL',
        dispatchedAt: '2024-07-10 13:30:00',
      });

      // Verify 1 trade occurred for 4 units
      const initialTrades = TradeModel.findByOrderId(amoId);
      expect(initialTrades.length).toBe(1);
      expect(initialTrades[0].quantity).toBe(4);

      // Simulate crash BEFORE completeAmoDispatch is called
      // (dispatch log is still CLAIMED)
      db.prepare(`UPDATE amo_dispatch_log SET status = 'CLAIMED', processed_at = NULL WHERE order_id = ?`).run(amoId);

      // Server restart: wipe engine memory
      engine.reset();
      expect(engine.getOrderBook().bids.length).toBe(0);

      // Recovery runs
      const rec = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec.finalized).toBe(1);

      // Verify order status and remainingQuantity in SQLite
      const recoveredOrder = OrderModel.findById(amoId);
      expect(recoveredOrder?.status).toBe('PARTIALLY_FILLED');
      expect(recoveredOrder?.remainingQuantity).toBe(6);

      // Hydrate engine
      engine.hydrateFromDatabase();
      const orderBook = engine.getOrderBook();
      expect(orderBook.bids.length).toBe(1);
      expect(orderBook.bids[0].price).toBe(225.0);
      expect(orderBook.bids[0].quantity).toBe(6);
      expect(orderBook.bids[0].orderCount).toBe(1);

      // Trades are preserved without duplicates
      const tradesAfterRecovery = TradeModel.findByOrderId(amoId);
      expect(tradesAfterRecovery.length).toBe(1);
      expect(tradesAfterRecovery[0].quantity).toBe(4);

      // Now a new incoming counter-order arrives for 6 units:
      const incomingSellerId = 'seller_remaining_6';
      OrderModel.create({
        id: incomingSellerId,
        side: 'SELL',
        type: 'LIMIT',
        price: 225.0,
        quantity: 6,
        remainingQuantity: 6,
        status: 'PENDING',
        createdAt: '2024-07-10 14:00:00',
        symbol: 'AAPL',
      });

      const fillRes = engine.processOrder(OrderModel.findById(incomingSellerId)!);
      expect(fillRes.trades.length).toBe(1);
      expect(fillRes.trades[0].quantity).toBe(6);

      // AMO is now fully filled
      const finalAmo = OrderModel.findById(amoId);
      expect(finalAmo?.status).toBe('FILLED');
      expect(finalAmo?.remainingQuantity).toBe(0);

      // Total trades for AMO: exactly 2 trades totaling 10 units
      const allAmoTrades = TradeModel.findByOrderId(amoId);
      expect(allAmoTrades.length).toBe(2);
      expect(allAmoTrades.reduce((sum, t) => sum + t.quantity, 0)).toBe(10);
    });
  });

  describe('4b. Crash-Injection Atomicity Tests (All 4 Critical Points)', () => {
    beforeEach(() => {
      const engine = EngineManager.getInstance().getEngine('AAPL');
      engine.reset();
      db.prepare("DELETE FROM trades WHERE symbol = 'AAPL'").run();
      db.prepare("DELETE FROM orders WHERE symbol = 'AAPL'").run();
      db.prepare('DELETE FROM amo_dispatch_log').run();
    });

    it('Point 1: Crash immediately after OrderModel.update but before acceptance marker', async () => {
      // Simulate crash where order status was updated in orders table, but engine_accepted_at is NULL
      const amoId = 'crash_pt1_order';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 218.0,
        quantity: 4,
        remainingQuantity: 4,
        status: 'PENDING',
        createdAt: '2024-07-10 12:00:00',
        dispatchedAt: '2024-07-10 13:30:00',
        symbol: 'AAPL',
      });
      db.prepare(`
        INSERT INTO amo_dispatch_log (order_id, dispatched_at, engine_accepted_at, status)
        VALUES (?, CURRENT_TIMESTAMP, NULL, 'CLAIMED')
      `).run(amoId);

      // Verify getActiveOrders excludes this order because engine_accepted_at is NULL and status is CLAIMED
      const active = OrderModel.getActiveOrders('AAPL');
      expect(active.some((o) => o.id === amoId)).toBe(false);

      // Hydration runs before recovery: order is NOT hydrated into matching engine
      const engine = EngineManager.getInstance().getEngine('AAPL');
      engine.hydrateFromDatabase();
      expect(engine.getOrderBook().bids.length).toBe(0);

      // Restart occurs when market is CLOSED
      TimeProvider.setMockTime(new Date('2024-07-14T14:00:00Z'));
      const rec = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec.requeued).toBe(1);
      expect(rec.recovered).toBe(0);
      expect(rec.finalized).toBe(0);

      // Verify exact SQLite state after recovery
      const orderAfter = OrderModel.findById(amoId);
      expect(orderAfter?.status).toBe('QUEUED_AMO');
      expect(orderAfter?.dispatchedAt).toBeUndefined();
      expect(orderAfter?.remainingQuantity).toBe(4);

      // Verify dispatch log was cleaned up
      expect(OrderModel.getAmoDispatchLog(amoId)).toBeNull();

      // Verify no duplicate order-book entries or trades
      expect(engine.getOrderBook().bids.length).toBe(0);
      expect(TradeModel.findByOrderId(amoId).length).toBe(0);

      // Recovery idempotency
      const rec2 = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec2.requeued).toBe(0);
      expect(rec2.recovered).toBe(0);
      expect(rec2.finalized).toBe(0);
    });

    it('Point 2: Crash immediately before recordAmoEngineAcceptance', async () => {
      // Order claimed, but crashed right before engine acceptance could be recorded
      const amoId = 'crash_pt2_order';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 219.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });

      OrderModel.claimAmoDispatch(amoId);
      // At this moment, amo_dispatch_log has status='CLAIMED', engine_accepted_at=NULL
      const log = OrderModel.getAmoDispatchLog(amoId);
      expect(log?.engine_accepted_at).toBeNull();

      // Market is OPEN when server restarts
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));
      const rec = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec.recovered).toBe(1);
      expect(rec.finalized).toBe(0);
      expect(rec.requeued).toBe(0);

      // Verify exactly one order exists on book
      const engine = EngineManager.getInstance().getEngine('AAPL');
      const book = engine.getOrderBook();
      expect(book.bids.length).toBe(1);
      expect(book.bids[0].price).toBe(219.0);
      expect(book.bids[0].quantity).toBe(5);
      expect(book.bids[0].orderCount).toBe(1);

      // Order status and dispatch log agree
      const orderAfter = OrderModel.findById(amoId);
      expect(orderAfter?.status).toBe('PENDING');
      const logAfter = OrderModel.getAmoDispatchLog(amoId);
      expect(logAfter?.status).toBe('PROCESSED');
      expect(logAfter?.engine_accepted_at).toBeDefined();

      // Recovery idempotency
      const rec2 = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec2.recovered).toBe(0);
      expect(book.bids[0].orderCount).toBe(1);
    });

    it('Point 3: Crash immediately after recordAmoEngineAcceptance / persistOrderAcceptance', async () => {
      // Order was accepted and resting (zero trades), but crashed before completeAmoDispatch
      const amoId = 'crash_pt3_order';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 220.0,
        quantity: 7,
        remainingQuantity: 7,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });

      OrderModel.claimAmoDispatch(amoId);

      const engine = EngineManager.getInstance().getEngine('AAPL');
      engine.processOrder({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 220.0,
        quantity: 7,
        remainingQuantity: 7,
        status: 'PENDING',
        createdAt: '2024-07-10 12:00:00',
        dispatchedAt: '2024-07-10 13:30:00',
        symbol: 'AAPL',
      });

      // Verify engine acceptance was recorded atomically
      const logBeforeCrash = OrderModel.getAmoDispatchLog(amoId);
      expect(logBeforeCrash?.engine_accepted_at).toBeDefined();
      expect(logBeforeCrash?.status).toBe('CLAIMED');

      // CRASH: Wipe engine memory to simulate server reboot
      engine.reset();
      expect(engine.getOrderBook().bids.length).toBe(0);

      // Recovery runs
      const rec = await MarketSessionManager.reconcileDispatchedAmos();
      // Must be finalized WITHOUT re-submitting to engine
      expect(rec.finalized).toBe(1);
      expect(rec.recovered).toBe(0);
      expect(rec.requeued).toBe(0);

      // Order status and dispatch log agree
      const logAfter = OrderModel.getAmoDispatchLog(amoId);
      expect(logAfter?.status).toBe('PROCESSED');
      expect(logAfter?.processed_at).toBeDefined();

      // Hydration restores resting order exactly once
      engine.hydrateFromDatabase();
      const book = engine.getOrderBook();
      expect(book.bids.length).toBe(1);
      expect(book.bids[0].price).toBe(220.0);
      expect(book.bids[0].quantity).toBe(7);
      expect(book.bids[0].orderCount).toBe(1);

      // 0 trades occurred
      expect(TradeModel.findByOrderId(amoId).length).toBe(0);

      // Recovery idempotency
      const rec2 = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec2.finalized).toBe(0);
      expect(rec2.recovered).toBe(0);
      expect(engine.getOrderBook().bids[0].orderCount).toBe(1);
    });

    it('Point 4: Crash during matching when one or more trades are persisted', async () => {
      const engine = EngineManager.getInstance().getEngine('AAPL');

      // Pre-existing resting maker: 3 units @ $222
      const makerId = 'maker_pt4_ask';
      OrderModel.create({
        id: makerId,
        side: 'SELL',
        type: 'LIMIT',
        price: 222.0,
        quantity: 3,
        remainingQuantity: 3,
        status: 'PENDING',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });
      engine.processOrder(OrderModel.findById(makerId)!);

      // Incoming AMO: BUY 8 units @ $222
      const amoId = 'crash_pt4_amo';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 222.0,
        quantity: 8,
        remainingQuantity: 8,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10 12:01:00',
        symbol: 'AAPL',
      });
      OrderModel.claimAmoDispatch(amoId);

      // Simulate partial matching execution:
      // Trade 1 is executed and persisted (3 units), maker is updated to FILLED,
      // but crash occurs BEFORE persistOrderAcceptance is completed for incoming order
      TradeModel.create({
        id: 'pt4_trade_1',
        buyOrderId: amoId,
        sellOrderId: makerId,
        price: 222.0,
        quantity: 3,
        timestamp: '2024-07-10T14:30:01Z',
      });
      OrderModel.update({
        id: makerId,
        side: 'SELL',
        type: 'LIMIT',
        price: 222.0,
        quantity: 3,
        remainingQuantity: 0,
        status: 'FILLED',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });

      // At this exact point in SQLite:
      // amo_dispatch_log is still CLAIMED and engine_accepted_at is NULL
      // orders table has incoming order with original quantity 8
      // trades table has 1 trade of 3 units
      const logBeforeCrash = OrderModel.getAmoDispatchLog(amoId);
      expect(logBeforeCrash?.status).toBe('CLAIMED');
      expect(logBeforeCrash?.engine_accepted_at).toBeNull();
      expect(TradeModel.findByOrderId(amoId).length).toBe(1);

      // CRASH: Wipe engine memory
      engine.reset();

      // Recovery runs
      const rec = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec.finalized).toBe(1);

      // Order state and dispatch log agree atomically
      const recoveredOrder = OrderModel.findById(amoId);
      expect(recoveredOrder?.status).toBe('PARTIALLY_FILLED');
      expect(recoveredOrder?.remainingQuantity).toBe(5); // 8 - 3 = 5

      const logAfter = OrderModel.getAmoDispatchLog(amoId);
      expect(logAfter?.status).toBe('PROCESSED');
      expect(logAfter?.engine_accepted_at).toBeDefined();

      // Hydration loads remaining 5 units onto book
      engine.hydrateFromDatabase();
      const book = engine.getOrderBook();
      expect(book.bids.length).toBe(1);
      expect(book.bids[0].price).toBe(222.0);
      expect(book.bids[0].quantity).toBe(5);
      expect(book.bids[0].orderCount).toBe(1);

      // Trades preserved exactly: 1 trade of 3 units
      const tradesAfter = TradeModel.findByOrderId(amoId);
      expect(tradesAfter.length).toBe(1);
      expect(tradesAfter[0].quantity).toBe(3);

      // Second seller arrives for 5 units:
      const seller2Id = 'seller_pt4_fill_rest';
      OrderModel.create({
        id: seller2Id,
        side: 'SELL',
        type: 'LIMIT',
        price: 222.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'PENDING',
        createdAt: '2024-07-10 14:35:00',
        symbol: 'AAPL',
      });

      const fillRes = engine.processOrder(OrderModel.findById(seller2Id)!);
      expect(fillRes.trades.length).toBe(1);
      expect(fillRes.trades[0].quantity).toBe(5);

      // Final order state: FILLED, remaining 0, total 2 trades sum to 8
      const finalAmo = OrderModel.findById(amoId);
      expect(finalAmo?.status).toBe('FILLED');
      expect(finalAmo?.remainingQuantity).toBe(0);

      const allTrades = TradeModel.findByOrderId(amoId);
      expect(allTrades.length).toBe(2);
      expect(allTrades.reduce((sum, t) => sum + t.quantity, 0)).toBe(8);

      // Recovery idempotency
      const rec2 = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec2.finalized).toBe(0);
      expect(rec2.recovered).toBe(0);
      expect(rec2.requeued).toBe(0);
    });
  });

  describe('4c. Transaction Failure-Injection & Rollback Safety', () => {
    beforeEach(() => {
      const engine = EngineManager.getInstance().getEngine('AAPL');
      engine.reset();
      db.prepare("DELETE FROM trades WHERE symbol = 'AAPL'").run();
      db.prepare("DELETE FROM orders WHERE symbol = 'AAPL'").run();
      db.prepare('DELETE FROM amo_dispatch_log').run();
    });

    it('1. Failure during the orders-table update: transaction rolls back and in-memory engine entry is reverted', () => {
      const engine = EngineManager.getInstance().getEngine('AAPL');
      const amoId = 'tx_fail_orders_order';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 217.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });
      OrderModel.claimAmoDispatch(amoId);

      // Inject failure directly into SQLite via RAISE(ABORT) trigger
      db.exec(
        "CREATE TRIGGER IF NOT EXISTS test_fail_orders_update BEFORE UPDATE ON orders BEGIN SELECT RAISE(ABORT, 'Simulated SQLite disk/constraint failure on orders update'); END;"
      );

      try {
        // processOrder must throw and not swallow the error
        expect(() => {
          engine.processOrder({
            id: amoId,
            side: 'BUY',
            type: 'LIMIT',
            price: 217.0,
            quantity: 5,
            remainingQuantity: 5,
            status: 'PENDING',
            createdAt: '2024-07-10 12:00:00',
            dispatchedAt: '2024-07-10 13:30:00',
            symbol: 'AAPL',
          });
        }).toThrow(/Simulated SQLite disk\/constraint failure on orders update/);
      } finally {
        db.exec('DROP TRIGGER IF EXISTS test_fail_orders_update');
      }

      // In-memory order book must have rolled back the insertion (no ghost resting order)
      expect(engine.getOrderBook().bids.length).toBe(0);

      // SQLite transaction rolled back: engine_accepted_at is NULL (no partial commit)
      const log = OrderModel.getAmoDispatchLog(amoId);
      expect(log?.engine_accepted_at).toBeNull();
    });

    it('2. Failure during the dispatch-log update: entire transaction rolls back without partial writes', () => {
      const engine = EngineManager.getInstance().getEngine('AAPL');
      const amoId = 'tx_fail_log_order';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 216.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });
      OrderModel.claimAmoDispatch(amoId);

      // Inject failure specifically on amo_dispatch_log update
      db.exec(
        "CREATE TRIGGER IF NOT EXISTS test_fail_log_update BEFORE UPDATE ON amo_dispatch_log BEGIN SELECT RAISE(ABORT, 'Simulated lock failure on amo_dispatch_log update'); END;"
      );

      try {
        expect(() => {
          engine.processOrder({
            id: amoId,
            side: 'BUY',
            type: 'LIMIT',
            price: 216.0,
            quantity: 5,
            remainingQuantity: 5,
            status: 'PENDING',
            createdAt: '2024-07-10 12:00:00',
            dispatchedAt: '2024-07-10 13:30:00',
            symbol: 'AAPL',
          });
        }).toThrow(/Simulated lock failure on amo_dispatch_log update/);
      } finally {
        db.exec('DROP TRIGGER IF EXISTS test_fail_log_update');
      }

      // In-memory order book rolled back
      expect(engine.getOrderBook().bids.length).toBe(0);

      // Entire transaction rolled back: orders status was rolled back and engine_accepted_at is NULL
      const log = OrderModel.getAmoDispatchLog(amoId);
      expect(log?.engine_accepted_at).toBeNull();
    });

    it('3. Failure during completeAmoRecovery(): transaction rolls back and preserves uncorrupted trade history', async () => {
      const amoId = 'tx_fail_rec_order';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 220.0,
        quantity: 10,
        remainingQuantity: 10,
        status: 'PENDING',
        createdAt: '2024-07-10 12:00:00',
        dispatchedAt: '2024-07-10 13:30:00',
        symbol: 'AAPL',
      });
      db.prepare(`
        INSERT INTO amo_dispatch_log (order_id, dispatched_at, engine_accepted_at, status)
        VALUES (?, CURRENT_TIMESTAMP, NULL, 'CLAIMED')
      `).run(amoId);

      // Pre-existing trade of 4 units committed in SQLite
      OrderModel.create({
        id: 'maker_tx_3',
        side: 'SELL',
        type: 'LIMIT',
        price: 220.0,
        quantity: 4,
        remainingQuantity: 0,
        status: 'FILLED',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });
      TradeModel.create({
        id: 'trade_tx_3',
        buyOrderId: amoId,
        sellOrderId: 'maker_tx_3',
        price: 220.0,
        quantity: 4,
        timestamp: '2024-07-10T14:00:00Z',
      });

      // Inject failure on recovery update
      db.exec(
        "CREATE TRIGGER IF NOT EXISTS test_fail_rec_update BEFORE UPDATE ON orders BEGIN SELECT RAISE(ABORT, 'Simulated failure during recovery transaction write'); END;"
      );

      try {
        // completeAmoRecovery throws and does not swallow the persistence failure
        await expect(MarketSessionManager.reconcileDispatchedAmos()).rejects.toThrow(
          /Simulated failure during recovery transaction write/
        );
      } finally {
        db.exec('DROP TRIGGER IF EXISTS test_fail_rec_update');
      }

      // SQLite state is intact: trade was preserved
      const trades = TradeModel.findByOrderId(amoId);
      expect(trades.length).toBe(1);
      expect(trades[0].quantity).toBe(4);

      // Retry recovery after transient DB failure resolves
      const rec = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec.finalized).toBe(1);

      const recoveredOrder = OrderModel.findById(amoId);
      expect(recoveredOrder?.status).toBe('PARTIALLY_FILLED');
      expect(recoveredOrder?.remainingQuantity).toBe(6);
      expect(OrderModel.getAmoDispatchLog(amoId)?.status).toBe('PROCESSED');
    });

    it('Complete In-Memory Rollback Audit: Maker state agreement when incoming AMO persistOrderAcceptance fails after trade execution', () => {
      const engine = EngineManager.getInstance().getEngine('AAPL');
      engine.reset();
      db.prepare("DELETE FROM trades WHERE symbol = 'AAPL'").run();
      db.prepare("DELETE FROM orders WHERE symbol = 'AAPL'").run();
      db.prepare('DELETE FROM amo_dispatch_log').run();

      // 1. Existing maker order rests on the book: SELL 10 AAPL @ $220.00
      const makerId = 'maker_audit_resting_10';
      OrderModel.create({
        id: makerId,
        side: 'SELL',
        type: 'LIMIT',
        price: 220.0,
        quantity: 10,
        remainingQuantity: 10,
        status: 'PENDING',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });
      engine.hydrateFromDatabase();
      expect(engine.getOrderBook().asks.length).toBe(1);
      expect(engine.getOrderBook().asks[0].quantity).toBe(10);

      // 2. A new AMO arrives for 4 units: BUY 4 AAPL @ $220.00
      const amoId = 'amo_audit_incoming_4';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 220.0,
        quantity: 4,
        remainingQuantity: 4,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10 12:01:00',
        symbol: 'AAPL',
      });
      OrderModel.claimAmoDispatch(amoId);

      // 3 & 4. Simulate failure during persistOrderAcceptance() of incoming AMO
      // using a trigger targeting amo_dispatch_log update
      db.exec(
        "CREATE TRIGGER IF NOT EXISTS test_fail_acceptance_trigger BEFORE UPDATE ON amo_dispatch_log BEGIN SELECT RAISE(ABORT, 'Simulated failure in persistOrderAcceptance'); END;"
      );

      try {
        expect(() => {
          engine.processOrder({
            id: amoId,
            side: 'BUY',
            type: 'LIMIT',
            price: 220.0,
            quantity: 4,
            remainingQuantity: 4,
            status: 'PENDING',
            createdAt: '2024-07-10 12:01:00',
            dispatchedAt: '2024-07-10 13:30:00',
            symbol: 'AAPL',
          });
        }).toThrow(/Simulated failure in persistOrderAcceptance/);
      } finally {
        db.exec('DROP TRIGGER IF EXISTS test_fail_acceptance_trigger');
      }

      // 5. In-Memory Rollback Audit & State Agreement Verification:
      // a. No ghost orders: incoming AMO is NOT on the order book
      const book = engine.getOrderBook();
      expect(book.bids.length).toBe(0);

      // b. No incorrect maker quantities: maker in-memory remaining quantity is exactly 6
      expect(book.asks.length).toBe(1);
      expect(book.asks[0].price).toBe(220.0);
      expect(book.asks[0].quantity).toBe(6);
      expect(book.asks[0].orderCount).toBe(1);

      // c. In-memory maker state agrees EXACTLY with SQLite:
      const makerDb = OrderModel.findById(makerId);
      expect(makerDb).toBeDefined();
      expect(makerDb?.status).toBe('PARTIALLY_FILLED');
      expect(makerDb?.remainingQuantity).toBe(6);

      // d. No duplicate or missing trades: exactly 1 trade was persisted for 4 units
      const tradesForMaker = TradeModel.findByOrderId(makerId);
      expect(tradesForMaker.length).toBe(1);
      expect(tradesForMaker[0].quantity).toBe(4);
      expect(tradesForMaker[0].price).toBe(220.0);
      expect(tradesForMaker[0].buyOrderId).toBe(amoId);
      expect(tradesForMaker[0].sellOrderId).toBe(makerId);

      const tradesForAmo = TradeModel.findByOrderId(amoId);
      expect(tradesForAmo.length).toBe(1);
      expect(tradesForAmo[0].id).toBe(tradesForMaker[0].id);

      // e. No divergence between SQLite and in-memory order book:
      // Calling getActiveOrders returns exactly what is in the engine
      const activeDbOrders = OrderModel.getActiveOrders('AAPL');
      expect(activeDbOrders.length).toBe(1);
      expect(activeDbOrders[0].id).toBe(makerId);
      expect(activeDbOrders[0].remainingQuantity).toBe(6);

      // f. Legitimate persisted partial fill is preserved and committed trades are NOT reversed
      expect(tradesForMaker.length).toBe(1);
    });

    it('4. Statement-level trigger abort (AFTER UPDATE trigger): rolls back transaction and in-memory engine book', () => {
      const engine = EngineManager.getInstance().getEngine('AAPL');
      const amoId = 'tx_fail_statement_abort_order';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 215.0,
        quantity: 6,
        remainingQuantity: 6,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });
      OrderModel.claimAmoDispatch(amoId);

      // Clarification: An AFTER UPDATE trigger with RAISE(ABORT) fires during statement execution
      // immediately after the row modification, causing the statement inside the transaction body to abort.
      db.exec(
        "CREATE TRIGGER IF NOT EXISTS test_fail_stmt_abort AFTER UPDATE ON amo_dispatch_log BEGIN SELECT RAISE(ABORT, 'Simulated SQLite statement-level abort via trigger'); END;"
      );

      try {
        expect(() => {
          engine.processOrder({
            id: amoId,
            side: 'BUY',
            type: 'LIMIT',
            price: 215.0,
            quantity: 6,
            remainingQuantity: 6,
            status: 'PENDING',
            createdAt: '2024-07-10 12:00:00',
            dispatchedAt: '2024-07-10 13:30:00',
            symbol: 'AAPL',
          });
        }).toThrow(/Simulated SQLite statement-level abort via trigger/);
      } finally {
        db.exec('DROP TRIGGER IF EXISTS test_fail_stmt_abort');
      }

      // In-memory order book rolled back
      expect(engine.getOrderBook().bids.length).toBe(0);

      // Log status is still CLAIMED without engine_accepted_at
      const log = OrderModel.getAmoDispatchLog(amoId);
      expect(log?.engine_accepted_at).toBeNull();
    });

    it('4b. Genuine transaction commit failure (simulated via deferred constraint check): statements succeed but COMMIT fails and rolls back', () => {
      // Setup deferred foreign-key test table to simulate a true COMMIT-phase failure:
      // All SQL statements in the transaction block execute successfully;
      // SQLite only enforces deferred constraints at the COMMIT step, causing sqlite3_step("COMMIT") to fail.
      db.exec('PRAGMA foreign_keys = ON;');
      db.exec('CREATE TABLE IF NOT EXISTS commit_parent (id TEXT PRIMARY KEY);');
      db.exec(
        'CREATE TABLE IF NOT EXISTS commit_child (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES commit_parent(id) DEFERRABLE INITIALLY DEFERRED);'
      );

      const amoId = 'tx_fail_genuine_commit_order';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 213.0,
        quantity: 4,
        remainingQuantity: 4,
        status: 'QUEUED_AMO',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
      });
      OrderModel.claimAmoDispatch(amoId);

      // Wrap an atomic acceptance transaction that inserts an invalid deferred reference
      // Statements inside callback succeed; COMMIT step fails with SQLITE_CONSTRAINT
      const simulatedCommitFailTx = db.transaction(() => {
        db.prepare('UPDATE orders SET remaining_quantity = 4, status = ? WHERE id = ?').run('PENDING', amoId);
        db.prepare('UPDATE amo_dispatch_log SET engine_accepted_at = CURRENT_TIMESTAMP WHERE order_id = ?').run(amoId);
        // Deferred foreign key violation: valid statement, but causes COMMIT to fail!
        db.prepare("INSERT INTO commit_child VALUES ('c_fail', 'nonexistent_parent')").run();
      });

      try {
        expect(() => {
          simulatedCommitFailTx();
        }).toThrow(/FOREIGN KEY constraint failed/);
      } finally {
        db.exec('DROP TABLE IF EXISTS commit_child;');
        db.exec('DROP TABLE IF EXISTS commit_parent;');
      }

      // Verify transaction rollback: orders table and amo_dispatch_log rolled back
      const log = OrderModel.getAmoDispatchLog(amoId);
      expect(log?.engine_accepted_at).toBeNull();

      const order = OrderModel.findById(amoId);
      expect(order?.status).toBe('PENDING'); // Dispatched state preserved; uncommitted updates discarded
    });

    it('5. Restart after each failed transaction: verifies non-duplication and safe idempotent recovery', async () => {
      // Setup order in CLAIMED state where acceptance persistence had failed
      const amoId = 'tx_fail_restart_order';
      OrderModel.create({
        id: amoId,
        side: 'BUY',
        type: 'LIMIT',
        price: 214.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'PENDING',
        createdAt: '2024-07-10 12:00:00',
        dispatchedAt: '2024-07-10 13:30:00',
        symbol: 'AAPL',
      });
      db.prepare(`
        INSERT INTO amo_dispatch_log (order_id, dispatched_at, engine_accepted_at, status)
        VALUES (?, CURRENT_TIMESTAMP, NULL, 'CLAIMED')
      `).run(amoId);

      const engine = EngineManager.getInstance().getEngine('AAPL');
      engine.reset();

      // Verify unaccepted order is excluded from getActiveOrders before recovery
      expect(OrderModel.getActiveOrders('AAPL').some((o) => o.id === amoId)).toBe(false);

      // Server restarts when market is OPEN
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));
      const rec = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec.recovered).toBe(1);
      expect(rec.finalized).toBe(0);
      expect(rec.requeued).toBe(0);

      // Hydrate all engines (deterministic index.ts startup order)
      engine.hydrateFromDatabase();

      // Verify exactly one order exists on book with correct remaining quantity
      const book = engine.getOrderBook();
      expect(book.bids.length).toBe(1);
      expect(book.bids[0].price).toBe(214.0);
      expect(book.bids[0].quantity).toBe(5);
      expect(book.bids[0].orderCount).toBe(1);

      // 0 duplicate trades
      expect(TradeModel.findByOrderId(amoId).length).toBe(0);

      // Order status and dispatch log agree
      const orderAfter = OrderModel.findById(amoId);
      expect(orderAfter?.status).toBe('PENDING');
      const logAfter = OrderModel.getAmoDispatchLog(amoId);
      expect(logAfter?.status).toBe('PROCESSED');
      expect(logAfter?.engine_accepted_at).toBeDefined();

      // Recovery can be safely repeated multiple times
      const rec2 = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec2.recovered).toBe(0);
      expect(rec2.finalized).toBe(0);
      expect(rec2.requeued).toBe(0);

      const rec3 = await MarketSessionManager.reconcileDispatchedAmos();
      expect(rec3.recovered).toBe(0);
      expect(rec3.finalized).toBe(0);
      expect(rec3.requeued).toBe(0);

      // Book remains exactly 1 level with orderCount 1
      expect(engine.getOrderBook().bids[0].orderCount).toBe(1);
    });
  });

  // =========================================================================
  // 5. FUNDS RESERVATION ADAPTER VERIFICATION
  // =========================================================================
  describe('5. Funds Reservation Adapter Verification', () => {
    it('should return SIMULATED_NOOP preview without mutating any persistent balances', async () => {
      const adapter = FundsReservationAdapterFactory.getAdapter();

      const result = await adapter.reserveFunds({
        orderId: 'res_test_1',
        symbol: 'AAPL',
        side: 'BUY',
        price: 220,
        quantity: 5,
      });

      expect(result.status).toBe('SIMULATED_NOOP');
      expect(result.success).toBe(true);
      expect(result.reservedAmountCents).toBe(110000n); // 5 * 220 = $1,100.00 = 110,000 cents
      expect(result.message).toContain('Simulated NoOp reservation preview');

      // Verify no tables other than orders and trades exist or are touched
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).not.toContain('wallets');
      expect(tableNames).not.toContain('balances');
      expect(tableNames).not.toContain('ledger');
    });

    it('should perform release and commit operations idempotently without throwing', async () => {
      const adapter = FundsReservationAdapterFactory.getAdapter();

      await adapter.reserveFunds({
        orderId: 'idem_test_1',
        symbol: 'AAPL',
        side: 'BUY',
        price: 100,
        quantity: 1,
      });

      // Commit once
      const commit1 = await adapter.commitReservation('idem_test_1');
      expect(commit1).toBe(true);

      // Commit second time (idempotent)
      const commit2 = await adapter.commitReservation('idem_test_1');
      expect(commit2).toBe(true);

      // Release unknown / already released ID (idempotent)
      const release1 = await adapter.releaseReservation('idem_test_1');
      expect(release1).toBe(true);
      const release2 = await adapter.releaseReservation('idem_test_unknown');
      expect(release2).toBe(true);
    });

    it('should return X-BYTE-Reservation: simulated-preview header in API responses', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BYTE-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 100,
          quantity: 1,
        }),
      });

      expect(res.status).toBe(201);
      expect(res.headers.get('x-byte-reservation')).toBe('simulated-preview');

      const body = await res.json();
      expect(body.data.reservation.status).toBe('SIMULATED_NOOP');
      expect(body.data.reservation.reservedAmountCents).toBe('10000');
    });
  });
});
