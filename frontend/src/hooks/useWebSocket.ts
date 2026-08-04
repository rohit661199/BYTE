import { useEffect, useState, useRef, useCallback } from 'react';
import { ExchangeStats, OrderBook, Trade } from '../types/index';
import { apiService } from '../services/api';

interface WsPayloadInit {
  orderBook: OrderBook;
  stats: ExchangeStats;
  recentTrades: Trade[];
}

interface WsMessage {
  type: 'ORDER_BOOK_UPDATE' | 'TRADE_EXECUTED' | 'STATS_UPDATE' | 'INIT';
  payload: unknown;
  timestamp: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: [], asks: [] });
  const [stats, setStats] = useState<ExchangeStats>({
    totalBuyOrders: 0,
    totalSellOrders: 0,
    totalTradesExecuted: 0,
    totalVolume: 0,
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fast Initial REST Hydration so UI renders instantly without waiting for WS handshake
  const fetchInitialData = useCallback(async () => {
    try {
      const [obData, statsData, tradesData] = await Promise.all([
        apiService.getOrderBook(),
        apiService.getStats(),
        apiService.getTrades(20),
      ]);
      setOrderBook(obData);
      setStats(statsData);
      setTrades(tradesData);
    } catch (err) {
      console.error('REST initial hydration error:', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect directly to backend port 5000 or host
    const wsHost = window.location.port === '5173' ? `${window.location.hostname}:5000` : window.location.host;
    const wsUrl = `${protocol}//${wsHost}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'INIT': {
              const initData = message.payload as WsPayloadInit;
              setOrderBook(initData.orderBook);
              setStats(initData.stats);
              setTrades(initData.recentTrades);
              break;
            }
            case 'ORDER_BOOK_UPDATE': {
              setOrderBook(message.payload as OrderBook);
              break;
            }
            case 'STATS_UPDATE': {
              setStats(message.payload as ExchangeStats);
              break;
            }
            case 'TRADE_EXECUTED': {
              setTrades(message.payload as Trade[]);
              break;
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, 3000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect, fetchInitialData]);

  return {
    isConnected,
    orderBook,
    stats,
    trades,
    setOrderBook,
    setStats,
    setTrades,
    refreshData: fetchInitialData,
  };
}
