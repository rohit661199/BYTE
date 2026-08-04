import { OrderBook as OrderBookType } from '../types/index';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface OrderBookProps {
  orderBook: OrderBookType;
}

export function OrderBook({ orderBook }: OrderBookProps) {
  const maxBidQty = Math.max(...orderBook.bids.map((b) => b.quantity), 1);
  const maxAskQty = Math.max(...orderBook.asks.map((a) => a.quantity), 1);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <h2 className="font-semibold text-white">Order Book</h2>
        <span className="text-xs text-slate-400 font-mono">Live Depth</span>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {/* BUY BIDS COLUMN */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
            <span className="text-emerald-400">Price (USD)</span>
            <span>Qty</span>
          </div>

          <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
            {orderBook.bids.length === 0 ? (
              <div className="text-center py-10 text-slate-600 text-xs italic">No active buy bids</div>
            ) : (
              orderBook.bids.map((bid, idx) => {
                const depthWidth = Math.min((bid.quantity / maxBidQty) * 100, 100);
                return (
                  <div
                    key={idx}
                    className="relative flex items-center justify-between py-1.5 px-2 text-xs font-mono rounded hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Background Depth Bar */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded-r pointer-events-none transition-all duration-300"
                      style={{ width: `${depthWidth}%` }}
                    />
                    <span className="font-semibold text-emerald-400 z-10">{formatCurrency(bid.price)}</span>
                    <span className="text-slate-200 z-10">{formatNumber(bid.quantity, 0)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SELL ASKS COLUMN */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
            <span className="text-rose-400">Price (USD)</span>
            <span>Qty</span>
          </div>

          <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
            {orderBook.asks.length === 0 ? (
              <div className="text-center py-10 text-slate-600 text-xs italic">No active sell asks</div>
            ) : (
              orderBook.asks.map((ask, idx) => {
                const depthWidth = Math.min((ask.quantity / maxAskQty) * 100, 100);
                return (
                  <div
                    key={idx}
                    className="relative flex items-center justify-between py-1.5 px-2 text-xs font-mono rounded hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Background Depth Bar */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-rose-500/10 rounded-r pointer-events-none transition-all duration-300"
                      style={{ width: `${depthWidth}%` }}
                    />
                    <span className="font-semibold text-rose-400 z-10">{formatCurrency(ask.price)}</span>
                    <span className="text-slate-200 z-10">{formatNumber(ask.quantity, 0)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
