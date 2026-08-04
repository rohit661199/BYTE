import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { matchingEngine } from '../matching-engine/MatchingEngine.js';
import { StatsService } from './statsService.js';
import { TradeService } from './tradeService.js';

export type WsEventType = 'ORDER_BOOK_UPDATE' | 'TRADE_EXECUTED' | 'STATS_UPDATE' | 'INIT';

export interface WsMessage {
  type: WsEventType;
  payload: unknown;
  timestamp: string;
}

export class WebSocketService {
  private static wss: WebSocketServer | null = null;

  public static initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    logger.info('WebSocket Server initialized on path /ws');

    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('New WebSocket client connected.');

      // Send initial full snapshot upon client connection
      this.sendInitialSnapshot(ws);

      ws.on('close', () => {
        logger.info('WebSocket client disconnected.');
      });

      ws.on('error', (err) => {
        logger.error('WebSocket connection error:', err);
      });
    });
  }

  public static broadcast(type: WsEventType, payload: unknown): void {
    if (!this.wss) return;

    const message: WsMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(message);

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    });
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
      ws.send(JSON.stringify(snapshotMessage));
    }
  }
}
