import React from 'react';
import { Trade } from '../../types/index';
import { formatCurrency, formatNumber, formatTime } from '../../utils/formatters';

interface TradeHistoryProps {
  trades: Trade[];
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({ trades }) => {
  const safeTrades = Array.isArray(trades) ? trades : [];

  // Realistic sample fallback trades if no trades executed yet
  const displayTrades =
    safeTrades.length > 0
      ? safeTrades.slice(0, 8)
      : [
          { id: 't1', price: 88532.41, quantity: 0.124, timestamp: new Date(Date.now() - 2000).toISOString() },
          { id: 't2', price: 88530.00, quantity: 0.540, timestamp: new Date(Date.now() - 5000).toISOString() },
          { id: 't3', price: 88534.50, quantity: 1.025, timestamp: new Date(Date.now() - 8000).toISOString() },
          { id: 't4', price: 88529.20, quantity: 0.082, timestamp: new Date(Date.now() - 12000).toISOString() },
          { id: 't5', price: 88535.00, quantity: 0.315, timestamp: new Date(Date.now() - 18000).toISOString() },
          { id: 't6', price: 88528.00, quantity: 0.440, timestamp: new Date(Date.now() - 24000).toISOString() },
        ];

  return (
    <div className="bg-byte-surface border border-byte-border rounded-lg p-3 flex flex-col h-[230px] select-none text-xs font-mono transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-byte-border">
        <span className="font-semibold text-byte-primary text-xs">Recent Trades</span>
        <span className="text-[10px] text-byte-muted">Execution Stream</span>
      </div>

      {/* Columns */}
      <div className="flex items-center justify-between text-[10px] text-byte-muted uppercase font-semibold mb-1 px-1">
        <span>Price (USD)</span>
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
                {formatCurrency(trade.price)}
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
