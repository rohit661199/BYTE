import { MigrationDatabase } from './001_base_tables.js';

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

function getTableColumns(db: MigrationDatabase, tableName: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as ColumnInfo[];
  return rows.map((r) => r.name.toLowerCase());
}

interface TriggerInfo {
  name: string;
  sql: string;
}

function getTableTriggers(db: MigrationDatabase, tableName: string): TriggerInfo[] {
  try {
    const rows = db.prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = '${tableName}'`).all() as TriggerInfo[];
    return rows.filter((r) => r && r.sql);
  } catch (_) {
    return [];
  }
}

export function needsStatusCheckUpgrade(db: MigrationDatabase): boolean {
  try {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'").get() as { sql?: string } | undefined;
    if (!row || !row.sql) return false;
    return row.sql.includes('status IN') && !row.sql.includes('QUEUED_AMO');
  } catch (_) {
    return false;
  }
}

export const migration002 = {
  version: 2,
  name: '002_multi_asset_amo',
  up: (db: MigrationDatabase): void => {
    const orderCols = getTableColumns(db, 'orders');

    // If existing orders table has legacy CHECK constraint on status, upgrade non-destructively
    // Note: Caller disables foreign_keys before beginning transaction, and restores foreign_keys in finally
    if (needsStatusCheckUpgrade(db)) {
      db.exec(`
        CREATE TABLE orders_upgrade (
          id TEXT PRIMARY KEY,
          side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
          type TEXT NOT NULL DEFAULT 'LIMIT' CHECK(type IN ('LIMIT', 'MARKET')),
          price REAL NOT NULL CHECK(price >= 0),
          quantity REAL NOT NULL CHECK(quantity > 0),
          remaining_quantity REAL NOT NULL CHECK(remaining_quantity >= 0),
          status TEXT NOT NULL CHECK(status IN ('PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'QUEUED_AMO', 'REJECTED')),
          created_at TEXT NOT NULL,
          symbol TEXT DEFAULT 'BYTE-USD',
          user_id TEXT,
          owner_type TEXT DEFAULT 'USER',
          dispatched_at TEXT
        );
      `);

      const symbolExpr = orderCols.includes('symbol')
        ? "CASE WHEN symbol IS NULL OR symbol = 'BYTE' THEN 'BYTE-USD' ELSE symbol END"
        : "'BYTE-USD'";
      const userExpr = orderCols.includes('user_id') ? "user_id" : "NULL";
      const ownerExpr = orderCols.includes('owner_type') ? "COALESCE(owner_type, 'USER')" : "'USER'";
      const dispatchedExpr = orderCols.includes('dispatched_at') ? "dispatched_at" : "NULL";

      db.exec(`
        INSERT INTO orders_upgrade (id, side, type, price, quantity, remaining_quantity, status, created_at, symbol, user_id, owner_type, dispatched_at)
        SELECT id, side, type, price, quantity, remaining_quantity, status, created_at,
               ${symbolExpr}, ${userExpr}, ${ownerExpr}, ${dispatchedExpr}
        FROM orders;
      `);

      const existingTriggers = getTableTriggers(db, 'orders');

      db.exec('DROP TABLE orders');
      db.exec('ALTER TABLE orders_upgrade RENAME TO orders');

      // Recreate custom triggers if any existed on orders
      for (const trig of existingTriggers) {
        db.exec(trig.sql);
      }

      // Recreate original and multi-asset indexes on orders
      db.exec('CREATE INDEX IF NOT EXISTS idx_orders_side_status ON orders(side, status)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_orders_price ON orders(price)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_orders_symbol_status ON orders(symbol, status)');
      db.exec("CREATE INDEX IF NOT EXISTS idx_orders_queued_amo ON orders(status, symbol) WHERE status = 'QUEUED_AMO'");
    } else {
      // Safe Column Additions to orders table if not present
      if (!orderCols.includes('symbol')) {
        db.exec("ALTER TABLE orders ADD COLUMN symbol TEXT DEFAULT 'BYTE-USD'");
      }
      if (!orderCols.includes('user_id')) {
        db.exec("ALTER TABLE orders ADD COLUMN user_id TEXT");
      }
      if (!orderCols.includes('owner_type')) {
        db.exec("ALTER TABLE orders ADD COLUMN owner_type TEXT DEFAULT 'USER'");
      }
      if (!orderCols.includes('dispatched_at')) {
        db.exec("ALTER TABLE orders ADD COLUMN dispatched_at TEXT");
      }

      db.exec('CREATE INDEX IF NOT EXISTS idx_orders_symbol_status ON orders(symbol, status)');
      db.exec("CREATE INDEX IF NOT EXISTS idx_orders_queued_amo ON orders(status, symbol) WHERE status = 'QUEUED_AMO'");
    }

    // 2. Safe Column Additions to trades table
    const tradeCols = getTableColumns(db, 'trades');
    if (!tradeCols.includes('symbol')) {
      db.exec("ALTER TABLE trades ADD COLUMN symbol TEXT DEFAULT 'BYTE-USD'");
    }

    // 3. Normalization: Migrate existing legacy 'BYTE' entries to canonical 'BYTE-USD'
    db.exec("UPDATE orders SET symbol = 'BYTE-USD' WHERE symbol = 'BYTE' OR symbol IS NULL");
    db.exec("UPDATE trades SET symbol = 'BYTE-USD' WHERE symbol = 'BYTE' OR symbol IS NULL");

    // 4. Create Multi-Asset & AMO performance indexes
    db.exec("CREATE INDEX IF NOT EXISTS idx_trades_symbol_timestamp ON trades(symbol, timestamp DESC)");
  },
};
