export interface MigrationDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: any[]): { changes: number };
    get(...params: any[]): any;
    all(...params: any[]): any[];
  };
}

export const migration001 = {
  version: 1,
  name: '001_base_tables',
  up: (db: MigrationDatabase): void => {
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
  },
};
