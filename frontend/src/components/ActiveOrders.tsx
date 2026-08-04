import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Order } from '../types/index';
import { apiService } from '../services/api';
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters';

interface ActiveOrdersProps {
  orders: Order[];
  onOrderCancelled?: () => void;
}

export function ActiveOrders({ orders, onOrderCancelled }: ActiveOrdersProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <h2 className="font-semibold text-white">All Orders & Management</h2>
        <span className="text-xs text-slate-400 font-mono">Total Orders: {orders.length}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
              <th className="pb-2 pl-2">ID</th>
              <th className="pb-2">Side</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Price</th>
              <th className="pb-2">Quantity</th>
              <th className="pb-2">Remaining</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Created</th>
              <th className="pb-2 pr-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-600 italic">
                  No orders found in database
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 pl-2 font-semibold text-slate-300">{order.id.slice(-8)}</td>
                  <td className="py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        order.side === 'BUY'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {order.side}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-400">{order.type}</td>
                  <td className="py-2.5 text-white font-semibold">{formatCurrency(order.price)}</td>
                  <td className="py-2.5 text-slate-200">{formatNumber(order.quantity, 0)}</td>
                  <td className="py-2.5 text-slate-300">{formatNumber(order.remainingQuantity, 0)}</td>
                  <td className="py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        order.status === 'FILLED'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : order.status === 'PARTIALLY_FILLED'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : order.status === 'CANCELLED'
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-500 text-[11px]">{formatDate(order.createdAt)}</td>
                  <td className="py-2.5 pr-2 text-right">
                    {order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED' ? (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancellingId === order.id}
                        className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-medium border border-rose-500/20 transition-all flex items-center space-x-1 ml-auto disabled:opacity-50"
                      >
                        {cancellingId === order.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-3 h-3" />
                            <span>Cancel</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-slate-600 text-[11px]">—</span>
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
}
