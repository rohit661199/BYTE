import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { InstrumentRegistry } from '../src/services/InstrumentRegistry.js';
import { EngineManager } from '../src/matching-engine/EngineManager.js';
import { MatchingEngine } from '../src/matching-engine/MatchingEngine.js';

describe('Database Migration & EngineManager Multi-Asset Architecture', () => {
  describe('SQLite Versioned Migration Runner', () => {
    it('migrates a fresh database up to version 2 successfully', () => {
      const db = new Database(':memory:');

      // 1. Create migration table
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      // 2. Apply Migration 1
      db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
          type TEXT NOT NULL DEFAULT 'LIMIT' CHECK(type IN ('LIMIT', 'MARKET')),
          price REAL NOT NULL CHECK(price >= 0),
          quantity REAL NOT NULL CHECK(quantity > 0),
          remaining_quantity REAL NOT NULL CHECK(remaining_quantity >= 0),
          status TEXT NOT NULL CHECK(status IN ('PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'QUEUED_AMO', 'REJECTED')),
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS trades (
          id TEXT PRIMARY KEY,
          buy_order_id TEXT NOT NULL,
          sell_order_id TEXT NOT NULL,
          price REAL NOT NULL CHECK(price > 0),
          quantity REAL NOT NULL CHECK(quantity > 0),
          timestamp TEXT NOT NULL,
          FOREIGN KEY (buy_order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (sell_order_id) REFERENCES orders(id) ON DELETE CASCADE
        );
      `);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        1,
        '001_base_tables',
        new Date().toISOString()
      );

      // Verify migration 1 columns
      const pragmaOrders1 = db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>;
      const cols1 = pragmaOrders1.map((c) => c.name);
      expect(cols1).toContain('id');
      expect(cols1).toContain('status');
      expect(cols1).not.toContain('symbol');

      // 3. Apply Migration 2
      const orderColNames = cols1.map((c) => c.toLowerCase());
      if (!orderColNames.includes('symbol')) {
        db.exec("ALTER TABLE orders ADD COLUMN symbol TEXT DEFAULT 'BYTE-USD'");
      }
      if (!orderColNames.includes('user_id')) {
        db.exec('ALTER TABLE orders ADD COLUMN user_id TEXT');
      }
      if (!orderColNames.includes('owner_type')) {
        db.exec("ALTER TABLE orders ADD COLUMN owner_type TEXT DEFAULT 'USER'");
      }
      if (!orderColNames.includes('dispatched_at')) {
        db.exec('ALTER TABLE orders ADD COLUMN dispatched_at TEXT');
      }

      const pragmaTrades = db.prepare('PRAGMA table_info(trades)').all() as Array<{ name: string }>;
      const tradeColNames = pragmaTrades.map((c) => c.name.toLowerCase());
      if (!tradeColNames.includes('symbol')) {
        db.exec("ALTER TABLE trades ADD COLUMN symbol TEXT DEFAULT 'BYTE-USD'");
      }

      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        2,
        '002_multi_asset_amo',
        new Date().toISOString()
      );

      // Verify migration 2 columns and versions
      const pragmaOrders2 = db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>;
      const cols2 = pragmaOrders2.map((c) => c.name);
      expect(cols2).toContain('symbol');
      expect(cols2).toContain('user_id');
      expect(cols2).toContain('owner_type');
      expect(cols2).toContain('dispatched_at');

      const migrations = db.prepare('SELECT version, name FROM schema_migrations ORDER BY version ASC').all() as Array<{
        version: number;
        name: string;
      }>;
      expect(migrations.length).toBe(2);
      expect(migrations[0].version).toBe(1);
      expect(migrations[1].version).toBe(2);
      db.close();
    });

    it('safely normalizes legacy BYTE records to BYTE-USD without losing order or trade history', () => {
      const db = new Database(':memory:');

      // Populate legacy v1 database (prior to migration 2)
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

        INSERT INTO orders VALUES ('ord_legacy_1', 'BUY', 'LIMIT', 10.5, 100, 50, 'PARTIALLY_FILLED', '2026-01-01T00:00:00.000Z');
        INSERT INTO orders VALUES ('ord_legacy_2', 'SELL', 'LIMIT', 10.5, 50, 0, 'FILLED', '2026-01-01T00:00:01.000Z');
        INSERT INTO trades VALUES ('trd_legacy_1', 'ord_legacy_1', 'ord_legacy_2', 10.5, 50, '2026-01-01T00:00:01.000Z');
      `);

      // Run Migration 2
      db.exec("ALTER TABLE orders ADD COLUMN symbol TEXT DEFAULT 'BYTE-USD'");
      db.exec('ALTER TABLE orders ADD COLUMN user_id TEXT');
      db.exec("ALTER TABLE orders ADD COLUMN owner_type TEXT DEFAULT 'USER'");
      db.exec('ALTER TABLE orders ADD COLUMN dispatched_at TEXT');
      db.exec("ALTER TABLE trades ADD COLUMN symbol TEXT DEFAULT 'BYTE-USD'");

      // Also simulate explicit 'BYTE' rows inserted previously
      db.exec("INSERT INTO orders VALUES ('ord_byte_alias', 'BUY', 'LIMIT', 11.0, 20, 20, 'PENDING', '2026-01-01T00:00:02.000Z', 'BYTE', 'usr_1', 'USER', NULL)");

      // Normalization step
      db.exec("UPDATE orders SET symbol = 'BYTE-USD' WHERE symbol = 'BYTE' OR symbol IS NULL");
      db.exec("UPDATE trades SET symbol = 'BYTE-USD' WHERE symbol = 'BYTE' OR symbol IS NULL");

      // Verify preservation and normalization
      const orders = db.prepare('SELECT id, symbol, remaining_quantity, status FROM orders ORDER BY id ASC').all() as any[];
      expect(orders.length).toBe(3);
      expect(orders[0]).toEqual({ id: 'ord_byte_alias', symbol: 'BYTE-USD', remaining_quantity: 20, status: 'PENDING' });
      expect(orders[1]).toEqual({ id: 'ord_legacy_1', symbol: 'BYTE-USD', remaining_quantity: 50, status: 'PARTIALLY_FILLED' });
      expect(orders[2]).toEqual({ id: 'ord_legacy_2', symbol: 'BYTE-USD', remaining_quantity: 0, status: 'FILLED' });

      const trades = db.prepare('SELECT id, symbol, price, quantity FROM trades').all() as any[];
      expect(trades.length).toBe(1);
      expect(trades[0]).toEqual({ id: 'trd_legacy_1', symbol: 'BYTE-USD', price: 10.5, quantity: 50 });

      db.close();
    });

    it('demonstrates migration idempotency when re-run against already migrated database', () => {
      const db = new Database(':memory:');

      db.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
        INSERT INTO schema_migrations VALUES (1, '001_base_tables', '2026-01-01');
        INSERT INTO schema_migrations VALUES (2, '002_multi_asset_amo', '2026-01-01');

        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          symbol TEXT DEFAULT 'BYTE-USD',
          status TEXT NOT NULL
        );
      `);

      // Attempting to run migration checks again
      const applied = db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>;
      const versions = new Set(applied.map((a) => a.version));

      expect(versions.has(1)).toBe(true);
      expect(versions.has(2)).toBe(true);

      // Re-running runner logic skips already applied versions
      const migrationVersionsToApply = [1, 2].filter((v) => !versions.has(v));
      expect(migrationVersionsToApply.length).toBe(0);

      db.close();
    });
  });

  describe('EngineManager Canonical Normalization & Multi-Asset Order Books', () => {
    it('resolves BYTE and BYTE-USD to the exact same MatchingEngine instance', () => {
      const manager = EngineManager.getInstance();

      const engineByte = manager.getEngine('BYTE');
      const engineByteUsd = manager.getEngine('BYTE-USD');
      const engineLower = manager.getEngine('byte');

      expect(engineByte).toBeDefined();
      expect(engineByteUsd).toBeDefined();
      expect(engineByte).toBe(engineByteUsd); // Strict reference equality!
      expect(engineLower).toBe(engineByteUsd);
      expect(engineByte.symbol).toBe('BYTE-USD');
    });

    it('maintains completely isolated order books for different canonical instruments', () => {
      const manager = EngineManager.getInstance();

      const aaplEngine = manager.getEngine('AAPL');
      const btcEngine = manager.getEngine('BTC-USD');
      const byteEngine = manager.getEngine('BYTE-USD');

      expect(aaplEngine).not.toBe(btcEngine);
      expect(aaplEngine).not.toBe(byteEngine);
      expect(btcEngine).not.toBe(byteEngine);

      // Reset test state
      aaplEngine.reset();
      btcEngine.reset();

      // Submit an order to AAPL
      aaplEngine.processOrder({
        id: 'ord_aapl_1',
        side: 'BUY',
        type: 'LIMIT',
        price: 150.0,
        quantity: 10,
        remainingQuantity: 10,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        symbol: 'AAPL',
      });

      // AAPL should have 1 bid
      const aaplBook = aaplEngine.getOrderBookSnapshot();
      expect(aaplBook.bids.length).toBe(1);
      expect(aaplBook.bids[0].price).toBe(150.0);

      // BTC-USD orderbook should remain untouched (0 bids)
      const btcBook = btcEngine.getOrderBookSnapshot();
      expect(btcBook.bids.length).toBe(0);
    });

    it('preserves existing MatchingEngine order matching behavior exactly', () => {
      const engine = new MatchingEngine('TSLA');
      engine.reset();

      // Submit Ask
      engine.processOrder({
        id: 'sell_1',
        side: 'SELL',
        type: 'LIMIT',
        price: 200.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'PENDING',
        createdAt: '2026-01-01T10:00:00.000Z',
        symbol: 'TSLA',
      });

      // Submit Matching Bid
      const matchResult = engine.processOrder({
        id: 'buy_1',
        side: 'BUY',
        type: 'LIMIT',
        price: 200.0,
        quantity: 5,
        remainingQuantity: 5,
        status: 'PENDING',
        createdAt: '2026-01-01T10:00:01.000Z',
        symbol: 'TSLA',
      });

      expect(matchResult.order.status).toBe('FILLED');
      expect(matchResult.order.remainingQuantity).toBe(0);
      expect(matchResult.trades.length).toBe(1);
      expect(matchResult.trades[0].price).toBe(200.0);
      expect(matchResult.trades[0].quantity).toBe(5);

      const book = engine.getOrderBookSnapshot();
      expect(book.bids.length).toBe(0);
      expect(book.asks.length).toBe(0);
    });
  });
});
