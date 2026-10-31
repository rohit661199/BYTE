import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { TradingHeader } from '../components/trading/TradingHeader';
import { TradingWatchlist } from '../components/trading/TradingWatchlist';
import { TradingChart } from '../components/trading/TradingChart';
import { OrderBook } from '../components/trading/OrderBook';
import { TradeHistory } from '../components/trading/TradeHistory';
import { OrderForm } from '../components/trading/OrderForm';
import { ActiveOrders } from '../components/trading/ActiveOrders';
import { useWebSocket } from '../hooks/useWebSocket';
import { apiService } from '../services/api';
import { Order } from '../types/index';

export const TradingPage: React.FC = () => {
  const { symbol = 'BYTE-USD' } = useParams<{ symbol: string }>();
  const { orderBook, trades, refreshData } = useWebSocket();
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
    <div className="space-y-3">
      {/* Top Instrument Header Ribbon */}
      <TradingHeader currentSymbol={symbol} />

      {/* Main Trading Workstation Grid (Matching Reference Image) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Left Column: Watchlist Panel (2 cols on xl) */}
        <div className="xl:col-span-2">
          <TradingWatchlist currentSymbol={symbol} />
        </div>

        {/* Center Column: Candlestick Chart (7 cols on xl) */}
        <div className="xl:col-span-7">
          <TradingChart symbol={symbol} />
        </div>

        {/* Right Column: Order Book & Order Entry (3 cols on xl) */}
        <div className="xl:col-span-3 space-y-3">
          <OrderBook orderBook={orderBook} />
          <TradeHistory trades={trades} />
          <OrderForm symbol={symbol} onOrderCreated={handleOrderChange} />
        </div>
      </div>

      {/* Bottom Full-Width Orders & Holdings Ledger */}
      <ActiveOrders orders={allOrders} onOrderCancelled={handleOrderChange} />
    </div>
  );
};
