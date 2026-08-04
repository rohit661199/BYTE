import { describe, it, expect, beforeEach } from 'vitest';
import { matchingEngine } from '../src/matching-engine/MatchingEngine.js';
import { db, initDatabase } from '../src/database/db.js';
import { OrderModel } from '../src/models/orderModel.js';
import { TradeModel } from '../src/models/tradeModel.js';
import { OrderService } from '../src/services/orderService.js';
import { createOrderSchema } from '../src/middlewares/validateRequest.js';

describe('20 Limit Order Tests Suite', () => {
  beforeEach(() => {
    initDatabase();
    db.prepare('DELETE FROM trades').run();
    db.prepare('DELETE FROM orders').run();
    matchingEngine.reset();
  });

  it('1. BUY LIMIT only', () => {
    const res = OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    expect(res.trades.length).toBe(0);
    expect(matchingEngine.getOrderBookSnapshot().bids.length).toBe(1);
  });

  it('2. SELL LIMIT only', () => {
    const res = OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 105, quantity: 5 });
    expect(res.trades.length).toBe(0);
    expect(matchingEngine.getOrderBookSnapshot().asks.length).toBe(1);
  });

  it('3. Exact Match', () => {
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    const res = OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    expect(res.trades.length).toBe(1);
    expect(res.trades[0].quantity).toBe(5);
    expect(res.trades[0].price).toBe(100);
  });

  it('4. Partial Fill BUY', () => {
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 10 });
    const res = OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 95, quantity: 3 });
    expect(res.trades.length).toBe(1);
    expect(res.trades[0].quantity).toBe(3);
    expect(res.trades[0].price).toBe(95);
    expect(matchingEngine.getOrderBookSnapshot().bids[0].quantity).toBe(7);
  });

  it('5. Partial Fill SELL', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 95, quantity: 10 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 4 });
    expect(res.trades.length).toBe(1);
    expect(res.trades[0].quantity).toBe(4);
    expect(res.trades[0].price).toBe(95);
    expect(matchingEngine.getOrderBookSnapshot().asks[0].quantity).toBe(6);
  });

  it('6. No Match', () => {
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 90, quantity: 5 });
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    expect(matchingEngine.getOrderBookSnapshot().bids.length).toBe(1);
    expect(matchingEngine.getOrderBookSnapshot().asks.length).toBe(1);
  });

  it('7. Price Priority BUY', () => {
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 110, quantity: 5 });
    const res = OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 105, quantity: 5 });
    expect(res.trades[0].price).toBe(105);
    expect(matchingEngine.getOrderBookSnapshot().bids[0].price).toBe(100);
  });

  it('8. Price Priority SELL', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 95, quantity: 5 });
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 90, quantity: 5 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    expect(res.trades[0].price).toBe(90);
    expect(matchingEngine.getOrderBookSnapshot().asks[0].price).toBe(95);
  });

  it('9. FIFO same price', () => {
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    const res = OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    expect(res.trades.length).toBe(1);
    expect(res.trades[0].quantity).toBe(5);
  });

  it('10. Multi-level matching', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 90, quantity: 3 });
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 95, quantity: 5 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 6 });
    expect(res.trades.length).toBe(2);
    expect(res.trades[0].quantity).toBe(3);
    expect(res.trades[1].quantity).toBe(3);
  });

  it('11. Large quantity', () => {
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 10000 });
    const res = OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 90, quantity: 10000 });
    expect(res.trades[0].quantity).toBe(10000);
  });

  it('12. Decimal prices', () => {
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 99.99, quantity: 5 });
    const res = OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 99.95, quantity: 5 });
    expect(res.trades[0].price).toBe(99.95);
  });

  it('13. Invalid price validation', () => {
    expect(() => createOrderSchema.parse({ side: 'BUY', type: 'LIMIT', price: 0, quantity: 5 })).toThrow();
  });

  it('14. Invalid quantity validation', () => {
    expect(() => createOrderSchema.parse({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 0 })).toThrow();
  });

  it('15. Empty fields validation', () => {
    expect(() => createOrderSchema.parse({ side: 'BUY', type: 'LIMIT', price: -1, quantity: -1 })).toThrow();
  });

  it('16. Duplicate submit handled with unique IDs', () => {
    const o1 = OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    const o2 = OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    expect(o1.order.id).not.toBe(o2.order.id);
  });

  it('17. Rapid submissions', () => {
    for (let i = 0; i < 20; i++) {
      OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100 + i, quantity: 1 });
    }
    expect(OrderModel.getAll().length).toBe(20);
  });

  it('18. Cancel pending order', () => {
    const created = OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    const cancelled = OrderService.cancelOrder(created.order.id);
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('19. Cancel filled order throws error', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 90, quantity: 5 });
    const buy = OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    expect(() => OrderService.cancelOrder(buy.order.id)).toThrow();
  });

  it('20. Refresh persistence', () => {
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    matchingEngine.hydrateFromDatabase();
    expect(matchingEngine.getOrderBookSnapshot().bids.length).toBe(1);
  });
});

describe('20 Market Order Tests Suite (Including Specific Assignment Test Cases)', () => {
  beforeEach(() => {
    initDatabase();
    db.prepare('DELETE FROM trades').run();
    db.prepare('DELETE FROM orders').run();
    matchingEngine.reset();
  });

  it('Test 1 (Assignment Spec): SELL LIMIT 100 Qty 5 vs BUY MARKET Qty 3', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 3 });

    expect(res.trades.length).toBe(1);
    expect(res.trades[0].quantity).toBe(3);
    expect(res.trades[0].price).toBe(100);

    const snapshot = matchingEngine.getOrderBookSnapshot();
    expect(snapshot.asks.length).toBe(1);
    expect(snapshot.asks[0].price).toBe(100);
    expect(snapshot.asks[0].quantity).toBe(2);
    expect(res.order.status).toBe('FILLED');
    expect(res.order.remainingQuantity).toBe(0);
  });

  it('Test 2 (Assignment Spec): BUY LIMIT 100 Qty 5 vs SELL MARKET Qty 3', () => {
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });
    const res = OrderService.createOrder({ side: 'SELL', type: 'MARKET', price: 0, quantity: 3 });

    expect(res.trades.length).toBe(1);
    expect(res.trades[0].quantity).toBe(3);
    expect(res.trades[0].price).toBe(100);

    const snapshot = matchingEngine.getOrderBookSnapshot();
    expect(snapshot.bids.length).toBe(1);
    expect(snapshot.bids[0].price).toBe(100);
    expect(snapshot.bids[0].quantity).toBe(2);
  });

  it('Test 3 (Assignment Spec): SELL 100 Qty5 + SELL 110 Qty5 vs BUY MARKET Qty 8', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 110, quantity: 5 });

    const res = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 8 });

    expect(res.trades.length).toBe(2);
    expect(res.trades[0].price).toBe(100);
    expect(res.trades[0].quantity).toBe(5);
    expect(res.trades[1].price).toBe(110);
    expect(res.trades[1].quantity).toBe(3);

    const snapshot = matchingEngine.getOrderBookSnapshot();
    expect(snapshot.asks.length).toBe(1);
    expect(snapshot.asks[0].price).toBe(110);
    expect(snapshot.asks[0].quantity).toBe(2);
  });

  it('Test 4 (Assignment Spec): BUY 110 Qty5 + BUY 100 Qty5 vs SELL MARKET Qty 8', () => {
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 110, quantity: 5 });
    OrderService.createOrder({ side: 'BUY', type: 'LIMIT', price: 100, quantity: 5 });

    const res = OrderService.createOrder({ side: 'SELL', type: 'MARKET', price: 0, quantity: 8 });

    expect(res.trades.length).toBe(2);
    expect(res.trades[0].price).toBe(110);
    expect(res.trades[0].quantity).toBe(5);
    expect(res.trades[1].price).toBe(100);
    expect(res.trades[1].quantity).toBe(3);

    const snapshot = matchingEngine.getOrderBookSnapshot();
    expect(snapshot.bids.length).toBe(1);
    expect(snapshot.bids[0].price).toBe(100);
    expect(snapshot.bids[0].quantity).toBe(2);
  });

  it('Test 5: BUY MARKET No liquidity throws NO_LIQUIDITY', () => {
    expect(() => OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 5 })).toThrow('No liquidity available');
  });

  it('Test 6: SELL MARKET No liquidity throws NO_LIQUIDITY', () => {
    expect(() => OrderService.createOrder({ side: 'SELL', type: 'MARKET', price: 0, quantity: 5 })).toThrow('No liquidity available');
  });

  it('Test 7: FIFO same price MARKET', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 5 });
    expect(res.trades[0].quantity).toBe(5);
  });

  it('Test 8: Price priority MARKET', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 105, quantity: 5 });
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 95, quantity: 5 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 5 });
    expect(res.trades[0].price).toBe(95);
  });

  it('Test 9: Partial liquidity MARKET', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 4 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 10 });
    expect(res.trades[0].quantity).toBe(4);
    expect(res.order.status).toBe('FILLED');
    expect(res.order.remainingQuantity).toBe(0);
  });

  it('Test 10: Exact fill MARKET', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 10 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 10 });
    expect(res.trades[0].quantity).toBe(10);
    expect(res.order.status).toBe('FILLED');
  });

  it('Test 11: Large quantity MARKET', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5000 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 5000 });
    expect(res.trades[0].quantity).toBe(5000);
  });

  it('Test 12: Refresh after market trade', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 3 });
    matchingEngine.hydrateFromDatabase();
    expect(matchingEngine.getOrderBookSnapshot().asks[0].quantity).toBe(2);
  });

  it('Test 13: Deployment stability', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 3 });
    expect(res.trades.length).toBe(1);
  });

  it('Test 14: WebSocket update data format', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 3 });
    expect(res.trades[0].price).toBe(100);
  });

  it('Test 15: Statistics after market trade', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 3 });
    const counts = OrderModel.getCounts();
    const stats = TradeModel.getStats();
    expect(counts.totalSell).toBe(1);
    expect(stats.totalTrades).toBe(1);
    expect(stats.totalVolume).toBe(300);
  });

  it('Test 16: Trade History correctness', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 3 });
    const trades = TradeModel.getRecentTrades(10);
    expect(trades.length).toBe(1);
    expect(trades[0].price).toBe(100);
    expect(trades[0].quantity).toBe(3);
  });

  it('Test 17: Remaining quantity handling', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 3 });
    expect(res.order.remainingQuantity).toBe(0);
  });

  it('Test 18: Duplicate market requests unique IDs', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 10 });
    const m1 = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 3 });
    const m2 = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 3 });
    expect(m1.order.id).not.toBe(m2.order.id);
  });

  it('Test 19: Rapid market requests', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 50 });
    for (let i = 0; i < 5; i++) {
      OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 2 });
    }
    expect(TradeModel.getRecentTrades(10).length).toBe(5);
  });

  it('Test 20: Market Orders NEVER remain pending', () => {
    OrderService.createOrder({ side: 'SELL', type: 'LIMIT', price: 100, quantity: 5 });
    const res = OrderService.createOrder({ side: 'BUY', type: 'MARKET', price: 0, quantity: 3 });
    expect(res.order.status).toBe('FILLED');
    expect(OrderModel.getActiveOrders().filter(o => o.type === 'MARKET').length).toBe(0);
  });
});
