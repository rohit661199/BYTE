import { Request, Response, NextFunction } from 'express';
import { matchingEngine } from '../matching-engine/MatchingEngine.js';

export class OrderbookController {
  static getOrderBook(_req: Request, res: Response, next: NextFunction): void {
    try {
      matchingEngine.hydrateFromDatabase();
      const orderBook = matchingEngine.getOrderBookSnapshot();
      res.status(200).json({
        success: true,
        data: orderBook,
      });
    } catch (error) {
      next(error);
    }
  }
}
