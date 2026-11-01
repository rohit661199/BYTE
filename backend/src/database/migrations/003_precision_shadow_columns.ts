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
  try {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as ColumnInfo[];
    return rows.map((r) => r.name.toLowerCase());
  } catch (_) {
    return [];
  }
}

export const migration003 = {
  version: 3,
  name: '003_precision_shadow_columns',
  up: (db: MigrationDatabase): void => {
    const orderCols = getTableColumns(db, 'orders');

    // 1. Add authoritative integer shadow columns to orders table
    if (!orderCols.includes('price_basis')) {
      db.exec('ALTER TABLE orders ADD COLUMN price_basis INTEGER');
    }
    if (!orderCols.includes('quantity_micro')) {
      db.exec('ALTER TABLE orders ADD COLUMN quantity_micro INTEGER');
    }
    if (!orderCols.includes('remaining_quantity_micro')) {
      db.exec('ALTER TABLE orders ADD COLUMN remaining_quantity_micro INTEGER');
    }

    // 2. Add authoritative integer shadow columns to trades table
    const tradeCols = getTableColumns(db, 'trades');
    if (!tradeCols.includes('price_basis')) {
      db.exec('ALTER TABLE trades ADD COLUMN price_basis INTEGER');
    }
    if (!tradeCols.includes('quantity_micro')) {
      db.exec('ALTER TABLE trades ADD COLUMN quantity_micro INTEGER');
    }

    // 3. Safely backfill existing legacy records preserving exact scales:
    // Price scale: 10,000 (basis points)
    // Quantity scale: 1,000,000 (micro-units)
    db.exec(`
      UPDATE orders
      SET price_basis = CAST(ROUND(price * 10000) AS INTEGER),
          quantity_micro = CAST(ROUND(quantity * 1000000) AS INTEGER),
          remaining_quantity_micro = CAST(ROUND(remaining_quantity * 1000000) AS INTEGER)
      WHERE price_basis IS NULL;
    `);

    db.exec(`
      UPDATE trades
      SET price_basis = CAST(ROUND(price * 10000) AS INTEGER),
          quantity_micro = CAST(ROUND(quantity * 1000000) AS INTEGER)
      WHERE price_basis IS NULL;
    `);
  },
};
