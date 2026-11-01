import { Order, Trade, OrderBook, OrderBookLevel, OrderSide } from '../types/index.js';
import { OrderModel } from '../models/orderModel.js';
import { TradeModel } from '../models/tradeModel.js';
import { MathPrecision } from '../utils/MathPrecision.js';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

export class MatchingEngine {
  // Canonical symbol this engine instance is responsible for
  public readonly symbol: string;

  // In-Memory Order Books
  // Bids: Sorted descending by price (highest first), then ascending by createdAt (oldest first)
  private bids: Order[] = [];

  // Asks: Sorted ascending by price (lowest first), then ascending by createdAt (oldest first)
  private asks: Order[] = [];

  constructor(symbol: string = 'BYTE-USD') {
    this.symbol = symbol === 'BYTE' ? 'BYTE-USD' : symbol;
    this.hydrateFromDatabase();
  }

  /**
   * Hydrates the in-memory engine state from SQLite on server startup.
   */
  public hydrateFromDatabase(): void {
    logger.info(`Hydrating matching engine for ${this.symbol} from persistent database...`);
    const activeOrders = OrderModel.getActiveOrders(this.symbol);

    this.bids = [];
    this.asks = [];

    for (const order of activeOrders) {
      if (order.type === 'MARKET') continue; // Market orders never rest on orderbooks
      if (order.side === 'BUY') {
        this.insertBid(order);
      } else {
        this.insertAsk(order);
      }
    }

    logger.info(
      `Matching engine [${this.symbol}] hydrated successfully. Active Bids: ${this.bids.length}, Active Asks: ${this.asks.length}`
    );
  }


  /**
   * Resets in-memory bids and asks orderbooks to empty state.
   */
  public reset(): void {
    this.bids = [];
    this.asks = [];
    logger.info('Matching engine in-memory state reset to empty.');
  }

  /**
   * Processes a newly submitted order through the matching algorithm.
   */
  public processOrder(incomingOrder: Order): { order: Order; trades: Trade[] } {
    const executedTrades: Trade[] = [];

    // Ensure order is persisted in SQLite DB before trade execution
    if (!OrderModel.findById(incomingOrder.id)) {
      OrderModel.create(incomingOrder);
    }

    if (incomingOrder.side === 'BUY') {
      this.matchBuyOrder(incomingOrder, executedTrades);
      if (incomingOrder.remainingQuantity > 0 && incomingOrder.type !== 'MARKET' && incomingOrder.status !== 'CANCELLED') {
        this.insertBid(incomingOrder);
      }
    } else {
      this.matchSellOrder(incomingOrder, executedTrades);
      if (incomingOrder.remainingQuantity > 0 && incomingOrder.type !== 'MARKET' && incomingOrder.status !== 'CANCELLED') {
        this.insertAsk(incomingOrder);
      }
    }

    // Ensure MARKET orders never remain pending or active after execution
    if (incomingOrder.type === 'MARKET') {
      if (incomingOrder.remainingQuantity > 0) {
        if (executedTrades.length === 0) {
          incomingOrder.status = 'CANCELLED';
        } else {
          incomingOrder.status = 'FILLED';
          incomingOrder.remainingQuantity = 0;
          incomingOrder.remainingQuantityMicro = 0n;
        }
      } else {
        incomingOrder.status = 'FILLED';
        incomingOrder.remainingQuantityMicro = 0n;
      }
    }

    // Persist incoming order state update and engine acceptance evidence atomically
    try {
      OrderModel.persistOrderAcceptance(incomingOrder);
    } catch (err: any) {
      logger.error(`[MatchingEngine] Failed to persist order acceptance for ${incomingOrder.id}:`, err);
      // Remove incoming order and synchronize in-memory state with SQLite
      if (incomingOrder.side === 'BUY') {
        this.bids = this.bids.filter((b) => b.id !== incomingOrder.id);
      } else {
        this.asks = this.asks.filter((a) => a.id !== incomingOrder.id);
      }
      this.hydrateFromDatabase();
      throw err;
    }

    return { order: incomingOrder, trades: executedTrades };
  }

  /**
   * Matches an incoming BUY order against resting ASK (SELL) orders.
   */
  private matchBuyOrder(buyOrder: Order, executedTrades: Trade[]): void {
    let index = 0;

    while (buyOrder.remainingQuantity > 0 && index < this.asks.length) {
      const bestAsk = this.asks[index];

      // Check price compatibility: For LIMIT orders, Buy Price must be >= Sell Price
      // For MARKET orders, match at best ask price regardless
      if (buyOrder.type === 'LIMIT' && buyOrder.price < bestAsk.price) {
        break; // No further compatible ask orders exist (since asks are sorted ascending)
      }

      // Calculate fill quantity using exact micro-units to prevent floating-point dust
      const buyRemMicro = buyOrder.remainingQuantityMicro ?? MathPrecision.parseQtyToMicro(buyOrder.remainingQuantity);
      const askRemMicro = bestAsk.remainingQuantityMicro ?? MathPrecision.parseQtyToMicro(bestAsk.remainingQuantity);
      const matchMicro = buyRemMicro < askRemMicro ? buyRemMicro : askRemMicro;

      const newBuyRemMicro = buyRemMicro - matchMicro;
      const newAskRemMicro = askRemMicro - matchMicro;

      buyOrder.remainingQuantityMicro = newBuyRemMicro;
      bestAsk.remainingQuantityMicro = newAskRemMicro;
      buyOrder.remainingQuantity = Number(MathPrecision.formatMicroToQty(newBuyRemMicro));
      bestAsk.remainingQuantity = Number(MathPrecision.formatMicroToQty(newAskRemMicro));

      const matchQuantity = Number(MathPrecision.formatMicroToQty(matchMicro));
      const executionPrice = bestAsk.price; // Trade executes at resting maker price

      buyOrder.status = newBuyRemMicro === 0n ? 'FILLED' : 'PARTIALLY_FILLED';
      bestAsk.status = newAskRemMicro === 0n ? 'FILLED' : 'PARTIALLY_FILLED';

      // Persist bestAsk status change
      OrderModel.update(bestAsk);

      // Create and persist Trade record
      const trade: Trade = {
        id: `trade_${Date.now()}_${randomUUID().substring(0, 8)}`,
        buyOrderId: buyOrder.id,
        sellOrderId: bestAsk.id,
        price: executionPrice,
        quantity: matchQuantity,
        timestamp: new Date().toISOString(),
        symbol: this.symbol,
        priceBasis: MathPrecision.parsePriceToBasis(executionPrice),
        quantityMicro: matchMicro,
      };

      TradeModel.create(trade);
      executedTrades.push(trade);

      logger.info(
        `Trade Executed! Price: $${executionPrice}, Qty: ${matchQuantity} | BuyOrder: ${buyOrder.id}, SellOrder: ${bestAsk.id}`
      );

      // If bestAsk is fully filled, remove from ask book, else increment index
      if (bestAsk.remainingQuantity === 0) {
        this.asks.splice(index, 1);
      } else {
        index++;
      }
    }
  }

  /**
   * Matches an incoming SELL order against resting BID (BUY) orders.
   */
  private matchSellOrder(sellOrder: Order, executedTrades: Trade[]): void {
    let index = 0;

    while (sellOrder.remainingQuantity > 0 && index < this.bids.length) {
      const bestBid = this.bids[index];

      // Check price compatibility: For LIMIT orders, Sell Price must be <= Buy Price
      // For MARKET orders, match at best bid price regardless
      if (sellOrder.type === 'LIMIT' && sellOrder.price > bestBid.price) {
        break; // No further compatible bid orders exist (since bids are sorted descending)
      }

      // Calculate fill quantity using exact micro-units to prevent floating-point dust
      const sellRemMicro = sellOrder.remainingQuantityMicro ?? MathPrecision.parseQtyToMicro(sellOrder.remainingQuantity);
      const bidRemMicro = bestBid.remainingQuantityMicro ?? MathPrecision.parseQtyToMicro(bestBid.remainingQuantity);
      const matchMicro = sellRemMicro < bidRemMicro ? sellRemMicro : bidRemMicro;

      const newSellRemMicro = sellRemMicro - matchMicro;
      const newBidRemMicro = bidRemMicro - matchMicro;

      sellOrder.remainingQuantityMicro = newSellRemMicro;
      bestBid.remainingQuantityMicro = newBidRemMicro;
      sellOrder.remainingQuantity = Number(MathPrecision.formatMicroToQty(newSellRemMicro));
      bestBid.remainingQuantity = Number(MathPrecision.formatMicroToQty(newBidRemMicro));

      const matchQuantity = Number(MathPrecision.formatMicroToQty(matchMicro));
      const executionPrice = sellOrder.type === 'MARKET' ? bestBid.price : sellOrder.price; // Trade executes at SELL order price per assignment spec

      sellOrder.status = newSellRemMicro === 0n ? 'FILLED' : 'PARTIALLY_FILLED';
      bestBid.status = newBidRemMicro === 0n ? 'FILLED' : 'PARTIALLY_FILLED';

      // Persist bestBid status change
      OrderModel.update(bestBid);

      // Create and persist Trade record
      const trade: Trade = {
        id: `trade_${Date.now()}_${randomUUID().substring(0, 8)}`,
        buyOrderId: bestBid.id,
        sellOrderId: sellOrder.id,
        price: executionPrice,
        quantity: matchQuantity,
        timestamp: new Date().toISOString(),
        symbol: this.symbol,
        priceBasis: MathPrecision.parsePriceToBasis(executionPrice),
        quantityMicro: matchMicro,
      };

      TradeModel.create(trade);
      executedTrades.push(trade);

      logger.info(
        `Trade Executed! Price: $${executionPrice}, Qty: ${matchQuantity} | BuyOrder: ${bestBid.id}, SellOrder: ${sellOrder.id}`
      );

      // If bestBid is fully filled, remove from bid book, else increment index
      if (bestBid.remainingQuantity === 0) {
        this.bids.splice(index, 1);
      } else {
        index++;
      }
    }
  }

  /**
   * Cancels an open order from the in-memory book.
   */
  public cancelOrder(orderId: string): boolean {
    let removed = false;
    let bidIndex: number;
    while ((bidIndex = this.bids.findIndex((o) => o.id === orderId)) !== -1) {
      this.bids.splice(bidIndex, 1);
      removed = true;
    }
    let askIndex: number;
    while ((askIndex = this.asks.findIndex((o) => o.id === orderId)) !== -1) {
      this.asks.splice(askIndex, 1);
      removed = true;
    }
    return removed;
  }

  /**
   * Generates a price-level aggregated snapshot of the current Order Book.
   */
  public getOrderBookSnapshot(): OrderBook {
    const bidsMap = new Map<number, { quantity: number; orderCount: number }>();
    const asksMap = new Map<number, { quantity: number; orderCount: number }>();

    for (const order of this.bids) {
      const existing = bidsMap.get(order.price) || { quantity: 0, orderCount: 0 };
      bidsMap.set(order.price, {
        quantity: existing.quantity + order.remainingQuantity,
        orderCount: existing.orderCount + 1,
      });
    }

    for (const order of this.asks) {
      const existing = asksMap.get(order.price) || { quantity: 0, orderCount: 0 };
      asksMap.set(order.price, {
        quantity: existing.quantity + order.remainingQuantity,
        orderCount: existing.orderCount + 1,
      });
    }

    const aggregatedBids: OrderBookLevel[] = Array.from(bidsMap.entries())
      .map(([price, data]) => ({ price, quantity: data.quantity, orderCount: data.orderCount }))
      .sort((a, b) => b.price - a.price); // Highest price first

    const aggregatedAsks: OrderBookLevel[] = Array.from(asksMap.entries())
      .map(([price, data]) => ({ price, quantity: data.quantity, orderCount: data.orderCount }))
      .sort((a, b) => a.price - b.price); // Lowest price first

    return {
      bids: aggregatedBids,
      asks: aggregatedAsks,
    };
  }

  /**
   * Alias for getOrderBookSnapshot
   */
  public getOrderBook(): OrderBook {
    return this.getOrderBookSnapshot();
  }

  /**
   * Helper: Inserts a BUY order into bids array upholding Price-Time Priority.
   * Highest Price first; if same price, oldest createdAt first.
   */
  private insertBid(order: Order): void {
    if (this.bids.some((b) => b.id === order.id)) {
      return;
    }
    let inserted = false;
    for (let i = 0; i < this.bids.length; i++) {
      if (
        order.price > this.bids[i].price ||
        (order.price === this.bids[i].price &&
          new Date(order.createdAt).getTime() < new Date(this.bids[i].createdAt).getTime())
      ) {
        this.bids.splice(i, 0, order);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.bids.push(order);
    }
  }

  /**
   * Helper: Inserts a SELL order into asks array upholding Price-Time Priority.
   * Lowest Price first; if same price, oldest createdAt first.
   */
  private insertAsk(order: Order): void {
    if (this.asks.some((a) => a.id === order.id)) {
      return;
    }
    let inserted = false;
    for (let i = 0; i < this.asks.length; i++) {
      if (
        order.price < this.asks[i].price ||
        (order.price === this.asks[i].price &&
          new Date(order.createdAt).getTime() < new Date(this.asks[i].createdAt).getTime())
      ) {
        this.asks.splice(i, 0, order);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.asks.push(order);
    }
  }
}

// Global Singleton Instance of the Engine (persisted on globalThis across serverless invocations)
const gEngine = globalThis as any;
if (!gEngine.__matchingEngine__) {
  gEngine.__matchingEngine__ = new MatchingEngine();
}
export const matchingEngine: MatchingEngine = gEngine.__matchingEngine__;
