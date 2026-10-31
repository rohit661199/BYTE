import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Order } from '../../types/index';
import { apiService } from '../../services/api';
import { formatCurrency, formatNumber, formatTime } from '../../utils/formatters';

interface ActiveOrdersProps {
  orders: Order[];
  onOrderCancelled?: () => void;
}

export const ActiveOrders: React.FC<ActiveOrdersProps> = ({ orders, onOrderCancelled }) => {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'history' | 'trades' | 'holdings'>('open');
  const safeOrders = Array.isArray(orders) ? orders : [];

  const handleCancel = async (id: string) => {
    try {
      setCancellingId(id);
      await apiService.cancelOrder(id);
      if (onOrderCancelled) onOrderCancelled();
    } catch (err) {
      console.error('Failed to cancel order:', err);
    } finally {
      setCancellingId(null);
    }
  };

  const openOrders = safeOrders.filter(
    (o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED'
  );
  const historyOrders = safeOrders.filter(
    (o) => o.status === 'FILLED' || o.status === 'CANCELLED'
  );

  return (
    <div className="bg-byte-surface border border-byte-border rounded select-none text-xs font-mono transition-colors shadow-xs">
      {/* Ledger Navigation Tabs (Matching Reference Image) */}
      <div className="flex items-center justify-between px-3 border-b border-byte-border bg-byte-surface">
        <div className="flex space-x-1 py-1">
          {[
            { id: 'open', label: `Open Orders (${openOrders.length})` },
            { id: 'history', label: `Order History (${historyOrders.length})` },
            { id: 'trades', label: 'Trade History' },
            { id: 'holdings', label: 'Holdings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-byte-secondary text-byte-accent font-medium'
                  : 'text-byte-muted hover:text-byte-primary hover:bg-byte-secondary/60 font-normal'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-byte-border text-byte-muted uppercase text-[10px] tracking-wider bg-byte-secondary/40 font-normal">
              <th className="py-2 px-3 font-normal">Time</th>
              <th className="py-2 px-2 font-normal">Symbol</th>
              <th className="py-2 px-2 font-normal">Side</th>
              <th className="py-2 px-2 font-normal">Type</th>
              <th className="py-2 px-2 font-normal text-right">Price</th>
              <th className="py-2 px-2 font-normal text-right">Quantity</th>
              <th className="py-2 px-2 font-normal text-right">Filled</th>
              <th className="py-2 px-2 font-normal text-center">Status</th>
              <th className="py-2 px-3 font-normal text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-byte-border/40">
            {activeTab === 'open' && openOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-7 text-byte-muted italic font-sans">
                  No active resting limit orders on the matching engine.
                </td>
              </tr>
            ) : activeTab === 'history' && historyOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-7 text-byte-muted italic font-sans">
                  No historical order executions recorded yet.
                </td>
              </tr>
            ) : activeTab === 'holdings' ? (
              <>
                <tr className="hover:bg-byte-secondary/40 transition-colors">
                  <td className="py-2 px-3 text-byte-muted">—</td>
                  <td className="py-2 px-2 font-semibold text-byte-primary">BYTE-USD</td>
                  <td className="py-2 px-2"><span className="text-bull font-medium">ASSET</span></td>
                  <td className="py-2 px-2 text-byte-muted">SPOT</td>
                  <td className="py-2 px-2 text-right text-byte-primary tnum">$100.00</td>
                  <td className="py-2 px-2 text-right text-byte-primary tnum">100.00 BYTE</td>
                  <td className="py-2 px-2 text-right text-bull tnum">100%</td>
                  <td className="py-2 px-2 text-center"><span className="text-bull bg-bull/10 px-1.5 py-0.5 rounded text-[10px]">Active</span></td>
                  <td className="py-2 px-3 text-right text-byte-muted">—</td>
                </tr>
                <tr className="hover:bg-byte-secondary/40 transition-colors">
                  <td className="py-2 px-3 text-byte-muted">—</td>
                  <td className="py-2 px-2 font-semibold text-byte-primary">USD CASH</td>
                  <td className="py-2 px-2"><span className="text-byte-accent font-medium">FIAT</span></td>
                  <td className="py-2 px-2 text-byte-muted">CASH</td>
                  <td className="py-2 px-2 text-right text-byte-primary tnum">$1.00</td>
                  <td className="py-2 px-2 text-right text-byte-primary tnum">$10,000.00</td>
                  <td className="py-2 px-2 text-right text-bull tnum">100%</td>
                  <td className="py-2 px-2 text-center"><span className="text-bull bg-bull/10 px-1.5 py-0.5 rounded text-[10px]">Settled</span></td>
                  <td className="py-2 px-3 text-right text-byte-muted">—</td>
                </tr>
              </>
            ) : (
              (activeTab === 'open' ? openOrders : historyOrders).map((order) => (
                <tr key={order.id} className="hover:bg-byte-secondary/40 transition-colors">
                  <td className="py-2 px-3 text-byte-muted text-[11px] tnum">
                    {formatTime(order.createdAt)}
                  </td>
                  <td className="py-2 px-2 font-semibold text-byte-primary">BYTE-USD</td>
                  <td className="py-2 px-2">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                        order.side === 'BUY'
                          ? 'bg-bull/10 text-bull'
                          : 'bg-bear/10 text-bear'
                      }`}
                    >
                      {order.side}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-byte-muted">{order.type}</td>
                  <td className="py-2 px-2 text-right text-byte-primary font-medium tnum">
                    {formatCurrency(order.price)}
                  </td>
                  <td className="py-2 px-2 text-right text-byte-primary tnum">
                    {formatNumber(order.quantity, 0)}
                  </td>
                  <td className="py-2 px-2 text-right text-byte-muted tnum">
                    {formatNumber(order.quantity - order.remainingQuantity, 0)}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        order.status === 'FILLED'
                          ? 'bg-bull/10 text-bull'
                          : order.status === 'PARTIALLY_FILLED'
                          ? 'bg-byte-accent/15 text-byte-accent'
                          : order.status === 'CANCELLED'
                          ? 'bg-byte-secondary text-byte-muted'
                          : 'bg-byte-secondary text-byte-primary'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    {order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED' ? (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancellingId === order.id}
                        className="px-2 py-0.5 rounded bg-bear/10 hover:bg-bear/20 text-bear text-[10px] font-medium transition-colors inline-flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                      >
                        {cancellingId === order.id ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-2.5 h-2.5" />
                            <span>Cancel</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-byte-tertiary text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
