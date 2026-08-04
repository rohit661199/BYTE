import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/orderService.js';

export class OrderController {
  static createOrder(req: Request, res: Response, next: NextFunction): void {
    try {
      const order = OrderService.createOrder(req.body);
      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  static cancelOrder(req: Request<{ id: string }>, res: Response, next: NextFunction): void {
    try {
      const id = String(req.params.id);
      const cancelledOrder = OrderService.cancelOrder(id);
      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: cancelledOrder,
      });
    } catch (error) {
      next(error);
    }
  }

  static getAllOrders(_req: Request, res: Response, next: NextFunction): void {
    try {
      const orders = OrderService.getAllOrders();
      res.status(200).json({
        success: true,
        data: orders,
      });
    } catch (error) {
      next(error);
    }
  }

  static resetExchange(_req: Request, res: Response, next: NextFunction): void {
    try {
      OrderService.resetExchange();
      res.status(200).json({
        success: true,
        message: 'Exchange engine reset successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
