import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import app from '../src/index.js';
import { db, initDatabase } from '../src/database/db.js';
import { OrderModel } from '../src/models/orderModel.js';
import { TradeModel } from '../src/models/tradeModel.js';
import { OrderService } from '../src/services/orderService.js';
import { EngineManager } from '../src/matching-engine/EngineManager.js';
import { InstrumentRegistry } from '../src/services/InstrumentRegistry.js';
import { MathPrecision } from '../src/utils/MathPrecision.js';
import { TimeProvider } from '../src/utils/TimeProvider.js';
import { AmoScheduler } from '../src/services/AmoScheduler.js';
import { LiquiditySimulator } from '../src/services/LiquiditySimulator.js';
import { FundsReservationAdapterFactory } from '../src/services/FundsReservationAdapter.js';
import { AppError } from '../src/middlewares/errorHandler.js';

describe('Phase 02 — Step 5: Order Service Integration & Precision Compatibility Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Start actual Express HTTP server on ephemeral port for genuine network API tests
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
    LiquiditySimulator.stop();
    TimeProvider.reset();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    TimeProvider.reset();
    OrderService.resetExchange();
    FundsReservationAdapterFactory.resetToDefault();
  });

  // =========================================================================
  // 1. Order Placement for Equities (AAPL, MSFT, NVDA, TSLA, AMZN)
  // =========================================================================
  describe('1. Equities Order Placement', () => {
    it('should place a valid AAPL limit order during regular market hours', () => {
      // Wednesday 10:30 AM ET (14:30 UTC) during regular hours
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));

      const res = OrderService.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        price: 228.1,
        quantity: 5,
        userId: 'usr_equity_1',
      });

      expect(res.order.symbol).toBe('AAPL');
      expect(res.order.status).toBe('PENDING');
      expect(res.order.price).toBe(228.1);
      expect(res.order.quantity).toBe(5);
      expect(res.order.remainingQuantity).toBe(5);
      expect(res.order.priceBasis).toBe(2281000n);
      expect(res.order.quantityMicro).toBe(5000000n);
      expect(res.order.remainingQuantityMicro).toBe(5000000n);
      expect(res.order.priceStr).toBe('228.10');
      expect(res.order.quantityStr).toBe('5');

      // Verify persisted in SQLite
      const persisted = OrderModel.findById(res.order.id);
      expect(persisted).not.toBeNull();
      expect(persisted?.symbol).toBe('AAPL');
      expect(persisted?.priceBasis).toBe(2281000n);
      expect(persisted?.quantityMicro).toBe(5000000n);

      // Verify present in isolated AAPL matching engine
      const book = EngineManager.getInstance().getEngine('AAPL').getOrderBook();
      expect(book.bids.length).toBe(1);
      expect(book.bids[0].price).toBe(228.1);
    });

    it('should support other registered equities (MSFT, NVDA, TSLA, AMZN)', () => {
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));

      for (const sym of ['MSFT', 'NVDA', 'TSLA', 'AMZN']) {
        const inst = InstrumentRegistry.getInstrument(sym)!;
        const res = OrderService.createOrder({
          symbol: sym,
          side: 'BUY',
          type: 'LIMIT',
          price: inst.baselinePrice,
          quantity: 2,
        });
        expect(res.order.symbol).toBe(sym);
        expect(res.order.status).toBe('PENDING');
        expect(EngineManager.getInstance().getEngine(sym).getOrderBook().bids.length).toBe(1);
      }
    });
  });

  // =========================================================================
  // 2. Order Placement for Crypto (BTC-USD, ETH-USD, SOL-USD)
  // =========================================================================
  describe('2. Crypto Order Placement (24/7/365)', () => {
    it('should place a valid BTC-USD limit order on a weekend (continuous 24/7 trading)', () => {
      // Sunday midnight UTC
      TimeProvider.setMockTime(new Date('2024-07-14T00:00:00Z'));

      const res = OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: 88532.5, // 0.50 tick size
        quantity: 0.0002, // 0.0001 step
      });

      expect(res.order.symbol).toBe('BTC-USD');
      expect(res.order.status).toBe('PENDING');
      expect(res.order.priceBasis).toBe(885325000n);
      expect(res.order.quantityMicro).toBe(200n);
      expect(res.order.priceStr).toBe('88532.50');
      expect(res.order.quantityStr).toBe('0.0002');

      const book = EngineManager.getInstance().getEngine('BTC-USD').getOrderBook();
      expect(book.bids.length).toBe(1);
      expect(book.bids[0].price).toBe(88532.5);
    });

    it('should place valid ETH-USD and SOL-USD orders continuously', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T02:00:00Z'));

      const ethRes = OrderService.createOrder({
        symbol: 'ETH-USD',
        side: 'SELL',
        type: 'LIMIT',
        price: 3240.5,
        quantity: 0.005,
      });
      expect(ethRes.order.symbol).toBe('ETH-USD');
      expect(ethRes.order.priceBasis).toBe(32405000n);
      expect(ethRes.order.quantityMicro).toBe(5000n);

      const solRes = OrderService.createOrder({
        symbol: 'SOL-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: 184.2,
        quantity: 0.05,
      });
      expect(solRes.order.symbol).toBe('SOL-USD');
      expect(solRes.order.priceBasis).toBe(1842000n);
      expect(solRes.order.quantityMicro).toBe(50000n);
    });
  });

  // =========================================================================
  // 3. Order Placement for BYTE-USD
  // =========================================================================
  describe('3. BYTE-USD Order Placement', () => {
    it('should place valid BYTE-USD orders with discrete share lot steps', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T03:00:00Z'));

      const res = OrderService.createOrder({
        symbol: 'BYTE-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: 100.0,
        quantity: 10, // Discrete lot (fractional not allowed for BYTE-USD)
      });

      expect(res.order.symbol).toBe('BYTE-USD');
      expect(res.order.status).toBe('PENDING');
      expect(res.order.priceBasis).toBe(1000000n);
      expect(res.order.quantityMicro).toBe(10000000n);
      expect(res.order.priceStr).toBe('100.00');
      expect(res.order.quantityStr).toBe('10');
    });
  });

  // =========================================================================
  // 4. Symbol Alias Canonicalization
  // =========================================================================
  describe('4. Symbol Alias Canonicalization', () => {
    it('should normalize legacy aliases to their canonical symbols', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T04:00:00Z'));

      const byteRes = OrderService.createOrder({
        symbol: 'BYTE',
        side: 'BUY',
        type: 'LIMIT',
        price: 100,
        quantity: 5,
      });
      expect(byteRes.order.symbol).toBe('BYTE-USD');

      const btcRes = OrderService.createOrder({
        symbol: 'BTC',
        side: 'BUY',
        type: 'LIMIT',
        price: 88532.5,
        quantity: 0.0001,
      });
      expect(btcRes.order.symbol).toBe('BTC-USD');

      const ethRes = OrderService.createOrder({
        symbol: 'ETH',
        side: 'BUY',
        type: 'LIMIT',
        price: 3240.5,
        quantity: 0.001,
      });
      expect(ethRes.order.symbol).toBe('ETH-USD');

      const solRes = OrderService.createOrder({
        symbol: 'SOL',
        side: 'BUY',
        type: 'LIMIT',
        price: 184.2,
        quantity: 0.01,
      });
      expect(solRes.order.symbol).toBe('SOL-USD');
    });

    it('should reject unknown instruments cleanly', () => {
      expect(() => {
        OrderService.createOrder({
          symbol: 'UNKNOWN-ASSET',
          side: 'BUY',
          type: 'LIMIT',
          price: 10,
          quantity: 1,
        });
      }).toThrowError(/Unknown or untradable instrument/);
    });
  });

  // =========================================================================
  // 5. Invalid Tick-Size Rejection
  // =========================================================================
  describe('5. Invalid Tick-Size Rejection', () => {
    it('should reject BTC-USD price violating 0.50 tick size', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T05:00:00Z'));

      expect(() => {
        OrderService.createOrder({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 88532.41, // Violates 0.50 tick size
          quantity: 0.0001,
        });
      }).toThrowError(/does not conform to tick size/);
    });

    it('should reject SOL-USD price violating 0.05 tick size', () => {
      expect(() => {
        OrderService.createOrder({
          symbol: 'SOL-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 184.22, // Violates 0.05 tick size
          quantity: 0.01,
        });
      }).toThrowError(/does not conform to tick size/);
    });

    it('should reject AAPL price violating 0.01 tick size', () => {
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));

      expect(() => {
        OrderService.createOrder({
          symbol: 'AAPL',
          side: 'BUY',
          type: 'LIMIT',
          price: 228.105, // Violates 0.01 tick size
          quantity: 1,
        });
      }).toThrowError(/does not conform to tick size/);
    });
  });

  // =========================================================================
  // 6. Invalid Quantity-Step Rejection
  // =========================================================================
  describe('6. Invalid Quantity-Step Rejection', () => {
    it('should reject BYTE-USD fractional quantity (lot step is 1.0)', () => {
      expect(() => {
        OrderService.createOrder({
          symbol: 'BYTE-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 100,
          quantity: 1.5, // Non-discrete lot
        });
      }).toThrowError(/does not conform to step size/);
    });

    it('should reject BTC-USD quantity violating 0.0001 step size', () => {
      expect(() => {
        OrderService.createOrder({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 88532.5,
          quantity: 0.00015, // Violates 0.0001 step
        });
      }).toThrowError(/does not conform to step size/);
    });

    it('should reject quantity below minimum order quantity', () => {
      expect(() => {
        OrderService.createOrder({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 88532.5,
          quantity: 0.00005, // Below 0.0001 min lot
        });
      }).toThrowError(/below minimum lot size/);
    });
  });

  // =========================================================================
  // 7. Minimum Notional Validation ($1.00 USD / 100 Cents)
  // =========================================================================
  describe('7. Minimum Notional Validation', () => {
    it('should reject order if notional is below $1.00 USD', () => {
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));

      // AAPL price $100, qty 0.001 -> Notional $0.10 (10 cents < 100 cents)
      expect(() => {
        OrderService.createOrder({
          symbol: 'AAPL',
          side: 'BUY',
          type: 'LIMIT',
          price: 100.0,
          quantity: 0.001,
        });
      }).toThrowError(/does not meet the minimum requirement of \$1\.00 USD/);
    });

    it('should accept order if notional meets or exceeds $1.00 USD', () => {
      TimeProvider.setMockTime(new Date('2024-07-10T14:30:00Z'));

      // AAPL price $200, qty 0.005 -> Notional $1.00 (100 cents)
      const res = OrderService.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        price: 200.0,
        quantity: 0.005,
      });

      expect(res.order.status).toBe('PENDING');
      expect(res.order.quantity).toBe(0.005);
    });
  });

  // =========================================================================
  // 8. Precise Partial-Fill Calculations (No Floating-Point Dust)
  // =========================================================================
  describe('8. Precise Partial-Fill Calculations', () => {
    it('should handle repeated fractional partial fills with exact micro-unit arithmetic without dust', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T06:00:00Z'));

      // Resting maker: SELL 0.0003 BTC at $88,532.50
      const maker = OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'SELL',
        type: 'LIMIT',
        price: 88532.5,
        quantity: 0.0003,
      });
      expect(maker.order.remainingQuantity).toBe(0.0003);
      expect(maker.order.remainingQuantityMicro).toBe(300n);

      // Taker 1: BUY 0.0001 BTC
      const taker1 = OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: 88532.5,
        quantity: 0.0001,
      });
      expect(taker1.trades.length).toBe(1);
      expect(taker1.trades[0].quantity).toBe(0.0001);
      expect(taker1.trades[0].quantityMicro).toBe(100n);

      // Verify maker after fill 1: exactly 0.0002 remaining, no floating point dust
      const makerAfter1 = OrderModel.findById(maker.order.id)!;
      expect(makerAfter1.status).toBe('PARTIALLY_FILLED');
      expect(makerAfter1.remainingQuantity).toBe(0.0002);
      expect(makerAfter1.remainingQuantityMicro).toBe(200n);
      expect(makerAfter1.remainingQuantityStr).toBe('0.0002');

      // Taker 2: BUY 0.0001 BTC
      const taker2 = OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: 88532.5,
        quantity: 0.0001,
      });
      expect(taker2.trades.length).toBe(1);

      // Verify maker after fill 2: exactly 0.0001 remaining
      const makerAfter2 = OrderModel.findById(maker.order.id)!;
      expect(makerAfter2.status).toBe('PARTIALLY_FILLED');
      expect(makerAfter2.remainingQuantity).toBe(0.0001);
      expect(makerAfter2.remainingQuantityMicro).toBe(100n);
      expect(makerAfter2.remainingQuantityStr).toBe('0.0001');

      // Taker 3: BUY 0.0001 BTC (complete fill)
      const taker3 = OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: 88532.5,
        quantity: 0.0001,
      });
      expect(taker3.trades.length).toBe(1);

      // Verify maker after fill 3: exactly 0 remaining, status FILLED
      const makerAfter3 = OrderModel.findById(maker.order.id)!;
      expect(makerAfter3.status).toBe('FILLED');
      expect(makerAfter3.remainingQuantity).toBe(0);
      expect(makerAfter3.remainingQuantityMicro).toBe(0n);
      expect(makerAfter3.remainingQuantityStr).toBe('0');
      expect(makerAfter3.filledQuantityStr).toBe('0.0003');

      // Order book is now empty
      const book = EngineManager.getInstance().getEngine('BTC-USD').getOrderBook();
      expect(book.asks.length).toBe(0);
    });
  });

  // =========================================================================
  // 9. Correct Trade Persistence
  // =========================================================================
  describe('9. Correct Trade Persistence', () => {
    it('should persist trade record with integer shadow columns and canonical symbol', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T07:00:00Z'));

      OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'SELL',
        type: 'LIMIT',
        price: 88532.5,
        quantity: 0.0001,
      });

      const buyRes = OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: 88532.5,
        quantity: 0.0001,
      });

      expect(buyRes.trades.length).toBe(1);
      const trade = buyRes.trades[0];
      expect(trade.symbol).toBe('BTC-USD');
      expect(trade.price).toBe(88532.5);
      expect(trade.quantity).toBe(0.0001);
      expect(trade.priceBasis).toBe(885325000n);
      expect(trade.quantityMicro).toBe(100n);

      // Verify persisted trade from DB
      const recentTrades = TradeModel.getRecentTrades(10, 'BTC-USD');
      expect(recentTrades.length).toBe(1);
      expect(recentTrades[0].symbol).toBe('BTC-USD');
      expect(recentTrades[0].priceBasis).toBe(885325000n);
      expect(recentTrades[0].quantityMicro).toBe(100n);
      expect(recentTrades[0].priceStr).toBe('88532.50');
      expect(recentTrades[0].quantityStr).toBe('0.0001');
    });
  });

  // =========================================================================
  // 10. AMO Order Compatibility
  // =========================================================================
  describe('10. AMO Order Compatibility', () => {
    it('should queue equity limit order outside regular hours as QUEUED_AMO and retain shadow precision', () => {
      // Wednesday 8:00 PM ET (Thursday 00:00 UTC) outside regular hours
      TimeProvider.setMockTime(new Date('2024-07-11T00:00:00Z'));

      const res = OrderService.createOrder({
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        price: 228.1,
        quantity: 2,
      });

      expect(res.order.status).toBe('QUEUED_AMO');
      expect(res.order.symbol).toBe('AAPL');
      expect(res.order.priceBasis).toBe(2281000n);
      expect(res.order.quantityMicro).toBe(2000000n);

      // Must NOT be present in matching engine yet
      const book = EngineManager.getInstance().getEngine('AAPL').getOrderBook();
      expect(book.bids.length).toBe(0);

      // Verify in queued AMOs list
      const queued = OrderModel.getQueuedAmoOrders('AAPL');
      expect(queued.length).toBe(1);
      expect(queued[0].id).toBe(res.order.id);
    });
  });

  // =========================================================================
  // 11. Market-Session Validation
  // =========================================================================
  describe('11. Market-Session Validation', () => {
    it('should reject equity market orders outside regular trading hours', () => {
      // Wednesday 8:00 PM ET outside regular hours
      TimeProvider.setMockTime(new Date('2024-07-11T00:00:00Z'));

      expect(() => {
        OrderService.createOrder({
          symbol: 'AAPL',
          side: 'BUY',
          type: 'MARKET',
          quantity: 2,
        });
      }).toThrowError(/Market orders for equities are rejected outside regular trading hours/);
    });

    it('should allow crypto market orders at any time provided opposite liquidity exists', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T08:00:00Z')); // Sunday

      // Place resting sell limit order
      OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'SELL',
        type: 'LIMIT',
        price: 88532.5,
        quantity: 0.0001,
      });

      // Place market BUY order
      const res = OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'BUY',
        type: 'MARKET',
        quantity: 0.0001,
      });

      expect(res.order.status).toBe('FILLED');
      expect(res.trades.length).toBe(1);
      expect(res.trades[0].price).toBe(88532.5);
    });
  });

  // =========================================================================
  // 12. Simulator Liquidity Compatibility
  // =========================================================================
  describe('12. Simulator Liquidity Compatibility', () => {
    it('should execute user orders against resting simulator orders while distinguishing ownership', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T09:00:00Z'));

      // Populate simulator liquidity for BTC-USD
      LiquiditySimulator.refreshInstrument('BTC-USD');

      const simOrders = OrderModel.getSimulatorOrders('BTC-USD', 'PENDING');
      expect(simOrders.length).toBeGreaterThan(0);
      expect(simOrders[0].ownerType).toBe('SIMULATOR');

      const book = EngineManager.getInstance().getEngine('BTC-USD').getOrderBook();
      expect(book.asks.length).toBeGreaterThan(0);
      const bestAskPrice = book.asks[0].price;

      // User places BUY limit order matching best simulator ask
      const userRes = OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: bestAskPrice,
        quantity: 0.0001,
        userId: 'usr_real_1',
      });

      expect(userRes.order.ownerType).toBe('USER');
      expect(userRes.trades.length).toBe(1);
      expect(userRes.trades[0].price).toBe(bestAskPrice);
      expect(userRes.order.status).toBe('FILLED');

      // Verify simulator orders still have SIMULATOR ownership
      const userOrders = OrderModel.getAll().filter((o) => o.ownerType === 'USER');
      expect(userOrders.some((o) => o.id === userRes.order.id)).toBe(true);
    });
  });

  // =========================================================================
  // 13. Cancellation and Order Ownership
  // =========================================================================
  describe('13. Cancellation and Order Ownership', () => {
    it('should allow user to cancel their own resting order and prevent subsequent execution', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T10:00:00Z'));

      const order = OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: 80000.0,
        quantity: 0.0001,
        userId: 'alice_123',
      });

      const engine = EngineManager.getInstance().getEngine('BTC-USD');
      expect(engine.getOrderBook().bids.length).toBe(1);

      // Alice cancels her order
      const cancelled = OrderService.cancelOrder(order.order.id, 'alice_123');
      expect(cancelled.status).toBe('CANCELLED');

      // Removed from engine book
      expect(engine.getOrderBook().bids.length).toBe(0);

      // Verify counter-order does NOT match against cancelled order
      const counter = OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'SELL',
        type: 'LIMIT',
        price: 80000.0,
        quantity: 0.0001,
      });
      expect(counter.trades.length).toBe(0);
    });

    it('should forbid a regular user from cancelling a SIMULATOR order', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T10:30:00Z'));
      LiquiditySimulator.refreshInstrument('BTC-USD');

      const simOrders = OrderModel.getSimulatorOrders('BTC-USD', 'PENDING');
      expect(simOrders.length).toBeGreaterThan(0);

      expect(() => {
        OrderService.cancelOrder(simOrders[0].id, 'regular_user');
      }).toThrowError(/Cannot cancel system simulator order/);
    });

    it('should forbid a user from cancelling another user order', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T11:00:00Z'));

      const order = OrderService.createOrder({
        symbol: 'BTC-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: 75000.0,
        quantity: 0.0001,
        userId: 'bob_owner',
      });

      expect(() => {
        OrderService.cancelOrder(order.order.id, 'eve_attacker');
      }).toThrowError(/Unauthorized: Order belongs to another user/);
    });
  });

  // =========================================================================
  // 14. API Response Precision and Serialization
  // =========================================================================
  describe('14. API Response Precision & Serialization', () => {
    it('should return exact decimal strings via HTTP API boundary', async () => {
      TimeProvider.setMockTime(new Date('2024-07-14T12:00:00Z'));

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: '88532.50',
          quantity: '0.0002',
          userId: 'api_test_user',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);

      const order = json.data.order;
      expect(order.symbol).toBe('BTC-USD');
      expect(typeof order.id).toBe('string');
      expect(order.type).toBe('LIMIT');
      expect(order.side).toBe('BUY');
      expect(order.status).toBe('PENDING');
      expect(order.ownerType).toBe('USER');

      // Validate exact decimal string fields
      expect(typeof order.price).toBe('string');
      expect(order.price).toBe('88532.50');
      expect(typeof order.quantity).toBe('string');
      expect(order.quantity).toBe('0.0002');
      expect(typeof order.remainingQuantity).toBe('string');
      expect(order.remainingQuantity).toBe('0.0002');
      expect(typeof order.filledQuantity).toBe('string');
      expect(order.filledQuantity).toBe('0');
      expect(typeof order.originalQuantity).toBe('string');
      expect(order.originalQuantity).toBe('0.0002');

      // Verify GET /api/orders serialization
      const getRes = await fetch(`${baseUrl}/api/orders`);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(true);
      const found = getJson.data.find((o: any) => o.id === order.id);
      expect(found).toBeDefined();
      expect(found.price).toBe('88532.50');
      expect(found.quantity).toBe('0.0002');
    });
  });

  // =========================================================================
  // 15. Existing Matching Engine FIFO Integrity
  // =========================================================================
  describe('15. FIFO Price-Time Priority Integrity', () => {
    it('should strictly uphold FIFO Price-Time Priority across orders', () => {
      TimeProvider.setMockTime(new Date('2024-07-14T13:00:00Z'));

      // Two resting bids at same price: $100.00
      const bid1 = OrderService.createOrder({
        symbol: 'BYTE-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: 100,
        quantity: 5,
      });

      const bid2 = OrderService.createOrder({
        symbol: 'BYTE-USD',
        side: 'BUY',
        type: 'LIMIT',
        price: 100,
        quantity: 5,
      });

      // Taker SELL for 6 shares
      const taker = OrderService.createOrder({
        symbol: 'BYTE-USD',
        side: 'SELL',
        type: 'LIMIT',
        price: 100,
        quantity: 6,
      });

      expect(taker.trades.length).toBe(2);
      // Trade 1 fills bid1 completely (FIFO)
      expect(taker.trades[0].buyOrderId).toBe(bid1.order.id);
      expect(taker.trades[0].quantity).toBe(5);
      // Trade 2 fills bid2 partially (1 share)
      expect(taker.trades[1].buyOrderId).toBe(bid2.order.id);
      expect(taker.trades[1].quantity).toBe(1);

      const bid1After = OrderModel.findById(bid1.order.id)!;
      expect(bid1After.status).toBe('FILLED');

      const bid2After = OrderModel.findById(bid2.order.id)!;
      expect(bid2After.status).toBe('PARTIALLY_FILLED');
      expect(bid2After.remainingQuantity).toBe(4);
    });
  });
});
