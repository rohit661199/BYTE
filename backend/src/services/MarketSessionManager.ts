import { Order, OrderType, SessionValidationResult, IFundsReservationAdapter } from '../types/index.js';
import { InstrumentRegistry, Instrument } from './InstrumentRegistry.js';
import { ExchangeCalendar } from './ExchangeCalendar.js';
import { OrderModel } from '../models/orderModel.js';
import { TradeModel } from '../models/tradeModel.js';
import { EngineManager } from '../matching-engine/EngineManager.js';
import { MathPrecision } from '../utils/MathPrecision.js';
import { FundsReservationAdapterFactory } from './FundsReservationAdapter.js';
import { TimeProvider } from '../utils/TimeProvider.js';
import { logger } from '../utils/logger.js';

export interface AmoValidationResult {
  valid: boolean;
  reason?: string;
}

export interface AmoDispatchSummary {
  dispatched: number;
  rejected: number;
  skipped: number;
  total: number;
  results: Array<{
    orderId: string;
    symbol: string;
    status: 'DISPATCHED' | 'REJECTED' | 'SKIPPED';
    reason?: string;
  }>;
}

/**
 * MarketSessionManager governs multi-asset trading sessions, order admission,
 * after-market order (AMO) queuing, market-open revalidation, and ±10% price collar enforcement.
 */
export class MarketSessionManager {
  /**
   * Evaluates whether an incoming order can be admitted immediately to the matching engine,
   * queued as an AMO, or rejected outright.
   */
  public static canExecuteImmediately(
    symbolOrAlias: string,
    orderType: OrderType,
    date: Date = new Date()
  ): SessionValidationResult {
    const canonical = InstrumentRegistry.getCanonicalSymbol(symbolOrAlias);
    const instrument = InstrumentRegistry.getInstrument(canonical);

    if (!instrument) {
      return {
        allowed: false,
        reason: `Unknown or untradable instrument: ${symbolOrAlias}`,
        canonicalSymbol: canonical,
      };
    }

    // 1. Crypto and Utility instruments trade 24/7/365 continuously
    if (instrument.sessionType === 'CRYPTO_24_7') {
      return {
        allowed: true,
        session: 'REGULAR',
        canonicalSymbol: canonical,
      };
    }

    // 2. US Equities follow the ExchangeCalendar schedule
    const session = ExchangeCalendar.getSession(date);

    if (session === 'REGULAR') {
      return {
        allowed: true,
        session: 'REGULAR',
        canonicalSymbol: canonical,
      };
    }

    // 3. Outside regular hours (Pre-market, After-hours, Closed, Holidays, Weekends)
    if (orderType === 'MARKET') {
      // Market orders are rejected outside regular trading hours per v2.4.0 policy
      return {
        allowed: false,
        queueAsAmo: false,
        session,
        canonicalSymbol: canonical,
        reason: 'Market orders for equities are rejected outside regular trading hours (09:30 - 16:00 ET). Please submit a Limit order to queue an After-Market Order (AMO).',
      };
    }

    // Limit orders are admitted as Queued AMOs
    return {
      allowed: false,
      queueAsAmo: true,
      session,
      canonicalSymbol: canonical,
      reason: 'Equity market is outside regular hours. Limit order queued as After-Market Order (AMO) for market open.',
    };
  }

  /**
   * Revalidates a queued AMO at market open prior to engine dispatch.
   * Enforces instrument tradability, tick size, quantity step, and ±10% price collar.
   */
  public static validateAmoOrder(order: Order, referencePrice?: number): AmoValidationResult {
    const symbol = order.symbol || 'BYTE-USD';
    const instrument = InstrumentRegistry.getInstrument(symbol);

    if (!instrument) {
      return {
        valid: false,
        reason: `Instrument ${symbol} is not registered or untradable`,
      };
    }

    // 1. Reference price for ±10% price collar
    const refPrice = referencePrice ?? instrument.baselinePrice;
    if (refPrice > 0) {
      // Round to 4 decimal places for comparison
      const lowerCollar = Math.round(refPrice * 0.9 * 10000) / 10000;
      const upperCollar = Math.round(refPrice * 1.1 * 10000) / 10000;

      if (order.price < lowerCollar || order.price > upperCollar) {
        return {
          valid: false,
          reason: `Order price $${order.price} violates ±10% price collar ($${lowerCollar.toFixed(2)} - $${upperCollar.toFixed(2)}) based on reference price $${refPrice.toFixed(2)}`,
        };
      }
    }

    // 2. Tick size alignment
    try {
      const priceBasis = MathPrecision.parsePriceToBasis(order.price);
      if (priceBasis % instrument.tickSizeBasis !== 0n) {
        return {
          valid: false,
          reason: `Order price $${order.price} does not align with tick size ${instrument.tickSize}`,
        };
      }
    } catch (_) {
      return { valid: false, reason: `Invalid order price representation: ${order.price}` };
    }

    // 3. Minimum quantity & lot step alignment
    if (order.quantity < instrument.minOrderQuantity) {
      return {
        valid: false,
        reason: `Order quantity ${order.quantity} is below minimum allowed ${instrument.minOrderQuantity}`,
      };
    }

    try {
      const qtyMicro = MathPrecision.parseQtyToMicro(order.quantity);
      if (qtyMicro % instrument.quantityStepMicro !== 0n) {
        return {
          valid: false,
          reason: `Order quantity ${order.quantity} does not align with lot step ${instrument.quantityStep}`,
        };
      }
    } catch (_) {
      return { valid: false, reason: `Invalid order quantity representation: ${order.quantity}` };
    }

    return { valid: true };
  }

  /**
   * Market Open Dispatcher:
   * Revalidates and dispatches all queued AMOs for the given symbol (or all symbols) at market open.
   * Atomically coordinates with OrderModel and IFundsReservationAdapter.
   */
  public static async dispatchMarketOpenAmos(
    symbol?: string,
    customReservationAdapter?: IFundsReservationAdapter
  ): Promise<AmoDispatchSummary> {
    const reservationAdapter = customReservationAdapter || FundsReservationAdapterFactory.getAdapter();
    const queuedAmos = OrderModel.getQueuedAmoOrders(symbol);

    const summary: AmoDispatchSummary = {
      dispatched: 0,
      rejected: 0,
      skipped: 0,
      total: queuedAmos.length,
      results: [],
    };

    logger.info(`[MarketSessionManager] Dispatching ${queuedAmos.length} queued AMOs for symbol: ${symbol || 'ALL'}...`);

    for (const amo of queuedAmos) {
      // 1. Revalidate order against current tradability, tick size, and price collar
      const validation = this.validateAmoOrder(amo);

      if (!validation.valid) {
        logger.warn(`[MarketSessionManager] Rejecting AMO ${amo.id}: ${validation.reason}`);
        // Reject in database
        OrderModel.rejectAmo(amo.id);
        // Release funds reservation
        await reservationAdapter.releaseReservation(amo.id);

        summary.rejected++;
        summary.results.push({
          orderId: amo.id,
          symbol: amo.symbol || 'BYTE-USD',
          status: 'REJECTED',
          reason: validation.reason,
        });
        continue;
      }

      // 2. Durable atomic dispatch claim
      const dispatchSuccess = OrderModel.claimAmoDispatch(amo.id);
      if (!dispatchSuccess) {
        logger.warn(`[MarketSessionManager] Skipping AMO ${amo.id} (already dispatched, cancelled, or modified)`);
        summary.skipped++;
        summary.results.push({
          orderId: amo.id,
          symbol: amo.symbol || 'BYTE-USD',
          status: 'SKIPPED',
          reason: 'Order status changed or already dispatched',
        });
        continue;
      }

      try {
        // 3. Commit funds reservation
        await reservationAdapter.commitReservation(amo.id);

        // 4. Inject into the MatchingEngine for the canonical instrument
        const canonical = InstrumentRegistry.getCanonicalSymbol(amo.symbol || 'BYTE-USD');
        const engine = EngineManager.getInstance().getEngine(canonical);

        // Process order in engine with active PENDING status
        const activeOrder: Order = {
          ...amo,
          status: 'PENDING',
          symbol: canonical,
          dispatchedAt: TimeProvider.now().toISOString(),
        };

        engine.processOrder(activeOrder);

        // 5. Mark durable dispatch as completed
        OrderModel.completeAmoDispatch(amo.id);

        summary.dispatched++;
        summary.results.push({
          orderId: amo.id,
          symbol: canonical,
          status: 'DISPATCHED',
        });
        logger.info(`[MarketSessionManager] Successfully dispatched AMO ${amo.id} to ${canonical} matching engine`);
      } catch (err: any) {
        logger.error(`[MarketSessionManager] Engine execution error for dispatched AMO ${amo.id}:`, err);

        // TRANSACTION-SAFE RECONCILIATION:
        // Before marking REJECTED or releasing reservations, inspect what was actually persisted in SQLite!
        const persistedTrades = TradeModel.findByOrderId(amo.id);

        if (persistedTrades.length === 0) {
          // No trades occurred. Safe to mark REJECTED and release reservation.
          OrderModel.update({
            ...amo,
            status: 'REJECTED',
          });
          OrderModel.failAmoDispatch(amo.id, err.message);
          await reservationAdapter.releaseReservation(amo.id);

          summary.rejected++;
          summary.results.push({
            orderId: amo.id,
            symbol: amo.symbol || 'BYTE-USD',
            status: 'REJECTED',
            reason: err.message || 'Execution error during market open dispatch',
          });
        } else {
          // Trades WERE persisted! We must NEVER mark the order REJECTED or wipe out the reservation!
          const executedQty = persistedTrades.reduce((acc, t) => acc + t.quantity, 0);
          const remainingQty = Math.max(0, amo.quantity - executedQty);

          const finalStatus = remainingQty === 0 ? 'FILLED' : 'PARTIALLY_FILLED';
          OrderModel.update({
            ...amo,
            status: finalStatus,
            remainingQuantity: remainingQty,
          });
          OrderModel.completeAmoDispatch(amo.id);

          if (finalStatus === 'PARTIALLY_FILLED') {
            const canonical = InstrumentRegistry.getCanonicalSymbol(amo.symbol || 'BYTE-USD');
            const engine = EngineManager.getInstance().getEngine(canonical);
            engine.hydrateFromDatabase();
          }

          summary.dispatched++;
          summary.results.push({
            orderId: amo.id,
            symbol: amo.symbol || 'BYTE-USD',
            status: 'DISPATCHED',
            reason: `Preserved ${persistedTrades.length} trade(s) with ${executedQty} units filled prior to engine interruption`,
          });
        }
      }
    }

    return summary;
  }

  /**
   * Reconciles interrupted AMOs upon server restart.
   * Identifies orders that were CLAIMED for dispatch but interrupted before completion.
   * Recovery is idempotent and never creates duplicate trades or fills.
   */
  public static async reconcileDispatchedAmos(
    customReservationAdapter?: IFundsReservationAdapter
  ): Promise<{ recovered: number; requeued: number; finalized: number }> {
    const reservationAdapter = customReservationAdapter || FundsReservationAdapterFactory.getAdapter();
    const interruptedOrders = OrderModel.getInterruptedAmoDispatches();

    let recovered = 0;
    let requeued = 0;
    let finalized = 0;

    logger.info(`[MarketSessionManager] Recovery check: ${interruptedOrders.length} interrupted AMO(s) found.`);

    for (const order of interruptedOrders) {
      const canonical = InstrumentRegistry.getCanonicalSymbol(order.symbol || 'BYTE-USD');
      const persistedTrades = TradeModel.findByOrderId(order.id);
      const totalFilled = persistedTrades.reduce((sum, t) => sum + t.quantity, 0);
      const dispatchLog = OrderModel.getAmoDispatchLog(order.id);
      const wasAcceptedByEngine = dispatchLog?.engine_accepted_at != null;

      if (persistedTrades.length > 0) {
        // Case 1: Interrupted after some trades were executed
        if (totalFilled >= order.quantity) {
          // Fully filled
          OrderModel.completeAmoRecovery(order, 'FILLED', 0);
          await reservationAdapter.commitReservation(order.id);
          finalized++;
        } else {
          // Partially filled: preserve existing trades and update status atomically
          const remaining = order.quantity - totalFilled;
          OrderModel.completeAmoRecovery(order, 'PARTIALLY_FILLED', remaining);
          await reservationAdapter.commitReservation(order.id);

          // Hydrate the unfilled remaining order into the engine so it rests without duplicate trades
          const engine = EngineManager.getInstance().getEngine(canonical);
          engine.hydrateFromDatabase();
          finalized++;
        }
      } else if (wasAcceptedByEngine) {
        // Case 2: Zero trades, but ALREADY accepted by MatchingEngine as a resting order!
        // DO NOT re-submit to engine (which would duplicate order-book entries).
        // Simply complete the dispatch log and commit reservation.
        // Engine hydration will restore the single resting order book entry.
        OrderModel.completeAmoDispatch(order.id);
        await reservationAdapter.commitReservation(order.id);
        finalized++;
        logger.info(
          `[MarketSessionManager] Finalized resting zero-trade AMO ${order.id} without re-submission (engine_accepted_at: ${dispatchLog.engine_accepted_at})`
        );
      } else {
        // Case 3: Zero trades and NOT accepted by engine before crash (Claimed but crashed before processOrder)
        if (ExchangeCalendar.isMarketOpen()) {
          // Market is currently OPEN: safely process order
          try {
            const engine = EngineManager.getInstance().getEngine(canonical);
            await reservationAdapter.commitReservation(order.id);
            engine.processOrder({
              ...order,
              status: 'PENDING',
              symbol: canonical,
              dispatchedAt: TimeProvider.now().toISOString(),
            });
            OrderModel.completeAmoDispatch(order.id);
            recovered++;
          } catch (err: any) {
            logger.error(`[MarketSessionManager] Recovery execution failed for order ${order.id}:`, err);
            const trades = TradeModel.findByOrderId(order.id);
            if (trades.length === 0) {
              OrderModel.update({ ...order, status: 'REJECTED' });
              OrderModel.failAmoDispatch(order.id, err.message);
              await reservationAdapter.releaseReservation(order.id);
            } else {
              const executed = trades.reduce((sum, t) => sum + t.quantity, 0);
              const remaining = Math.max(0, order.quantity - executed);
              const finalStatus = remaining === 0 ? 'FILLED' : 'PARTIALLY_FILLED';
              OrderModel.completeAmoRecovery(order, finalStatus, remaining);
              await reservationAdapter.commitReservation(order.id);
              finalized++;
            }
          }
        } else {
          // Market is CLOSED: safely reset back to QUEUED_AMO to wait for next market open
          OrderModel.resetInterruptedAmo(order.id);
          requeued++;
        }
      }
    }

    logger.info(
      `[MarketSessionManager] Recovery complete: ${recovered} dispatched to open market, ${requeued} reset to QUEUED_AMO, ${finalized} finalized partial/full/resting fills.`
    );

    return { recovered, requeued, finalized };
  }
}
