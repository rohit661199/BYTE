import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { MarketQuote, ProviderHealthStatus, CandleUpdatePayload } from '../types/marketData';
import { apiService } from '../services/api';

/**
 * Baseline fallback fixtures for all 24 registered instruments across Crypto, US, and NSE.
 * Guarantees zero blank screens while backend feeds initialize.
 */
const BASELINE_QUOTES: MarketQuote[] = [
  // Crypto
  {
    symbol: 'BTC-USD',
    exchange: 'BINANCE',
    assetType: 'CRYPTO',
    currency: 'USD',
    price: 88532.41,
    priceStr: '88532.41',
    open: 87297.0,
    high: 89210.4,
    low: 86128.0,
    volume: 48200000,
    change: 1235.41,
    changePercent: 1.42,
    source: 'BINANCE_PUBLIC',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
  },
  {
    symbol: 'ETH-USD',
    exchange: 'BINANCE',
    assetType: 'CRYPTO',
    currency: 'USD',
    price: 3240.5,
    priceStr: '3240.50',
    open: 3202.7,
    high: 3290.0,
    low: 3180.0,
    volume: 19400000,
    change: 37.8,
    changePercent: 1.18,
    source: 'BINANCE_PUBLIC',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
  },
  {
    symbol: 'SOL-USD',
    exchange: 'BINANCE',
    assetType: 'CRYPTO',
    currency: 'USD',
    price: 184.2,
    priceStr: '184.20',
    open: 177.3,
    high: 189.5,
    low: 176.0,
    volume: 8600000,
    change: 6.9,
    changePercent: 3.92,
    source: 'BINANCE_PUBLIC',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
  },
  // BYTE Simulated Utility
  {
    symbol: 'BYTE-USD',
    exchange: 'BYTE_SIM',
    assetType: 'UTILITY',
    currency: 'USD',
    price: 100.0,
    priceStr: '100.00',
    open: 100.0,
    high: 105.0,
    low: 95.0,
    volume: 345000,
    change: 0.0,
    changePercent: 0.0,
    source: 'BYTE_SIM',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
  },
  // US Equities
  {
    symbol: 'AAPL',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    currency: 'USD',
    price: 228.1,
    priceStr: '228.10',
    open: 229.06,
    high: 230.5,
    low: 226.4,
    volume: 28100000,
    change: -0.96,
    changePercent: -0.42,
    source: 'ALPACA_IEX',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
  },
  {
    symbol: 'MSFT',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    currency: 'USD',
    price: 416.2,
    priceStr: '416.20',
    open: 413.5,
    high: 419.0,
    low: 412.3,
    volume: 18400000,
    change: 2.7,
    changePercent: 0.65,
    source: 'ALPACA_IEX',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
  },
  {
    symbol: 'NVDA',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    currency: 'USD',
    price: 135.5,
    priceStr: '135.50',
    open: 133.32,
    high: 138.0,
    low: 133.2,
    volume: 42800000,
    change: 2.18,
    changePercent: 1.64,
    source: 'ALPACA_IEX',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
  },
  {
    symbol: 'TSLA',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    currency: 'USD',
    price: 260.8,
    priceStr: '260.80',
    open: 250.48,
    high: 266.0,
    low: 252.0,
    volume: 35900000,
    change: 10.32,
    changePercent: 4.12,
    source: 'ALPACA_IEX',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
  },
  {
    symbol: 'AMZN',
    exchange: 'NASDAQ',
    assetType: 'EQUITY',
    currency: 'USD',
    price: 186.4,
    priceStr: '186.40',
    open: 184.8,
    high: 188.2,
    low: 183.9,
    volume: 24700000,
    change: 1.6,
    changePercent: 0.87,
    source: 'ALPACA_IEX',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
  },
  // Indian Equities (NSE)
  {
    symbol: 'RELIANCE',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 2950.0,
    priceStr: '2950.00',
    open: 2930.0,
    high: 2980.0,
    low: 2915.0,
    volume: 7400000,
    change: 20.0,
    changePercent: 0.68,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'TCS',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 3950.0,
    priceStr: '3950.00',
    open: 3920.0,
    high: 3990.0,
    low: 3910.0,
    volume: 2800000,
    change: 30.0,
    changePercent: 0.77,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'HDFCBANK',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 1650.0,
    priceStr: '1650.00',
    open: 1660.0,
    high: 1675.0,
    low: 1642.0,
    volume: 12500000,
    change: -10.0,
    changePercent: -0.6,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'INFY',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 1780.0,
    priceStr: '1780.00',
    open: 1765.0,
    high: 1795.0,
    low: 1758.0,
    volume: 6100000,
    change: 15.0,
    changePercent: 0.85,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'ICICIBANK',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 1180.0,
    priceStr: '1180.00',
    open: 1170.0,
    high: 1195.0,
    low: 1165.0,
    volume: 9800000,
    change: 10.0,
    changePercent: 0.85,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'SBIN',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 820.0,
    priceStr: '820.00',
    open: 815.0,
    high: 832.0,
    low: 810.0,
    volume: 15200000,
    change: 5.0,
    changePercent: 0.61,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'BHARTIARTL',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 1540.0,
    priceStr: '1540.00',
    open: 1525.0,
    high: 1555.0,
    low: 1520.0,
    volume: 4300000,
    change: 15.0,
    changePercent: 0.98,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'ITC',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 490.0,
    priceStr: '490.00',
    open: 488.0,
    high: 494.0,
    low: 486.0,
    volume: 8900000,
    change: 2.0,
    changePercent: 0.41,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'LT',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 3620.0,
    priceStr: '3620.00',
    open: 3600.0,
    high: 3660.0,
    low: 3585.0,
    volume: 1900000,
    change: 20.0,
    changePercent: 0.56,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'WIPRO',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 540.0,
    priceStr: '540.00',
    open: 535.0,
    high: 548.0,
    low: 532.0,
    volume: 4800000,
    change: 5.0,
    changePercent: 0.93,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'AXISBANK',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 1220.0,
    priceStr: '1220.00',
    open: 1210.0,
    high: 1235.0,
    low: 1205.0,
    volume: 5100000,
    change: 10.0,
    changePercent: 0.83,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'BAJFINANCE',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 7100.0,
    priceStr: '7100.00',
    open: 7050.0,
    high: 7180.0,
    low: 7020.0,
    volume: 1200000,
    change: 50.0,
    changePercent: 0.71,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'MARUTI',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 12400.0,
    priceStr: '12400.00',
    open: 12300.0,
    high: 12550.0,
    low: 12250.0,
    volume: 680000,
    change: 100.0,
    changePercent: 0.81,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'HINDUNILVR',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 2450.0,
    priceStr: '2450.00',
    open: 2465.0,
    high: 2480.0,
    low: 2440.0,
    volume: 1700000,
    change: -15.0,
    changePercent: -0.61,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
  {
    symbol: 'TATAMOTORS',
    exchange: 'NSE',
    assetType: 'EQUITY',
    currency: 'INR',
    price: 980.0,
    priceStr: '980.00',
    open: 965.0,
    high: 995.0,
    low: 960.0,
    volume: 14800000,
    change: 15.0,
    changePercent: 1.55,
    source: 'UPSTOX_V3',
    sourceTimestamp: Date.now(),
    receivedTimestamp: Date.now(),
    status: 'PREVIEW',
    regulatoryNotice: 'NSE Reference Data · Preview Only · Non-Redistributable',
  },
];

interface MarketDataContextType {
  quotes: Record<string, MarketQuote>;
  quotesList: MarketQuote[];
  providers: ProviderHealthStatus[];
  isLoading: boolean;
  error: string | null;
  getQuote: (symbol: string) => MarketQuote | undefined;
  refreshQuotes: () => Promise<void>;
  subscribeToCandles: (
    symbol: string,
    interval: string,
    callback: (payload: CandleUpdatePayload) => void
  ) => () => void;
  lastUpdated: number;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

export const MarketDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Pre-seed state with baseline dictionary
  const initialMap: Record<string, MarketQuote> = {};
  BASELINE_QUOTES.forEach((q) => {
    initialMap[q.symbol.toUpperCase()] = q;
  });

  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>(initialMap);
  const [providers, setProviders] = useState<ProviderHealthStatus[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const candleSubscribersRef = useRef<
    Array<{ symbol: string; interval: string; cb: (payload: CandleUpdatePayload) => void }>
  >([]);

  // Fetch initial REST quotes & provider statuses
  const refreshQuotes = useCallback(async () => {
    try {
      const [fetchedQuotes, fetchedProviders] = await Promise.all([
        apiService.getMarketQuotes().catch(() => []),
        apiService.getProviderStatuses().catch(() => []),
      ]);

      if (Array.isArray(fetchedQuotes) && fetchedQuotes.length > 0) {
        setQuotes((prev) => {
          const updated = { ...prev };
          fetchedQuotes.forEach((q) => {
            if (q && q.symbol) {
              updated[q.symbol.toUpperCase()] = q;
            }
          });
          return updated;
        });
      }

      if (Array.isArray(fetchedProviders) && fetchedProviders.length > 0) {
        setProviders(fetchedProviders);
      }

      setError(null);
      setLastUpdated(Date.now());
    } catch (err: any) {
      console.warn('[MarketData] REST hydration note:', err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Listen to WebSocket events dispatched from useWebSocket
  useEffect(() => {
    const handleWsQuote = (event: Event) => {
      const customEvent = event as CustomEvent<MarketQuote>;
      const quote = customEvent.detail;
      if (quote && quote.symbol) {
        setQuotes((prev) => ({
          ...prev,
          [quote.symbol.toUpperCase()]: quote,
        }));
        setLastUpdated(Date.now());
      }
    };

    const handleWsCandle = (event: Event) => {
      const customEvent = event as CustomEvent<CandleUpdatePayload>;
      const payload = customEvent.detail;
      if (payload && payload.symbol) {
        const symbolUpper = payload.symbol.toUpperCase();
        candleSubscribersRef.current.forEach((sub) => {
          if (
            sub.symbol.toUpperCase() === symbolUpper &&
            (!sub.interval || sub.interval === payload.interval)
          ) {
            sub.cb(payload);
          }
        });
      }
    };

    window.addEventListener('byte:market_quote', handleWsQuote);
    window.addEventListener('byte:candle_update', handleWsCandle);

    return () => {
      window.removeEventListener('byte:market_quote', handleWsQuote);
      window.removeEventListener('byte:candle_update', handleWsCandle);
    };
  }, []);

  // Initial load + periodic polling fallback (every 20s)
  useEffect(() => {
    refreshQuotes();
    const interval = setInterval(() => {
      refreshQuotes();
    }, 20000);

    return () => clearInterval(interval);
  }, [refreshQuotes]);

  const getQuote = useCallback(
    (symbol: string): MarketQuote | undefined => {
      if (!symbol) return undefined;
      const clean = symbol.trim().toUpperCase();
      // Try exact, then stripped of -USD or added -USD
      return (
        quotes[clean] ||
        quotes[clean.replace('-USD', '')] ||
        quotes[`${clean}-USD`] ||
        quotes['BYTE-USD']
      );
    },
    [quotes]
  );

  const subscribeToCandles = useCallback(
    (symbol: string, interval: string, callback: (payload: CandleUpdatePayload) => void) => {
      const sub = { symbol, interval, cb: callback };
      candleSubscribersRef.current.push(sub);

      return () => {
        candleSubscribersRef.current = candleSubscribersRef.current.filter((s) => s !== sub);
      };
    },
    []
  );

  const quotesList = Object.values(quotes);

  return (
    <MarketDataContext.Provider
      value={{
        quotes,
        quotesList,
        providers,
        isLoading,
        error,
        getQuote,
        refreshQuotes,
        subscribeToCandles,
        lastUpdated,
      }}
    >
      {children}
    </MarketDataContext.Provider>
  );
};

export const useMarketData = (): MarketDataContextType => {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketData must be used within a MarketDataProvider');
  }
  return context;
};
