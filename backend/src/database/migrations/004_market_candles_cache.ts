import { MigrationDatabase } from './001_base_tables.js';

export const migration004 = {
  version: 4,
  name: '004_market_candles_cache',
  up: (db: MigrationDatabase): void => {
    // 1. Create market_candles table for caching historical OHLCV data
    db.exec(`
      CREATE TABLE IF NOT EXISTS market_candles (
        symbol TEXT NOT NULL,
        interval TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL DEFAULT 0,
        source TEXT NOT NULL,
        PRIMARY KEY (symbol, interval, timestamp)
      );

      CREATE INDEX IF NOT EXISTS idx_market_candles_lookup 
      ON market_candles (symbol, interval, timestamp DESC);
    `);
  },
};
