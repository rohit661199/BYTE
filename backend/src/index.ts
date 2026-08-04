import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { initDatabase } from './database/db.js';
import apiRouter from './routes/apiRouter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { WebSocketService } from './services/websocketService.js';

const app = express();
const server = http.createServer(app);

// Initialize Database Schema
initDatabase();

// Initialize WebSocket Broadcaster
WebSocketService.initialize(server);

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// API Routes (supports both /api prefix and direct Vercel serverless function rewrites)
app.use('/api', apiRouter);
app.use(apiRouter);

// Healthcheck Endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server.listen(config.port, () => {
    logger.info(`ByteExchange Server & WebSockets running on port ${config.port}`);
  });
}

export { server };
export default app;
