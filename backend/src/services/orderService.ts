import { randomUUID } from 'crypto';
import { OrderModel } from '../models/orderModel.js';
import { CreateOrderDTO, Order } from '../types/index.js';
import { AppError } from '../middlewares/errorHandler.js';

export class OrderService {
  static createOrder(dto: CreateOrderDTO): Order {
    const newOrder: Order = {
      id: `${dto.side.toLowerCase()}_${Date.now()}_${randomUUID().substring(0, 8)}`,
      side: dto.side,
      type: dto.type || 'LIMIT',
      price: Number(dto.price),
      quantity: Number(dto.quantity),
      remainingQuantity: Number(dto.quantity),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    OrderModel.create(newOrder);
    return newOrder;
  }

  static getOrderById(id: string): Order {
    const order = OrderModel.findById(id);
    if (!order) {
      throw new AppError(`Order with ID '${id}' not found`, 404, 'ORDER_NOT_FOUND');
    }
    return order;
  }

  static cancelOrder(id: string): Order {
    const order = this.getOrderById(id);
    if (order.status === 'FILLED' || order.status === 'CANCELLED') {
      throw new AppError(`Cannot cancel order in status ${order.status}`, 400, 'INVALID_ORDER_STATE');
    }

    const success = OrderModel.cancel(id);
    if (!success) {
      throw new AppError('Failed to cancel order', 400, 'CANCELLATION_FAILED');
    }

    return { ...order, status: 'CANCELLED' };
  }

  static getAllOrders(): Order[] {
    return OrderModel.getAll();
  }
}
