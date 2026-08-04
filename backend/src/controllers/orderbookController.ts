import { Request, Response, NextFunction } from 'express';

export class OrderbookController {
  static getOrderBook(_req: Request, res: Response, next: NextFunction): void {
    try {
      // OrderBook snapshot will be fetched from MatchingEngine (integrated in Milestone 3)
      res.status(200).json({
        success: true,
        data: {
          bids: [],
          asks: [],
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
