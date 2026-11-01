import { db } from '../database/db.js';
import { Order, OrderSide, OrderStatus, OrderType, OwnerType } from '../types/index.js';
import { MathPrecision } from '../utils/MathPrecision.js';

interface RawOrderRow {
  id: string;
  side: string;
  type: string;
  price: number;
  quantity: number;
  remaining_quantity: number;
  status: string;
  created_at: string;
  symbol?: string;
  user_id?: string;
  owner_type?: string;
  dispatched_at?: string;
  price_basis?: number | bigint;
  quantity_micro?: number | bigint;
  remaining_quantity_micro?: number | bigint;
}

function mapRowToOrder(row: RawOrderRow): Order {
  const priceBasis = row.price_basis != null
    ? BigInt(row.price_basis)
    : MathPrecision.parsePriceToBasis(row.price);
  const qtyMicro = row.quantity_micro != null
    ? BigInt(row.quantity_micro)
    : MathPrecision.parseQtyToMicro(row.quantity);
  const remMicro = row.remaining_quantity_micro != null
    ? BigInt(row.remaining_quantity_micro)
    : MathPrecision.parseQtyToMicro(row.remaining_quantity);
  const filledMicro = qtyMicro - remMicro;

  const priceStr = MathPrecision.formatBasisToPrice(priceBasis, 2);
  const qtyStr = MathPrecision.formatMicroToQty(qtyMicro);
  const remStr = MathPrecision.formatMicroToQty(remMicro);
  const filledStr = MathPrecision.formatMicroToQty(filledMicro);

  return {
    id: row.id,
    side: row.side as OrderSide,
    type: row.type as OrderType,
    price: row.price,
    quantity: row.quantity,
    remainingQuantity: row.remaining_quantity,
    status: row.status as OrderStatus,
    createdAt: row.created_at,
    symbol: row.symbol || 'BYTE-USD',
    userId: row.user_id,
    ownerType: (row.owner_type as OwnerType) || 'USER',
    dispatchedAt: row.dispatched_at || undefined,
    priceBasis,
    quantityMicro: qtyMicro,
    remainingQuantityMicro: remMicro,
    priceStr,
    quantityStr: qtyStr,
    originalQuantity: qtyStr,
    originalQuantityStr: qtyStr,
    remainingQuantityStr: remStr,
    filledQuantityStr: filledStr,
    filledQuantity: Number(qtyStr) - Number(remStr),
  };
}

export class OrderModel {
  static create(order: Order): Order {
    const symbol = order.symbol || 'BYTE-USD';
    const ownerType = order.ownerType || 'USER';
    const userId = order.userId || null;

    const priceBasis = order.priceBasis ?? MathPrecision.parsePriceToBasis(order.price);
    const quantityMicro = order.quantityMicro ?? MathPrecision.parseQtyToMicro(order.quantity);
    const remainingQuantityMicro = order.remainingQuantityMicro ?? MathPrecision.parseQtyToMicro(order.remainingQuantity);

    const stmt = db.prepare(`
      INSERT INTO orders (
        id, side, type, price, quantity, remaining_quantity, status, created_at, symbol, user_id, owner_type,
        price_basis, quantity_micro, remaining_quantity_micro
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      order.id,
      order.side,
      order.type,
      order.price,
      order.quantity,
      order.remainingQuantity,
      order.status,
      order.createdAt,
      symbol,
      userId,
      ownerType,
      Number(priceBasis),
      Number(quantityMicro),
      Number(remainingQuantityMicro)
    );

    order.priceBasis = priceBasis;
    order.quantityMicro = quantityMicro;
    order.remainingQuantityMicro = remainingQuantityMicro;

    return order;
  }

  static findById(id: string): Order | null {
    const stmt = db.prepare('SELECT * FROM orders WHERE id = ?');
    const row = stmt.get(id) as RawOrderRow | undefined;
    return row ? mapRowToOrder(row) : null;
  }

  static update(order: Order): void {
    const remMicro = order.remainingQuantityMicro ?? MathPrecision.parseQtyToMicro(order.remainingQuantity);
    const stmt = db.prepare(`
      UPDATE orders
      SET remaining_quantity = ?, remaining_quantity_micro = ?, status = ?
      WHERE id = ?
    `);
    stmt.run(order.remainingQuantity, Number(remMicro), order.status, order.id);
  }

  static cancel(id: string): boolean {
    const stmt = db.prepare(`
      UPDATE orders
      SET status = 'CANCELLED'
      WHERE id = ? AND status IN ('PENDING', 'PARTIALLY_FILLED', 'QUEUED_AMO')
    `);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static getActiveOrders(symbol?: string): Order[] {
    if (symbol) {
      const canonical = symbol === 'BYTE' ? 'BYTE-USD' : symbol;
      const sql = canonical === 'BYTE-USD'
        ? `SELECT o.* FROM orders o
           LEFT JOIN amo_dispatch_log l ON o.id = l.order_id
           WHERE o.status IN ('PENDING', 'PARTIALLY_FILLED')
             AND (l.order_id IS NULL OR l.status = 'PROCESSED' OR l.engine_accepted_at IS NOT NULL)
             AND (o.symbol = 'BYTE-USD' OR o.symbol = 'BYTE')
           ORDER BY o.created_at ASC`
        : `SELECT o.* FROM orders o
           LEFT JOIN amo_dispatch_log l ON o.id = l.order_id
           WHERE o.status IN ('PENDING', 'PARTIALLY_FILLED')
             AND (l.order_id IS NULL OR l.status = 'PROCESSED' OR l.engine_accepted_at IS NOT NULL)
             AND o.symbol = ?
           ORDER BY o.created_at ASC`;
      const stmt = db.prepare(sql);
      const rows = (canonical === 'BYTE-USD' ? stmt.all() : stmt.all(canonical)) as RawOrderRow[];
      return rows.map(mapRowToOrder);
    }

    const stmt = db.prepare(`
      SELECT o.* FROM orders o
      LEFT JOIN amo_dispatch_log l ON o.id = l.order_id
      WHERE o.status IN ('PENDING', 'PARTIALLY_FILLED')
        AND (l.order_id IS NULL OR l.status = 'PROCESSED' OR l.engine_accepted_at IS NOT NULL)
      ORDER BY o.created_at ASC
    `);
    const rows = stmt.all() as RawOrderRow[];
    return rows.map(mapRowToOrder);
  }

  static getQueuedAmoOrders(symbol?: string): Order[] {
    if (symbol) {
      const canonical = symbol === 'BYTE' ? 'BYTE-USD' : symbol;
      const sql = canonical === 'BYTE-USD'
        ? `SELECT * FROM orders
           WHERE status = 'QUEUED_AMO' AND (symbol = 'BYTE-USD' OR symbol = 'BYTE')
           ORDER BY created_at ASC`
        : `SELECT * FROM orders
           WHERE status = 'QUEUED_AMO' AND symbol = ?
           ORDER BY created_at ASC`;
      const stmt = db.prepare(sql);
      const rows = (canonical === 'BYTE-USD' ? stmt.all() : stmt.all(canonical)) as RawOrderRow[];
      return rows.map(mapRowToOrder);
    }

    const stmt = db.prepare(`
      SELECT * FROM orders
      WHERE status = 'QUEUED_AMO'
      ORDER BY created_at ASC
    `);
    const rows = stmt.all() as RawOrderRow[];
    return rows.map(mapRowToOrder);
  }

  static markAmoDispatched(id: string): boolean {
    return this.claimAmoDispatch(id);
  }

  static claimAmoDispatch(id: string): boolean {
    try {
      const claimTx = db.transaction(() => {
        const stmt = db.prepare(`
          UPDATE orders
          SET status = 'PENDING', dispatched_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'QUEUED_AMO'
        `);
        const res = stmt.run(id);
        if (res.changes === 0) return false;

        db.prepare(`
          INSERT OR REPLACE INTO amo_dispatch_log (order_id, dispatched_at, status)
          VALUES (?, CURRENT_TIMESTAMP, 'CLAIMED')
        `).run(id);
        return true;
      });

      return claimTx();
    } catch (_) {
      return false;
    }
  }

  static completeAmoDispatch(id: string): void {
    try {
      db.prepare(`
        UPDATE amo_dispatch_log
        SET processed_at = CURRENT_TIMESTAMP,
            status = 'PROCESSED',
            engine_accepted_at = COALESCE(engine_accepted_at, CURRENT_TIMESTAMP)
        WHERE order_id = ?
      `).run(id);
    } catch (_) {}
  }

  static persistOrderAcceptance(order: Order): void {
    const remMicro = order.remainingQuantityMicro ?? MathPrecision.parseQtyToMicro(order.remainingQuantity);
    const persistTx = db.transaction(() => {
      db.prepare(`
        UPDATE orders
        SET remaining_quantity = ?, remaining_quantity_micro = ?, status = ?
        WHERE id = ?
      `).run(order.remainingQuantity, Number(remMicro), order.status, order.id);

      db.prepare(`
        UPDATE amo_dispatch_log
        SET engine_accepted_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `).run(order.id);
    });
    persistTx();
  }

  static completeAmoRecovery(order: Order, finalStatus: 'FILLED' | 'PARTIALLY_FILLED', remainingQty: number): void {
    const remMicro = MathPrecision.parseQtyToMicro(remainingQty);
    const recTx = db.transaction(() => {
      db.prepare(`
        UPDATE orders
        SET status = ?, remaining_quantity = ?, remaining_quantity_micro = ?
        WHERE id = ?
      `).run(finalStatus, remainingQty, Number(remMicro), order.id);

      db.prepare(`
        UPDATE amo_dispatch_log
        SET processed_at = CURRENT_TIMESTAMP,
            status = 'PROCESSED',
            engine_accepted_at = COALESCE(engine_accepted_at, CURRENT_TIMESTAMP)
        WHERE order_id = ?
      `).run(order.id);
    });
    recTx();
  }

  static failAmoDispatch(id: string, error?: string): void {
    try {
      db.prepare(`
        UPDATE amo_dispatch_log
        SET processed_at = CURRENT_TIMESTAMP, status = 'FAILED', error = ?
        WHERE order_id = ?
      `).run(error || 'Execution failed', id);
    } catch (_) {}
  }

  static recordAmoEngineAcceptance(id: string): void {
    try {
      db.prepare(`
        UPDATE amo_dispatch_log
        SET engine_accepted_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `).run(id);
    } catch (_) {}
  }

  static getAmoDispatchLog(id: string): {
    order_id: string;
    dispatched_at: string;
    engine_accepted_at?: string | null;
    processed_at?: string | null;
    status: string;
    error?: string | null;
  } | null {
    try {
      const row = db.prepare(`SELECT * FROM amo_dispatch_log WHERE order_id = ?`).get(id);
      return (row as any) || null;
    } catch (_) {
      return null;
    }
  }

  static getInterruptedAmoDispatches(): Order[] {
    try {
      const stmt = db.prepare(`
        SELECT o.* FROM orders o
        LEFT JOIN amo_dispatch_log l ON o.id = l.order_id
        WHERE (l.status = 'CLAIMED' AND l.processed_at IS NULL)
           OR (l.order_id IS NULL AND o.status = 'PENDING' AND o.dispatched_at IS NOT NULL)
        ORDER BY o.created_at ASC
      `);
      const rows = stmt.all() as RawOrderRow[];
      return rows.map(mapRowToOrder);
    } catch (_) {
      return [];
    }
  }

  static resetInterruptedAmo(id: string): void {
    try {
      const resetTx = db.transaction(() => {
        db.prepare(`
          UPDATE orders
          SET status = 'QUEUED_AMO', dispatched_at = NULL
          WHERE id = ?
        `).run(id);
        db.prepare(`DELETE FROM amo_dispatch_log WHERE order_id = ?`).run(id);
      });
      resetTx();
    } catch (_) {}
  }

  static rejectAmo(id: string): boolean {
    const stmt = db.prepare(`
      UPDATE orders
      SET status = 'REJECTED'
      WHERE id = ? AND status = 'QUEUED_AMO'
    `);
    const res = stmt.run(id);
    return res.changes > 0;
  }

  static cancelSimulatorOrders(symbol: string): number {
    const canonical = symbol === 'BYTE' ? 'BYTE-USD' : symbol;
    const sql = canonical === 'BYTE-USD'
      ? `UPDATE orders
         SET status = 'CANCELLED'
         WHERE owner_type = 'SIMULATOR' AND status IN ('PENDING', 'PARTIALLY_FILLED') AND (symbol = 'BYTE-USD' OR symbol = 'BYTE')`
      : `UPDATE orders
         SET status = 'CANCELLED'
         WHERE owner_type = 'SIMULATOR' AND status IN ('PENDING', 'PARTIALLY_FILLED') AND symbol = ?`;
    const stmt = db.prepare(sql);
    const res = canonical === 'BYTE-USD' ? stmt.run() : stmt.run(canonical);
    return res.changes || 0;
  }

  static getSimulatorOrders(symbol?: string, status?: OrderStatus): Order[] {
    let sql = `SELECT * FROM orders WHERE owner_type = 'SIMULATOR'`;
    const params: any[] = [];
    if (symbol) {
      const canonical = symbol === 'BYTE' ? 'BYTE-USD' : symbol;
      if (canonical === 'BYTE-USD') {
        sql += ` AND (symbol = 'BYTE-USD' OR symbol = 'BYTE')`;
      } else {
        sql += ` AND symbol = ?`;
        params.push(canonical);
      }
    }
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC`;
    const stmt = db.prepare(sql);
    const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as RawOrderRow[];
    return rows.map(mapRowToOrder);
  }


  static getAll(limit?: number, offset?: number): Order[] {
    let sql = 'SELECT * FROM orders ORDER BY created_at DESC';
    const params: number[] = [];
    if (limit != null && !isNaN(limit) && limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset != null && !isNaN(offset) && offset > 0) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }
    const stmt = db.prepare(sql);
    const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as RawOrderRow[];
    return rows.map(mapRowToOrder);
  }

  static getPaginated(options: {
    limit?: number;
    offset?: number;
    status?: string;
    search?: string;
  }): { orders: Order[]; total: number } {
    const whereClauses: string[] = [];
    const filterParams: any[] = [];

    // 1. Status Filter
    if (options.status && options.status.toUpperCase() !== 'ALL') {
      const upperStatus = options.status.toUpperCase();
      if (upperStatus === 'OPEN') {
        whereClauses.push("status IN ('PENDING', 'PARTIALLY_FILLED')");
      } else if (upperStatus === 'FILLED' || upperStatus === 'COMPLETED') {
        whereClauses.push("status = 'FILLED'");
      } else if (upperStatus === 'CANCELLED') {
        whereClauses.push("status = 'CANCELLED'");
      } else if (['PENDING', 'PARTIALLY_FILLED', 'QUEUED_AMO', 'REJECTED'].includes(upperStatus)) {
        whereClauses.push("status = ?");
        filterParams.push(upperStatus);
      }
    }

    // 2. Search Filter (parameterized search on id and symbol)
    if (options.search && options.search.trim()) {
      const searchPattern = `%${options.search.trim()}%`;
      whereClauses.push("(id LIKE ? OR symbol LIKE ? OR side LIKE ?)");
      filterParams.push(searchPattern, searchPattern, searchPattern);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 3. Count Query using exact same filter criteria
    const countSql = `SELECT COUNT(*) as count FROM orders ${whereSql}`;
    const countStmt = db.prepare(countSql);
    const countResult = (filterParams.length > 0 ? countStmt.get(...filterParams) : countStmt.get()) as { count: number };
    const total = countResult ? countResult.count : 0;

    // 4. Clamping and Pagination Query
    let limit = 50;
    if (typeof options.limit === 'number' && !isNaN(options.limit) && options.limit > 0) {
      limit = Math.min(options.limit, 100);
    }

    let offset = 0;
    if (typeof options.offset === 'number' && !isNaN(options.offset)) {
      offset = Math.max(0, options.offset);
    }

    const dataSql = `SELECT * FROM orders ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const dataParams = [...filterParams, limit, offset];
    const dataStmt = db.prepare(dataSql);
    const rows = dataStmt.all(...dataParams) as RawOrderRow[];

    return {
      orders: rows.map(mapRowToOrder),
      total,
    };
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

