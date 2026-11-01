import { MarketQuote, ProviderHealthStatus, Candle, CandleInterval } from '../../types/marketData.js';

export interface IMarketDataProvider {
  readonly name: string;
  readonly supportedSymbols: string[];
  initialize(): Promise<void>;
  getLatestQuote(symbol: string): Promise<MarketQuote | null>;
  getLatestQuotes(): Promise<MarketQuote[]>;
  getHistoricalCandles(symbol: string, interval: CandleInterval, limit?: number): Promise<Candle[]>;
  startStreaming(onQuote: (quote: MarketQuote) => void): Promise<void>;
  stopStreaming(): Promise<void>;
  getStatus(): ProviderHealthStatus;
}

