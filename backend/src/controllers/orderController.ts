import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/orderService.js';
import { InstrumentRegistry } from '../services/InstrumentRegistry.js';
import { MathPrecision } from '../utils/MathPrecision.js';
import { Order } from '../types/index.js';
import { formatTradeResponse } from './tradeController.js';

export function formatOrderResponse(order: Order) {
  const canonical = InstrumentRegistry.getCanonicalSymbol(order.symbol || 'BYTE-USD');
  const instrument = InstrumentRegistry.getInstrument(canonical);

  const priceBasis = order.priceBasis ?? MathPrecision.parsePriceToBasis(order.price);
  const qtyMicro = order.quantityMicro ?? MathPrecision.parseQtyToMicro(order.quantity);
  const remMicro = order.remainingQuantityMicro ?? MathPrecision.parseQtyToMicro(order.remainingQuantity);
  const filledMicro = qtyMicro - remMicro;

  const decimals = instrument?.assetClass === 'CRYPTO' ? 2 : 2;
  const priceStr = MathPrecision.formatBasisToPrice(priceBasis, decimals);
  const qtyStr = MathPrecision.formatMicroToQty(qtyMicro);
  const remStr = MathPrecision.formatMicroToQty(remMicro);
  const filledStr = MathPrecision.formatMicroToQty(filledMicro);

  return {
    id: order.id,
    symbol: canonical,
    type: order.type,
    side: order.side,
    price: priceStr,
    quantity: qtyStr,
    originalQuantity: qtyStr,
    filledQuantity: filledStr,
    remainingQuantity: remStr,
    status: order.status,
    ownerType: order.ownerType || 'USER',
    userId: order.userId || undefined,
    createdAt: order.createdAt,
    dispatchedAt: order.dispatchedAt || undefined,
    // Explicit string properties
    priceStr,
    quantityStr: qtyStr,
    originalQuantityStr: qtyStr,
    filledQuantityStr: filledStr,
    remainingQuantityStr: remStr,
    // Backwards-compatible numeric fields
    priceNumber: order.price,
    quantityNumber: order.quantity,
    remainingQuantityNumber: order.remainingQuantity,
    filledQuantityNumber: order.quantity - order.remainingQuantity,
  };
}

export class OrderController {
  static createOrder(req: Request, res: Response, next: NextFunction): void {
    try {
      const result = OrderService.createOrder(req.body);

      // Return simulated preview header as mandated by v2.4.0 specification
      res.setHeader('X-BYTE-Reservation', 'simulated-preview');

      res.status(201).json({
        success: true,
        message: result.order.status === 'QUEUED_AMO'
          ? 'Order queued as After-Market Order (AMO)'
          : 'Order created successfully',
        data: {
          order: formatOrderResponse(result.order),
          trades: result.trades.map(formatTradeResponse),
          reservation: result.reservation
            ? {
                reservationId: result.reservation.reservationId,
                status: result.reservation.status,
                reservedAmountCents: result.reservation.reservedAmountCents?.toString(),
                message: result.reservation.message,
              }
            : undefined,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static cancelOrder(req: Request<{ id: string }>, res: Response, next: NextFunction): void {
    try {
      const id = String(req.params.id);
      const userId = (req.body?.userId || req.query?.userId) as string | undefined;
      const cancelledOrder = OrderService.cancelOrder(id, userId);
      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: formatOrderResponse(cancelledOrder),
      });
    } catch (error) {
      next(error);
    }
  }

  static getAllOrders(req: Request, res: Response, next: NextFunction): void {
    try {
      const hasPaginationOrFilter =
        req.query.limit != null ||
        req.query.offset != null ||
        req.query.status != null ||
        req.query.search != null;

      if (!hasPaginationOrFilter) {
        // Preserves exact backward compatibility when no pagination or filter params are supplied
        const orders = OrderService.getAllOrders();
        res.status(200).json({
          success: true,
          data: orders.map(formatOrderResponse),
          total: orders.length,
        });
        return;
      }

      const parsedLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const limit = !isNaN(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;
      const parsedOffset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const offset = !isNaN(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;

      const result = OrderService.getOrdersPaginated({ limit, offset, status, search });
      res.status(200).json({
        success: true,
        data: result.orders.map(formatOrderResponse),
        total: result.total,
        limit,
        offset,
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
