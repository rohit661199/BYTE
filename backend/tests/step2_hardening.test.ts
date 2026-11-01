import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { db, runMigrations, MIGRATIONS, setDatabase } from '../src/database/db.js';
import { OrderModel } from '../src/models/orderModel.js';
import { TradeModel } from '../src/models/tradeModel.js';
import { MatchingEngine } from '../src/matching-engine/MatchingEngine.js';
import { EngineManager } from '../src/matching-engine/EngineManager.js';
import { MathPrecision } from '../src/utils/MathPrecision.js';
import { Order, Trade } from '../src/types/index.js';


describe('Phase 02 — Step 2 Hardening & Verification Suite', () => {
  describe('1. Database Migrations Verification', () => {
    it('initializes a fresh database and applies all migrations cleanly', () => {
      const db = new Database(':memory:');
      runMigrations(db);

      const migrations = db.prepare('SELECT version, name FROM schema_migrations ORDER BY version ASC').all() as any[];
      expect(migrations.length).toBe(MIGRATIONS.length);
      expect(migrations[0].version).toBe(1);
      expect(migrations[1].version).toBe(2);
      expect(migrations[2].version).toBe(3);

      const orderCols = (db.prepare('PRAGMA table_info(orders)').all() as any[]).map((c) => c.name.toLowerCase());
      expect(orderCols).toContain('id');
      expect(orderCols).toContain('symbol');
      expect(orderCols).toContain('user_id');
      expect(orderCols).toContain('owner_type');
      expect(orderCols).toContain('dispatched_at');

      const tradeCols = (db.prepare('PRAGMA table_info(trades)').all() as any[]).map((c) => c.name.toLowerCase());
      expect(tradeCols).toContain('id');
      expect(tradeCols).toContain('symbol');

      db.close();
    });

    it('migrates a populated legacy database preserving FILLED, PARTIALLY_FILLED, CANCELLED orders and trades', () => {
      const db = new Database(':memory:');

      // Create v1 unmigrated tables
      db.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          side TEXT NOT NULL,
          type TEXT NOT NULL,
          price REAL NOT NULL,
          quantity REAL NOT NULL,
          remaining_quantity REAL NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE trades (
          id TEXT PRIMARY KEY,
          buy_order_id TEXT NOT NULL,
          sell_order_id TEXT NOT NULL,
          price REAL NOT NULL,
          quantity REAL NOT NULL,
          timestamp TEXT NOT NULL
        );

        INSERT INTO orders VALUES ('ord_1', 'BUY', 'LIMIT', 100.0, 10, 0, 'FILLED', '2026-01-01T00:00:00Z');
        INSERT INTO orders VALUES ('ord_2', 'SELL', 'LIMIT', 100.0, 10, 4, 'PARTIALLY_FILLED', '2026-01-01T00:00:01Z');
        INSERT INTO orders VALUES ('ord_3', 'BUY', 'LIMIT', 95.0, 5, 5, 'CANCELLED', '2026-01-01T00:00:02Z');
        INSERT INTO trades VALUES ('trd_1', 'ord_1', 'ord_2', 100.0, 6, '2026-01-01T00:00:01Z');
      `);

      // Run migrations on legacy DB
      runMigrations(db);

      const orders = db.prepare('SELECT id, symbol, status, remaining_quantity, owner_type FROM orders ORDER BY id ASC').all() as any[];
      expect(orders.length).toBe(3);
      expect(orders[0]).toEqual({ id: 'ord_1', symbol: 'BYTE-USD', status: 'FILLED', remaining_quantity: 0, owner_type: 'USER' });
      expect(orders[1]).toEqual({ id: 'ord_2', symbol: 'BYTE-USD', status: 'PARTIALLY_FILLED', remaining_quantity: 4, owner_type: 'USER' });
      expect(orders[2]).toEqual({ id: 'ord_3', symbol: 'BYTE-USD', status: 'CANCELLED', remaining_quantity: 5, owner_type: 'USER' });

      const trades = db.prepare('SELECT id, symbol, price, quantity FROM trades').all() as any[];
      expect(trades.length).toBe(1);
      expect(trades[0]).toEqual({ id: 'trd_1', symbol: 'BYTE-USD', price: 100.0, quantity: 6 });

      db.close();
    });

    it('safely handles partially migrated schemas with missing columns', () => {
      const db = new Database(':memory:');

      // Table already has symbol, but missing user_id, owner_type, dispatched_at
      db.exec(`
        CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT);
        INSERT INTO schema_migrations VALUES (1, '001_base_tables', '2026-01-01');

        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          side TEXT NOT NULL,
          type TEXT NOT NULL,
          price REAL NOT NULL,
          quantity REAL NOT NULL,
          remaining_quantity REAL NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          symbol TEXT DEFAULT 'BYTE-USD'
        );

        CREATE TABLE trades (
          id TEXT PRIMARY KEY,
          buy_order_id TEXT NOT NULL,
          sell_order_id TEXT NOT NULL,
          price REAL NOT NULL,
          quantity REAL NOT NULL,
          timestamp TEXT NOT NULL
        );
      `);

      // Migration 2 should notice 'symbol' already exists, and only add the other columns
      runMigrations(db);

      const orderCols = (db.prepare('PRAGMA table_info(orders)').all() as any[]).map((c) => c.name.toLowerCase());
      expect(orderCols).toContain('symbol');
      expect(orderCols).toContain('user_id');
      expect(orderCols).toContain('owner_type');
      expect(orderCols).toContain('dispatched_at');

      const tradeCols = (db.prepare('PRAGMA table_info(trades)').all() as any[]).map((c) => c.name.toLowerCase());
      expect(tradeCols).toContain('symbol');

      db.close();
    });

    it('is completely idempotent when executed repeatedly', () => {
      const db = new Database(':memory:');
      runMigrations(db);
      const count1 = (db.prepare('SELECT COUNT(*) as cnt FROM schema_migrations').get() as any).cnt;

      // Run again
      runMigrations(db);
      const count2 = (db.prepare('SELECT COUNT(*) as cnt FROM schema_migrations').get() as any).cnt;

      expect(count1).toBe(MIGRATIONS.length);
      expect(count2).toBe(MIGRATIONS.length);
      db.close();
    });

    it('rolls back completely if a migration fails midway', () => {
      const db = new Database(':memory:');

      // Initialize base
      runMigrations(db);

      const nextVersion = MIGRATIONS.length + 1;
      // Create a faulty migration wrapped in transactional apply
      const faultyMigration = {
        version: nextVersion,
        name: `00${nextVersion}_faulty_migration`,
        up: (targetDb: any) => {
          targetDb.exec("ALTER TABLE orders ADD COLUMN will_fail_col TEXT");
          // Throw intentional error
          throw new Error('Simulated mid-migration catastrophe');
        },
      };

      // Execute transactional migration block like runMigrations does
      let errorThrown = false;
      try {
        db.exec('BEGIN IMMEDIATE');
        try {
          faultyMigration.up(db);
          db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
            faultyMigration.version,
            faultyMigration.name,
            new Date().toISOString()
          );
          db.exec('COMMIT');
        } catch (innerErr) {
          db.exec('ROLLBACK');
          throw innerErr;
        }
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toBe('Simulated mid-migration catastrophe');
      }

      expect(errorThrown).toBe(true);

      // Verify that will_fail_col was rolled back and version is NOT in schema_migrations
      const orderCols = (db.prepare('PRAGMA table_info(orders)').all() as any[]).map((c) => c.name.toLowerCase());
      expect(orderCols).not.toContain('will_fail_col');

      const versionCheck = db.prepare('SELECT * FROM schema_migrations WHERE version = ?').get(nextVersion);
      expect(versionCheck).toBeUndefined();

      db.close();
    });

    it('upgrades legacy CHECK constraint in real SQLite with active foreign keys and 0 foreign_key_check violations', () => {
      // Use real SQLite database with strict foreign keys enabled
      const db = new Database(':memory:');
      db.pragma('foreign_keys = ON');

      // Create legacy schema with restrictive CHECK constraint and strict foreign key relationships
      db.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
          type TEXT NOT NULL DEFAULT 'LIMIT' CHECK(type IN ('LIMIT', 'MARKET')),
          price REAL NOT NULL CHECK(price >= 0),
          quantity REAL NOT NULL CHECK(quantity > 0),
          remaining_quantity REAL NOT NULL CHECK(remaining_quantity >= 0),
          status TEXT NOT NULL CHECK(status IN ('PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED')),
          created_at TEXT NOT NULL
        );

        CREATE INDEX idx_orders_side_status ON orders(side, status);
        CREATE INDEX idx_orders_price ON orders(price);

        CREATE TABLE trades (
          id TEXT PRIMARY KEY,
          buy_order_id TEXT NOT NULL,
          sell_order_id TEXT NOT NULL,
          price REAL NOT NULL CHECK(price > 0),
          quantity REAL NOT NULL CHECK(quantity > 0),
          timestamp TEXT NOT NULL,
          FOREIGN KEY (buy_order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (sell_order_id) REFERENCES orders(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_trades_timestamp ON trades(timestamp DESC);
        CREATE TRIGGER test_audit_trigger AFTER INSERT ON orders BEGIN
          SELECT 1;
        END;
      `);

      // Populate legacy orders and trades
      db.exec(`
        INSERT INTO orders VALUES ('ord_buyer_1', 'BUY', 'LIMIT', 150.0, 10, 0, 'FILLED', '2026-01-01T10:00:00Z');
        INSERT INTO orders VALUES ('ord_seller_1', 'SELL', 'LIMIT', 150.0, 10, 0, 'FILLED', '2026-01-01T10:00:01Z');
        INSERT INTO orders VALUES ('ord_active_1', 'BUY', 'LIMIT', 149.0, 5, 2, 'PARTIALLY_FILLED', '2026-01-01T10:00:02Z');
        INSERT INTO orders VALUES ('ord_cancel_1', 'SELL', 'LIMIT', 155.0, 8, 8, 'CANCELLED', '2026-01-01T10:00:03Z');

        INSERT INTO trades VALUES ('trd_rel_1', 'ord_buyer_1', 'ord_seller_1', 150.0, 10, '2026-01-01T10:00:01Z');
      `);

      // Verify foreign keys are currently active
      const preFk = db.pragma('foreign_keys', { simple: true });
      expect(preFk).toBe(1);

      // Execute production migration runner on this real SQLite database
      runMigrations(db);

      // 1. Verify foreign keys are restored to ON after migration
      const postFk = db.pragma('foreign_keys', { simple: true });
      expect(postFk).toBe(1);

      // 2. Verify PRAGMA foreign_key_check returns zero violations
      const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
      expect(fkViolations).toEqual([]);

      // 3. Verify trade-to-order relationship is preserved
      const tradeWithOrders = db.prepare(`
        SELECT t.id, t.price, t.quantity, b.side as buy_side, s.side as sell_side
        FROM trades t
        JOIN orders b ON t.buy_order_id = b.id
        JOIN orders s ON t.sell_order_id = s.id
        WHERE t.id = 'trd_rel_1'
      `).get() as any;
      expect(tradeWithOrders).toEqual({
        id: 'trd_rel_1',
        price: 150.0,
        quantity: 10,
        buy_side: 'BUY',
        sell_side: 'SELL',
      });

      // 4. Verify existing indexes and new indexes are created and active
      const indexes = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as any[]).map((r) => r.name);
      expect(indexes).toContain('idx_orders_side_status');
      expect(indexes).toContain('idx_orders_price');
      expect(indexes).toContain('idx_orders_symbol_status');
      expect(indexes).toContain('idx_orders_queued_amo');
      expect(indexes).toContain('idx_trades_timestamp');
      expect(indexes).toContain('idx_trades_symbol_timestamp');

      // 4b. Verify custom triggers are preserved
      const triggers = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all() as any[]).map((r) => r.name);
      expect(triggers).toContain('test_audit_trigger');

      // 5. Verify that inserting QUEUED_AMO and REJECTED now succeeds without constraint error
      expect(() => {
        db.exec("INSERT INTO orders (id, side, type, price, quantity, remaining_quantity, status, created_at, symbol, user_id, owner_type, dispatched_at) VALUES ('amo_1', 'BUY', 'LIMIT', 100.0, 1, 1, 'QUEUED_AMO', '2026-01-01T12:00:00Z', 'BYTE-USD', 'usr_1', 'USER', NULL)");
        db.exec("INSERT INTO orders (id, side, type, price, quantity, remaining_quantity, status, created_at, symbol, user_id, owner_type, dispatched_at) VALUES ('amo_2', 'SELL', 'LIMIT', 105.0, 2, 2, 'REJECTED', '2026-01-01T12:01:00Z', 'BYTE-USD', 'usr_1', 'USER', NULL)");
      }).not.toThrow();

      const amoRow = db.prepare("SELECT id, status FROM orders WHERE id = 'amo_1'").get() as any;
      expect(amoRow.status).toBe('QUEUED_AMO');

      db.close();
    });

  });

  describe('2. AMO Lifecycle & Atomic Dispatch Verification', () => {
    beforeEach(() => {
      // Ensure clean test database state
      runMigrations();
      db.prepare('DELETE FROM trades').run();
      db.prepare('DELETE FROM orders').run();
    });


    it('never hydrates QUEUED_AMO orders as active engine orders', () => {
      const amoOrder: Order = {
        id: 'ord_amo_1',
        side: 'BUY',
        type: 'LIMIT',
        price: 150.0,
        quantity: 10,
        remainingQuantity: 10,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T04:00:00Z',
        symbol: 'AAPL',
      };
      OrderModel.create(amoOrder);

      // Active orders query should exclude it
      const activeAll = OrderModel.getActiveOrders();
      expect(activeAll.some((o) => o.id === 'ord_amo_1')).toBe(false);

      const activeAapl = OrderModel.getActiveOrders('AAPL');
      expect(activeAapl.some((o) => o.id === 'ord_amo_1')).toBe(false);

      // Hydrating an engine should yield an empty book
      const engine = new MatchingEngine('AAPL');
      engine.hydrateFromDatabase();
      const snapshot = engine.getOrderBookSnapshot();
      expect(snapshot.bids.length).toBe(0);
      expect(snapshot.asks.length).toBe(0);
    });

    it('enforces atomic conditional update on markAmoDispatched preventing duplicate dispatch', () => {
      const amoOrder: Order = {
        id: 'ord_amo_dispatch',
        side: 'BUY',
        type: 'LIMIT',
        price: 200.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T05:00:00Z',
        symbol: 'TSLA',
      };
      OrderModel.create(amoOrder);

      // First dispatch must succeed
      const dispatch1 = OrderModel.markAmoDispatched('ord_amo_dispatch');
      expect(dispatch1).toBe(true);

      const updated = OrderModel.findById('ord_amo_dispatch');
      expect(updated?.status).toBe('PENDING');
      expect(updated?.dispatchedAt).toBeDefined();

      // Second dispatch attempt must return false (atomic conditional update prevents double dispatch)
      const dispatch2 = OrderModel.markAmoDispatched('ord_amo_dispatch');
      expect(dispatch2).toBe(false);
    });

    it('never dispatches cancelled or rejected AMOs', () => {
      const cancelledAmo: Order = {
        id: 'ord_amo_cancelled',
        side: 'BUY',
        type: 'LIMIT',
        price: 100.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T05:00:00Z',
        symbol: 'MSFT',
      };
      OrderModel.create(cancelledAmo);

      // Cancel before open
      const cancelResult = OrderModel.cancel('ord_amo_cancelled');
      expect(cancelResult).toBe(true);
      expect(OrderModel.findById('ord_amo_cancelled')?.status).toBe('CANCELLED');

      // Attempt to dispatch cancelled AMO
      const dispatchCancelled = OrderModel.markAmoDispatched('ord_amo_cancelled');
      expect(dispatchCancelled).toBe(false);

      // Test rejected AMO
      const rejectedAmo: Order = {
        id: 'ord_amo_rejected',
        side: 'BUY',
        type: 'LIMIT',
        price: 100.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T05:05:00Z',
        symbol: 'MSFT',
      };
      OrderModel.create(rejectedAmo);

      const rejectResult = OrderModel.rejectAmo('ord_amo_rejected');
      expect(rejectResult).toBe(true);
      expect(OrderModel.findById('ord_amo_rejected')?.status).toBe('REJECTED');

      // Attempt to dispatch rejected AMO
      const dispatchRejected = OrderModel.markAmoDispatched('ord_amo_rejected');
      expect(dispatchRejected).toBe(false);
    });

    it('retrieves queued AMOs correctly via getQueuedAmoOrders', () => {
      OrderModel.create({
        id: 'amo_aapl_1',
        side: 'BUY',
        type: 'LIMIT',
        price: 150.0,
        quantity: 2,
        remainingQuantity: 2,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T01:00:00Z',
        symbol: 'AAPL',
      });

      OrderModel.create({
        id: 'amo_msft_1',
        side: 'SELL',
        type: 'LIMIT',
        price: 400.0,
        quantity: 1,
        remainingQuantity: 1,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T01:05:00Z',
        symbol: 'MSFT',
      });

      const aaplAmos = OrderModel.getQueuedAmoOrders('AAPL');
      expect(aaplAmos.length).toBe(1);
      expect(aaplAmos[0].id).toBe('amo_aapl_1');

      const allAmos = OrderModel.getQueuedAmoOrders();
      expect(allAmos.length).toBe(2);
    });
  });

  describe('3. Simulator Ownership & Selective Cleanup Verification', () => {
    beforeEach(() => {
      runMigrations();
      db.prepare('DELETE FROM trades').run();
      db.prepare('DELETE FROM orders').run();
    });

    it('cancelSimulatorOrders cancels ONLY active simulator orders for requested symbol', () => {
      // 1. User active order (Must NOT be cancelled)
      OrderModel.create({
        id: 'usr_pend',
        side: 'BUY',
        type: 'LIMIT',
        price: 100.0,
        quantity: 10,
        remainingQuantity: 10,
        status: 'PENDING',
        createdAt: '2026-01-01T01:00:00Z',
        symbol: 'AAPL',
        ownerType: 'USER',
      });

      // 2. User partially filled order (Must NOT be cancelled)
      OrderModel.create({
        id: 'usr_part',
        side: 'SELL',
        type: 'LIMIT',
        price: 105.0,
        quantity: 10,
        remainingQuantity: 5,
        status: 'PARTIALLY_FILLED',
        createdAt: '2026-01-01T01:01:00Z',
        symbol: 'AAPL',
        ownerType: 'USER',
      });

      // 3. Simulator active orders on AAPL (Must be cancelled)
      OrderModel.create({
        id: 'sim_aapl_pend',
        side: 'BUY',
        type: 'LIMIT',
        price: 99.0,
        quantity: 20,
        remainingQuantity: 20,
        status: 'PENDING',
        createdAt: '2026-01-01T01:02:00Z',
        symbol: 'AAPL',
        ownerType: 'SIMULATOR',
      });
      OrderModel.create({
        id: 'sim_aapl_part',
        side: 'SELL',
        type: 'LIMIT',
        price: 101.0,
        quantity: 20,
        remainingQuantity: 10,
        status: 'PARTIALLY_FILLED',
        createdAt: '2026-01-01T01:03:00Z',
        symbol: 'AAPL',
        ownerType: 'SIMULATOR',
      });

      // 4. Simulator historical filled & cancelled orders on AAPL (Must NOT be modified)
      OrderModel.create({
        id: 'sim_aapl_filled',
        side: 'BUY',
        type: 'LIMIT',
        price: 100.0,
        quantity: 15,
        remainingQuantity: 0,
        status: 'FILLED',
        createdAt: '2026-01-01T00:50:00Z',
        symbol: 'AAPL',
        ownerType: 'SIMULATOR',
      });

      // 5. Simulator active order on TSLA (Must NOT be cancelled when AAPL is requested)
      OrderModel.create({
        id: 'sim_tsla_pend',
        side: 'BUY',
        type: 'LIMIT',
        price: 250.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'PENDING',
        createdAt: '2026-01-01T01:04:00Z',
        symbol: 'TSLA',
        ownerType: 'SIMULATOR',
      });

      // Execute cleanup for AAPL
      const cancelledCount = OrderModel.cancelSimulatorOrders('AAPL');
      expect(cancelledCount).toBe(2);

      // Verify states
      expect(OrderModel.findById('sim_aapl_pend')?.status).toBe('CANCELLED');
      expect(OrderModel.findById('sim_aapl_part')?.status).toBe('CANCELLED');

      // User orders untouched
      expect(OrderModel.findById('usr_pend')?.status).toBe('PENDING');
      expect(OrderModel.findById('usr_part')?.status).toBe('PARTIALLY_FILLED');

      // Simulator historical order untouched
      expect(OrderModel.findById('sim_aapl_filled')?.status).toBe('FILLED');

      // Other symbol simulator order untouched
      expect(OrderModel.findById('sim_tsla_pend')?.status).toBe('PENDING');
    });
  });

  describe('4. Engine Hydration & Symbol Isolation Verification', () => {
    beforeEach(() => {
      runMigrations();
      db.prepare('DELETE FROM trades').run();
      db.prepare('DELETE FROM orders').run();
    });


    it('hydrates legacy BYTE records strictly into BYTE-USD and never into other instruments', () => {
      // Legacy BYTE order
      OrderModel.create({
        id: 'ord_legacy_byte',
        side: 'BUY',
        type: 'LIMIT',
        price: 10.0,
        quantity: 100,
        remainingQuantity: 100,
        status: 'PENDING',
        createdAt: '2026-01-01T00:00:00Z',
        symbol: 'BYTE',
      });

      // AAPL order
      OrderModel.create({
        id: 'ord_aapl_pend',
        side: 'BUY',
        type: 'LIMIT',
        price: 150.0,
        quantity: 10,
        remainingQuantity: 10,
        status: 'PENDING',
        createdAt: '2026-01-01T00:01:00Z',
        symbol: 'AAPL',
      });

      // AAPL engine hydration must ONLY load AAPL
      const aaplEngine = new MatchingEngine('AAPL');
      aaplEngine.hydrateFromDatabase();
      const aaplBook = aaplEngine.getOrderBookSnapshot();
      expect(aaplBook.bids.length).toBe(1);
      expect(aaplBook.bids[0].price).toBe(150.0);

      // BYTE-USD engine hydration loads BYTE-USD and legacy BYTE
      const byteEngine = new MatchingEngine('BYTE-USD');
      byteEngine.hydrateFromDatabase();
      const byteBook = byteEngine.getOrderBookSnapshot();
      expect(byteBook.bids.length).toBe(1);
      expect(byteBook.bids[0].price).toBe(10.0);
    });

    it('ensures orders from different instruments never enter another instrument book', () => {
      const manager = EngineManager.getInstance();
      const nvdaEngine = manager.getEngine('NVDA');
      const btcEngine = manager.getEngine('BTC-USD');

      nvdaEngine.reset();
      btcEngine.reset();

      // Submit to NVDA
      nvdaEngine.processOrder({
        id: 'ord_nvda_1',
        side: 'SELL',
        type: 'LIMIT',
        price: 130.0,
        quantity: 20,
        remainingQuantity: 20,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        symbol: 'NVDA',
      });

      expect(nvdaEngine.getOrderBookSnapshot().asks.length).toBe(1);
      expect(btcEngine.getOrderBookSnapshot().asks.length).toBe(0);
    });
  });

  describe('5. Financial Data Integrity & Decimal String Serialization', () => {
    it('preserves exact fractional decimals in database without loss or silent conversion', () => {
      const highPrecisionOrder: Order = {
        id: 'ord_prec_1',
        side: 'BUY',
        type: 'LIMIT',
        price: 150.2555,
        quantity: 0.001234,
        remainingQuantity: 0.001234,
        status: 'PENDING',
        createdAt: '2026-01-01T12:00:00Z',
        symbol: 'ETH-USD',
      };
      OrderModel.create(highPrecisionOrder);

      const retrieved = OrderModel.findById('ord_prec_1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.price).toBe(150.2555);
      expect(retrieved?.quantity).toBe(0.001234);
      expect(retrieved?.remainingQuantity).toBe(0.001234);
    });

    it('serializes BigInt values as decimal strings without JSON stringify errors', () => {
      const priceBasis = MathPrecision.parsePriceToBasis('228.10');
      const qtyMicro = MathPrecision.parseQtyToMicro('15.500000');
      const notionalCents = MathPrecision.calculateNotionalCents(priceBasis, qtyMicro);

      const wirePayload = {
        symbol: 'AAPL',
        price: MathPrecision.formatBasisToPrice(priceBasis),
        quantity: MathPrecision.formatMicroToQty(qtyMicro),
        notionalUsd: MathPrecision.formatCentsToCash(notionalCents),
        cents: notionalCents.toString(), // Integer string
      };

      // Native JSON.stringify must succeed cleanly without BigInt serialization exception
      const jsonString = JSON.stringify(wirePayload);
      expect(jsonString).toBeDefined();

      const parsed = JSON.parse(jsonString);
      expect(parsed.price).toBe('228.10');
      expect(parsed.quantity).toBe('15.5');
      expect(parsed.notionalUsd).toBe('3535.55');
      expect(parsed.cents).toBe('353555');
    });

    it('eliminates floating-point rounding errors in financial calculation', () => {
      // Classic JS float bug: 0.1 + 0.2 !== 0.3
      // In MathPrecision cents arithmetic:
      const p1 = MathPrecision.parsePriceToBasis('0.10');
      const q1 = MathPrecision.parseQtyToMicro('1.0');
      const cents1 = MathPrecision.calculateNotionalCents(p1, q1); // 10 cents

      const p2 = MathPrecision.parsePriceToBasis('0.20');
      const q2 = MathPrecision.parseQtyToMicro('1.0');
      const cents2 = MathPrecision.calculateNotionalCents(p2, q2); // 20 cents

      expect(cents1 + cents2).toBe(30n);
      expect(MathPrecision.formatCentsToCash(cents1 + cents2)).toBe('0.30');
    });
  });

  describe('6. Real Temporary SQLite File-Backed Database Verification', () => {
    const tempDbPath = path.resolve(process.cwd(), 'tests', 'temp_hardening_real_sqlite.db');
    let realDb: any;

    beforeEach(() => {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      realDb = new Database(tempDbPath);
      realDb.pragma('journal_mode = WAL');
      realDb.pragma('foreign_keys = ON');
      setDatabase(realDb);
    });

    afterEach(() => {
      setDatabase(null);
      if (realDb && realDb.open) realDb.close();
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    });

    it('verifies all 6 critical production operations against an actual disk-backed SQLite file', () => {
      // 1. Setup legacy schema on disk with active foreign keys and restrictive CHECK constraint
      realDb.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
          type TEXT NOT NULL DEFAULT 'LIMIT' CHECK(type IN ('LIMIT', 'MARKET')),
          price REAL NOT NULL CHECK(price >= 0),
          quantity REAL NOT NULL CHECK(quantity > 0),
          remaining_quantity REAL NOT NULL CHECK(remaining_quantity >= 0),
          status TEXT NOT NULL CHECK(status IN ('PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED')),
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_orders_side_status ON orders(side, status);
        CREATE INDEX idx_orders_price ON orders(price);

        CREATE TABLE trades (
          id TEXT PRIMARY KEY,
          buy_order_id TEXT NOT NULL,
          sell_order_id TEXT NOT NULL,
          price REAL NOT NULL CHECK(price > 0),
          quantity REAL NOT NULL CHECK(quantity > 0),
          timestamp TEXT NOT NULL,
          FOREIGN KEY (buy_order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (sell_order_id) REFERENCES orders(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_trades_timestamp ON trades(timestamp DESC);
      `);

      // 2. Populate historical orders & trades
      realDb.exec(`
        INSERT INTO orders VALUES ('o_buy', 'BUY', 'LIMIT', 100.0, 10, 0, 'FILLED', '2026-01-01T00:00:00Z');
        INSERT INTO orders VALUES ('o_sell', 'SELL', 'LIMIT', 100.0, 10, 0, 'FILLED', '2026-01-01T00:00:01Z');
        INSERT INTO trades VALUES ('t_hist', 'o_buy', 'o_sell', 100.0, 10, '2026-01-01T00:00:01Z');
      `);

      // 3. Execute legacy CHECK constraint migration on disk
      runMigrations(realDb);

      // Verify PRAGMA foreign_keys is ON after migration
      const postFk = realDb.pragma('foreign_keys', { simple: true });
      expect(postFk).toBe(1);

      // Verify foreign_key_check reports zero violations
      const fkViolations = realDb.prepare('PRAGMA foreign_key_check').all();
      expect(fkViolations).toEqual([]);

      // Verify historical trade preservation and foreign key relationship
      const preservedTrade = realDb.prepare(`
        SELECT t.id, t.price, t.quantity, b.side as buy_side, s.side as sell_side
        FROM trades t
        JOIN orders b ON t.buy_order_id = b.id
        JOIN orders s ON t.sell_order_id = s.id
        WHERE t.id = 't_hist'
      `).get();
      expect(preservedTrade).toEqual({
        id: 't_hist',
        price: 100.0,
        quantity: 10,
        buy_side: 'BUY',
        sell_side: 'SELL',
      });

      // 4. Verify transaction rollback on disk
      const faultyMigration = {
        version: 99,
        name: '099_faulty_disk',
        up: (dbInstance: any) => {
          dbInstance.exec("ALTER TABLE orders ADD COLUMN will_fail_disk TEXT");
          throw new Error('Disk-backed rollback trigger');
        },
      };
      expect(() => {
        realDb.exec('BEGIN IMMEDIATE');
        try {
          faultyMigration.up(realDb);
          realDb.exec('COMMIT');
        } catch (err) {
          realDb.exec('ROLLBACK');
          throw err;
        }
      }).toThrow('Disk-backed rollback trigger');
      const orderCols = (realDb.prepare('PRAGMA table_info(orders)').all() as any[]).map((c) => c.name.toLowerCase());
      expect(orderCols).not.toContain('will_fail_disk');

      // 5. Verify atomic AMO dispatch on disk via OrderModel
      OrderModel.create({
        id: 'ord_amo_disk',
        side: 'BUY',
        type: 'LIMIT',
        price: 150.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'QUEUED_AMO',
        createdAt: '2026-01-01T02:00:00Z',
        symbol: 'AAPL',
      });
      // First dispatch must succeed
      const dispatch1 = OrderModel.markAmoDispatched('ord_amo_disk');
      expect(dispatch1).toBe(true);
      expect(OrderModel.findById('ord_amo_disk')?.status).toBe('PENDING');
      // Second dispatch must fail (atomic conditional update)
      const dispatch2 = OrderModel.markAmoDispatched('ord_amo_disk');
      expect(dispatch2).toBe(false);

      // 6. Verify Simulator-only cancellation on disk via OrderModel
      OrderModel.create({
        id: 'usr_disk_active',
        side: 'BUY',
        type: 'LIMIT',
        price: 150.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'PENDING',
        createdAt: '2026-01-01T02:01:00Z',
        symbol: 'AAPL',
        ownerType: 'USER',
      });
      OrderModel.create({
        id: 'sim_disk_active',
        side: 'BUY',
        type: 'LIMIT',
        price: 149.0,
        quantity: 10,
        remainingQuantity: 10,
        status: 'PENDING',
        createdAt: '2026-01-01T02:02:00Z',
        symbol: 'AAPL',
        ownerType: 'SIMULATOR',
      });
      const cancelledCount = OrderModel.cancelSimulatorOrders('AAPL');
      expect(cancelledCount).toBe(1);
      expect(OrderModel.findById('sim_disk_active')?.status).toBe('CANCELLED');
      expect(OrderModel.findById('usr_disk_active')?.status).toBe('PENDING');
    });
  });
});

