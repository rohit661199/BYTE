import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Loader2, RefreshCw } from 'lucide-react';
import { Order } from '../types/index';
import { apiService } from '../services/api';
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters';
import { Button } from '../components/ui/Button';

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getAllOrders();
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCancel = async (id: string) => {
    try {
      setCancellingId(id);
      await apiService.cancelOrder(id);
      fetchOrders();
    } catch (err) {
      console.error('Failed to cancel order:', err);
    } finally {
      setCancellingId(null);
    }
  };

  const safeOrders = Array.isArray(orders) ? orders : [];

  const filteredOrders = safeOrders.filter((o) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'OPEN') return o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED';
    return o.status === filterStatus;
  });

  return (
    <div className="max-w-[1780px] mx-auto space-y-4 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-byte-border">
        <div>
          <h1 className="text-xl font-normal text-byte-primary tracking-tight">Orders & Activity Ledger</h1>
          <p className="text-xs text-byte-muted mt-0.5 font-normal">
            Audit trail of submitted, filled, and cancelled orders stored in persistent SQLite WAL.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          onClick={fetchOrders}
        >
          Refresh Ledger
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-1 bg-byte-surface p-0.5 rounded border border-byte-border w-fit text-xs">
        {[
          { id: 'ALL', label: `All (${safeOrders.length})` },
          { id: 'OPEN', label: 'Open' },
          { id: 'FILLED', label: 'Filled' },
          { id: 'CANCELLED', label: 'Cancelled' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3 py-1 rounded font-normal transition-colors cursor-pointer ${
              filterStatus === tab.id
                ? 'bg-byte-secondary text-byte-accent font-medium'
                : 'text-byte-muted hover:text-byte-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-byte-surface border border-byte-border rounded shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-byte-border bg-byte-secondary/40 text-byte-muted uppercase text-[11px] tracking-wider font-normal">
                <th className="py-2.5 px-4 font-normal">Order ID</th>
                <th className="py-2.5 px-3 font-normal">Side</th>
                <th className="py-2.5 px-3 font-normal">Type</th>
                <th className="py-2.5 px-3 font-normal text-right">Price</th>
                <th className="py-2.5 px-3 font-normal text-right">Quantity</th>
                <th className="py-2.5 px-3 font-normal text-right">Remaining</th>
                <th className="py-2.5 px-3 font-normal text-center">Status</th>
                <th className="py-2.5 px-3 font-normal text-right">Timestamp</th>
                <th className="py-2.5 px-4 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-byte-border/40">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-byte-muted italic font-sans">
                    No orders match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-byte-secondary/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-byte-primary">{order.id.slice(-8)}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          order.side === 'BUY'
                            ? 'bg-bull/10 text-bull'
                            : 'bg-bear/10 text-bear'
                        }`}
                      >
                        {order.side}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-byte-muted">{order.type}</td>
                    <td className="py-3 px-3 text-right font-medium text-byte-primary tnum">{formatCurrency(order.price)}</td>
                    <td className="py-3 px-3 text-right text-byte-primary tnum">{formatNumber(order.quantity, 0)}</td>
                    <td className="py-3 px-3 text-right text-byte-muted tnum">{formatNumber(order.remainingQuantity, 0)}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
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
                    <td className="py-3 px-3 text-right text-byte-muted text-[11px] tnum">{formatDate(order.createdAt)}</td>
                    <td className="py-3 px-4 text-right">
                      {order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED' ? (
                        <button
                          onClick={() => handleCancel(order.id)}
                          disabled={cancellingId === order.id}
                          className="px-2 py-1 rounded bg-bear/10 hover:bg-bear/20 text-bear text-[11px] font-medium transition-colors inline-flex items-center space-x-1 cursor-pointer disabled:opacity-50"
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
    </div>
  );
};
