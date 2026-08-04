import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { StatsCards } from '../components/StatsCards';
import { OrderForm } from '../components/OrderForm';
import { OrderBook } from '../components/OrderBook';
import { TradeHistory } from '../components/TradeHistory';
import { ActiveOrders } from '../components/ActiveOrders';
import { useWebSocket } from '../hooks/useWebSocket';
import { apiService } from '../services/api';
import { Order } from '../types/index';

export function Dashboard() {
  const { isConnected, orderBook, stats, trades, refreshData } = useWebSocket();
  const [allOrders, setAllOrders] = useState<Order[]>([]);

  const fetchOrders = useCallback(async () => {
    try {
      const orders = await apiService.getAllOrders();
      setAllOrders(orders);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOrderChange = () => {
    fetchOrders();
    refreshData();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Header Navbar */}
      <Navbar isConnected={isConnected} onResetCompleted={handleOrderChange} />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Exchange Statistics Bar */}
        <StatsCards stats={stats} />

        {/* Core Trading Terminal Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Order Entry Panel (4 cols) */}
          <div className="lg:col-span-4">
            <OrderForm onOrderCreated={handleOrderChange} />
          </div>

          {/* Live Order Book (5 cols) */}
          <div className="lg:col-span-5">
            <OrderBook orderBook={orderBook} />
          </div>

          {/* Trade History Stream (3 cols) */}
          <div className="lg:col-span-3">
            <TradeHistory trades={trades} />
          </div>
        </div>

        {/* All Orders Table & Cancellation */}
        <ActiveOrders orders={allOrders} onOrderCancelled={handleOrderChange} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-600 font-mono">
        BYTE Exchange — Simplified Technical Assignment Engine © 2026
      </footer>
    </div>
  );
}
