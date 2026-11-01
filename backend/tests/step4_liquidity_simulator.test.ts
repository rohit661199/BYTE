import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiquiditySimulator, SIMULATOR_USER_ID } from '../src/services/LiquiditySimulator.js';
import { InstrumentRegistry } from '../src/services/InstrumentRegistry.js';
import { EngineManager } from '../src/matching-engine/EngineManager.js';
import { OrderModel } from '../src/models/orderModel.js';
import { TradeModel } from '../src/models/tradeModel.js';
import { MathPrecision } from '../src/utils/MathPrecision.js';
import { TimeProvider } from '../src/utils/TimeProvider.js';
import { db } from '../src/database/db.js';
import { Order } from '../src/types/index.js';

describe('Phase 02 — Step 4: Liquidity Simulator Test Suite', () => {
  beforeEach(() => {
    // Reset engines and clean test records
    EngineManager.getInstance().resetAll();
    db.prepare('DELETE FROM trades').run();
    db.prepare('DELETE FROM orders').run();
    db.prepare('DELETE FROM amo_dispatch_log').run();
    LiquiditySimulator.resetConfig();
    TimeProvider.reset();
  });

  afterEach(() => {
    LiquiditySimulator.stop();
    TimeProvider.reset();
  });

  // =========================================================================
  // 1. LIFECYCLE MANAGEMENT (START, STOP, IDEMPOTENCY)
  // =========================================================================
  describe('1. Lifecycle Management', () => {
    it('should start and stop the simulator heartbeat cleanly', () => {
      expect(LiquiditySimulator.isSimulatorRunning()).toBe(false);

      LiquiditySimulator.start(100);
      expect(LiquiditySimulator.isSimulatorRunning()).toBe(true);

      LiquiditySimulator.stop();
      expect(LiquiditySimulator.isSimulatorRunning()).toBe(false);
    });

    it('should prevent multiple heartbeat loops from starting on repeated start() calls', () => {
      expect(LiquiditySimulator.isSimulatorRunning()).toBe(false);

      LiquiditySimulator.start(100);
      expect(LiquiditySimulator.isSimulatorRunning()).toBe(true);

      // Repeated calls should not create additional timers
      LiquiditySimulator.start(100);
      LiquiditySimulator.start(100);
      expect(LiquiditySimulator.isSimulatorRunning()).toBe(true);

      LiquiditySimulator.stop();
      expect(LiquiditySimulator.isSimulatorRunning()).toBe(false);
    });
  });

  // =========================================================================
  // 2. DEPTH GENERATION & INSTRUMENT COVERAGE
  // =========================================================================
  describe('2. Order Depth & Instrument Coverage', () => {
    it('should maintain up to five bid and five ask levels for 24/7 crypto instruments', async () => {
      // BTC-USD is 24/7 crypto
      const res = await LiquiditySimulator.refreshInstrument('BTC-USD');
      expect(res.success).toBe(true);
      expect(res.skipped).toBeFalsy();
      expect(res.bidsCount).toBe(5);
      expect(res.asksCount).toBe(5);

      const engine = EngineManager.getInstance().getEngine('BTC-USD');
      const book = engine.getOrderBook();
      expect(book.bids.length).toBe(5);
      expect(book.asks.length).toBe(5);

      // Verify bid prices are strictly descending (highest first)
      for (let i = 0; i < book.bids.length - 1; i++) {
        expect(book.bids[i].price).toBeGreaterThan(book.bids[i + 1].price);
      }

      // Verify ask prices are strictly ascending (lowest first)
      for (let i = 0; i < book.asks.length - 1; i++) {
        expect(book.asks[i].price).toBeLessThan(book.asks[i + 1].price);
      }

      // Inside market: best bid is strictly below best ask
      expect(book.bids[0].price).toBeLessThan(book.asks[0].price);
    });

    it('should respect market session for US equities: generate liquidity during regular hours, skip outside', async () => {
      const engine = EngineManager.getInstance().getEngine('AAPL');

      // Case A: Outside trading hours (Sunday 10:00 AM NY)
      TimeProvider.setMockTime(new Date('2024-07-14T14:00:00Z'));
      const closedRes = await LiquiditySimulator.refreshInstrument('AAPL');
      expect(closedRes.skipped).toBe(true);
      expect(closedRes.reason).toContain('not open');
      expect(engine.getOrderBook().bids.length).toBe(0);
      expect(engine.getOrderBook().asks.length).toBe(0);

      // Case B: Regular trading hours (Wednesday 10:30 AM NY)
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));
      const openRes = await LiquiditySimulator.refreshInstrument('AAPL');
      expect(openRes.success).toBe(true);
      expect(openRes.skipped).toBeFalsy();
      expect(openRes.bidsCount).toBe(5);
      expect(openRes.asksCount).toBe(5);

      const book = engine.getOrderBook();
      expect(book.bids.length).toBe(5);
      expect(book.asks.length).toBe(5);
    });

    it('should cover all registered instruments across equities and crypto without second registry', async () => {
      // Set time to Wednesday regular market hours so both equities and crypto are eligible
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));

      const results = await LiquiditySimulator.tick();
      const allInstruments = InstrumentRegistry.getAllInstruments();

      expect(results.size).toBe(allInstruments.length);
      for (const inst of allInstruments) {
        const r = results.get(inst.symbol);
        expect(r).toBeDefined();
        expect(r?.success).toBe(true);
        expect(r?.ordersGenerated).toBe(10);
      }
    });
  });

  // =========================================================================
  // 3. FINANCIAL PRECISION, TICK SIZES & LOT STEPS
  // =========================================================================
  describe('3. Precision, Tick Size & Lot Steps', () => {
    it('should generate prices that strictly conform to each instrument tick size', () => {
      const instruments = InstrumentRegistry.getAllInstruments();

      for (const inst of instruments) {
        const orders = LiquiditySimulator.generateLiquidityOrders(inst);
        expect(orders.length).toBe(10);

        for (const o of orders) {
          const priceBasis = MathPrecision.parsePriceToBasis(o.price);
          expect(MathPrecision.isValidTickSize(priceBasis, inst.tickSizeBasis)).toBe(true);
          expect(priceBasis % inst.tickSizeBasis).toBe(0n);
        }
      }
    });

    it('should generate quantities that strictly conform to quantity step, minimum lot, and minimum notional', () => {
      const instruments = InstrumentRegistry.getAllInstruments();

      for (const inst of instruments) {
        const orders = LiquiditySimulator.generateLiquidityOrders(inst);

        for (const o of orders) {
          const qtyMicro = MathPrecision.parseQtyToMicro(o.quantity);
          const priceBasis = MathPrecision.parsePriceToBasis(o.price);

          const validCheck = MathPrecision.isValidQuantity(
            qtyMicro,
            inst.minOrderQuantityMicro,
            inst.quantityStepMicro
          );
          expect(validCheck.valid).toBe(true);
          expect(qtyMicro % inst.quantityStepMicro).toBe(0n);
          expect(qtyMicro >= inst.minOrderQuantityMicro).toBe(true);

          // Minimum notional requirement: at least $1.00 USD (100 cents)
          const notionalCents = MathPrecision.calculateNotionalCents(priceBasis, qtyMicro);
          expect(MathPrecision.isValidMinimumNotional(notionalCents)).toBe(true);
        }
      }
    });

    it('should generate realistic varying quantities across depth levels', () => {
      const inst = InstrumentRegistry.getInstrument('AAPL')!;
      const orders = LiquiditySimulator.generateLiquidityOrders(inst);

      const bids = orders.filter((o) => o.side === 'BUY');
      const asks = orders.filter((o) => o.side === 'SELL');

      // Quantities should increase across levels 1 to 5 to reflect depth buildup
      for (let i = 0; i < bids.length - 1; i++) {
        expect(bids[i + 1].quantity).toBeGreaterThan(bids[i].quantity);
      }
      for (let i = 0; i < asks.length - 1; i++) {
        expect(asks[i + 1].quantity).toBeGreaterThan(asks[i].quantity);
      }
    });
  });

  // =========================================================================
  // 4. SPREAD CONTROL
  // =========================================================================
  describe('4. Spread Control (0.05% to 0.15%)', () => {
    it('should maintain a controlled inside spread between 0.05% and 0.15% across all instruments', () => {
      const instruments = InstrumentRegistry.getAllInstruments();

      for (const inst of instruments) {
        const orders = LiquiditySimulator.generateLiquidityOrders(inst);
        const bestBid = orders.find((o) => o.side === 'BUY');
        const bestAsk = orders.find((o) => o.side === 'SELL');

        expect(bestBid).toBeDefined();
        expect(bestAsk).toBeDefined();

        expect(bestBid!.price).toBeLessThan(bestAsk!.price);

        const spreadDollars = bestAsk!.price - bestBid!.price;
        const spreadRatio = spreadDollars / inst.baselinePrice;

        // Spread must be between 0.05% (0.0005) and 0.15% (0.0015)
        expect(spreadRatio).toBeGreaterThanOrEqual(0.0005);
        expect(spreadRatio).toBeLessThanOrEqual(0.0015);
      }
    });
  });

  // =========================================================================
  // 5. SIMULATOR OWNERSHIP & USER SAFETY
  // =========================================================================
  describe('5. Simulator Ownership & Safety Guarantees', () => {
    it('should tag all generated orders with SIMULATOR ownership and unique IDs', () => {
      const inst = InstrumentRegistry.getInstrument('ETH-USD')!;
      const orders = LiquiditySimulator.generateLiquidityOrders(inst);

      const idSet = new Set<string>();
      for (const o of orders) {
        expect(o.ownerType).toBe('SIMULATOR');
        expect(o.userId).toBe(SIMULATOR_USER_ID);
        expect(o.id.startsWith('sim_ETH-USD_')).toBe(true);

        expect(idSet.has(o.id)).toBe(false);
        idSet.add(o.id);
      }
    });

    it('should NEVER cancel, modify, or delete user-owned orders during liquidity refresh', async () => {
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));
      const engine = EngineManager.getInstance().getEngine('AAPL');

      // 1. Seed resting user limit order in SQLite and engine
      const userOrder: Order = {
        id: 'user_active_maker_bid_1',
        side: 'BUY',
        type: 'LIMIT',
        price: 220.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'PENDING',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
        userId: 'retail_trader_42',
        ownerType: 'USER',
      };
      OrderModel.create(userOrder);
      engine.processOrder(userOrder);

      expect(engine.getOrderBook().bids.length).toBe(1);

      // 2. Run liquidity simulator refresh
      await LiquiditySimulator.refreshInstrument('AAPL');

      // 3. Verify user order in SQLite is completely untouched
      const dbUserOrder = OrderModel.findById('user_active_maker_bid_1');
      expect(dbUserOrder).toBeDefined();
      expect(dbUserOrder?.status).toBe('PENDING');
      expect(dbUserOrder?.remainingQuantity).toBe(5);
      expect(dbUserOrder?.ownerType).toBe('USER');
      expect(dbUserOrder?.userId).toBe('retail_trader_42');

      // 4. Verify user order is still present in the engine book alongside simulator bids
      const book = engine.getOrderBook();
      expect(book.bids.length).toBe(6); // 5 simulator bids + 1 user bid
      const userLevel = book.bids.find((b) => b.price === 220.0);
      expect(userLevel).toBeDefined();
      expect(userLevel?.quantity).toBe(5);
    });

    it('should safely prevent duplicate simulator orders across repeated heartbeat ticks', async () => {
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));

      // Run 3 consecutive simulator ticks
      await LiquiditySimulator.refreshInstrument('SOL-USD');
      await LiquiditySimulator.refreshInstrument('SOL-USD');
      await LiquiditySimulator.refreshInstrument('SOL-USD');

      // In SQLite: exactly 10 active simulator orders exist (5 bids + 5 asks)
      const activeSimOrders = OrderModel.getSimulatorOrders('SOL-USD', 'PENDING');
      expect(activeSimOrders.length).toBe(10);

      // In MatchingEngine: exactly 5 bids and 5 asks
      const book = EngineManager.getInstance().getEngine('SOL-USD').getOrderBook();
      expect(book.bids.length).toBe(5);
      expect(book.asks.length).toBe(5);
    });

    it('should preserve completed historical orders and trade history when refreshing', async () => {
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));
      const engine = EngineManager.getInstance().getEngine('BYTE-USD');

      // 1. Initial liquidity refresh
      await LiquiditySimulator.refreshInstrument('BYTE-USD');
      const initialBook = engine.getOrderBook();
      const bestAsk = initialBook.asks[0];

      // 2. User places matching BUY order against simulator ask
      const userBuyOrder: Order = {
        id: 'user_market_crossing_buy',
        side: 'BUY',
        type: 'LIMIT',
        price: bestAsk.price,
        quantity: 5,
        remainingQuantity: 5,
        status: 'PENDING',
        createdAt: TimeProvider.now().toISOString(),
        symbol: 'BYTE-USD',
        userId: 'retail_trader_buyer',
        ownerType: 'USER',
      };
      const matchResult = engine.processOrder(userBuyOrder);
      expect(matchResult.trades.length).toBe(1);

      // Verify trade persisted in SQLite
      const tradesBefore = TradeModel.findByOrderId(userBuyOrder.id);
      expect(tradesBefore.length).toBe(1);

      // 3. Second simulator refresh
      await LiquiditySimulator.refreshInstrument('BYTE-USD');

      // 4. Verify historical trade is still preserved
      const tradesAfter = TradeModel.findByOrderId(userBuyOrder.id);
      expect(tradesAfter.length).toBe(1);
      expect(tradesAfter[0].id).toBe(tradesBefore[0].id);

      // Verify user order is still FILLED
      const dbUser = OrderModel.findById(userBuyOrder.id);
      expect(dbUser?.status).toBe('FILLED');
    });

    it('should only cancel simulator-owned pending or partially filled orders during cleanup', () => {
      // 1. User PENDING
      OrderModel.create({
        id: 'u_pend',
        side: 'BUY',
        type: 'LIMIT',
        price: 100,
        quantity: 1,
        remainingQuantity: 1,
        status: 'PENDING',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
        ownerType: 'USER',
      });
      // 2. User FILLED
      OrderModel.create({
        id: 'u_fill',
        side: 'BUY',
        type: 'LIMIT',
        price: 100,
        quantity: 1,
        remainingQuantity: 0,
        status: 'FILLED',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
        ownerType: 'USER',
      });
      // 3. Simulator FILLED
      OrderModel.create({
        id: 's_fill',
        side: 'SELL',
        type: 'LIMIT',
        price: 101,
        quantity: 1,
        remainingQuantity: 0,
        status: 'FILLED',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
        ownerType: 'SIMULATOR',
      });
      // 4. Simulator PENDING
      OrderModel.create({
        id: 's_pend',
        side: 'SELL',
        type: 'LIMIT',
        price: 102,
        quantity: 1,
        remainingQuantity: 1,
        status: 'PENDING',
        createdAt: '2024-07-10 12:00:00',
        symbol: 'AAPL',
        ownerType: 'SIMULATOR',
      });

      // Execute simulator cleanup
      const cancelledCount = OrderModel.cancelSimulatorOrders('AAPL');
      expect(cancelledCount).toBe(1);

      // Verify states
      expect(OrderModel.findById('u_pend')?.status).toBe('PENDING');
      expect(OrderModel.findById('u_fill')?.status).toBe('FILLED');
      expect(OrderModel.findById('s_fill')?.status).toBe('FILLED');
      expect(OrderModel.findById('s_pend')?.status).toBe('CANCELLED');
    });
  });

  // =========================================================================
  // 6. REFERENCE PRICE SEPARATION & MATCHING ENGINE INTEGRATION
  // =========================================================================
  describe('6. Reference Price Separation & Matching Engine Integrity', () => {
    it('should separate referencePrice benchmark from exchange executions without overwriting', async () => {
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));
      const instBefore = InstrumentRegistry.getInstrument('AAPL')!;
      const originalBaseline = instBefore.baselinePrice;

      // Execute refresh
      await LiquiditySimulator.refreshInstrument('AAPL');

      // Verify InstrumentRegistry baselinePrice was not overwritten
      const instAfter = InstrumentRegistry.getInstrument('AAPL')!;
      expect(instAfter.baselinePrice).toBe(originalBaseline);
    });

    it('should maintain existing FIFO MatchingEngine behaviour unchanged', async () => {
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));
      const engine = EngineManager.getInstance().getEngine('BYTE-USD');

      // 1. Populate simulator depth on BYTE-USD
      await LiquiditySimulator.refreshInstrument('BYTE-USD');
      const book = engine.getOrderBook();
      const bestAsk = book.asks[0];

      // 2. User submits MARKET order to buy
      const marketBuyOrder: Order = {
        id: 'user_fifo_test_market_buy',
        side: 'BUY',
        type: 'MARKET',
        price: 0,
        quantity: 4,
        remainingQuantity: 4,
        status: 'PENDING',
        createdAt: TimeProvider.now().toISOString(),
        symbol: 'BYTE-USD',
        userId: 'retail_trader_fifo',
        ownerType: 'USER',
      };

      const result = engine.processOrder(marketBuyOrder);
      expect(result.trades.length).toBe(1);
      expect(result.trades[0].price).toBe(bestAsk.price);
      expect(result.trades[0].quantity).toBe(4);
      expect(result.order.status).toBe('FILLED');
    });

    it('should isolate errors per instrument so single failure does not halt other instruments', async () => {
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));

      const originalFn = LiquiditySimulator.refreshInstrument;
      const refreshSpy = vi.spyOn(LiquiditySimulator, 'refreshInstrument').mockImplementation(async (sym) => {
        const canonical = typeof sym === 'string' ? sym : sym.symbol;
        if (canonical === 'MSFT') {
          throw new Error('Simulated hardware/IO fault on MSFT');
        }
        return originalFn.call(LiquiditySimulator, sym);
      });

      const results = await LiquiditySimulator.tick();

      // MSFT failed
      expect(results.get('MSFT')?.success).toBe(false);
      expect(results.get('MSFT')?.reason).toContain('Simulated hardware/IO fault');

      // AAPL and BTC-USD succeeded
      expect(results.get('AAPL')?.success).toBe(true);
      expect(results.get('BTC-USD')?.success).toBe(true);

      refreshSpy.mockRestore();
    });
  });
});
