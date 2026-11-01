import { db } from '../database/db.js';
import { Trade } from '../types/index.js';
import { MathPrecision } from '../utils/MathPrecision.js';

interface RawTradeRow {
  id: string;
  buy_order_id: string;
  sell_order_id: string;
  price: number;
  quantity: number;
  timestamp: string;
  symbol?: string;
  price_basis?: number | bigint;
  quantity_micro?: number | bigint;
}

function mapRowToTrade(row: RawTradeRow): Trade {
  const priceBasis = row.price_basis != null
    ? BigInt(row.price_basis)
    : MathPrecision.parsePriceToBasis(row.price);
  const qtyMicro = row.quantity_micro != null
    ? BigInt(row.quantity_micro)
    : MathPrecision.parseQtyToMicro(row.quantity);

  return {
    id: row.id,
    buyOrderId: row.buy_order_id,
    sellOrderId: row.sell_order_id,
    price: row.price,
    quantity: row.quantity,
    timestamp: row.timestamp,
    symbol: row.symbol || 'BYTE-USD',
    priceBasis,
    quantityMicro: qtyMicro,
    priceStr: MathPrecision.formatBasisToPrice(priceBasis, 2),
    quantityStr: MathPrecision.formatMicroToQty(qtyMicro),
  };
}

export class TradeModel {
  static create(trade: Trade): Trade {
    const symbol = trade.symbol || 'BYTE-USD';
    const priceBasis = trade.priceBasis ?? MathPrecision.parsePriceToBasis(trade.price);
    const quantityMicro = trade.quantityMicro ?? MathPrecision.parseQtyToMicro(trade.quantity);

    const stmt = db.prepare(`
      INSERT INTO trades (
        id, buy_order_id, sell_order_id, price, quantity, timestamp, symbol,
        price_basis, quantity_micro
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trade.id,
      trade.buyOrderId,
      trade.sellOrderId,
      trade.price,
      trade.quantity,
      trade.timestamp,
      symbol,
      Number(priceBasis),
      Number(quantityMicro)
    );

    trade.priceBasis = priceBasis;
    trade.quantityMicro = quantityMicro;
    trade.priceStr = MathPrecision.formatBasisToPrice(priceBasis, 2);
    trade.quantityStr = MathPrecision.formatMicroToQty(quantityMicro);

    return trade;
  }

  static getRecentTrades(limit = 50, symbol?: string): Trade[] {
    if (symbol) {
      const canonical = symbol === 'BYTE' ? 'BYTE-USD' : symbol;
      const sql = canonical === 'BYTE-USD'
        ? `SELECT * FROM trades
           WHERE symbol = 'BYTE-USD' OR symbol = 'BYTE'
           ORDER BY timestamp DESC
           LIMIT ?`
        : `SELECT * FROM trades
           WHERE symbol = ?
           ORDER BY timestamp DESC
           LIMIT ?`;
      const stmt = db.prepare(sql);
      const rows = (canonical === 'BYTE-USD' ? stmt.all(limit) : stmt.all(canonical, limit)) as RawTradeRow[];
      return rows.map(mapRowToTrade);
    }

    const stmt = db.prepare(`
      SELECT * FROM trades
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as RawTradeRow[];
    return rows.map(mapRowToTrade);
  }

  static getStats(symbol?: string): { totalTrades: number; totalVolume: number } {
    if (symbol) {
      const canonical = symbol === 'BYTE' ? 'BYTE-USD' : symbol;
      const sql = canonical === 'BYTE-USD'
        ? `SELECT
            COUNT(*) as totalTrades,
            COALESCE(SUM(quantity * price), 0) as totalVolume
          FROM trades
          WHERE symbol = 'BYTE-USD' OR symbol = 'BYTE'`
        : `SELECT
            COUNT(*) as totalTrades,
            COALESCE(SUM(quantity * price), 0) as totalVolume
          FROM trades
          WHERE symbol = ?`;
      const stmt = db.prepare(sql);
      const result = (canonical === 'BYTE-USD' ? stmt.get() : stmt.get(canonical)) as { totalTrades: number; totalVolume: number };
      return {
        totalTrades: result.totalTrades || 0,
        totalVolume: result.totalVolume || 0,
      };
    }


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

  static findByOrderId(orderId: string): Trade[] {
    const stmt = db.prepare(`
      SELECT * FROM trades
      WHERE buy_order_id = ? OR sell_order_id = ?
      ORDER BY timestamp ASC
    `);
    const rows = stmt.all(orderId, orderId) as RawTradeRow[];
    return rows.map(mapRowToTrade);
  }
}

