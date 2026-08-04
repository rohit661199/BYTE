import { describe, it, expect, beforeEach } from 'vitest';
import { MatchingEngine } from '../src/matching-engine/MatchingEngine.js';
import { db, initDatabase } from '../src/database/db.js';
import { Order } from '../src/types/index.js';

describe('MatchingEngine Unit Test Suite', () => {
  let engine: MatchingEngine;

  beforeEach(() => {
    // Reset test database tables before each test case
    initDatabase();
    db.prepare('DELETE FROM trades').run();
    db.prepare('DELETE FROM orders').run();

    engine = new MatchingEngine();
  });

  it('1. should execute a full match when BUY price >= SELL price', () => {
    const buyOrder: Order = {
      id: 'buy_1',
      side: 'BUY',
      type: 'LIMIT',
      price: 100,
      quantity: 10,
      remainingQuantity: 10,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const sellOrder: Order = {
      id: 'sell_1',
      side: 'SELL',
      type: 'LIMIT',
      price: 95,
      quantity: 10,
      remainingQuantity: 10,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    // Process buy order first (resting bid)
    engine.processOrder(buyOrder);

    // Process incoming sell order (matches against resting bid)
    const result = engine.processOrder(sellOrder);

    expect(result.trades.length).toBe(1);
    expect(result.trades[0].quantity).toBe(10);
    expect(result.trades[0].price).toBe(95); // SELL order price per specification
    expect(buyOrder.status).toBe('FILLED');
    expect(sellOrder.status).toBe('FILLED');
    expect(buyOrder.remainingQuantity).toBe(0);
    expect(sellOrder.remainingQuantity).toBe(0);

    const snapshot = engine.getOrderBookSnapshot();
    expect(snapshot.bids.length).toBe(0);
    expect(snapshot.asks.length).toBe(0);
  });

  it('1b. should record trade price as 100 when BUY 100 vs SELL 100', () => {
    const buyOrder: Order = {
      id: 'buy_same_price',
      side: 'BUY',
      type: 'LIMIT',
      price: 100,
      quantity: 10,
      remainingQuantity: 10,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const sellOrder: Order = {
      id: 'sell_same_price',
      side: 'SELL',
      type: 'LIMIT',
      price: 100,
      quantity: 10,
      remainingQuantity: 10,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    engine.processOrder(buyOrder);
    const result = engine.processOrder(sellOrder);

    expect(result.trades.length).toBe(1);
    expect(result.trades[0].quantity).toBe(10);
    expect(result.trades[0].price).toBe(100);
  });

  it('2. should handle partial fills correctly', () => {
    const buyOrder: Order = {
      id: 'buy_partial_1',
      side: 'BUY',
      type: 'LIMIT',
      price: 100,
      quantity: 10,
      remainingQuantity: 10,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const sellOrder: Order = {
      id: 'sell_partial_1',
      side: 'SELL',
      type: 'LIMIT',
      price: 95,
      quantity: 3,
      remainingQuantity: 3,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    engine.processOrder(buyOrder);
    const result = engine.processOrder(sellOrder);

    expect(result.trades.length).toBe(1);
    expect(result.trades[0].quantity).toBe(3);
    expect(result.trades[0].price).toBe(95); // SELL order price per specification
    expect(sellOrder.status).toBe('FILLED');
    expect(buyOrder.status).toBe('PARTIALLY_FILLED');
    expect(buyOrder.remainingQuantity).toBe(7);

    const snapshot = engine.getOrderBookSnapshot();
    expect(snapshot.bids.length).toBe(1);
    expect(snapshot.bids[0].price).toBe(100);
    expect(snapshot.bids[0].quantity).toBe(7);
  });

  it('3. should enforce Price-Time priority sorting', () => {
    const time1 = new Date(Date.now() - 10000).toISOString();
    const time2 = new Date(Date.now() - 5000).toISOString();

    const sellLowPrice: Order = {
      id: 'sell_low',
      side: 'SELL',
      type: 'LIMIT',
      price: 90,
      quantity: 5,
      remainingQuantity: 5,
      status: 'PENDING',
      createdAt: time2,
    };

    const sellHighPrice: Order = {
      id: 'sell_high',
      side: 'SELL',
      type: 'LIMIT',
      price: 95,
      quantity: 5,
      remainingQuantity: 5,
      status: 'PENDING',
      createdAt: time1,
    };

    engine.processOrder(sellHighPrice);
    engine.processOrder(sellLowPrice);

    // Asks should place lowest price ($90) at the top of the book
    const snapshot = engine.getOrderBookSnapshot();
    expect(snapshot.asks[0].price).toBe(90);
    expect(snapshot.asks[1].price).toBe(95);

    // Incoming BUY order should match lowest ask ($90) first!
    const buyOrder: Order = {
      id: 'buy_sweep',
      side: 'BUY',
      type: 'LIMIT',
      price: 100,
      quantity: 5,
      remainingQuantity: 5,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const result = engine.processOrder(buyOrder);
    expect(result.trades[0].sellOrderId).toBe('sell_low');
    expect(result.trades[0].price).toBe(90);
  });

  it('4. should cancel open orders cleanly from engine memory', () => {
    const buyOrder: Order = {
      id: 'buy_cancel_me',
      side: 'BUY',
      type: 'LIMIT',
      price: 100,
      quantity: 5,
      remainingQuantity: 5,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    engine.processOrder(buyOrder);
    expect(engine.getOrderBookSnapshot().bids.length).toBe(1);

    const cancelled = engine.cancelOrder('buy_cancel_me');
    expect(cancelled).toBe(true);
    expect(engine.getOrderBookSnapshot().bids.length).toBe(0);
  });

  it('5. should execute MARKET orders against top of book', () => {
    const restingAsk: Order = {
      id: 'ask_limit_1',
      side: 'SELL',
      type: 'LIMIT',
      price: 105,
      quantity: 5,
      remainingQuantity: 5,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    engine.processOrder(restingAsk);

    const marketBuy: Order = {
      id: 'buy_market_1',
      side: 'BUY',
      type: 'MARKET',
      price: 0,
      quantity: 3,
      remainingQuantity: 3,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const result = engine.processOrder(marketBuy);
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].quantity).toBe(3);
    expect(result.trades[0].price).toBe(105);
    expect(marketBuy.status).toBe('FILLED');
  });

  it('5b. should execute MARKET SELL orders against highest BUY bid', () => {
    const restingBid: Order = {
      id: 'bid_limit_1',
      side: 'BUY',
      type: 'LIMIT',
      price: 110,
      quantity: 5,
      remainingQuantity: 5,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    engine.processOrder(restingBid);

    const marketSell: Order = {
      id: 'sell_market_1',
      side: 'SELL',
      type: 'MARKET',
      price: 0,
      quantity: 2,
      remainingQuantity: 2,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const result = engine.processOrder(marketSell);
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].quantity).toBe(2);
    expect(result.trades[0].price).toBe(110);
    expect(marketSell.status).toBe('FILLED');
  });

  it('6. should sweep multiple counter-orders across price levels', () => {
    const askLevel1: Order = {
      id: 'ask_level_1',
      side: 'SELL',
      type: 'LIMIT',
      price: 90,
      quantity: 3,
      remainingQuantity: 3,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const askLevel2: Order = {
      id: 'ask_level_2',
      side: 'SELL',
      type: 'LIMIT',
      price: 95,
      quantity: 5,
      remainingQuantity: 5,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    engine.processOrder(askLevel1);
    engine.processOrder(askLevel2);

    const largeBuy: Order = {
      id: 'buy_large_sweep',
      side: 'BUY',
      type: 'LIMIT',
      price: 100,
      quantity: 6,
      remainingQuantity: 6,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const result = engine.processOrder(largeBuy);

    // Should sweep 3 @ $90 from askLevel1 and 3 @ $95 from askLevel2
    expect(result.trades.length).toBe(2);
    expect(result.trades[0].price).toBe(90);
    expect(result.trades[0].quantity).toBe(3);
    expect(result.trades[1].price).toBe(95);
    expect(result.trades[1].quantity).toBe(3);
    expect(largeBuy.status).toBe('FILLED');
    expect(largeBuy.remainingQuantity).toBe(0);
  });
});
