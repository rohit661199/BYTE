import { db } from '../database/db.js';
import { Order, OrderSide, OrderStatus, OrderType } from '../types/index.js';

interface RawOrderRow {
  id: string;
  side: string;
  type: string;
  price: number;
  quantity: number;
  remaining_quantity: number;
  status: string;
  created_at: string;
}

function mapRowToOrder(row: RawOrderRow): Order {
  return {
    id: row.id,
    side: row.side as OrderSide,
    type: row.type as OrderType,
    price: row.price,
    quantity: row.quantity,
    remainingQuantity: row.remaining_quantity,
    status: row.status as OrderStatus,
    createdAt: row.created_at,
  };
}

export class OrderModel {
  static create(order: Order): Order {
    const stmt = db.prepare(`
      INSERT INTO orders (id, side, type, price, quantity, remaining_quantity, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      order.id,
      order.side,
      order.type,
      order.price,
      order.quantity,
      order.remainingQuantity,
      order.status,
      order.createdAt
    );

    return order;
  }

  static findById(id: string): Order | null {
    const stmt = db.prepare('SELECT * FROM orders WHERE id = ?');
    const row = stmt.get(id) as RawOrderRow | undefined;
    return row ? mapRowToOrder(row) : null;
  }

  static update(order: Order): void {
    const stmt = db.prepare(`
      UPDATE orders
      SET remaining_quantity = ?, status = ?
      WHERE id = ?
    `);
    stmt.run(order.remainingQuantity, order.status, order.id);
  }

  static cancel(id: string): boolean {
    const stmt = db.prepare(`
      UPDATE orders
      SET status = 'CANCELLED'
      WHERE id = ? AND status IN ('PENDING', 'PARTIALLY_FILLED')
    `);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static getActiveOrders(): Order[] {
    const stmt = db.prepare(`
      SELECT * FROM orders
      WHERE status IN ('PENDING', 'PARTIALLY_FILLED')
      ORDER BY created_at ASC
    `);
    const rows = stmt.all() as RawOrderRow[];
    return rows.map(mapRowToOrder);
  }

  static getAll(): Order[] {
    const stmt = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
    const rows = stmt.all() as RawOrderRow[];
    return rows.map(mapRowToOrder);
  }

  static getCounts(): { totalBuy: number; totalSell: number } {
    const stmt = db.prepare(`
      SELECT
        COUNT(CASE WHEN side = 'BUY' THEN 1 END) as totalBuy,
        COUNT(CASE WHEN side = 'SELL' THEN 1 END) as totalSell
      FROM orders
    `);
    const result = stmt.get() as { totalBuy: number; totalSell: number };
    return {
      totalBuy: result.totalBuy || 0,
      totalSell: result.totalSell || 0,
    };
  }
}
