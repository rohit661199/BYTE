import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, Loader2, RefreshCw, Search } from 'lucide-react';
import { Order } from '../types/index';
import { apiService } from '../services/api';
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters';
import { Button } from '../components/ui/Button';

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Race condition protection: ignore stale responses from superseded requests
  const activeRequestIdRef = useRef<number>(0);

  const fetchOrders = useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const offset = (currentPage - 1) * pageSize;
      const result = await apiService.getOrdersPaginated({
        limit: pageSize,
        offset,
        status: filterStatus,
        search: searchKeyword,
      });

      // Ignore response if a newer fetch request was dispatched in the meantime
      if (requestId !== activeRequestIdRef.current) return;

      setOrders(result.orders);
      setTotalOrders(result.total);
    } catch (err) {
      if (requestId !== activeRequestIdRef.current) return;
      console.error('Failed to fetch orders:', err);
      setErrorMsg('Failed to load orders from server. Please retry.');
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentPage, filterStatus, searchKeyword]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const handleSearchChange = (term: string) => {
    setSearchKeyword(term);
    setCurrentPage(1);
  };

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

  const totalPages = Math.ceil(totalOrders / pageSize) || 1;

  return (
    <div className="max-w-[1780px] mx-auto space-y-4 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-byte-border">
        <div>
          <h1 className="text-xl font-normal text-byte-primary tracking-tight">Orders & Activity Ledger</h1>
          <p className="text-xs text-byte-muted mt-0.5 font-normal">
            Server-paginated audit trail of orders stored in persistent SQLite WAL.
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

      {/* Error Toast */}
      {errorMsg && (
        <div className="p-3 rounded bg-bear/10 border border-bear/20 text-bear text-xs font-mono">
          {errorMsg}
        </div>
      )}

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-1 bg-byte-surface p-0.5 rounded border border-byte-border w-fit text-xs">
          {[
            { id: 'ALL', label: `All (${filterStatus === 'ALL' ? totalOrders.toLocaleString() : 'All'})` },
            { id: 'OPEN', label: 'Open' },
            { id: 'FILLED', label: 'Filled' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleFilterChange(tab.id)}
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

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-byte-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search order ID or symbol..."
            className="w-full bg-byte-secondary border border-byte-border rounded pl-8 pr-3 py-1 text-xs text-byte-primary font-mono focus:outline-none focus:border-byte-accent placeholder:text-byte-muted/60"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-byte-surface border border-byte-border rounded shadow-xs overflow-hidden">
        <div className="overflow-x-auto relative">
          {isLoading && (
            <div className="absolute inset-0 bg-byte-surface/50 backdrop-blur-[1px] flex items-center justify-center z-10">
              <Loader2 className="w-6 h-6 animate-spin text-byte-accent" />
            </div>
          )}
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
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-byte-muted italic font-sans">
                    {isLoading ? 'Loading orders...' : 'No orders match the selected filter.'}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
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

        {/* Server-Side Pagination Bar */}
        {totalOrders > pageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-byte-surface border-t border-byte-border text-xs text-byte-muted select-none">
            <div>
              Showing <span className="font-medium text-byte-primary">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-medium text-byte-primary">{Math.min(currentPage * pageSize, totalOrders)}</span> of{' '}
              <span className="font-medium text-byte-primary">{totalOrders.toLocaleString()}</span> orders
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1 || isLoading}
                className="px-2.5 py-1 rounded bg-byte-secondary/60 hover:bg-byte-secondary text-byte-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
                className="px-2.5 py-1 rounded bg-byte-secondary/60 hover:bg-byte-secondary text-byte-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Previous
              </button>
              <span className="px-2 text-byte-muted">
                Page <span className="font-medium text-byte-primary">{currentPage}</span> of{' '}
                <span className="font-medium text-byte-primary">{totalPages}</span>
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || isLoading}
                className="px-2.5 py-1 rounded bg-byte-secondary/60 hover:bg-byte-secondary text-byte-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || isLoading}
                className="px-2.5 py-1 rounded bg-byte-secondary/60 hover:bg-byte-secondary text-byte-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
