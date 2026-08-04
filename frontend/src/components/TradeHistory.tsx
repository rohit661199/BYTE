import { Clock } from 'lucide-react';
import { Trade } from '../types/index';
import { formatCurrency, formatNumber, formatTime } from '../utils/formatters';

interface TradeHistoryProps {
  trades: Trade[];
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <h2 className="font-semibold text-white flex items-center space-x-2">
          <span>Trade History</span>
        </h2>
        <span className="text-xs text-slate-400 font-mono flex items-center space-x-1">
          <Clock className="w-3 h-3 text-cyan-400" />
          <span>Real-Time Stream</span>
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
        <span>Price (USD)</span>
        <span>Qty</span>
        <span>Time</span>
      </div>

      <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1 flex-1">
        {trades.length === 0 ? (
          <div className="text-center py-10 text-slate-600 text-xs italic">No trades executed yet</div>
        ) : (
          trades.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between py-1.5 px-2 text-xs font-mono rounded hover:bg-slate-800/50 transition-colors border-b border-slate-800/30"
            >
              <span className="font-semibold text-cyan-400">{formatCurrency(trade.price)}</span>
              <span className="text-slate-200">{formatNumber(trade.quantity, 0)}</span>
              <span className="text-slate-400 text-[11px]">{formatTime(trade.timestamp)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
