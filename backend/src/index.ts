import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    logger.info(`ByteExchange Backend Server running on port ${config.port}`);
  });
}

export default app;
