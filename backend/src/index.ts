import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { initDatabase, pgPool } from './database/db.js';
import apiRouter from './routes/apiRouter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { WebSocketService } from './services/websocketService.js';

const app = express();
const server = http.createServer(app);

// Initialize Database Schema
initDatabase();

// Initialize WebSocket Broadcaster
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
    let dbStatus = 'sqlite_or_memory';
    if (pgPool) {
      const client = await pgPool.connect();
      client.release();
      dbStatus = 'postgres_connected';
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

// Centralized Error Handling Middleware
app.use(errorHandler);

// Launch Continuous Server Process (Render / Railway / Docker / Local)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server.listen(config.port, () => {
    logger.info(`ByteExchange Production Server & WebSockets running on port ${config.port}`);
  });
}

// Production Graceful Shutdown Handlers
const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
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
