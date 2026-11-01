import { useEffect, useState, useRef, useCallback } from 'react';
import { ExchangeStats, OrderBook, Trade } from '../types/index';
import { apiService } from '../services/api';

interface WsPayloadInit {
  orderBook: OrderBook;
  stats: ExchangeStats;
  recentTrades: Trade[];
}

interface WsMessage {
  type: 'ORDER_BOOK_UPDATE' | 'TRADE_EXECUTED' | 'STATS_UPDATE' | 'INIT' | 'MARKET_QUOTE_UPDATE' | 'CANDLE_UPDATE' | 'AUTH_RESPONSE';
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
      if (obData) {
        setOrderBook({
          bids: Array.isArray(obData.bids) ? obData.bids : [],
          asks: Array.isArray(obData.asks) ? obData.asks : [],
        });
      }
      if (statsData) {
        setStats(statsData);
      }
      if (Array.isArray(tradesData)) {
        setTrades(tradesData);
      }
    } catch (err) {
      console.error('REST initial hydration error:', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    let wsUrl = '';
    const customApiUrl = import.meta.env.VITE_API_URL;
    if (customApiUrl) {
      const cleanUrl = customApiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const protocol = customApiUrl.startsWith('https') ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${cleanUrl}/ws`;
    } else if (window.location.hostname.includes('vercel.app')) {
      wsUrl = 'wss://byte-exchange-backend.onrender.com/ws';
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.port === '5173' ? `${window.location.hostname}:5000` : window.location.host;
      wsUrl = `${protocol}//${wsHost}/ws`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('byte:ws:connected', { detail: { connected: true } }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'INIT': {
              const initData = message.payload as WsPayloadInit;
              if (initData?.orderBook) {
                setOrderBook({
                  bids: Array.isArray(initData.orderBook.bids) ? initData.orderBook.bids : [],
                  asks: Array.isArray(initData.orderBook.asks) ? initData.orderBook.asks : [],
                });
              }
              if (initData?.stats) setStats(initData.stats);
              if (Array.isArray(initData?.recentTrades)) setTrades(initData.recentTrades);
              break;
            }
            case 'ORDER_BOOK_UPDATE': {
              const payload = message.payload as OrderBook;
              if (payload) {
                setOrderBook({
                  bids: Array.isArray(payload.bids) ? payload.bids : [],
                  asks: Array.isArray(payload.asks) ? payload.asks : [],
                });
              }
              break;
            }
            case 'STATS_UPDATE': {
              if (message.payload) setStats(message.payload as ExchangeStats);
              break;
            }
            case 'TRADE_EXECUTED': {
              if (Array.isArray(message.payload)) setTrades(message.payload as Trade[]);
              break;
            }
            case 'MARKET_QUOTE_UPDATE': {
              if (typeof window !== 'undefined' && message.payload) {
                window.dispatchEvent(new CustomEvent('byte:market_quote', { detail: message.payload }));
              }
              break;
            }
            case 'CANDLE_UPDATE': {
              if (typeof window !== 'undefined' && message.payload) {
                window.dispatchEvent(new CustomEvent('byte:candle_update', { detail: message.payload }));
              }
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
          }, 5000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        try { ws.close(); } catch (_) {}
      };
    } catch (_) {
      setIsConnected(false);
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
