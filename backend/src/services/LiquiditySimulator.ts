import { Instrument, InstrumentRegistry } from './InstrumentRegistry.js';
import { EngineManager } from '../matching-engine/EngineManager.js';
import { MarketSessionManager } from './MarketSessionManager.js';
import { OrderModel } from '../models/orderModel.js';
import { MathPrecision } from '../utils/MathPrecision.js';
import { TimeProvider } from '../utils/TimeProvider.js';
import { logger } from '../utils/logger.js';
import { Order, OwnerType } from '../types/index.js';
import { randomUUID } from 'crypto';

export const SIMULATOR_USER_ID = 'simulator-liquidity-provider';
export const SIMULATOR_OWNER_TYPE: OwnerType = 'SIMULATOR';

export interface SimulatorConfig {
  heartbeatIntervalMs: number;
  levelsPerSide: number;
  baseSpreadRatio: number; // default: 0.0010 (0.10% spread, between 0.05% and 0.15%)
}

export interface LiquidityRefreshResult {
  symbol: string;
  success: boolean;
  skipped?: boolean;
  reason?: string;
  ordersGenerated?: number;
  bidsCount?: number;
  asksCount?: number;
}

const DEFAULT_CONFIG: SimulatorConfig = {
  heartbeatIntervalMs: 3000,
  levelsPerSide: 5,
  baseSpreadRatio: 0.0010, // 0.10% inside spread
};

/**
 * LiquiditySimulator maintains realistic, controlled depth (5 bids and 5 asks)
 * for eligible instruments across regular market sessions and 24/7 crypto.
 *
 * Core Guarantees:
 * 1. Never cancels, modifies, or deletes user-owned orders.
 * 2. Only cleans up its own PENDING or PARTIALLY_FILLED orders on refresh.
 * 3. Preserves FILLED orders, completed trades, and historical fills.
 * 4. Generates orders strictly conforming to tick size and quantity step via MathPrecision.
 * 5. Controls spread between 0.05% and 0.15% around the reference price.
 * 6. Keeps benchmark referencePrice separate from internal execution prices.
 * 7. Submits generated orders through the existing MatchingEngine FIFO matching flow.
 */
export class LiquiditySimulator {
  private static timer: NodeJS.Timeout | null = null;
  private static running: boolean = false;
  private static refreshingSymbols: Set<string> = new Set<string>();
  private static config: SimulatorConfig = { ...DEFAULT_CONFIG };
  private static customReferencePrices: Map<string, number> = new Map<string, number>();

  /**
   * Starts the 3-second heartbeat loop. Idempotent: repeated calls do not create multiple loops.
   */
  public static start(intervalMs?: number): void {
    if (this.running) {
      logger.info('[LiquiditySimulator] Simulator heartbeat is already running.');
      return;
    }

    if (intervalMs && intervalMs > 0) {
      this.config.heartbeatIntervalMs = intervalMs;
    }

    this.running = true;
    logger.info(
      `[LiquiditySimulator] Starting liquidity simulator heartbeat (interval: ${this.config.heartbeatIntervalMs}ms)...`
    );

    // Run first tick immediately on startup (non-blocking)
    this.tick().catch((err) => {
      logger.error('[LiquiditySimulator] Error on initial heartbeat tick:', err);
    });

    this.timer = setInterval(async () => {
      try {
        await this.tick();
      } catch (err: any) {
        logger.error('[LiquiditySimulator] Error during heartbeat tick:', err);
      }
    }, this.config.heartbeatIntervalMs);

    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  /**
   * Stops the heartbeat loop cleanly.
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    this.refreshingSymbols.clear();
    logger.info('[LiquiditySimulator] Simulator heartbeat stopped cleanly.');
  }

  /**
   * Returns whether the simulator heartbeat loop is actively running.
   */
  public static isSimulatorRunning(): boolean {
    return this.running;
  }

  /**
   * Sets custom simulator configuration options.
   */
  public static setConfig(newConfig: Partial<SimulatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Resets configuration and custom reference prices back to defaults.
   */
  public static resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.customReferencePrices.clear();
  }

  /**
   * Allows test overrides of reference pricing without modifying InstrumentRegistry.
   */
  public static setCustomReferencePrice(symbol: string, price: number | null): void {
    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    if (price === null) {
      this.customReferencePrices.delete(canonical);
    } else {
      this.customReferencePrices.set(canonical, price);
    }
  }

  /**
   * Returns the pricing anchor for the instrument.
   * Keeps referencePrice benchmark separate from exchange execution price.
   */
  public static getReferencePrice(instrument: Instrument): number {
    const custom = this.customReferencePrices.get(instrument.symbol);
    if (custom != null && custom > 0) {
      return custom;
    }
    return instrument.baselinePrice;
  }

  /**
   * Executes a single heartbeat cycle across all registered instruments.
   * Isolates failures so that an individual instrument error never stops other instruments.
   */
  public static async tick(): Promise<Map<string, LiquidityRefreshResult>> {
    const instruments = InstrumentRegistry.getAllInstruments();
    const results = new Map<string, LiquidityRefreshResult>();

    for (const inst of instruments) {
      try {
        const res = await this.refreshInstrument(inst);
        results.set(inst.symbol, res);
      } catch (err: any) {
        logger.error(`[LiquiditySimulator] Unhandled error refreshing ${inst.symbol}:`, err);
        results.set(inst.symbol, {
          symbol: inst.symbol,
          success: false,
          reason: err.message || 'Unknown refresh error',
        });
      }
    }

    return results;
  }

  /**
   * Refreshes liquidity for a single instrument safely.
   */
  public static async refreshInstrument(symbolOrInstrument: string | Instrument): Promise<LiquidityRefreshResult> {
    const symbol = typeof symbolOrInstrument === 'string' ? symbolOrInstrument : symbolOrInstrument.symbol;
    const canonical = InstrumentRegistry.getCanonicalSymbol(symbol);
    const instrument = typeof symbolOrInstrument === 'string' ? InstrumentRegistry.getInstrument(canonical) : symbolOrInstrument;

    if (!instrument) {
      return { symbol: canonical, success: false, reason: `Unknown instrument: ${symbol}` };
    }

    // Avoid overlapping refresh operations for the same instrument
    if (this.refreshingSymbols.has(canonical)) {
      return { symbol: canonical, success: false, reason: 'Refresh already in progress for this instrument' };
    }
    this.refreshingSymbols.add(canonical);

    try {
      // 1. Session Eligibility Check:
      // Crypto operates 24/7; Equities require REGULAR session.
      const session = MarketSessionManager.canExecuteImmediately(canonical, 'LIMIT', TimeProvider.now());
      if (!session.allowed) {
        return {
          symbol: canonical,
          success: true,
          skipped: true,
          reason: `Market session not open for trading (${session.session || 'CLOSED'})`,
        };
      }

      // 2. Safe Simulator Order Cancellation:
      // Identifies and cancels ONLY simulator-owned pending or partially filled orders.
      // USER orders, FILLED historical orders, and trades are strictly preserved.
      OrderModel.cancelSimulatorOrders(canonical);

      // 3. Hydrate Matching Engine:
      // Re-reads active orders from SQLite, stripping cancelled simulator orders while preserving active user orders.
      const engine = EngineManager.getInstance().getEngine(canonical);
      engine.hydrateFromDatabase();

      // 4. Generate Order Levels around Reference Price
      const ordersToSubmit = this.generateLiquidityOrders(instrument);

      // 5. Submit orders through standard MatchingEngine order-submission flow
      for (const simOrder of ordersToSubmit) {
        engine.processOrder(simOrder);
      }

      return {
        symbol: canonical,
        success: true,
        ordersGenerated: ordersToSubmit.length,
        bidsCount: ordersToSubmit.filter((o) => o.side === 'BUY').length,
        asksCount: ordersToSubmit.filter((o) => o.side === 'SELL').length,
      };
    } finally {
      this.refreshingSymbols.delete(canonical);
    }
  }

  /**
   * Generates up to 5 buy limit orders and 5 sell limit orders around the reference price.
   * Conforms strictly to instrument tick size, lot step, and minimum notional requirements.
   */
  public static generateLiquidityOrders(instrument: Instrument): Order[] {
    const refPrice = this.getReferencePrice(instrument);
    const refBasis = MathPrecision.parsePriceToBasis(refPrice);
    const tickBasis = instrument.tickSizeBasis;
    const stepMicro = instrument.quantityStepMicro;
    const minQtyMicro = instrument.minOrderQuantityMicro;
    const levels = this.config.levelsPerSide; // up to 5 levels

    const halfSpreadRatio = this.config.baseSpreadRatio / 2; // e.g. 0.0005 (5 bps)

    // Realistic depth notionals (USD) that increase away from the inside market
    const bidNotionals = [2200, 3800, 6200, 9500, 14500];
    const askNotionals = [2000, 3500, 6000, 9000, 14000];

    const bids: Order[] = [];
    const asks: Order[] = [];
    const now = TimeProvider.now().toISOString();

    for (let i = 1; i <= levels; i++) {
      // Delta expands with each level away from inside market
      const spreadRatio_i = halfSpreadRatio + (i - 1) * 0.0004;
      const offsetDollars = refPrice * spreadRatio_i;
      const calcOffsetBasis = MathPrecision.parsePriceToBasis(offsetDollars);
      const minOffsetBasis = BigInt(i) * tickBasis;
      const offsetBasis = calcOffsetBasis > minOffsetBasis ? calcOffsetBasis : minOffsetBasis;

      // --- BID (BUY) ORDER ---
      // Floor bid price down to exact tick size
      let bidBasis = ((refBasis - offsetBasis) / tickBasis) * tickBasis;
      if (bidBasis >= refBasis) {
        bidBasis = refBasis - tickBasis;
      }
      if (bidBasis <= 0n) {
        bidBasis = tickBasis;
      }
      const bidPrice = Number(bidBasis) / 10000;

      // Quantity calculation conforming to quantity step and min notional
      const targetBidNotional = bidNotionals[i - 1] || 2000;
      const rawBidQty = targetBidNotional / refPrice;
      const rawBidMicro = MathPrecision.parseQtyToMicro(rawBidQty.toFixed(6));
      let bidQtyMicro = (rawBidMicro / stepMicro) * stepMicro;
      if (bidQtyMicro < minQtyMicro) {
        bidQtyMicro = minQtyMicro;
      }
      while (MathPrecision.calculateNotionalCents(bidBasis, bidQtyMicro) < 100n) {
        bidQtyMicro += stepMicro;
      }
      const bidQuantity = Number(bidQtyMicro) / 1_000_000;

      const bidOrder: Order = {
        id: `sim_${instrument.symbol}_bid_L${i}_${Date.now()}_${randomUUID().slice(0, 8)}`,
        side: 'BUY',
        type: 'LIMIT',
        price: bidPrice,
        quantity: bidQuantity,
        remainingQuantity: bidQuantity,
        status: 'PENDING',
        createdAt: now,
        symbol: instrument.symbol,
        userId: SIMULATOR_USER_ID,
        ownerType: 'SIMULATOR',
      };
      bids.push(bidOrder);

      // --- ASK (SELL) ORDER ---
      // Ceil ask price up to exact tick size
      let askBasis = ((refBasis + offsetBasis + tickBasis - 1n) / tickBasis) * tickBasis;
      if (askBasis <= refBasis) {
        askBasis = refBasis + tickBasis;
      }
      const askPrice = Number(askBasis) / 10000;

      // Quantity calculation conforming to quantity step and min notional
      const targetAskNotional = askNotionals[i - 1] || 2000;
      const rawAskQty = targetAskNotional / refPrice;
      const rawAskMicro = MathPrecision.parseQtyToMicro(rawAskQty.toFixed(6));
      let askQtyMicro = (rawAskMicro / stepMicro) * stepMicro;
      if (askQtyMicro < minQtyMicro) {
        askQtyMicro = minQtyMicro;
      }
      while (MathPrecision.calculateNotionalCents(askBasis, askQtyMicro) < 100n) {
        askQtyMicro += stepMicro;
      }
      const askQuantity = Number(askQtyMicro) / 1_000_000;

      const askOrder: Order = {
        id: `sim_${instrument.symbol}_ask_L${i}_${Date.now()}_${randomUUID().slice(0, 8)}`,
        side: 'SELL',
        type: 'LIMIT',
        price: askPrice,
        quantity: askQuantity,
        remainingQuantity: askQuantity,
        status: 'PENDING',
        createdAt: now,
        symbol: instrument.symbol,
        userId: SIMULATOR_USER_ID,
        ownerType: 'SIMULATOR',
      };
      asks.push(askOrder);
    }

    return [...bids, ...asks];
  }
}
