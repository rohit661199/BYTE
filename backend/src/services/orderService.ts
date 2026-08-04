import { randomUUID } from 'crypto';
import { db } from '../database/db.js';
import { OrderModel } from '../models/orderModel.js';
import { CreateOrderDTO, Order, Trade } from '../types/index.js';
import { AppError } from '../middlewares/errorHandler.js';
import { matchingEngine } from '../matching-engine/MatchingEngine.js';
import { WebSocketService } from './websocketService.js';

export interface CreateOrderResult {
  order: Order;
  trades: Trade[];
}

export class OrderService {
  static createOrder(dto: CreateOrderDTO): CreateOrderResult {
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

    // Save initial order in SQLite DB
    OrderModel.create(newOrder);

    // Process order through matching engine
    const { order, trades } = matchingEngine.processOrder(newOrder);

    // Check for MARKET order with no opposite-side liquidity
    if (newOrder.type === 'MARKET' && trades.length === 0) {
      // Mark market order as CANCELLED in DB
      newOrder.status = 'CANCELLED';
      OrderModel.update(newOrder);
      WebSocketService.broadcastStateUpdates();
      throw new AppError('No liquidity available', 400, 'NO_LIQUIDITY');
    }

    // Broadcast updated state to all connected WebSockets
    WebSocketService.broadcastStateUpdates();

    return { order, trades };
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

    // Cancel in matching engine memory
    matchingEngine.cancelOrder(id);

    // Cancel in database
    const success = OrderModel.cancel(id);
    if (!success) {
      throw new AppError('Failed to cancel order', 400, 'CANCELLATION_FAILED');
    }

    // Broadcast updated state to all connected WebSockets
    WebSocketService.broadcastStateUpdates();

    return { ...order, status: 'CANCELLED' };
  }

  static getAllOrders(): Order[] {
    return OrderModel.getAll();
  }

  static resetExchange(): void {
    db.prepare('DELETE FROM trades').run();
    db.prepare('DELETE FROM orders').run();

    matchingEngine.reset();
    WebSocketService.broadcastStateUpdates();
  }
}
