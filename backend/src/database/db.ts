import path from 'path';
import fs from 'fs';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

class MemoryDB {
  private ordersMap = new Map<string, any>();
  private tradesList: any[] = [];

  pragma(_str: string) {}
  exec(_sql: string) {}

  prepare(sql: string) {
    const s = sql.trim();
    return {
      run: (...params: any[]) => {
        if (s.startsWith('INSERT INTO orders')) {
          const [id, side, type, price, quantity, remaining_quantity, status, created_at] = params;
          this.ordersMap.set(id, { id, side, type, price, quantity, remaining_quantity, status, created_at });
        } else if (s.startsWith('UPDATE orders SET remaining_quantity')) {
          const [remaining_quantity, status, id] = params;
          const o = this.ordersMap.get(id);
          if (o) { o.remaining_quantity = remaining_quantity; o.status = status; }
        } else if (s.startsWith('UPDATE orders SET status = \'CANCELLED\'')) {
          const [id] = params;
          const o = this.ordersMap.get(id);
          if (o) o.status = 'CANCELLED';
        } else if (s.startsWith('INSERT INTO trades')) {
          const [id, buy_order_id, sell_order_id, price, quantity, timestamp] = params;
          this.tradesList.push({ id, buy_order_id, sell_order_id, price, quantity, timestamp });
        } else if (s.startsWith('DELETE FROM trades')) {
          this.tradesList = [];
        } else if (s.startsWith('DELETE FROM orders')) {
          this.ordersMap.clear();
        }
        return { changes: 1 };
      },
      get: (...params: any[]) => {
        if (s.includes('FROM orders WHERE id =')) {
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
        if (s.includes('WHERE status IN (\'PENDING\', \'PARTIALLY_FILLED\')')) {
          return Array.from(this.ordersMap.values())
            .filter(o => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED')
            .sort((a, b) => a.created_at.localeCompare(b.created_at));
        } else if (s.includes('FROM orders ORDER BY created_at DESC')) {
          return Array.from(this.ordersMap.values())
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
        } else if (s.includes('FROM trades ORDER BY timestamp DESC')) {
          const limit = params[0] || 50;
          return [...this.tradesList]
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .slice(0, limit);
        }
        return [];
      }
    };
  }
}

const gDb = globalThis as any;

if (!gDb.__db__) {
  if (process.env.VERCEL) {
    logger.info('Vercel serverless environment detected. Using persistent global In-Memory Database Adapter.');
    gDb.__db__ = new MemoryDB();
  } else {
    try {
      const Database = require('better-sqlite3');
      const dbDir = path.dirname(path.resolve(process.cwd(), config.dbPath));
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      gDb.__db__ = new Database(path.resolve(process.cwd(), config.dbPath));
      gDb.__db__.pragma('journal_mode = WAL');
      gDb.__db__.pragma('synchronous = NORMAL');
      gDb.__db__.pragma('foreign_keys = ON');
    } catch (err) {
      logger.warn('Native SQLite module better-sqlite3 not available. Using In-Memory database adapter.');
      gDb.__db__ = new MemoryDB();
    }
  }
}

export const db = gDb.__db__;

export function initDatabase(): void {
  logger.info('Initializing SQLite database schema...');

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
        type TEXT NOT NULL DEFAULT 'LIMIT' CHECK(type IN ('LIMIT', 'MARKET')),
        price REAL NOT NULL CHECK(price >= 0),
        quantity REAL NOT NULL CHECK(quantity > 0),
        remaining_quantity REAL NOT NULL CHECK(remaining_quantity >= 0),
        status TEXT NOT NULL CHECK(status IN ('PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED')),
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_orders_side_status ON orders(side, status);
      CREATE INDEX IF NOT EXISTS idx_orders_price ON orders(price);

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

      CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);
    `);
  } catch (_) {}

  logger.info('Database schema initialized successfully.');
}
