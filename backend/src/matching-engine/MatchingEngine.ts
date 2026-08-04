import { Order, Trade, OrderBook, OrderBookLevel, OrderSide } from '../types/index.js';
import { OrderModel } from '../models/orderModel.js';
import { TradeModel } from '../models/tradeModel.js';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

export class MatchingEngine {
  // In-Memory Order Books
  // Bids: Sorted descending by price (highest first), then ascending by createdAt (oldest first)
  private bids: Order[] = [];

  // Asks: Sorted ascending by price (lowest first), then ascending by createdAt (oldest first)
  private asks: Order[] = [];

  constructor() {
    this.hydrateFromDatabase();
  }

  /**
   * Hydrates the in-memory engine state from SQLite on server startup.
   */
  public hydrateFromDatabase(): void {
    logger.info('Hydrating matching engine from persistent database...');
    const activeOrders = OrderModel.getActiveOrders();

    this.bids = [];
    this.asks = [];

    for (const order of activeOrders) {
      if (order.side === 'BUY') {
        this.insertBid(order);
      } else {
        this.insertAsk(order);
      }
    }

    logger.info(
      `Matching engine hydrated successfully. Active Bids: ${this.bids.length}, Active Asks: ${this.asks.length}`
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

    // Persist incoming order state update
    OrderModel.update(incomingOrder);

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

      // Calculate fill quantity
      const matchQuantity = Math.min(buyOrder.remainingQuantity, bestAsk.remainingQuantity);
      const executionPrice = bestAsk.price; // Trade executes at resting maker price

      // Execute trade
      buyOrder.remainingQuantity -= matchQuantity;
      bestAsk.remainingQuantity -= matchQuantity;

      buyOrder.status = buyOrder.remainingQuantity === 0 ? 'FILLED' : 'PARTIALLY_FILLED';
      bestAsk.status = bestAsk.remainingQuantity === 0 ? 'FILLED' : 'PARTIALLY_FILLED';

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

      // Calculate fill quantity
      const matchQuantity = Math.min(sellOrder.remainingQuantity, bestBid.remainingQuantity);
      const executionPrice = bestBid.price; // Trade executes at resting maker price

      // Execute trade
      sellOrder.remainingQuantity -= matchQuantity;
      bestBid.remainingQuantity -= matchQuantity;

      sellOrder.status = sellOrder.remainingQuantity === 0 ? 'FILLED' : 'PARTIALLY_FILLED';
      bestBid.status = bestBid.remainingQuantity === 0 ? 'FILLED' : 'PARTIALLY_FILLED';

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
    const bidIndex = this.bids.findIndex((o) => o.id === orderId);
    if (bidIndex !== -1) {
      this.bids.splice(bidIndex, 1);
      return true;
    }

    const askIndex = this.asks.findIndex((o) => o.id === orderId);
    if (askIndex !== -1) {
      this.asks.splice(askIndex, 1);
      return true;
    }

    return false;
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
   * Helper: Inserts a BUY order into bids array upholding Price-Time Priority.
   * Highest Price first; if same price, oldest createdAt first.
   */
  private insertBid(order: Order): void {
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

// Global Singleton Instance of the Engine
export const matchingEngine = new MatchingEngine();
