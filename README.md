# BYTE Exchange — High-Performance Order Matching Engine & Real-Time Trading Terminal

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL--Mode-blue.svg)](https://www.sqlite.org/)
[![Vitest](https://img.shields.io/badge/Vitest-3.0-yellow.svg)](https://vitest.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)](https://www.docker.com/)

An interview-quality, production-grade **Order Matching Engine and Real-Time Trading Terminal** built for a fictional asset called **`BYTE`**.

Designed and implemented following **Clean Architecture principles**, robust Price-Time Priority order matching, atomic SQLite durability, real-time WebSocket broadcasting, and automated Vitest unit testing.

---

## 🌟 Project Overview & Key Features

### ⚙️ Core Matching Engine & Execution
- **Price-Time Priority (FIFO) Matching**: In-memory matching engine supporting both **`LIMIT`** and **`MARKET`** orders.
  - **Bids (Buy Book)**: Sorted descending by price (highest price first); tie-breaker is oldest timestamp.
  - **Asks (Sell Book)**: Sorted ascending by price (lowest price first); tie-breaker is oldest timestamp.
- **Specification-Compliant Execution Price**: Trade execution price strictly records at the **SELL order price** ($95$ in `BUY 100 vs SELL 95`), exactly adhering to the exchange specification.
- **Partial Fills & Multi-Level Sweeps**: Handles partial order fills, remaining quantities, and sweeping multiple counter-order price levels.
- **Market Order Liquidity Guard**: MARKET BUY executes against lowest available SELL asks; MARKET SELL executes against highest available BUY bids. Returns `"No liquidity available"` if opposite book is empty.
- **Order Cancellation (Bonus)**: Instant cancellation of resting open orders from in-memory engine and database (`DELETE /api/orders/:id`).
- **Reset Engine Feature**: One-click reset feature (`POST /api/orders/reset`) wiping active orders, trade history, and statistics back to fresh state.

### 💾 Persistence & Real-Time Sync
- **Atomic SQLite WAL Mode Persistence**: Zero-latency, synchronous persistence via `better-sqlite3` operating in Write-Ahead Logging (WAL) mode. Orderbook state is automatically hydrated from persistent DB rows on server startup.
- **Real-Time WebSockets (`ws`)**: Instant event streaming (`ORDER_BOOK_UPDATE`, `TRADE_EXECUTED`, `STATS_UPDATE`) to connected frontend clients.

### 🎨 Trading Dashboard UI
- **Modern Dark Trading Terminal**: Built with React 18 + Vite + TypeScript + TailwindCSS.
- **Visual Liquidity Depth Bars**: Orderbook columns dynamically visualize volume depth ratios per price level.
- **Real-Time Trade Stream**: Live executed trade stream showing Price, Quantity, and Time (`HH:mm:ss`).
- **Order Entry Panel**: Tabbed BUY/SELL selector, LIMIT/MARKET toggle, quick quantity presets (+1, +5, +10, +25, +50), estimated total calculation, and Zod error toast display.

### 🧪 Quality Assurance & Containerization
- **100% Vitest Unit Test Suite**: 8 automated unit tests covering full matches, partial fills, Price-Time priority sorting, market orders, order cancellations, and multi-level sweeps (**8/8 passed in 72ms**).
- **Docker & Docker-Compose**: Production-ready multi-stage Docker builds for Express backend and Nginx-served frontend.

---

## 📁 Repository Directory Structure

```
BYTE/
├── backend/            # Express.js + TypeScript + SQLite Engine
│   ├── src/
│   │   ├── config/           # Environment & configuration loader
│   │   ├── controllers/      # REST API request handlers
│   │   ├── database/         # SQLite connection, schema & WAL mode initialization
│   │   ├── matching-engine/  # Core Price-Time Priority Matching Engine
│   │   ├── middlewares/      # Zod validation & centralized error handling
│   │   ├── models/           # SQLite Data Repositories (prepared statements)
│   │   ├── routes/           # Express router endpoints
│   │   ├── services/         # Business logic layer & engine bridge
│   │   ├── types/            # Strict TypeScript domain interfaces
│   │   └── utils/            # Logger & helper utilities
│   ├── tests/                # Vitest unit test suite (matchingEngine.test.ts)
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/           # React 18 + Vite + TypeScript + TailwindCSS Dashboard
│   ├── src/
│   │   ├── components/       # UI Components (Navbar, StatsCards, OrderForm, OrderBook, etc.)
│   │   ├── hooks/            # Custom Hooks (useWebSocket real-time sync)
│   │   ├── pages/            # View Layouts (Dashboard)
│   │   ├── services/         # Axios API client
│   │   ├── types/            # Shared TypeScript types
│   │   └── utils/            # Currency & time formatters
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml  # Container orchestration
├── design-decisions.md # Detailed technical decisions, complexity & scaling analysis
├── architecture.md     # System architecture & Mermaid sequence diagrams
└── README.md           # Master project documentation
```

---

## ⚡ Quick Start & Running Locally

### Prerequisites
- **Node.js**: v18+ (v22 recommended)
- **npm**: v9+

### 1. Setup Dependencies

```bash
git clone https://github.com/rohit661199/BYTE.git
cd BYTE

# Install both backend and frontend dependencies
npm run setup
```

### 2. Running Dev Servers

Launch both the Express Backend and React Frontend dev servers concurrently:

```bash
# Terminal 1: Launch Backend Server (Port 5000)
cd backend
npm run dev

# Terminal 2: Launch Frontend Dashboard (Port 5173)
cd frontend
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser!

---

## 🐳 Running via Docker & Docker-Compose

Run the complete containerized application using Docker:

```bash
docker-compose up --build
```

- **Frontend Dashboard**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`

---

## 🧪 Running Automated Unit Tests

Execute the Vitest matching engine unit test suite:

```bash
# Run tests inside backend directory
cd backend
npm test
```

### Test Suite Output:
```bash
 ✓ tests/matchingEngine.test.ts (8 tests) 72ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Duration  1.69s
```

---

## 📖 API Documentation

### Base URL: `http://localhost:5000/api`

### 1. Submit New Order (`POST /api/orders`)
- **Limit Order Body**:
```json
{
  "side": "BUY",
  "type": "LIMIT",
  "price": 100.00,
  "quantity": 5
}
```
- **Market Order Body**:
```json
{
  "side": "BUY",
  "type": "MARKET",
  "quantity": 5
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": "buy_1785824486782_46ee677e",
      "side": "BUY",
      "type": "LIMIT",
      "price": 100,
      "quantity": 5,
      "remainingQuantity": 5,
      "status": "PENDING",
      "createdAt": "2026-08-04T06:21:26.783Z"
    },
    "trades": []
  }
}
```

### 2. Get Order Book Depth (`GET /api/orderbook`)
```json
{
  "success": true,
  "data": {
    "bids": [{ "price": 100, "quantity": 7, "orderCount": 1 }],
    "asks": [{ "price": 105, "quantity": 12, "orderCount": 2 }]
  }
}
```

### 3. Get Recent Trades (`GET /api/trades?limit=50`)
```json
{
  "success": true,
  "data": [
    {
      "id": "trade_1785825166369_36881df4",
      "buyOrderId": "buy_1785825166348_a3e2f8ef",
      "sellOrderId": "sell_1785825166368_301df89f",
      "price": 95,
      "quantity": 3,
      "timestamp": "2026-08-04T06:32:46.369Z"
    }
  ]
}
```

### 4. Get Exchange Statistics (`GET /api/stats`)
```json
{
  "success": true,
  "data": {
    "totalBuyOrders": 14,
    "totalSellOrders": 12,
    "totalTradesExecuted": 8,
    "totalVolume": 3450.00
  }
}
```

### 5. Cancel Order (`DELETE /api/orders/:id`)
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "id": "buy_1785824486782_46ee677e",
    "status": "CANCELLED"
  }
}
```

### 6. Reset Exchange Engine (`POST /api/orders/reset`)
```json
{
  "success": true,
  "message": "Exchange engine reset successfully"
}
```

---

## 🚀 Scaling Strategy & Architectural Analysis

For architectural design deep-dives, sequence diagrams, and throughput scaling analysis (scaling to **100,000 active orders** and **10,000 trades/minute**), refer to:
- **[design-decisions.md](file:///c:/Users/rohit/OneDrive/Desktop/resumes/Projects%20copy/BYTE/design-decisions.md)**
- **[architecture.md](file:///c:/Users/rohit/OneDrive/Desktop/resumes/Projects%20copy/BYTE/architecture.md)**
