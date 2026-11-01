export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'LIMIT' | 'MARKET';
export type OrderStatus = 'PENDING' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'QUEUED_AMO' | 'REJECTED';
export type OwnerType = 'USER' | 'SIMULATOR';

export interface Order {
  id: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  quantity: number;
  remainingQuantity: number;
  status: OrderStatus;
  createdAt: string;
  symbol?: string;
  userId?: string;
  ownerType?: OwnerType;
  dispatchedAt?: string | null;

  // Authoritative integer shadow fields (Step 5 precision)
  priceBasis?: bigint;
  quantityMicro?: bigint;
  remainingQuantityMicro?: bigint;

  // Decimal string representations (API & WebSocket boundaries)
  priceStr?: string;
  quantityStr?: string;
  originalQuantity?: string;
  originalQuantityStr?: string;
  remainingQuantityStr?: string;
  filledQuantityStr?: string;
  filledQuantity?: number | string;
}

export interface Trade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  price: number;
  quantity: number;
  timestamp: string;
  symbol?: string;

  // Authoritative integer shadow fields (Step 5 precision)
  priceBasis?: bigint;
  quantityMicro?: bigint;

  // Decimal string representations
  priceStr?: string;
  quantityStr?: string;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBook {
  bids: OrderBookLevel[]; // BUY orders (highest price first)
  asks: OrderBookLevel[]; // SELL orders (lowest price first)
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
  price?: number | string;
  quantity: number | string;
  symbol?: string;
  userId?: string;
}

// --- Step 3: Session Management & Calendar Types ---
export type TradingSession = 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';

export interface SessionValidationResult {
  allowed: boolean;
  reason?: string;
  queueAsAmo?: boolean;
  session?: TradingSession;
  canonicalSymbol?: string;
}

// --- Step 3: Funds Reservation Adapter Types ---
export type ReservationStatus = 'CONFIRMED' | 'REJECTED' | 'SIMULATED_NOOP';

export interface ReservationRequest {
  orderId: string;
  userId?: string;
  symbol: string;
  side: OrderSide;
  quantity: number | string;
  price: number | string;
  notionalCashCents?: bigint;
}

export interface ReservationResult {
  success: boolean;
  reservationId: string;
  status: ReservationStatus;
  reservedAmountCents: bigint;
  message?: string;
}

export interface IFundsReservationAdapter {
  reserveFunds(req: ReservationRequest): Promise<ReservationResult>;
  releaseReservation(reservationId: string): Promise<boolean>;
  commitReservation(reservationId: string): Promise<boolean>;
}
