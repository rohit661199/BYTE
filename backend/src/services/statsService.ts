import { OrderModel } from '../models/orderModel.js';
import { TradeModel } from '../models/tradeModel.js';
import { ExchangeStats } from '../types/index.js';

export class StatsService {
  static getStats(): ExchangeStats {
    const orderCounts = OrderModel.getCounts();
    const tradeStats = TradeModel.getStats();

    return {
      totalBuyOrders: orderCounts.totalBuy,
      totalSellOrders: orderCounts.totalSell,
      totalTradesExecuted: tradeStats.totalTrades,
      totalVolume: Math.round(tradeStats.totalVolume * 100) / 100,
    };
  }
}
