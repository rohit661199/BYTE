import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { matchingEngine } from '../matching-engine/MatchingEngine.js';
import { StatsService } from './statsService.js';
import { TradeService } from './tradeService.js';
import { config } from '../config/env.js';

export type WsEventType =
  | 'ORDER_BOOK_UPDATE'
  | 'TRADE_EXECUTED'
  | 'STATS_UPDATE'
  | 'INIT'
  | 'MARKET_QUOTE_UPDATE'
  | 'CANDLE_UPDATE'
  | 'AUTH_RESPONSE';

export interface WsMessage {
  type: WsEventType;
  payload: unknown;
  timestamp: string;
}

export interface AuthenticatedWebSocket extends WebSocket {
  isAuthorizedPrivateSession?: boolean;
}

/**
 * Securely verifies private session tokens against expected backend secret.
 * Uses timingSafeEqual to prevent side-channel timing attacks.
 */
export function verifySessionToken(candidateToken?: string): boolean {
  if (config.upstox.commercialRedistribution) return true;
  const expectedToken = config.upstox.privateSessionToken || config.upstox.accessToken;
  if (!expectedToken || typeof expectedToken !== 'string' || expectedToken.trim().length === 0) {
    return false;
  }
  if (!candidateToken || typeof candidateToken !== 'string' || candidateToken.trim().length === 0) {
    return false;
  }
  const expBuf = Buffer.from(expectedToken.trim());
  const candBuf = Buffer.from(candidateToken.trim());
  if (expBuf.length !== candBuf.length) return false;
  return crypto.timingSafeEqual(expBuf, candBuf);
}

export class WebSocketService {
  private static wss: WebSocketServer | null = null;

  public static initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    logger.info('WebSocket Server initialized on path /ws');

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
      // Determine initial authorization from URL query params or headers
      let isAuthorized = false;

      try {
        const url = new URL(req.url || '', 'http://localhost');
        const queryToken = url.searchParams.get('token') || url.searchParams.get('auth');
        const authHeader = req.headers['authorization'];
        const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
        const headerToken = (req.headers['x-session-token'] as string) || bearer;
        const candidateToken = queryToken || headerToken;

        isAuthorized = verifySessionToken(candidateToken);
      } catch (_) {
        // Fall back to unauthorized
      }

      ws.isAuthorizedPrivateSession = isAuthorized;
      logger.info(`New WebSocket client connected (Authorized Private Session: ${isAuthorized}).`);

      // Send initial full snapshot upon client connection
      this.sendInitialSnapshot(ws);

      // Handle runtime auth messages: { type: 'AUTH', token: '...' }
      ws.on('message', (data: any) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed && parsed.type === 'AUTH') {
            const token = parsed.token;
            const valid = verifySessionToken(token);
            ws.isAuthorizedPrivateSession = valid;
            logger.info(`WebSocket client auth attempt: ${valid ? 'SUCCESS' : 'FAILED'}`);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'AUTH_RESPONSE',
                payload: { authorized: valid },
                timestamp: new Date().toISOString(),
              }));
            }
          }
        } catch (_) {
          // Ignore invalid JSON payloads
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket client disconnected.');
      });

      ws.on('error', (err) => {
        logger.error('WebSocket connection error:', err);
      });
    });
  }

  /**
   * Broadcast message to ALL connected clients (public & private).
   */
  public static broadcast(type: WsEventType, payload: unknown): void {
    if (!this.wss) return;

    const message: WsMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(message, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    });
  }

  /**
   * Broadcast message ONLY to authorized private sessions.
   * Public clients never receive this message.
   */
  public static broadcastToPrivate(type: WsEventType, payload: unknown): void {
    if (!this.wss) return;

    const message: WsMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(message, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && (client as AuthenticatedWebSocket).isAuthorizedPrivateSession) {
        client.send(serialized);
      }
    });
  }

  /**
   * Broadcast message ONLY to public (unauthorized) clients.
   */
  public static broadcastToPublic(type: WsEventType, payload: unknown): void {
    if (!this.wss) return;

    const message: WsMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(message, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && !(client as AuthenticatedWebSocket).isAuthorizedPrivateSession) {
        client.send(serialized);
      }
    });
  }

  /**
   * Broadcast audience-specific payloads:
   * Private clients receive `privatePayload` (or fallback to `publicPayload`).
   * Public clients receive `publicPayload` (if provided; if undefined, they receive nothing).
   */
  public static broadcastWithAudience(
    type: WsEventType,
    options: {
      publicPayload?: unknown;
      privatePayload?: unknown;
    }
  ): void {
    if (!this.wss) return;

    const now = new Date().toISOString();
    let serializedPublic: string | null = null;
    let serializedPrivate: string | null = null;

    if (options.publicPayload !== undefined) {
      serializedPublic = JSON.stringify(
        { type, payload: options.publicPayload, timestamp: now },
        (_key, value) => (typeof value === 'bigint' ? value.toString() : value)
      );
    }

    if (options.privatePayload !== undefined) {
      serializedPrivate = JSON.stringify(
        { type, payload: options.privatePayload, timestamp: now },
        (_key, value) => (typeof value === 'bigint' ? value.toString() : value)
      );
    }

    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const isPrivate = (client as AuthenticatedWebSocket).isAuthorizedPrivateSession;
      if (isPrivate && serializedPrivate) {
        client.send(serializedPrivate);
      } else if (!isPrivate && serializedPublic) {
        client.send(serializedPublic);
      } else if (isPrivate && serializedPublic && !serializedPrivate) {
        client.send(serializedPublic);
      }
    });
  }

  public static setClientAuthorization(ws: WebSocket, authorized: boolean): void {
    (ws as AuthenticatedWebSocket).isAuthorizedPrivateSession = authorized;
  }

  public static getWss(): WebSocketServer | null {
    return this.wss;
  }

  public static broadcastStateUpdates(): void {
    const orderbookSnapshot = matchingEngine.getOrderBookSnapshot();
    const stats = StatsService.getStats();
    const recentTrades = TradeService.getRecentTrades(20);

    this.broadcast('ORDER_BOOK_UPDATE', orderbookSnapshot);
    this.broadcast('STATS_UPDATE', stats);
    this.broadcast('TRADE_EXECUTED', recentTrades);
  }

  private static sendInitialSnapshot(ws: WebSocket): void {
    const orderbookSnapshot = matchingEngine.getOrderBookSnapshot();
    const stats = StatsService.getStats();
    const recentTrades = TradeService.getRecentTrades(20);

    const snapshotMessage: WsMessage = {
      type: 'INIT',
      payload: {
        orderBook: orderbookSnapshot,
        stats,
        recentTrades,
      },
      timestamp: new Date().toISOString(),
    };

    if (ws.readyState === WebSocket.OPEN) {
      const serialized = JSON.stringify(snapshotMessage, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
      ws.send(serialized);
    }
  }
}
