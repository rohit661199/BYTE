import { Request, Response, NextFunction } from 'express';
import { TradeService } from '../services/tradeService.js';
import { Trade } from '../types/index.js';

export function formatTradeResponse(trade: Trade) {
  return {
    id: trade.id,
    buyOrderId: trade.buyOrderId,
    sellOrderId: trade.sellOrderId,
    price: trade.price,
    quantity: trade.quantity,
    timestamp: trade.timestamp,
    symbol: trade.symbol || 'BYTE-USD',
    priceBasis: trade.priceBasis != null ? trade.priceBasis.toString() : undefined,
    quantityMicro: trade.quantityMicro != null ? trade.quantityMicro.toString() : undefined,
    priceStr: trade.priceStr ?? trade.price.toString(),
    quantityStr: trade.quantityStr ?? trade.quantity.toString(),
  };
}

export class TradeController {
  static getTrades(req: Request, res: Response, next: NextFunction): void {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const trades = TradeService.getRecentTrades(limit);
      res.status(200).json({
        success: true,
        data: trades.map(formatTradeResponse),
      });
    } catch (error) {
      next(error);
    }
  }
}
