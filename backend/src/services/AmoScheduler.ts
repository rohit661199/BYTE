import { ExchangeCalendar } from './ExchangeCalendar.js';
import { MarketSessionManager, AmoDispatchSummary } from './MarketSessionManager.js';
import { OrderModel } from '../models/orderModel.js';
import { logger } from '../utils/logger.js';

/**
 * AmoScheduler coordinates automatic dispatch of Queued After-Market Orders (AMOs)
 * at official US Equity regular market open (09:30:00 ET).
 *
 * Handles:
 * - Server startup before market open: schedules timer for upcoming 09:30:00 ET.
 * - Server startup after market open: catches up on pending queued AMOs if market is open.
 * - Server restarts with queued AMOs in SQLite: reconciles and triggers dispatch appropriately.
 * - Concurrency lock: prevents duplicate or overlapping scheduler executions.
 * - Multi-asset FIFO ordering: dispatches all queued instruments cleanly.
 */
export class AmoScheduler {
  private static timer: NodeJS.Timeout | null = null;
  private static running: boolean = false;
  private static isDispatching: boolean = false;

  /**
   * Starts the automatic AMO scheduler.
   */
  public static start(): void {
    if (this.running) {
      logger.info('[AmoScheduler] Scheduler is already active.');
      return;
    }

    this.running = true;
    logger.info('[AmoScheduler] Starting automatic market-open AMO scheduler...');

    // 1. Startup Durable Crash Recovery:
    // Reconcile any AMOs that were CLAIMED during dispatch when a crash or restart occurred.
    MarketSessionManager.reconcileDispatchedAmos()
      .then((rec) => {
        if (rec.recovered > 0 || rec.requeued > 0 || rec.finalized > 0) {
          logger.info(`[AmoScheduler] Startup recovery reconciled: ${JSON.stringify(rec)}`);
        }
        // 2. Startup Catch-up Check:
        // If the server is starting or restarting during regular market hours,
        // immediately check for and dispatch any queued AMOs.
        if (ExchangeCalendar.isMarketOpen()) {
          const pendingCount = OrderModel.getQueuedAmoOrders().length;
          if (pendingCount > 0) {
            logger.info(
              `[AmoScheduler] Startup catch-up: Market is currently OPEN with ${pendingCount} queued AMOs. Triggering dispatch immediately.`
            );
            this.triggerNow().catch((err) => {
              logger.error('[AmoScheduler] Error during startup catch-up dispatch:', err);
            });
          }
        } else {
          logger.info('[AmoScheduler] Market is currently CLOSED. Queued AMOs will dispatch at next market open.');
        }
      })
      .catch((err) => {
        logger.error('[AmoScheduler] Error during startup recovery:', err);
      });

    // 3. Schedule the next market open dispatch timer
    this.scheduleNextOpen();
  }

  /**
   * Stops the automatic scheduler and clears any pending timers.
   */
  public static stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.running = false;
    logger.info('[AmoScheduler] Automatic market-open AMO scheduler stopped.');
  }

  /**
   * Schedules a timer targeting the exact next regular session open date (09:30:00 ET).
   */
  public static scheduleNextOpen(): void {
    if (!this.running) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const nextOpen = ExchangeCalendar.getNextSessionOpen();
    const delayMs = Math.max(100, nextOpen.getTime() - Date.now());

    logger.info(
      `[AmoScheduler] Next regular market open scheduled for ${nextOpen.toISOString()} (in ${Math.round(
        delayMs / 1000
      )}s)`
    );

    // Node.js setTimeout handles delays up to 2^31 - 1 (~24.8 days)
    this.timer = setTimeout(async () => {
      try {
        logger.info('[AmoScheduler] Market open timer reached! Initiating AMO dispatch...');
        await this.triggerNow();
      } catch (err) {
        logger.error('[AmoScheduler] Error during scheduled market open dispatch:', err);
      } finally {
        // Re-arm for the next market session
        this.scheduleNextOpen();
      }
    }, delayMs);

    // Unref the timer so it does not block Node process exit during CLI / test runs
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  /**
   * Triggers market open AMO dispatch with concurrency protection against duplicate executions.
   */
  public static async triggerNow(symbol?: string): Promise<AmoDispatchSummary> {
    if (this.isDispatching) {
      logger.warn('[AmoScheduler] Dispatch already in progress. Skipping overlapping invocation.');
      return {
        dispatched: 0,
        rejected: 0,
        skipped: 0,
        total: 0,
        results: [],
      };
    }

    this.isDispatching = true;
    try {
      return await MarketSessionManager.dispatchMarketOpenAmos(symbol);
    } finally {
      this.isDispatching = false;
    }
  }

  public static isRunning(): boolean {
    return this.running;
  }

  public static isLocked(): boolean {
    return this.isDispatching;
  }
}
