import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.VERCEL ? '/tmp/exchange.db' : (process.env.DB_PATH || './data/exchange.db'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  alpaca: {
    apiKey: process.env.ALPACA_API_KEY || '',
    apiSecret: process.env.ALPACA_API_SECRET || '',
    dataFeed: process.env.ALPACA_DATA_FEED || 'iex',
    baseUrl: process.env.ALPACA_BASE_URL || 'https://data.alpaca.markets',
    wsUrl: process.env.ALPACA_WS_URL || 'wss://stream.data.alpaca.markets/v2/iex',
  },
  upstox: {
    accessToken: process.env.UPSTOX_ACCESS_TOKEN || '',
    baseUrl: process.env.UPSTOX_BASE_URL || 'https://api.upstox.com',
    commercialRedistribution: process.env.UPSTOX_COMMERCIAL_REDISTRIBUTION === 'true',
    privateSessionToken: process.env.UPSTOX_PRIVATE_SESSION_TOKEN || process.env.UPSTOX_ACCESS_TOKEN || '',
  },
  binance: {
    restUrl: process.env.BINANCE_REST_URL || 'https://api.binance.com',
    wsUrl: process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443',
  },
  marketData: {
    reconnect: process.env.MARKET_DATA_RECONNECT !== 'false',
    cacheEnabled: process.env.MARKET_DATA_CACHE_ENABLED !== 'false',
  },
};
