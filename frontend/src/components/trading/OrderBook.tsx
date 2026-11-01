import React from 'react';
import { OrderBook as OrderBookType } from '../../types/index';
import { formatPrice, formatNumber } from '../../utils/formatters';

interface OrderBookProps {
  orderBook: OrderBookType;
  symbol?: string;
}

export const OrderBook: React.FC<OrderBookProps> = ({ orderBook, symbol = 'BYTE-USD' }) => {
  const bids = Array.isArray(orderBook?.bids) ? orderBook.bids : [];
  const asks = Array.isArray(orderBook?.asks) ? orderBook.asks : [];

  const currency: 'USD' | 'INR' =
    symbol.includes('-') || !['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'LT', 'WIPRO', 'AXISBANK', 'BAJFINANCE', 'MARUTI', 'HINDUNILVR', 'TATAMOTORS'].includes(symbol.toUpperCase())
      ? 'USD'
      : 'INR';

  // Realistic sample fallback depth if book is currently empty
  const defaultBasePrice = currency === 'INR' ? 2950 : 88532;
  const displayAsks =
    asks.length > 0
      ? asks.slice(0, 7)
      : [
          { price: defaultBasePrice + 18, quantity: 1.45, orderCount: 2 },
          { price: defaultBasePrice + 12, quantity: 0.85, orderCount: 1 },
          { price: defaultBasePrice + 8, quantity: 2.12, orderCount: 3 },
          { price: defaultBasePrice + 5, quantity: 0.54, orderCount: 1 },
          { price: defaultBasePrice + 2, quantity: 1.2, orderCount: 2 },
        ];

  const displayBids =
    bids.length > 0
      ? bids.slice(0, 7)
      : [
          { price: defaultBasePrice - 2, quantity: 1.8, orderCount: 2 },
          { price: defaultBasePrice - 6, quantity: 0.95, orderCount: 1 },
          { price: defaultBasePrice - 10, quantity: 3.1, orderCount: 4 },
          { price: defaultBasePrice - 15, quantity: 1.4, orderCount: 2 },
          { price: defaultBasePrice - 20, quantity: 2.65, orderCount: 3 },
        ];

  const maxAskQty = Math.max(...displayAsks.map((a) => a.quantity), 1);
  const maxBidQty = Math.max(...displayBids.map((b) => b.quantity), 1);

  return (
    <div className="bg-byte-surface border border-byte-border rounded-lg p-3 flex flex-col h-[280px] select-none text-xs font-mono transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-byte-border">
        <span className="font-semibold text-byte-primary text-xs">Simulated Order Book</span>
        <span className="text-[10px] text-byte-accent font-semibold px-1 rounded bg-byte-secondary">FIFO Engine</span>
      </div>

      {/* Table Column Labels */}
      <div className="flex items-center justify-between text-[10px] text-byte-muted uppercase font-semibold mb-1 px-1">
        <span>Price ({currency})</span>
        <span>Size</span>
        <span>Total</span>
      </div>

      {/* Asks (Sell Orders - Red) */}
      <div className="space-y-0.5 overflow-hidden flex-1 flex flex-col justify-end">
        {displayAsks.map((ask, idx) => {
          const depth = Math.min((ask.quantity / maxAskQty) * 100, 100);
          const total = (ask.price * ask.quantity).toFixed(0);
          return (
            <div
              key={idx}
              className="relative flex items-center justify-between py-0.5 px-1 text-[11px] rounded hover:bg-byte-secondary/60 transition-colors"
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-[#EF6262]/10 rounded-r pointer-events-none"
                style={{ width: `${depth}%` }}
              />
              <span className="font-semibold text-[#EF6262] z-10 tnum">
                {formatPrice(ask.price, currency)}
              </span>
              <span className="text-byte-primary z-10 tnum">{formatNumber(ask.quantity, 2)}</span>
              <span className="text-byte-muted text-[10px] z-10 tnum">
                {currency === 'INR' ? '₹' : '$'}{total}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mid Market Spread Banner */}
      <div className="py-1 px-2 my-1 rounded bg-byte-secondary border-y border-byte-border flex items-center justify-between text-[11px] font-bold">
        <div className="flex items-center space-x-1.5 text-byte-primary">
          <span className="tnum">{formatPrice(defaultBasePrice, currency)}</span>
          <span className="text-[10px] text-[#22B982] font-normal">▲</span>
        </div>
        <span className="text-[10px] text-byte-muted font-normal">
          Spread {currency === 'INR' ? '₹' : '$'}4.00 (0.01%)
        </span>
      </div>

      {/* Bids (Buy Orders - Green) */}
      <div className="space-y-0.5 overflow-hidden flex-1">
        {displayBids.map((bid, idx) => {
          const depth = Math.min((bid.quantity / maxBidQty) * 100, 100);
          const total = (bid.price * bid.quantity).toFixed(0);
          return (
            <div
              key={idx}
              className="relative flex items-center justify-between py-0.5 px-1 text-[11px] rounded hover:bg-byte-secondary/60 transition-colors"
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-[#22B982]/10 rounded-r pointer-events-none"
                style={{ width: `${depth}%` }}
              />
              <span className="font-semibold text-[#22B982] z-10 tnum">
                {formatPrice(bid.price, currency)}
              </span>
              <span className="text-byte-primary z-10 tnum">{formatNumber(bid.quantity, 2)}</span>
              <span className="text-byte-muted text-[10px] z-10 tnum">
                {currency === 'INR' ? '₹' : '$'}{total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
