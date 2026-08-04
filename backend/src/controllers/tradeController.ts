import { Request, Response, NextFunction } from 'express';
import { TradeService } from '../services/tradeService.js';

export class TradeController {
  static getTrades(req: Request, res: Response, next: NextFunction): void {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const trades = TradeService.getRecentTrades(limit);
      res.status(200).json({
        success: true,
        data: trades,
      });
    } catch (error) {
      next(error);
    }
  }
}
