import { useEffect, useState, useRef, useCallback } from 'react';
import { ExchangeStats, OrderBook, Trade } from '../types/index';

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

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

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
      // Auto-reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    isConnected,
    orderBook,
    stats,
    trades,
    setOrderBook,
    setStats,
    setTrades,
  };
}
