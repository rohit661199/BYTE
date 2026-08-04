import { TradeModel } from '../models/tradeModel.js';
import { Trade } from '../types/index.js';

export class TradeService {
  static getRecentTrades(limit = 50): Trade[] {
    return TradeModel.getRecentTrades(limit);
  }
}
