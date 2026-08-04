export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'LIMIT' | 'MARKET';
export type OrderStatus = 'PENDING' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED';

export interface Order {
  id: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  quantity: number;
  remainingQuantity: number;
  status: OrderStatus;
  createdAt: string;
}

export interface Trade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  price: number;
  quantity: number;
  timestamp: string;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface ExchangeStats {
  totalBuyOrders: number;
  totalSellOrders: number;
  totalTradesExecuted: number;
  totalVolume: number;
}

export interface CreateOrderDTO {
  side: OrderSide;
  type?: OrderType;
  price: number;
  quantity: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}
