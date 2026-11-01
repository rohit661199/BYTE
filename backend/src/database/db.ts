import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { Pool } from 'pg';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const require = createRequire(import.meta.url);

let pgPool: Pool | null = null;

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

class PostgresAdapter {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  pragma(_str: string) { }

  async exec(sql: string) {
    const client = await this.pool.connect();
    try {
      await client.query(sql);
    } finally {
      client.release();
    }
  }

  prepare(sql: string) {
    let pgSql = sql.trim();

    // Replace ? parameters with $1, $2, etc. for PostgreSQL
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    return {
      run: (...params: any[]) => {
        return this.pool.query(pgSql, params).then(res => ({ changes: res.rowCount || 0 }));
      },
      get: (...params: any[]) => {
        return this.pool.query(pgSql, params).then(res => res.rows[0] || null);
      },
      all: (...params: any[]) => {
        return this.pool.query(pgSql, params).then(res => res.rows);
      }
    };
  }
}

import { migration001 } from './migrations/001_base_tables.js';
import { migration002, needsStatusCheckUpgrade } from './migrations/002_multi_asset_amo.js';
import { migration003 } from './migrations/003_precision_shadow_columns.js';

export const MIGRATIONS = [migration001, migration002, migration003];


class MemoryDB {
  private ordersMap = new Map<string, any>();
  private tradesList: any[] = [];
  private migrationsMap = new Map<number, any>();
  private amoDispatchMap = new Map<string, any>();

  pragma(_str: string) { }
  exec(_sql: string) { }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => fn(...args)) as T;
  }

  prepare(sql: string) {
    const s = sql.trim();
    return {
      run: (...params: any[]) => {
        if (s.startsWith('INSERT INTO schema_migrations')) {
          const [version, name, applied_at] = params;
          this.migrationsMap.set(version, { version, name, applied_at });
        } else if (s.startsWith('INSERT INTO orders')) {
          if (params.length >= 14) {
            const [id, side, type, price, quantity, remaining_quantity, status, created_at, symbol, user_id, owner_type, price_basis, quantity_micro, remaining_quantity_micro] = params;
            this.ordersMap.set(id, { id, side, type, price, quantity, remaining_quantity, status, created_at, symbol: symbol || 'BYTE-USD', user_id, owner_type: owner_type || 'USER', price_basis, quantity_micro, remaining_quantity_micro });
          } else if (params.length >= 10) {
            const [id, side, type, price, quantity, remaining_quantity, status, created_at, symbol, user_id, owner_type] = params;
            this.ordersMap.set(id, { id, side, type, price, quantity, remaining_quantity, status, created_at, symbol: symbol || 'BYTE-USD', user_id, owner_type: owner_type || 'USER' });
          } else {
            const [id, side, type, price, quantity, remaining_quantity, status, created_at] = params;
            this.ordersMap.set(id, { id, side, type, price, quantity, remaining_quantity, status, created_at, symbol: 'BYTE-USD', owner_type: 'USER' });
          }
        } else if (s.startsWith('UPDATE orders SET remaining_quantity')) {
          if (params.length >= 4) {
            const [remaining_quantity, remaining_quantity_micro, status, id] = params;
            const o = this.ordersMap.get(id);
            if (o) { o.remaining_quantity = remaining_quantity; o.remaining_quantity_micro = remaining_quantity_micro; o.status = status; }
          } else {
            const [remaining_quantity, status, id] = params;
            const o = this.ordersMap.get(id);
            if (o) { o.remaining_quantity = remaining_quantity; o.status = status; }
          }
        } else if (s.startsWith("UPDATE orders SET status = 'CANCELLED'")) {
          if (s.includes("WHERE owner_type = 'SIMULATOR'")) {
            let changes = 0;
            const targetSymbol = params[0];
            for (const o of this.ordersMap.values()) {
              if (o.owner_type === 'SIMULATOR' && (o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED')) {
                if (!targetSymbol || o.symbol === targetSymbol || (targetSymbol === 'BYTE-USD' && (o.symbol === 'BYTE' || o.symbol === 'BYTE-USD'))) {
                  o.status = 'CANCELLED';
                  changes++;
                }
              }
            }
            return { changes };
          }
          const [id] = params;
          const o = this.ordersMap.get(id);
          if (o && (o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED' || o.status === 'QUEUED_AMO')) {
            o.status = 'CANCELLED';
            return { changes: 1 };
          }
          return { changes: 0 };
        } else if (s.startsWith("UPDATE orders SET status = 'PENDING', dispatched_at = CURRENT_TIMESTAMP")) {
          const [id] = params;
          const o = this.ordersMap.get(id);
          if (o && o.status === 'QUEUED_AMO') {
            o.status = 'PENDING';
            o.dispatched_at = new Date().toISOString();
            return { changes: 1 };
          }
          return { changes: 0 };
        } else if (s.startsWith("UPDATE orders SET status = 'REJECTED'")) {
          const [id] = params;
          const o = this.ordersMap.get(id);
          if (o && o.status === 'QUEUED_AMO') {
            o.status = 'REJECTED';
            return { changes: 1 };
          }
          return { changes: 0 };
        } else if (s.startsWith('INSERT INTO trades')) {
          if (params.length >= 9) {
            const [id, buy_order_id, sell_order_id, price, quantity, timestamp, symbol, price_basis, quantity_micro] = params;
            this.tradesList.push({ id, buy_order_id, sell_order_id, price, quantity, timestamp, symbol: symbol || 'BYTE-USD', price_basis, quantity_micro });
          } else if (params.length >= 7) {
            const [id, buy_order_id, sell_order_id, price, quantity, timestamp, symbol] = params;
            this.tradesList.push({ id, buy_order_id, sell_order_id, price, quantity, timestamp, symbol: symbol || 'BYTE-USD' });
          } else {
            const [id, buy_order_id, sell_order_id, price, quantity, timestamp] = params;
            this.tradesList.push({ id, buy_order_id, sell_order_id, price, quantity, timestamp, symbol: 'BYTE-USD' });
          }
        } else if (s.startsWith('DELETE FROM trades')) {
          this.tradesList.length = 0;
        } else if (s.startsWith('DELETE FROM orders')) {
          this.ordersMap.clear();
        } else if (s.startsWith('INSERT OR REPLACE INTO amo_dispatch_log') || s.startsWith('INSERT INTO amo_dispatch_log')) {
          const [order_id] = params;
          this.amoDispatchMap.set(order_id, { order_id, dispatched_at: new Date().toISOString(), status: 'CLAIMED' });
        } else if (s.startsWith('UPDATE amo_dispatch_log SET engine_accepted_at')) {
          const [order_id] = params;
          const log = this.amoDispatchMap.get(order_id);
          if (log) log.engine_accepted_at = new Date().toISOString();
        } else if (s.includes("status = 'PROCESSED'")) {
          const [order_id] = params;
          const log = this.amoDispatchMap.get(order_id);
          if (log) {
            log.status = 'PROCESSED';
            log.processed_at = new Date().toISOString();
            if (!log.engine_accepted_at) log.engine_accepted_at = new Date().toISOString();
          }
        } else if (s.includes("status = 'FAILED'")) {
          const [error, order_id] = params;
          const log = this.amoDispatchMap.get(order_id);
          if (log) { log.status = 'FAILED'; log.error = error; log.processed_at = new Date().toISOString(); }
        } else if (s.startsWith('DELETE FROM amo_dispatch_log')) {
          if (s.includes('WHERE order_id = ?')) {
            this.amoDispatchMap.delete(params[0]);
          } else {
            this.amoDispatchMap.clear();
          }
        }
        return { changes: 1 };
      },
      get: (...params: any[]) => {
        if (s.includes('FROM schema_migrations WHERE version =')) {
          return this.migrationsMap.get(params[0]) || null;
        } else if (s.includes('FROM amo_dispatch_log WHERE order_id = ?')) {
          return this.amoDispatchMap.get(params[0]) || null;
        } else if (s.includes('FROM orders WHERE id =')) {
          return this.ordersMap.get(params[0]) || null;
        } else if (s.includes('totalBuy')) {
          let totalBuy = 0, totalSell = 0;
          for (const o of this.ordersMap.values()) {
            if (o.side === 'BUY') totalBuy++;
            if (o.side === 'SELL') totalSell++;
          }
          return { totalBuy, totalSell };
        } else if (s.includes('totalTrades')) {
          let totalVolume = 0;
          for (const t of this.tradesList) totalVolume += t.quantity * t.price;
          return { totalTrades: this.tradesList.length, totalVolume };
        }
        return null;
      },
      all: (...params: any[]) => {
        if (s.startsWith('PRAGMA table_info(orders)')) {
          return [
            { name: 'id' }, { name: 'side' }, { name: 'type' }, { name: 'price' },
            { name: 'quantity' }, { name: 'remaining_quantity' }, { name: 'status' },
            { name: 'created_at' }, { name: 'symbol' }, { name: 'user_id' },
            { name: 'owner_type' }, { name: 'dispatched_at' }
          ];
        } else if (s.startsWith('PRAGMA table_info(trades)')) {
          return [
            { name: 'id' }, { name: 'buy_order_id' }, { name: 'sell_order_id' },
            { name: 'price' }, { name: 'quantity' }, { name: 'timestamp' }, { name: 'symbol' }
          ];
        } else if (s.includes("status IN ('PENDING', 'PARTIALLY_FILLED')") || s.includes("o.status IN ('PENDING', 'PARTIALLY_FILLED')")) {
          const symParam = params[0];
          return Array.from(this.ordersMap.values())
            .filter(o => {
              const active = o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED';
              if (!active) return false;
              const log = this.amoDispatchMap.get(o.id);
              if (log && log.status === 'CLAIMED' && !log.engine_accepted_at) {
                return false;
              }
              if (s.includes("symbol = 'BYTE-USD' OR symbol = 'BYTE'") || s.includes("o.symbol = 'BYTE-USD' OR o.symbol = 'BYTE'")) {
                return o.symbol === 'BYTE-USD' || o.symbol === 'BYTE';
              }
              if ((s.includes('symbol = ?') || s.includes('o.symbol = ?')) && symParam) {
                return o.symbol === symParam;
              }
              return true;
            })
            .sort((a, b) => a.created_at.localeCompare(b.created_at));
        } else if (s.includes('FROM orders o') && s.includes('amo_dispatch_log l') && s.includes("l.status = 'CLAIMED'")) {
          return Array.from(this.ordersMap.values())
            .filter(o => {
              const log = this.amoDispatchMap.get(o.id);
              return (log && log.status === 'CLAIMED' && !log.processed_at) ||
                     (!log && o.status === 'PENDING' && o.dispatched_at);
            })
            .sort((a, b) => a.created_at.localeCompare(b.created_at));
        } else if (s.includes("WHERE status = 'QUEUED_AMO'")) {
          const symParam = params[0];
          return Array.from(this.ordersMap.values())
            .filter(o => {
              if (o.status !== 'QUEUED_AMO') return false;
              if (s.includes("symbol = 'BYTE-USD' OR symbol = 'BYTE'")) {
                return o.symbol === 'BYTE-USD' || o.symbol === 'BYTE';
              }
              if (s.includes('symbol = ?') && symParam) {
                return o.symbol === symParam;
              }
              return true;
            })
            .sort((a, b) => a.created_at.localeCompare(b.created_at));
        } else if (s.includes("WHERE owner_type = 'SIMULATOR'")) {
          return Array.from(this.ordersMap.values())
            .filter(o => {
              if (o.owner_type !== 'SIMULATOR') return false;
              if (params.includes('PENDING') && o.status !== 'PENDING') return false;
              if (params.includes('PARTIALLY_FILLED') && o.status !== 'PARTIALLY_FILLED') return false;
              if (params.includes('FILLED') && o.status !== 'FILLED') return false;
              if (params.includes('CANCELLED') && o.status !== 'CANCELLED') return false;
              return true;
            })
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
        } else if (s.includes('FROM orders ORDER BY created_at DESC')) {
          return Array.from(this.ordersMap.values())
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
        } else if (s.includes('FROM trades ORDER BY timestamp DESC')) {
          const limit = typeof params[0] === 'number' ? params[0] : (typeof params[1] === 'number' ? params[1] : 50);
          const symParam = typeof params[0] === 'string' ? params[0] : undefined;
          return [...this.tradesList]
            .filter(t => {
              if (s.includes("symbol = 'BYTE-USD' OR symbol = 'BYTE'")) {
                return t.symbol === 'BYTE-USD' || t.symbol === 'BYTE';
              }
              if (s.includes('symbol = ?') && symParam) {
                return t.symbol === symParam;
              }
              return true;
            })
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .slice(0, limit);
        }
        return [];
      }
    };
  }
}


const gState = globalThis as any;

if (!gState.__db__) {
  if (databaseUrl) {
    logger.info('PostgreSQL connection detected. Initializing pg Pool connection adapter...');
    pgPool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    gState.__db__ = new PostgresAdapter(pgPool);
  } else if (process.env.VERCEL) {
    logger.info('Vercel serverless environment detected. Using persistent global In-Memory Database Adapter.');
    if (!gState.__sharedOrdersMap__) gState.__sharedOrdersMap__ = new Map<string, any>();
    if (!gState.__sharedTradesList__) gState.__sharedTradesList__ = [];
    gState.__db__ = new MemoryDB();
  } else {
    try {
      const Database = require('better-sqlite3');
      const dbDir = path.dirname(path.resolve(process.cwd(), config.dbPath));
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      gState.__db__ = new Database(path.resolve(process.cwd(), config.dbPath));
      gState.__db__.pragma('journal_mode = WAL');
      gState.__db__.pragma('synchronous = NORMAL');
      gState.__db__.pragma('foreign_keys = ON');
    } catch (err) {
      logger.warn('Native SQLite module better-sqlite3 not available. Using In-Memory database adapter.');
      if (!gState.__sharedOrdersMap__) gState.__sharedOrdersMap__ = new Map<string, any>();
      if (!gState.__sharedTradesList__) gState.__sharedTradesList__ = [];
      gState.__db__ = new MemoryDB();
    }
  }
}

export function setDatabase(customDb: any): void {
  gState.__db__ = customDb;
}

export const db: any = new Proxy({} as any, {
  get(_target, prop) {
    return (gState.__db__ as any)[prop];
  },
  apply(_target, thisArg, argArray) {
    return (gState.__db__ as any).apply(thisArg, argArray);
  }
});
export { pgPool };

export function runMigrations(customDb?: any): void {
  const activeDb = customDb || gState.__db__;
  logger.info('Checking and running database migrations...');
  try {
    // 1. Ensure schema_migrations and amo_dispatch_log tables exist
    try {
      const amoTableSql = activeDb.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='amo_dispatch_log'").get() as { sql?: string } | undefined;
      if (amoTableSql && amoTableSql.sql && (!amoTableSql.sql.includes('CASCADE') || !amoTableSql.sql.includes('engine_accepted_at'))) {
        activeDb.exec('DROP TABLE IF EXISTS amo_dispatch_log');
      }
    } catch (_) {}

    activeDb.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS amo_dispatch_log (
        order_id TEXT PRIMARY KEY,
        dispatched_at TEXT NOT NULL,
        engine_accepted_at TEXT,
        processed_at TEXT,
        status TEXT NOT NULL CHECK(status IN ('CLAIMED', 'PROCESSED', 'FAILED')),
        error TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
    `);

    const getMigrationStmt = activeDb.prepare('SELECT version FROM schema_migrations WHERE version = ?');
    const recordMigrationStmt = activeDb.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');

    for (const migration of MIGRATIONS) {
      const existing = getMigrationStmt.get(migration.version);
      if (!existing) {
        logger.info(`Applying migration ${migration.version}_${migration.name}...`);

        // Check if foreign keys are enabled and disable BEFORE beginning transaction
        let wereFksEnabled = false;
        try {
          const fkRow = activeDb.prepare('PRAGMA foreign_keys').get() as { foreign_keys?: number } | undefined;
          wereFksEnabled = fkRow?.foreign_keys === 1;
        } catch (_) {}

        if (wereFksEnabled) {
          activeDb.exec('PRAGMA foreign_keys = OFF');
        }

        try {
          activeDb.exec('BEGIN IMMEDIATE');
          migration.up(activeDb);
          recordMigrationStmt.run(migration.version, migration.name, new Date().toISOString());
          activeDb.exec('COMMIT');
          logger.info(`Migration ${migration.name} applied successfully.`);
        } catch (mErr) {
          try {
            activeDb.exec('ROLLBACK');
          } catch (_) {}
          logger.error(`Migration ${migration.name} failed and was rolled back:`, mErr);
          throw mErr;
        } finally {
          // Restore foreign keys on all paths (success, error, rollback)
          if (wereFksEnabled) {
            activeDb.exec('PRAGMA foreign_keys = ON');
            const fkErrors = activeDb.prepare('PRAGMA foreign_key_check').all();
            if (fkErrors && fkErrors.length > 0) {
              logger.error('Foreign key check failed after migration:', fkErrors);
              throw new Error(`Foreign key check failed after migration ${migration.name}: ${JSON.stringify(fkErrors)}`);
            }
          }
        }
      }
    }

    // Safety check: ensure orders table does not retain legacy restrictive CHECK constraint
    if (needsStatusCheckUpgrade(activeDb)) {
      logger.info('Detected legacy CHECK constraint on orders table. Upgrading constraint...');
      let wereFksEnabled = false;
      try {
        const fkRow = activeDb.prepare('PRAGMA foreign_keys').get() as { foreign_keys?: number } | undefined;
        wereFksEnabled = fkRow?.foreign_keys === 1;
      } catch (_) {}

      if (wereFksEnabled) {
        activeDb.exec('PRAGMA foreign_keys = OFF');
      }

      try {
        activeDb.exec('BEGIN IMMEDIATE');
        migration002.up(activeDb);
        activeDb.exec('COMMIT');
        logger.info('Legacy CHECK constraint upgraded successfully.');
      } catch (uErr) {
        try { activeDb.exec('ROLLBACK'); } catch (_) {}
        logger.error('Failed to upgrade legacy CHECK constraint:', uErr);
        throw uErr;
      } finally {
        if (wereFksEnabled) {
          activeDb.exec('PRAGMA foreign_keys = ON');
          const fkErrors = activeDb.prepare('PRAGMA foreign_key_check').all();
          if (fkErrors && fkErrors.length > 0) {
            logger.error('Foreign key check failed after constraint upgrade:', fkErrors);
            throw new Error(`Foreign key check failed after constraint upgrade: ${JSON.stringify(fkErrors)}`);
          }
        }
      }
    }
  } catch (err: any) {
    logger.error('Error executing migrations:', err);
    throw err;
  }
}



// Automatically execute versioned migrations on initialization
try {
  runMigrations();
} catch (mErr) {
  logger.error('Failed to run initial migrations:', mErr);
}

export function initDatabase(): void {
  logger.info('Initializing database schema...');
  runMigrations();
  logger.info('Database schema initialized successfully.');
}



