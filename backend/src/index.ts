import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { initDatabase } from './database/db.js';
import apiRouter from './routes/apiRouter.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Initialize SQLite Database Schema
initDatabase();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Healthcheck Endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    logger.info(`ByteExchange Backend Server running on port ${config.port}`);
  });
}

export default app;
