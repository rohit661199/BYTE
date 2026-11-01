# Phase 03: Complete Market Data Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, plug-and-play multi-asset market data infrastructure supporting US stocks (Alpaca IEX), Indian NSE stocks (Upstox V3), and Crypto (Binance), seamlessly integrated into BYTE's backend matching ecosystem, SQLite caching, WebSocket server, and frontend trading terminal, markets directory, ticker bar, and watchlists with zero budget (₹0).

**Architecture:** A unified provider adapter architecture where independent market data providers (`AlpacaMarketDataProvider`, `UpstoxMarketDataProvider`, `BinanceMarketDataProvider`) normalize feeds into a standard `MarketQuote` and `Candle` schema consumed by a `UnifiedMarketDataService`. Historical candles are cached in SQLite (`market_candles`), live updates are broadcast via the existing `WebSocketService`, and frontend components consume live reference data without confusing external reference prices with simulated order book liquidity.

**Tech Stack:** Node.js, TypeScript, Express, SQLite (`better-sqlite3`), `ws` (WebSockets), Axios, React 18, Vite, Tailwind CSS, Lucide icons.

**Spec:** User prompt for "BYTE Exchange — Phase 03: Complete Market Data Infrastructure".

---

## Global Constraints

1. **₹0 Budget:** Strictly free public endpoints and free developer tiers; no paid subscriptions, paid APIs, or recurring services.
2. **Provider Transparency:** Alpaca feed is explicitly identified as `IEX` (not full consolidated US tape); Upstox is identified with its personal developer scope and NSE redistribution restrictions; Binance uses free public REST and WebSockets without API keys.
3. **Data Integrity:** Explicit data status (`LIVE`, `DELAYED`, `STALE`, `PREVIEW`, `UNAVAILABLE`); never label fixture or delayed data as `LIVE`; no fake price generators.
4. **Separation of Concerns:** External reference prices must remain strictly separate from BYTE's internal simulated matching engine and liquidity simulator order book.
5. **Plug and Play:** Backend starts gracefully whether credentials are present or absent; missing credentials default to clearly labeled `PREVIEW` or `UNAVAILABLE` without crashing or blocking other providers.
6. **No Breaking Changes:** Preserve all Phase 01 frontend styling and Phase 02 matching engine, session manager, AMO scheduler, and liquidity simulator features. Do not start Phase 04 (Auth) or Phase 05 (Wallet/Ledger).

---

## Review Focus

1. **Provider Isolation Failure:** A network drop, authentication failure, or rate limit on Alpaca must not affect Binance or Upstox data streams.
2. **Timezone & Currency Mismatch:** Indian stocks must be denominated in `INR` (₹) with `Asia/Kolkata` market sessions; US stocks in `USD` ($) with `America/New_York`; Crypto in quote currency ($).
3. **WebSocket BigInt & Serialization Errors:** Any raw BigInts or malformed JSON payloads over WebSocket will crash client connections if not serialized safely.
4. **Historical Candle Gaps & Timeframe Mismatches:** Selecting timeframe intervals (`1m`, `5m`, `15m`, `1h`, `4h`, `1d`, `1w`) across providers with different native bar intervals must normalize gracefully.
5. **Liquidity Simulator vs Reference Price Drift:** The simulated order book must remain its own distinct order book while referencing external market prices for realistic paper trading.

---

## File Structure & Module Map

```text
backend/
├── src/
│   ├── config/
│   │   └── env.ts                                 [MODIFY: add Alpaca, Upstox, Binance env keys]
│   ├── types/
│   │   └── marketData.ts                          [CREATE: MarketQuote, Candle, DataStatus, provider interfaces]
│   ├── services/
│   │   ├── InstrumentRegistry.ts                  [MODIFY: add 15 NSE stocks, metadata, provider keys]
│   │   ├── NseExchangeCalendar.ts                 [CREATE: NSE calendar, IST hours, Indian holidays]
│   │   ├── websocketService.ts                    [MODIFY: add MARKET_QUOTE_UPDATE, MARKET_CANDLE_UPDATE]
│   │   └── market-data/
│   │       ├── IMarketDataProvider.ts             [CREATE: provider interface definition]
│   │       ├── AlpacaMarketDataProvider.ts        [CREATE: US equities IEX REST & WS adapter]
│   │       ├── UpstoxMarketDataProvider.ts        [CREATE: NSE equities V3 REST & WS adapter]
│   │       ├── BinanceMarketDataProvider.ts       [CREATE: Crypto public spot REST & WS adapter]
│   │       └── UnifiedMarketDataService.ts        [CREATE: aggregator, quote/candle cache, WS distributor]
│   ├── database/
│   │   ├── migrations/
│   │   │   └── 004_market_candles_cache.ts       [CREATE: SQLite table for OHLCV candle caching]
│   │   └── db.ts                                  [MODIFY: register migration 004, update MemoryDB mock]
│   ├── controllers/
│   │   └── marketDataController.ts                [CREATE: /api/market quotes, candles, status handlers]
│   ├── routes/
│   │   ├── marketDataRoutes.ts                    [CREATE: market data REST router]
│   │   └── apiRouter.ts                           [MODIFY: mount /market router]
│   └── index.ts                                   [MODIFY: initialize UnifiedMarketDataService on startup]
└── tests/
    └── step1_market_data_foundation.test.ts       [CREATE: tests for types, NSE calendar, registry]
    └── step2_market_providers.test.ts             [CREATE: tests for Alpaca, Upstox, Binance adapters]
    └── step3_historical_candles.test.ts          [CREATE: tests for candle fetching, caching, intervals]
    └── step4_live_market_service.test.ts          [CREATE: tests for live aggregator, WS events, reconnect]

frontend/
├── src/
│   ├── types/
│   │   └── index.ts                               [MODIFY: add MarketQuote, Candle, MarketSessionInfo]
│   ├── services/
│   │   └── api.ts                                 [MODIFY: add getMarketQuotes, getCandles, getMarketStatus]
│   ├── hooks/
│   │   ├── useWebSocket.ts                        [MODIFY: handle MARKET_QUOTE_UPDATE & MARKET_CANDLE_UPDATE]
│   │   └── useMarketData.ts                       [CREATE: dedicated hook for quotes, candles, session status]
│   ├── components/
│   │   ├── layout/
│   │   │   └── TickerBar.tsx                      [MODIFY: real live quote stream, currency, badge status]
│   │   ├── trading/
│   │   │   ├── TradingHeader.tsx                  [MODIFY: real reference quotes, 24h stats, session status]
│   │   │   ├── TradingChart.tsx                   [MODIFY: real historical candles, live candle updates]
│   │   │   └── TradingWatchlist.tsx               [MODIFY: live multi-asset prices and daily changes]
│   └── pages/
│       ├── MarketsPage.tsx                        [MODIFY: US + NSE + Crypto live directory, search, filter]
│       └── WatchlistPage.tsx                      [MODIFY: live quotes, currency-aware formatting]
.env.example                                       [CREATE: complete plug-and-play documentation and keys]
```

---

## Step-by-Step Implementation Tasks

### Task 1: Market Data Foundation & InstrumentRegistry Extension (Step 1)

**Files:**
- Create: `backend/src/types/marketData.ts`
- Create: `backend/src/services/NseExchangeCalendar.ts`
- Create: `backend/src/database/migrations/004_market_candles_cache.ts`
- Modify: `backend/src/services/InstrumentRegistry.ts`
- Modify: `backend/src/database/db.ts`
- Test: `backend/tests/step1_market_data_foundation.test.ts`

**Interfaces:**
- Produces:
  - `MarketQuote`: Canonical quote format with `DataStatus` (`LIVE`, `DELAYED`, `STALE`, `PREVIEW`, `UNAVAILABLE`).
  - `Candle`: OHLCV structure with timestamp in ms.
  - `NseExchangeCalendar`: Indian market session tracker (`09:15-15:30 IST`, weekdays, holiday calendar).
  - `InstrumentRegistry`: 15 NSE stocks (`RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `ICICIBANK`, `SBIN`, `BHARTIARTL`, `ITC`, `LT`, `WIPRO`, `AXISBANK`, `BAJFINANCE`, `MARUTI`, `HINDUNILVR`, `TATAMOTORS`) with `currency = 'INR'`, tick size `0.05`, and venue `'NSE'`.

- [ ] **Step 1: Write failing unit tests in `backend/tests/step1_market_data_foundation.test.ts`**
  - Test registration of 15 NSE instruments.
  - Test currency attribution (`INR` for NSE, `USD` for US stocks/crypto).
  - Test `NseExchangeCalendar` trading sessions (regular hours 09:15-15:30 IST, weekends closed, holidays closed).
  - Test canonical symbol resolution and alias handling.

- [ ] **Step 2: Run test to verify failure**
  - Run: `npx vitest run tests/step1_market_data_foundation.test.ts`
  - Expected: FAIL with missing modules or types.

- [ ] **Step 3: Implement `backend/src/types/marketData.ts`**
  - Define `DataStatus`, `MarketQuote`, `Candle`, `CandleInterval`, `ProviderHealthStatus`.

- [ ] **Step 4: Implement `backend/src/services/NseExchangeCalendar.ts`**
  - Implement time conversions for `Asia/Kolkata`, official NSE trading hours (09:15 to 15:30 IST), and official NSE holiday calendar for 2024–2026.

- [ ] **Step 5: Extend `backend/src/services/InstrumentRegistry.ts`**
  - Add `ExchangeVenue` (`'NSE'`), `MarketSessionType` (`'NSE_EQUITY'`), and the 15 NSE instruments with appropriate baseline prices and fundamentals.

- [ ] **Step 6: Create migration `004_market_candles_cache.ts` and register in `backend/src/database/db.ts`**
  - Schema: `market_candles(symbol, interval, timestamp, open, high, low, close, volume, source, PRIMARY KEY (symbol, interval, timestamp))`.
  - Update `MIGRATIONS` array and `MemoryDB` mock.

- [ ] **Step 7: Run tests to verify pass**
  - Run: `npx vitest run tests/step1_market_data_foundation.test.ts`
  - Expected: PASS.

---

### Task 2: Provider Adapters (Alpaca, Upstox, Binance) (Step 2)

**Files:**
- Create: `backend/src/services/market-data/IMarketDataProvider.ts`
- Create: `backend/src/services/market-data/AlpacaMarketDataProvider.ts`
- Create: `backend/src/services/market-data/UpstoxMarketDataProvider.ts`
- Create: `backend/src/services/market-data/BinanceMarketDataProvider.ts`
- Modify: `backend/src/config/env.ts`
- Test: `backend/tests/step2_market_providers.test.ts`

**Interfaces:**
- Consumes: `MarketQuote`, `Candle`, `IMarketDataProvider`.
- Produces: Normalized data feeds across US equities (Alpaca IEX), Indian equities (Upstox V3), and Crypto (Binance).

- [ ] **Step 1: Write failing unit tests in `backend/tests/step2_market_providers.test.ts`**
  - Test Binance adapter quote and kline parsing (live unauthenticated endpoints).
  - Test Alpaca adapter quote and bar normalization with mock/real responses.
  - Test Upstox adapter quote normalization, token validation, and graceful unauthenticated fallback.
  - Test error isolation: Binance failure or missing Alpaca keys does not prevent other providers from functioning.

- [ ] **Step 2: Run test to verify failure**
  - Run: `npx vitest run tests/step2_market_providers.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Define `IMarketDataProvider.ts`**
  - Lifecycle: `initialize()`, `getLatestQuote(symbol)`, `getHistoricalCandles(symbol, interval, limit)`, `startStreaming(onQuote, onCandle)`, `stopStreaming()`, `getStatus()`.

- [ ] **Step 4: Implement `BinanceMarketDataProvider.ts`**
  - Connect to `https://api.binance.com/api/v3/ticker/24hr` and `https://api.binance.com/api/v3/klines`.
  - WebSocket stream: `wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker/solusdt@ticker/btcusdt@kline_1m/ethusdt@kline_1m/solusdt@kline_1m`.
  - Zero API key requirement; 24/7 continuous operation.

- [ ] **Step 5: Implement `AlpacaMarketDataProvider.ts`**
  - Connect to `https://data.alpaca.markets/v2/stocks/bars` with `feed=iex`.
  - WebSocket stream: `wss://stream.data.alpaca.markets/v2/iex` with `{action: 'auth', key, secret}` and `{action: 'subscribe', bars: [...], quotes: [...]}`.
  - If keys are missing, return `PREVIEW` status with clear configuration message.

- [ ] **Step 6: Implement `UpstoxMarketDataProvider.ts`**
  - Connect to Upstox V3 REST quote endpoints (`https://api.upstox.com/v3/market-quote/ltp`) and historical candle endpoints.
  - Document personal developer scope and NSE non-redistribution notice.
  - If token is missing or expired, return `PREVIEW` status with baseline quotes.

- [ ] **Step 7: Run tests to verify pass**
  - Run: `npx vitest run tests/step2_market_providers.test.ts`
  - Expected: PASS.

---

### Task 3: Historical Market Data & SQLite Caching (Step 3)

**Files:**
- Create: `backend/src/services/market-data/HistoricalDataService.ts`
- Modify: `backend/src/services/market-data/UnifiedMarketDataService.ts`
- Test: `backend/tests/step3_historical_candles.test.ts`

**Interfaces:**
- Consumes: Provider `getHistoricalCandles`, SQLite `market_candles` table.
- Produces: `getCandles(symbol, interval, limit)` with transparent write-through caching.

- [ ] **Step 1: Write failing unit tests in `backend/tests/step3_historical_candles.test.ts`**
  - Test historical candle retrieval for US stocks, NSE stocks, and crypto across intervals (`1m`, `5m`, `15m`, `1h`, `4h`, `1d`, `1w`).
  - Test SQLite caching: second query retrieves from cache without hitting external provider.
  - Test candle ordering: chronological ascending order (`timestamp ASC`).
  - Test missing candle gaps handling without fabricating fake price ticks.

- [ ] **Step 2: Run test to verify failure**
  - Run: `npx vitest run tests/step3_historical_candles.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Implement `HistoricalDataService.ts`**
  - Query SQLite `market_candles` table.
  - If cached candles are insufficient or older than TTL, fetch from the corresponding provider adapter and persist with `INSERT OR REPLACE INTO market_candles`.
  - Support fallback generation of higher timeframe candles (e.g. 5m from 1m) if provider only yields 1m bars.

- [ ] **Step 4: Run tests to verify pass**
  - Run: `npx vitest run tests/step3_historical_candles.test.ts`
  - Expected: PASS.

---

### Task 4: Unified Market Data Service & Live WebSocket Broadcasting (Step 4)

**Files:**
- Create: `backend/src/services/market-data/UnifiedMarketDataService.ts`
- Modify: `backend/src/services/websocketService.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/tests/step4_live_market_service.test.ts`

**Interfaces:**
- Consumes: All 3 provider adapters, `HistoricalDataService`.
- Produces:
  - `UnifiedMarketDataService.getQuote(symbol)`
  - `UnifiedMarketDataService.getAllQuotes()`
  - `UnifiedMarketDataService.getCandles(symbol, interval, limit)`
  - Broadcasts `MARKET_QUOTE_UPDATE` and `MARKET_CANDLE_UPDATE` via `WebSocketService`.

- [ ] **Step 1: Write failing unit tests in `backend/tests/step4_live_market_service.test.ts`**
  - Test provider aggregation: Unified service manages all 23 instruments.
  - Test WebSocket broadcasting: Streaming quotes from Binance or Alpaca trigger `WebSocketService.broadcast`.
  - Test stale quote detection: Quotes older than 60 seconds outside active sessions or 15 seconds during live market marked `STALE`.
  - Test automatic reconnection logic with exponential backoff on provider disconnect.

- [ ] **Step 2: Run test to verify failure**
  - Run: `npx vitest run tests/step4_live_market_service.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Implement `UnifiedMarketDataService.ts`**
  - Manages provider lifecycles.
  - On quote update, updates in-memory cache, checks stale status, and triggers `WebSocketService.broadcast('MARKET_QUOTE_UPDATE', quote)`.
  - On candle update, updates active candle and broadcasts `MARKET_CANDLE_UPDATE`.

- [ ] **Step 4: Update `WebSocketService.ts`**
  - Add `MARKET_QUOTE_UPDATE` and `MARKET_CANDLE_UPDATE` to `WsEventType`.
  - Include current quotes snapshot in `INIT` payload so clients hydrate immediately on connection.

- [ ] **Step 5: Wire startup in `backend/src/index.ts`**
  - Start `UnifiedMarketDataService.initialize()` gracefully on server boot.
  - Hook shutdown into `handleShutdown`.

- [ ] **Step 6: Run tests to verify pass**
  - Run: `npx vitest run tests/step4_live_market_service.test.ts`
  - Expected: PASS.

---

### Task 5: REST Endpoints & Environment Configuration (Step 5)

**Files:**
- Create: `backend/src/controllers/marketDataController.ts`
- Create: `backend/src/routes/marketDataRoutes.ts`
- Modify: `backend/src/routes/apiRouter.ts`
- Create: `.env.example`
- Test: `backend/tests/step5_market_api_routes.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/market/quotes`
  - `GET /api/market/quote/:symbol`
  - `GET /api/market/candles/:symbol?interval=15m&limit=100`
  - `GET /api/market/status`

- [ ] **Step 1: Write failing tests in `backend/tests/step5_market_api_routes.test.ts`**
  - Test `GET /api/market/quotes` returns all 23 instruments with currency, status, and price fields.
  - Test `GET /api/market/quote/AAPL` returns US stock quote with IEX attribution.
  - Test `GET /api/market/quote/RELIANCE` returns NSE quote in INR with session status.
  - Test `GET /api/market/candles/BTC-USD` returns valid OHLCV candles array.
  - Test `GET /api/market/status` returns provider health.

- [ ] **Step 2: Run test to verify failure**
  - Run: `npx vitest run tests/step5_market_api_routes.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Implement `marketDataController.ts` and `marketDataRoutes.ts`**
  - Add request validation, canonical symbol resolution via `InstrumentRegistry`, and response caching headers.

- [ ] **Step 4: Mount router in `backend/src/routes/apiRouter.ts`**
  - `apiRouter.use('/market', marketDataRoutes)`.

- [ ] **Step 5: Create complete `.env.example`**
  - Document all environment variables:
    ```bash
    # US Stock Market (Alpaca - Free IEX Feed)
    ALPACA_API_KEY=
    ALPACA_API_SECRET=
    ALPACA_DATA_FEED=iex
    ALPACA_BASE_URL=https://data.alpaca.markets

    # Indian Stock Market (Upstox V3 - Developer API)
    UPSTOX_ACCESS_TOKEN=
    UPSTOX_BASE_URL=https://api.upstox.com

    # Crypto (Binance Public - No Key Required)
    BINANCE_REST_URL=https://api.binance.com
    BINANCE_WS_URL=wss://stream.binance.com:9443

    # Market Data Engine Settings
    MARKET_DATA_RECONNECT=true
    MARKET_DATA_CACHE_ENABLED=true
    ```

- [ ] **Step 6: Run tests to verify pass**
  - Run: `npx vitest run tests/step5_market_api_routes.test.ts`
  - Expected: PASS.

---

### Task 6: Complete Frontend Integration (Step 6)

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/hooks/useMarketData.ts`
- Modify: `frontend/src/hooks/useWebSocket.ts`
- Modify: `frontend/src/components/layout/TickerBar.tsx`
- Modify: `frontend/src/pages/MarketsPage.tsx`
- Modify: `frontend/src/components/trading/TradingHeader.tsx`
- Modify: `frontend/src/components/trading/TradingChart.tsx`
- Modify: `frontend/src/components/trading/TradingWatchlist.tsx`
- Modify: `frontend/src/pages/WatchlistPage.tsx`

**Interfaces:**
- Consumes: REST endpoints (`/api/market/*`) and WebSocket events (`MARKET_QUOTE_UPDATE`, `MARKET_CANDLE_UPDATE`).
- Produces: Live, auto-updating, currency-formatted UI with zero manual polling.

- [ ] **Step 1: Extend frontend types in `frontend/src/types/index.ts`**
  - Add `MarketQuote`, `Candle`, `DataStatus`, `MarketSessionStatus`.

- [ ] **Step 2: Add API client methods in `frontend/src/services/api.ts`**
  - `getMarketQuotes()`, `getMarketQuote(symbol)`, `getCandles(symbol, interval, limit)`, `getMarketStatus()`.

- [ ] **Step 3: Create `frontend/src/hooks/useMarketData.ts`**
  - Subscribes to quotes map.
  - Computes flash animation states (green/red background flashes on price ticks).
  - Provides helper for currency formatting (`$` for USD, `₹` for INR).

- [ ] **Step 4: Update `frontend/src/components/layout/TickerBar.tsx`**
  - Render real live quotes across US, NSE, and Crypto instruments.
  - Show proper currency symbol, % change, and `LIVE` / `PREVIEW` badge.

- [ ] **Step 5: Update `frontend/src/pages/MarketsPage.tsx`**
  - Render all 23 instruments.
  - Filter tabs: `All`, `US Stocks`, `Indian Stocks (NSE)`, `Crypto`.
  - Search by symbol or company name.
  - Display actual reference prices, 24h high/low, volume, and data status.

- [ ] **Step 6: Update `frontend/src/components/trading/TradingHeader.tsx` & `TradingWatchlist.tsx`**
  - Show live quote, 24h change, day high/low, and market session badge (`Regular`, `Pre-market`, `Closed`).

- [ ] **Step 7: Update `frontend/src/components/trading/TradingChart.tsx`**
  - Replace static `candles` array with dynamic candle fetching via `apiService.getCandles(symbol, activeTf)`.
  - Update the active (last) candle when a new `MARKET_CANDLE_UPDATE` or `MARKET_QUOTE_UPDATE` event arrives.
  - Display loading spinner while candles load.

- [ ] **Step 8: Update `frontend/src/pages/WatchlistPage.tsx`**
  - Show live multi-asset watchlist with real prices, % change, and currency formatting.

---

### Task 7: Full System Verification & Regression Testing

**Files:**
- Run: Entire backend test suite (`npm test`)
- Run: Backend type check & build (`npm run build` in `backend`)
- Run: Frontend type check & build (`npm run build` in `frontend`)
- Run: Live integration verification tests against public endpoints (Binance live, Alpaca/Upstox validation)

- [ ] **Step 1: Run complete backend test suite**
  - Run: `npm test` in `backend/`
  - Expected: All test suites pass (original 195 tests + all new Phase 03 tests).

- [ ] **Step 2: Run backend TypeScript build**
  - Run: `npm run build` in `backend/`
  - Expected: Exit code 0 (0 errors).

- [ ] **Step 3: Run frontend TypeScript build**
  - Run: `npm run build` in `frontend/`
  - Expected: Exit code 0 (0 errors).

- [ ] **Step 4: Update `PROJECT_STATUS.md`**
  - Record Phase 03 deliverables, test counts, and verified capabilities.
