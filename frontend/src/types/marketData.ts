export type DataStatus = 'LIVE' | 'DELAYED' | 'STALE' | 'PREVIEW' | 'UNAVAILABLE';

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export interface MarketQuote {
  symbol: string; // Canonical symbol (e.g. 'AAPL', 'RELIANCE', 'BTC-USD', 'BYTE-USD')
  exchange: string; // e.g. 'NASDAQ', 'NYSE', 'NSE', 'BINANCE', 'BYTE_SIM'
  assetType: 'EQUITY' | 'CRYPTO' | 'UTILITY';
  currency: 'USD' | 'INR';
  price: number;
  priceStr: string;
  previousClose?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  source: string; // e.g. 'ALPACA_IEX', 'UPSTOX_V3', 'BINANCE_PUBLIC', 'BYTE_SIM'
  sourceTimestamp: number;
  receivedTimestamp: number;
  status: DataStatus;
  regulatoryNotice?: string;
}

export interface Candle {
  timestamp: number; // Unix epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source?: string;
}

export interface ProviderHealthStatus {
  name: string;
  connected: boolean;
  status: DataStatus;
  lastUpdateTimestamp?: number;
  error?: string;
  redistributionNotice?: string;
}

export interface CandleUpdatePayload {
  symbol: string;
  interval: string;
  candle: Candle;
  isForming?: boolean;
  isComplete?: boolean;
}
