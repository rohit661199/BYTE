import { Request, Response } from 'express';
import crypto from 'crypto';
import { MarketDataStreamingService } from '../services/market-data/MarketDataStreamingService.js';
import { HistoricalDataService } from '../services/market-data/HistoricalDataService.js';
import { InstrumentRegistry } from '../services/InstrumentRegistry.js';
import { CandleInterval } from '../types/marketData.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const VALID_INTERVALS: CandleInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

/**
 * Checks whether an incoming HTTP request belongs to an authorized private session.
 * Uses timingSafeEqual to prevent side-channel timing attacks on secret tokens.
 */
export function isAuthorizedPrivateSession(req: Request): boolean {
  if (config.upstox.commercialRedistribution) return true;
  const expectedToken = config.upstox.privateSessionToken || config.upstox.accessToken;
  if (!expectedToken || typeof expectedToken !== 'string' || expectedToken.trim().length === 0) {
    return false;
  }

  const authHeader = req.headers['authorization'];
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const headerToken = (req.headers['x-session-token'] as string) || bearer;
  const queryToken = req.query.token as string | undefined;
  const candidateToken = queryToken || headerToken;

  if (!candidateToken || typeof candidateToken !== 'string' || candidateToken.trim().length === 0) {
    return false;
  }

  const expBuf = Buffer.from(expectedToken.trim());
  const candBuf = Buffer.from(candidateToken.trim());
  if (expBuf.length !== candBuf.length) return false;
  return crypto.timingSafeEqual(expBuf, candBuf);
}

/**
 * GET /api/market-data/quotes
 * Returns all latest quotes across all providers.
 * Optional query: ?assetType=CRYPTO|EQUITY|UTILITY
 */
export async function getQuotes(req: Request, res: Response): Promise<void> {
  try {
    const streaming = MarketDataStreamingService.getInstance();
    const assetType = req.query.assetType as string | undefined;
    const isPrivate = isAuthorizedPrivateSession(req);

    let quotes;
    if (assetType && ['EQUITY', 'CRYPTO', 'UTILITY'].includes(assetType.toUpperCase())) {
      quotes = streaming.getQuotesByAssetType(assetType.toUpperCase() as 'EQUITY' | 'CRYPTO' | 'UTILITY', isPrivate);
    } else {
      quotes = streaming.getAllLatestQuotes(isPrivate);
    }

    res.json({ success: true, data: quotes, count: quotes.length });
  } catch (err: any) {
    logger.error(`[MarketDataController] getQuotes error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to retrieve quotes' });
  }
}

/**
 * GET /api/market-data/quotes/:symbol
 * Returns the latest quote for a specific symbol.
 */
export async function getQuoteBySymbol(req: Request, res: Response): Promise<void> {
  try {
    const symbol = InstrumentRegistry.getCanonicalSymbol(String(req.params.symbol));
    const streaming = MarketDataStreamingService.getInstance();
    const isPrivate = isAuthorizedPrivateSession(req);
    const quote = streaming.getLatestQuote(symbol, isPrivate);

    if (!quote) {
      res.status(404).json({ success: false, error: `No quote available for symbol: ${req.params.symbol}` });
      return;
    }

    res.json({ success: true, data: quote });
  } catch (err: any) {
    logger.error(`[MarketDataController] getQuoteBySymbol error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to retrieve quote' });
  }
}

/**
 * GET /api/market-data/candles/:symbol
 * Returns historical OHLCV candles for a symbol.
 * Query params: ?interval=1d&limit=100
 */
export async function getCandles(req: Request, res: Response): Promise<void> {
  try {
    const symbol = InstrumentRegistry.getCanonicalSymbol(String(req.params.symbol));
    const interval = (req.query.interval as CandleInterval) || '1d';
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 100, 1), 1000);

    if (!VALID_INTERVALS.includes(interval)) {
      res.status(400).json({
        success: false,
        error: `Invalid interval '${interval}'. Valid intervals: ${VALID_INTERVALS.join(', ')}`,
      });
      return;
    }

    const instrument = InstrumentRegistry.getInstrument(symbol);
    if (!instrument) {
      res.status(404).json({ success: false, error: `Unknown instrument: ${req.params.symbol}` });
      return;
    }

    const histService = HistoricalDataService.getInstance();
    const candles = await histService.getCandles(symbol, interval, limit);

    // Append the currently-forming candle if available and permissible
    const isPrivate = isAuthorizedPrivateSession(req);
    const isUpstox = instrument.venue === 'NSE';
    const hasCommercialRights = config.upstox.commercialRedistribution;

    const streaming = MarketDataStreamingService.getInstance();
    let formingCandle = null;

    if (interval === '1m') {
      if (!isUpstox || hasCommercialRights || isPrivate) {
        formingCandle = streaming.getFormingCandle(symbol, '1m');
      }
    }

    res.json({
      success: true,
      data: {
        symbol,
        interval,
        candles,
        formingCandle,
        count: candles.length,
      },
    });
  } catch (err: any) {
    logger.error(`[MarketDataController] getCandles error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to retrieve candles' });
  }
}

/**
 * GET /api/market-data/providers
 * Returns health/status of all market data providers.
 */
export async function getProviderStatus(_req: Request, res: Response): Promise<void> {
  try {
    const streaming = MarketDataStreamingService.getInstance();
    const statuses = streaming.getProviderStatuses();

    res.json({ success: true, data: statuses });
  } catch (err: any) {
    logger.error(`[MarketDataController] getProviderStatus error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to retrieve provider status' });
  }
}
