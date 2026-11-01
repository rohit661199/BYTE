import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import app from '../src/index.js';
import { db, initDatabase } from '../src/database/db.js';
import { OrderModel } from '../src/models/orderModel.js';
import { TradeModel } from '../src/models/tradeModel.js';
import { OrderService } from '../src/services/orderService.js';
import { InstrumentRegistry } from '../src/services/InstrumentRegistry.js';
import { AmoScheduler } from '../src/services/AmoScheduler.js';
import { LiquiditySimulator } from '../src/services/LiquiditySimulator.js';
import { TimeProvider } from '../src/utils/TimeProvider.js';

describe('QA Verified Defects Regression Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    initDatabase();
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
    db.prepare('DELETE FROM trades').run();
    db.prepare('DELETE FROM orders').run();
  });

  describe('Defect 1: BigInt Serialization in Trades API', () => {
    it('GET /api/trades?limit=20 should return 200 with safely serialized BigInts', async () => {
      const now = new Date().toISOString();
      const buyOrderId = 'ord_buy_1';
      const sellOrderId = 'ord_sell_1';
      const tradeId = 'tr_reg_1';

      // Insert parent orders to satisfy foreign key constraints
      const orderStmt = db.prepare(`
        INSERT INTO orders (id, side, type, price, quantity, remaining_quantity, status, created_at, symbol, user_id)
        VALUES (?, ?, 'LIMIT', 2950.5, 10, 0, 'FILLED', ?, 'RELIANCE', 'usr_1')
      `);
      orderStmt.run(buyOrderId, 'BUY', now);
      orderStmt.run(sellOrderId, 'SELL', now);

      // Seed a trade with BigInt shadow fields in SQLite
      TradeModel.create({
        id: tradeId,
        buyOrderId,
        sellOrderId,
        price: 2950.5,
        quantity: 10,
        timestamp: now,
        symbol: 'RELIANCE',
        priceBasis: 29505000n,    // BigInt price basis (4 decimal places = basis points)
        quantityMicro: 10000000n, // BigInt quantity micro (6 decimal places)
        priceStr: '2950.50',
        quantityStr: '10',
      });

      const response = await fetch(`${baseUrl}/api/trades?limit=20`);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBe(1);

      const trade = json.data[0];
      expect(trade.id).toBe(tradeId);
      expect(trade.symbol).toBe('RELIANCE');
      expect(typeof trade.priceBasis).toBe('string');
      expect(trade.priceBasis).toBe('29505000');
      expect(typeof trade.quantityMicro).toBe('string');
      expect(trade.quantityMicro).toBe('10000000');
      expect(trade.priceStr).toBe('2950.50');
      expect(trade.quantityStr).toBe('10');
      expect(trade.price).toBe(2950.5);
      expect(trade.quantity).toBe(10);
    });

    it('POST /api/orders should return 201 with safely serialized trades if executed immediately', async () => {
      // Regular trading hours for BYTE-USD (24/7)
      const buyRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: 'BUY',
          type: 'LIMIT',
          price: 100,
          quantity: 5,
          symbol: 'BYTE-USD',
        }),
      });
      expect(buyRes.status).toBe(201);

      const sellRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: 'SELL',
          type: 'LIMIT',
          price: 100,
          quantity: 5,
          symbol: 'BYTE-USD',
        }),
      });
      expect(sellRes.status).toBe(201);
      const sellJson = await sellRes.json();
      expect(sellJson.success).toBe(true);
      expect(sellJson.data.trades.length).toBe(1);

      const executedTrade = sellJson.data.trades[0];
      expect(typeof executedTrade.priceBasis).toBe('string');
      expect(typeof executedTrade.quantityMicro).toBe('string');
      expect(executedTrade.priceStr).toBe('100.00');
      expect(executedTrade.quantityStr).toBe('5');
    });
  });

  describe('Defect 2: Orders Page True Server-Side Pagination & Filtering', () => {
    it('GET /api/orders with limit and offset should return bounded paginated slices with total count', async () => {
      // Seed 60 orders (30 OPEN, 20 FILLED, 10 CANCELLED)
      const stmt = db.prepare(`
        INSERT INTO orders (id, side, type, price, quantity, remaining_quantity, status, created_at, symbol, user_id)
        VALUES (?, 'BUY', 'LIMIT', 100.0, 1.0, 1.0, ?, ?, ?, 'usr_test')
      `);

      for (let i = 1; i <= 60; i++) {
        const id = `order_page_test_${i.toString().padStart(3, '0')}`;
        const ts = new Date(Date.now() - (60 - i) * 1000).toISOString();
        const status = i <= 30 ? 'PENDING' : i <= 50 ? 'FILLED' : 'CANCELLED';
        const symbol = i % 2 === 0 ? 'AAPL' : 'BYTE-USD';
        stmt.run(id, status, ts, symbol);
      }

      // 1. Page 1: limit 10, offset 0
      const page1Res = await fetch(`${baseUrl}/api/orders?limit=10&offset=0`);
      expect(page1Res.status).toBe(200);
      const page1Json = await page1Res.json();
      expect(page1Json.success).toBe(true);
      expect(page1Json.data.length).toBe(10);
      expect(page1Json.total).toBe(60);
      expect(page1Json.limit).toBe(10);
      expect(page1Json.offset).toBe(0);

      // 2. Page 2: limit 10, offset 10
      const page2Res = await fetch(`${baseUrl}/api/orders?limit=10&offset=10`);
      expect(page2Res.status).toBe(200);
      const page2Json = await page2Res.json();
      expect(page2Json.success).toBe(true);
      expect(page2Json.data.length).toBe(10);
      expect(page2Json.total).toBe(60);
      expect(page2Json.offset).toBe(10);

      // Verify no ID overlap between page 1 and page 2
      const page1Ids = new Set(page1Json.data.map((o: any) => o.id));
      for (const order of page2Json.data) {
        expect(page1Ids.has(order.id)).toBe(false);
      }

      // 3. Status Filtering: status=OPEN should include only PENDING/PARTIALLY_FILLED and count 30
      const openRes = await fetch(`${baseUrl}/api/orders?limit=10&offset=0&status=OPEN`);
      expect(openRes.status).toBe(200);
      const openJson = await openRes.json();
      expect(openJson.success).toBe(true);
      expect(openJson.data.length).toBe(10);
      expect(openJson.total).toBe(30);
      for (const order of openJson.data) {
        expect(['PENDING', 'PARTIALLY_FILLED']).toContain(order.status);
      }

      // 4. Status Filtering: status=FILLED should count 20
      const filledRes = await fetch(`${baseUrl}/api/orders?limit=50&offset=0&status=FILLED`);
      expect(filledRes.status).toBe(200);
      const filledJson = await filledRes.json();
      expect(filledJson.success).toBe(true);
      expect(filledJson.data.length).toBe(20);
      expect(filledJson.total).toBe(20);
      for (const order of filledJson.data) {
        expect(order.status).toBe('FILLED');
      }

      // 5. Status Filtering: status=CANCELLED should count 10
      const cancelledRes = await fetch(`${baseUrl}/api/orders?limit=50&offset=0&status=CANCELLED`);
      expect(cancelledRes.status).toBe(200);
      const cancelledJson = await cancelledRes.json();
      expect(cancelledJson.success).toBe(true);
      expect(cancelledJson.data.length).toBe(10);
      expect(cancelledJson.total).toBe(10);

      // 6. Search Filtering: search=AAPL should return only AAPL orders
      const searchRes = await fetch(`${baseUrl}/api/orders?limit=50&offset=0&search=AAPL`);
      expect(searchRes.status).toBe(200);
      const searchJson = await searchRes.json();
      expect(searchJson.success).toBe(true);
      expect(searchJson.total).toBe(30);
      for (const order of searchJson.data) {
        expect(order.symbol).toBe('AAPL');
      }

      // 7. Clamping: invalid limit and negative offset fallback safely
      const clampedRes = await fetch(`${baseUrl}/api/orders?limit=-5&offset=-10`);
      expect(clampedRes.status).toBe(200);
      const clampedJson = await clampedRes.json();
      expect(clampedJson.limit).toBe(50);
      expect(clampedJson.offset).toBe(0);
    });

    it('GET /api/orders without pagination params should preserve backward-compatible full list', async () => {
      const res = await fetch(`${baseUrl}/api/orders`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(typeof json.total).toBe('number');
    });
  });

  describe('Defect 3: Dynamic Currency & Instrument Definitions', () => {
    it('should distinguish currency between INR and USD instruments in InstrumentRegistry', () => {
      const reliance = InstrumentRegistry.getInstrument('RELIANCE');
      expect(reliance).toBeDefined();
      expect(reliance?.currency).toBe('INR');
      expect(reliance?.venue).toBe('NSE');

      const aapl = InstrumentRegistry.getInstrument('AAPL');
      expect(aapl).toBeDefined();
      expect(aapl?.currency).toBe('USD');
      expect(aapl?.venue).toBe('NASDAQ');

      const btc = InstrumentRegistry.getInstrument('BTC-USD');
      expect(btc).toBeDefined();
      expect(btc?.currency).toBe('USD');
      expect(btc?.venue).toBe('CRYPTO_SIM');
    });

    it('should place order with explicit symbol preserving instrument identity', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: 'BUY',
          type: 'LIMIT',
          price: 2950,
          quantity: 1,
          symbol: 'RELIANCE',
        }),
      });

      // Note: If market is closed for NSE, it might be queued as AMO or allowed
      expect([201, 200]).toContain(res.status);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.order.symbol).toBe('RELIANCE');
    });
  });
});
