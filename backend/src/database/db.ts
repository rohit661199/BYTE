import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const dbDir = path.dirname(path.resolve(process.cwd(), config.dbPath));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(path.resolve(process.cwd(), config.dbPath));

// Enable WAL mode for high performance concurrent readers/writers
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  logger.info('Initializing SQLite database schema...');

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

  logger.info('Database schema initialized successfully.');
}
