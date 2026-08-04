import { Request, Response, NextFunction } from 'express';
import { StatsService } from '../services/statsService.js';

export class StatsController {
  static getStats(_req: Request, res: Response, next: NextFunction): void {
    try {
      const stats = StatsService.getStats();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}
