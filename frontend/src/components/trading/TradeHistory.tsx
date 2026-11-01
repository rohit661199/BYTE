import React from 'react';
import { Trade } from '../../types/index';
import { formatPrice, formatNumber, formatTime } from '../../utils/formatters';

interface TradeHistoryProps {
  trades: Trade[];
  symbol?: string;
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({ trades, symbol = 'BYTE-USD' }) => {
  const safeTrades = Array.isArray(trades) ? trades : [];

  const currency: 'USD' | 'INR' =
    symbol.includes('-') || !['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'LT', 'WIPRO', 'AXISBANK', 'BAJFINANCE', 'MARUTI', 'HINDUNILVR', 'TATAMOTORS'].includes(symbol.toUpperCase())
      ? 'USD'
      : 'INR';

  const defaultBasePrice = currency === 'INR' ? 2950 : 88532;

  // Realistic sample fallback trades if no trades executed yet
  const displayTrades =
    safeTrades.length > 0
      ? safeTrades.slice(0, 8)
      : [
          { id: 't1', price: defaultBasePrice + 2.4, quantity: 0.124, timestamp: new Date(Date.now() - 2000).toISOString() },
          { id: 't2', price: defaultBasePrice, quantity: 0.54, timestamp: new Date(Date.now() - 5000).toISOString() },
          { id: 't3', price: defaultBasePrice + 4.5, quantity: 1.025, timestamp: new Date(Date.now() - 8000).toISOString() },
          { id: 't4', price: defaultBasePrice - 1.2, quantity: 0.082, timestamp: new Date(Date.now() - 12000).toISOString() },
          { id: 't5', price: defaultBasePrice + 3.0, quantity: 0.315, timestamp: new Date(Date.now() - 18000).toISOString() },
          { id: 't6', price: defaultBasePrice - 2.0, quantity: 0.44, timestamp: new Date(Date.now() - 24000).toISOString() },
        ];

  return (
    <div className="bg-byte-surface border border-byte-border rounded-lg p-3 flex flex-col h-[230px] select-none text-xs font-mono transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-byte-border">
        <span className="font-semibold text-byte-primary text-xs">Simulated Matches</span>
        <span className="text-[10px] text-byte-muted">Execution Stream</span>
      </div>

      {/* Columns */}
      <div className="flex items-center justify-between text-[10px] text-byte-muted uppercase font-semibold mb-1 px-1">
        <span>Price ({currency})</span>
        <span>Size</span>
        <span>Time</span>
      </div>

      {/* Trade Rows */}
      <div className="space-y-0.5 overflow-y-auto flex-1">
        {displayTrades.map((trade, idx) => {
          const isUp = idx % 2 === 0;
          return (
            <div
              key={trade.id || idx}
              className="flex items-center justify-between py-1 px-1 text-[11px] rounded hover:bg-byte-secondary/60 transition-colors"
            >
              <span className={`font-semibold tnum ${isUp ? 'text-[#22B982]' : 'text-[#EF6262]'}`}>
                {formatPrice(trade.price, currency)}
              </span>
              <span className="text-byte-primary tnum">{formatNumber(trade.quantity, 3)}</span>
              <span className="text-byte-muted text-[10px] tnum">{formatTime(trade.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
