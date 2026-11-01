import { Router } from 'express';
import {
  getQuotes,
  getQuoteBySymbol,
  getCandles,
  getProviderStatus,
} from '../controllers/marketDataController.js';

const marketDataRoutes = Router();

// Quotes
marketDataRoutes.get('/quotes', getQuotes);
marketDataRoutes.get('/quotes/:symbol', getQuoteBySymbol);

// Historical candles
marketDataRoutes.get('/candles/:symbol', getCandles);

// Provider health
marketDataRoutes.get('/providers', getProviderStatus);

export default marketDataRoutes;
