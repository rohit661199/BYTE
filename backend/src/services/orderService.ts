import { randomUUID } from 'crypto';
import { db } from '../database/db.js';
import { OrderModel } from '../models/orderModel.js';
import { CreateOrderDTO, Order, Trade, ReservationResult } from '../types/index.js';
import { AppError } from '../middlewares/errorHandler.js';
import { matchingEngine } from '../matching-engine/MatchingEngine.js';
import { EngineManager } from '../matching-engine/EngineManager.js';
import { InstrumentRegistry } from './InstrumentRegistry.js';
import { MarketSessionManager } from './MarketSessionManager.js';
import { FundsReservationAdapterFactory } from './FundsReservationAdapter.js';
import { WebSocketService } from './websocketService.js';
import { TimeProvider } from '../utils/TimeProvider.js';
import { MathPrecision } from '../utils/MathPrecision.js';

export interface CreateOrderResult {
  order: Order;
  trades: Trade[];
  reservation?: ReservationResult;
}

export class OrderService {
  /**
   * Unified Multi-Asset Order Placement Flow (Step 5)
   * Follows strict 11-step pipeline across Equities, Crypto, and BYTE-USD:
   * 1. Receive order request
   * 2. Resolve instrument through InstrumentRegistry
   * 3. Canonicalize symbol and aliases
   * 4. Validate order type, side, price, and quantity
   * 5. Apply instrument-specific tick-size and quantity-step rules
   * 6. Calculate notional using MathPrecision
   * 7. Validate minimum order quantity and minimum notional ($1.00 USD)
   * 8. Apply market-session rules through MarketSessionManager
   * 9. Route order to correct engine through EngineManager
   * 10. Persist resulting order and trade information
   * 11. Return consistent API response
   */
  static createOrder(dto: CreateOrderDTO): CreateOrderResult {
    // 1. Receive order request & 2/3. Resolve canonical instrument
    const rawSymbol = dto.symbol || 'BYTE-USD';
    const canonicalSymbol = InstrumentRegistry.getCanonicalSymbol(rawSymbol);
    const instrument = InstrumentRegistry.getInstrument(canonicalSymbol);

    if (!instrument) {
      throw new AppError(`Unknown or untradable instrument: ${rawSymbol}`, 400, 'INVALID_INSTRUMENT');
    }

    // 4. Validate order type, side, price, and quantity
    const side = dto.side;
    if (side !== 'BUY' && side !== 'SELL') {
      throw new AppError(`Invalid order side: ${side}`, 400, 'INVALID_ORDER_SIDE');
    }

    const orderType = dto.type || 'LIMIT';
    if (orderType !== 'LIMIT' && orderType !== 'MARKET') {
      throw new AppError(`Invalid order type: ${orderType}`, 400, 'INVALID_ORDER_TYPE');
    }

    if (dto.quantity === undefined || dto.quantity === null) {
      throw new AppError('Quantity is required', 400, 'INVALID_QUANTITY');
    }

    // Parse and validate quantity via MathPrecision
    let qtyMicro: bigint;
    try {
      qtyMicro = MathPrecision.parseQtyToMicro(dto.quantity);
    } catch (e: any) {
      throw new AppError(e?.message || 'Invalid quantity format', 400, 'INVALID_QUANTITY');
    }

    // 5. Apply instrument-specific quantity-step rules & 7. min order quantity
    const qtyCheck = MathPrecision.isValidQuantity(
      qtyMicro,
      instrument.minOrderQuantityMicro,
      instrument.quantityStepMicro
    );
    if (!qtyCheck.valid) {
      throw new AppError(qtyCheck.error || 'Invalid order quantity', 400, 'INVALID_QUANTITY');
    }

    // 4. Validate price & 5. tick-size & 6. notional calculation
    let priceBasis = 0n;
    let priceNum = 0;
    let notionalCents = 0n;

    if (orderType === 'LIMIT') {
      if (dto.price === undefined || dto.price === null || Number(dto.price) <= 0) {
        throw new AppError('Price must be greater than 0 for LIMIT orders', 400, 'INVALID_PRICE');
      }

      try {
        priceBasis = MathPrecision.parsePriceToBasis(dto.price);
      } catch (e: any) {
        throw new AppError(e?.message || 'Invalid price format', 400, 'INVALID_PRICE');
      }

      // 5. Apply instrument-specific tick-size rules
      if (!MathPrecision.isValidTickSize(priceBasis, instrument.tickSizeBasis)) {
        throw new AppError(
          `Price $${dto.price} does not conform to tick size ${instrument.tickSize}`,
          400,
          'INVALID_TICK_SIZE'
        );
      }

      priceNum = Number(MathPrecision.formatBasisToPrice(priceBasis, 2));

      // 6. Calculate notional using MathPrecision
      notionalCents = MathPrecision.calculateNotionalCents(priceBasis, qtyMicro);

      // 7. Validate minimum notional ($1.00 USD / 100 cents)
      if (!MathPrecision.isValidMinimumNotional(notionalCents, MathPrecision.MIN_NOTIONAL_CENTS)) {
        throw new AppError(
          `Order notional value of $${MathPrecision.formatCentsToCash(notionalCents)} does not meet the minimum requirement of $1.00 USD`,
          400,
          'MINIMUM_NOTIONAL_NOT_MET'
        );
      }
    } else {
      // MARKET order
      if (dto.price !== undefined && dto.price !== null && Number(dto.price) > 0) {
        priceBasis = MathPrecision.parsePriceToBasis(dto.price);
        priceNum = Number(MathPrecision.formatBasisToPrice(priceBasis, 2));
        notionalCents = MathPrecision.calculateNotionalCents(priceBasis, qtyMicro);
      } else {
        // Derive reference price from opposing order book top or baseline reference
        const engine = EngineManager.getInstance().getEngine(canonicalSymbol);
        const book = engine.getOrderBook();
        const oppositeLevel = side === 'BUY' ? book.asks[0] : book.bids[0];
        const refBasis = oppositeLevel
          ? MathPrecision.parsePriceToBasis(oppositeLevel.price)
          : instrument.baselinePriceBasis;
        priceNum = 0;
        priceBasis = 0n;
        notionalCents = MathPrecision.calculateNotionalCents(refBasis, qtyMicro);
      }

      // 7. Validate minimum notional for market order based on reference price
      if (!MathPrecision.isValidMinimumNotional(notionalCents, MathPrecision.MIN_NOTIONAL_CENTS)) {
        throw new AppError(
          `Order notional value of $${MathPrecision.formatCentsToCash(notionalCents)} does not meet the minimum requirement of $1.00 USD`,
          400,
          'MINIMUM_NOTIONAL_NOT_MET'
        );
      }
    }

    const qtyNum = Number(MathPrecision.formatMicroToQty(qtyMicro));

    // Authoritative server timestamp (never derived from client payload)
    const evalDate = TimeProvider.now();

    // 8. Session check via MarketSessionManager
    const sessionResult = MarketSessionManager.canExecuteImmediately(canonicalSymbol, orderType, evalDate);

    if (!sessionResult.allowed && !sessionResult.queueAsAmo) {
      throw new AppError(
        sessionResult.reason || 'Trading session closed for instrument',
        400,
        'MARKET_CLOSED'
      );
    }

    const orderId = `${side.toLowerCase()}_${Date.now()}_${randomUUID().substring(0, 8)}`;
    const adapter = FundsReservationAdapterFactory.getAdapter();

    // Reserve funds (NoOp returns SIMULATED_NOOP preview)
    const reservation: ReservationResult = (adapter as any).reserveFundsSync
      ? (adapter as any).reserveFundsSync({
          orderId,
          userId: dto.userId || 'simulated_user',
          symbol: canonicalSymbol,
          side: side,
          price: priceNum,
          quantity: qtyNum,
          notionalCashCents: notionalCents,
        })
      : {
          success: true,
          reservationId: `noop_res_${orderId}`,
          status: 'SIMULATED_NOOP',
          reservedAmountCents: notionalCents,
          message: 'Simulated NoOp reservation preview (Phase 02). Guaranteed wallet backing activates in Phase 05.',
        };

    const priceStr = MathPrecision.formatBasisToPrice(priceBasis, 2);
    const qtyStr = MathPrecision.formatMicroToQty(qtyMicro);

    // If outside regular hours and eligible for AMO queueing
    if (sessionResult.queueAsAmo) {
      const amoOrder: Order = {
        id: orderId,
        side: side,
        type: orderType,
        price: priceNum,
        quantity: qtyNum,
        remainingQuantity: qtyNum,
        status: 'QUEUED_AMO',
        createdAt: evalDate.toISOString(),
        symbol: canonicalSymbol,
        userId: dto.userId,
        ownerType: 'USER',
        priceBasis,
        quantityMicro: qtyMicro,
        remainingQuantityMicro: qtyMicro,
        priceStr,
        quantityStr: qtyStr,
        originalQuantity: qtyStr,
        originalQuantityStr: qtyStr,
        remainingQuantityStr: qtyStr,
        filledQuantityStr: '0',
        filledQuantity: 0,
      };

      // 10. Persist resulting order information
      OrderModel.create(amoOrder);
      WebSocketService.broadcastStateUpdates();

      // 11. Return consistent API response
      return { order: amoOrder, trades: [], reservation };
    }

    // Regular trading session execution
    const newOrder: Order = {
      id: orderId,
      side: side,
      type: orderType,
      price: priceNum,
      quantity: qtyNum,
      remainingQuantity: qtyNum,
      status: 'PENDING',
      createdAt: evalDate.toISOString(),
      symbol: canonicalSymbol,
      userId: dto.userId,
      ownerType: 'USER',
      priceBasis,
      quantityMicro: qtyMicro,
      remainingQuantityMicro: qtyMicro,
      priceStr,
      quantityStr: qtyStr,
      originalQuantity: qtyStr,
      originalQuantityStr: qtyStr,
      remainingQuantityStr: qtyStr,
      filledQuantityStr: '0',
      filledQuantity: 0,
    };

    // 10. Save initial order in SQLite DB
    OrderModel.create(newOrder);

    // 9. Route order to correct engine through EngineManager
    const engine = EngineManager.getInstance().getEngine(canonicalSymbol);

    // Process order through matching engine
    const { order, trades } = engine.processOrder(newOrder);

    // Check for MARKET order with no opposite-side liquidity
    if (newOrder.type === 'MARKET' && trades.length === 0) {
      newOrder.status = 'CANCELLED';
      OrderModel.update(newOrder);
      if ((adapter as any).releaseReservationSync) {
        (adapter as any).releaseReservationSync(orderId);
      } else {
        adapter.releaseReservation(orderId);
      }
      WebSocketService.broadcastStateUpdates();
      throw new AppError('No liquidity available', 400, 'NO_LIQUIDITY');
    }

    // Update remaining and filled decimal string properties
    const remMicro = order.remainingQuantityMicro ?? MathPrecision.parseQtyToMicro(order.remainingQuantity);
    const filledMicro = qtyMicro - remMicro;
    order.remainingQuantityStr = MathPrecision.formatMicroToQty(remMicro);
    order.filledQuantityStr = MathPrecision.formatMicroToQty(filledMicro);
    order.filledQuantity = Number(order.quantityStr) - Number(order.remainingQuantityStr);

    // Commit funds reservation upon successful admission
    if ((adapter as any).commitReservationSync) {
      (adapter as any).commitReservationSync(orderId);
    } else {
      adapter.commitReservation(orderId);
    }

    // Broadcast updated state to all connected WebSockets
    WebSocketService.broadcastStateUpdates();

    // 11. Return consistent API response
    return { order, trades, reservation };
  }

  static getOrderById(id: string): Order {
    const order = OrderModel.findById(id);
    if (!order) {
      throw new AppError(`Order with ID '${id}' not found`, 404, 'ORDER_NOT_FOUND');
    }
    return order;
  }

  static cancelOrder(id: string, requestingUserId?: string): Order {
    const order = this.getOrderById(id);
    if (order.status === 'FILLED' || order.status === 'CANCELLED') {
      throw new AppError(`Cannot cancel order in status ${order.status}`, 400, 'INVALID_ORDER_STATE');
    }

    // Ownership check: If order is owned by SIMULATOR, regular users cannot cancel it
    if (order.ownerType === 'SIMULATOR' && requestingUserId && requestingUserId !== 'SIMULATOR') {
      throw new AppError('Cannot cancel system simulator order', 403, 'FORBIDDEN');
    }

    // If order has a userId and requestingUserId is provided and mismatches, reject
    if (order.userId && requestingUserId && requestingUserId !== 'SIMULATOR' && order.userId !== requestingUserId) {
      throw new AppError('Unauthorized: Order belongs to another user', 403, 'FORBIDDEN');
    }

    const canonical = InstrumentRegistry.getCanonicalSymbol(order.symbol || 'BYTE-USD');
    const engine = EngineManager.getInstance().getEngine(canonical);

    // Cancel in matching engine memory
    engine.cancelOrder(id);
    matchingEngine.cancelOrder(id);

    // Cancel in database
    const success = OrderModel.cancel(id);
    if (!success) {
      throw new AppError('Failed to cancel order', 400, 'CANCELLATION_FAILED');
    }

    // Release funds reservation
    const adapter = FundsReservationAdapterFactory.getAdapter();
    if ((adapter as any).releaseReservationSync) {
      (adapter as any).releaseReservationSync(id);
    } else {
      adapter.releaseReservation(id);
    }

    // Broadcast updated state to all connected WebSockets
    WebSocketService.broadcastStateUpdates();

    return { ...order, status: 'CANCELLED' };
  }

  static getAllOrders(limit?: number, offset?: number): Order[] {
    return OrderModel.getAll(limit, offset);
  }

  static getOrdersPaginated(options: {
    limit?: number;
    offset?: number;
    status?: string;
    search?: string;
  }): { orders: Order[]; total: number } {
    return OrderModel.getPaginated(options);
  }

  static resetExchange(): void {
    try {
      db.prepare('DELETE FROM amo_dispatch_log').run();
    } catch (_) {}
    db.prepare('DELETE FROM trades').run();
    db.prepare('DELETE FROM orders').run();

    matchingEngine.reset();
    EngineManager.getInstance().resetAll();
    const adapter = FundsReservationAdapterFactory.getAdapter();
    (adapter as any).clear?.();

    WebSocketService.broadcastStateUpdates();
  }
}
