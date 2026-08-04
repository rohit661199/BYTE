import { db } from '../database/db.js';
import { Trade } from '../types/index.js';

interface RawTradeRow {
  id: string;
  buy_order_id: string;
  sell_order_id: string;
  price: number;
  quantity: number;
  timestamp: string;
}

function mapRowToTrade(row: RawTradeRow): Trade {
  return {
    id: row.id,
    buyOrderId: row.buy_order_id,
    sellOrderId: row.sell_order_id,
    price: row.price,
    quantity: row.quantity,
    timestamp: row.timestamp,
  };
}

export class TradeModel {
  static create(trade: Trade): Trade {
    const stmt = db.prepare(`
      INSERT INTO trades (id, buy_order_id, sell_order_id, price, quantity, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trade.id,
      trade.buyOrderId,
      trade.sellOrderId,
      trade.price,
      trade.quantity,
      trade.timestamp
    );

    return trade;
  }

  static getRecentTrades(limit = 50): Trade[] {
    const stmt = db.prepare(`
      SELECT * FROM trades
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as RawTradeRow[];
    return rows.map(mapRowToTrade);
  }

  static getStats(): { totalTrades: number; totalVolume: number } {
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as totalTrades,
        COALESCE(SUM(quantity * price), 0) as totalVolume
      FROM trades
    `);
    const result = stmt.get() as { totalTrades: number; totalVolume: number };
    return {
      totalTrades: result.totalTrades || 0,
      totalVolume: result.totalVolume || 0,
    };
  }
}
