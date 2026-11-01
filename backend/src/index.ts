import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { initDatabase, pgPool, db } from './database/db.js';
import { MarketSessionManager } from './services/MarketSessionManager.js';
import { EngineManager } from './matching-engine/EngineManager.js';
import apiRouter from './routes/apiRouter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { WebSocketService } from './services/websocketService.js';

const app = express();
const server = http.createServer(app);

// Safe BigInt JSON serialization guard across all API responses
app.set('json replacer', (_key: string, value: any) =>
  typeof value === 'bigint' ? value.toString() : value
);

// 1. Initialize Database Schema & Migrations
initDatabase();

// 2. Durable Crash Recovery: Reconcile any interrupted AMOs BEFORE engine hydration
try {
  await MarketSessionManager.reconcileDispatchedAmos();
} catch (recErr) {
  logger.error('Failed to reconcile interrupted AMOs during startup:', recErr);
}

// 3. Hydrate all matching engines from reconciled database state
EngineManager.getInstance().hydrateAll();

// 4. Initialize WebSocket Broadcaster
WebSocketService.initialize(server);

// Production CORS & Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/api', apiRouter);
app.use(apiRouter);

// Root Welcome Endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'BYTE Exchange Backend API',
    status: 'online',
    version: '1.0.0',
    frontend: 'https://byte-nu.vercel.app',
    health: '/health',
    endpoints: {
      orderbook: '/api/orderbook',
      orders: '/api/orders',
      trades: '/api/trades',
      stats: '/api/stats',
    },
  });
});

// Healthcheck Endpoint with Connection Diagnostics
app.get('/health', async (_req, res) => {
  try {
    let dbStatus = 'in_memory';
    if (pgPool) {
      const client = await pgPool.connect();
      client.release();
      dbStatus = 'postgres_connected';
    } else if (db && db.memory === false && db.name) {
      dbStatus = `sqlite_persistent: ${path.basename(db.name)}`;
    }
    res.json({
      status: 'ok',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

import { AmoScheduler } from './services/AmoScheduler.js';
import { LiquiditySimulator } from './services/LiquiditySimulator.js';
import { MarketDataStreamingService } from './services/market-data/MarketDataStreamingService.js';

// Centralized Error Handling Middleware
app.use(errorHandler);

// Launch Continuous Server Process (Render / Railway / Docker / Local)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server.listen(config.port, async () => {
    logger.info(`ByteExchange Production Server & WebSockets running on port ${config.port}`);
    AmoScheduler.start();
    LiquiditySimulator.start();

    // Start market data streaming (provider failures are isolated and non-fatal)
    try {
      const streamingService = MarketDataStreamingService.getInstance();
      await streamingService.start();
    } catch (err) {
      logger.warn('MarketDataStreamingService failed to start. Market data will be unavailable:', err);
    }
  });
}

// Production Graceful Shutdown Handlers
const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  AmoScheduler.stop();
  LiquiditySimulator.stop();

  try {
    const streamingService = MarketDataStreamingService.getInstance();
    await streamingService.stop();
  } catch (_) {
    // Best-effort streaming shutdown
  }
  server.close(async () => {
    logger.info('HTTP & WebSocket server closed.');
    if (pgPool) {
      await pgPool.end();
      logger.info('PostgreSQL connection pool closed.');
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export { server };
export default app;
