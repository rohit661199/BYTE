# BYTE Exchange — Order Matching Engine & Real-Time Trading Terminal

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL--Mode-blue.svg)](https://www.sqlite.org/)
[![Vitest](https://img.shields.io/badge/Vitest-3.0-yellow.svg)](https://vitest.dev/)

An interview-quality, high-performance **Order Matching Engine and Real-Time Trading Terminal** built for a fictional asset called **`BYTE`**.

Designed and implemented following **Clean Architecture principles**, robust Price-Time Priority order matching, atomic SQLite durability, real-time WebSocket broadcasting, and automated Vitest unit testing.

---

## 🌟 Key Features

- **Price-Time Priority Orderbook Engine**: In-memory matching engine supporting `LIMIT` and `MARKET` orders.
- **Partial Fills & Continuous Sweeping**: Fully handles partial order fills, remaining quantities, and multi-level price sweeps.
- **Atomic SQLite WAL Persistence**: Synchronous, zero-latency persistence via `better-sqlite3` in Write-Ahead Logging (WAL) mode. Orderbook state is automatically hydrated on restart.
- **Real-Time WebSockets (`ws`)**: Instant push updates for Order Book depth (`ORDER_BOOK_UPDATE`), Trade execution streams (`TRADE_EXECUTED`), and Exchange Statistics (`STATS_UPDATE`).
- **Modern Trading Dashboard UI**: Dark-themed responsive UI in React + TailwindCSS featuring visual liquidity depth bars, real-time trade history, quick quantity presets, and active order cancellation.
- **Strict Validation & Error Handling**: Zod request schema validation and centralized JSON error responses.
- **100% Automated Unit Test Coverage**: Automated test suite for matching logic, partial fills, cancellations, and order sweeps using **Vitest**.
- **Docker & Docker-Compose Support**: Containerized backend and Nginx-served frontend.

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

### 1. Installation

Clone the repository and install all dependencies:

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

Run the complete production-built application using Docker:

```bash
# Build and launch containers
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
 ✓ tests/matchingEngine.test.ts (6 tests) 56ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  1.76s
```

---

## 📖 API Documentation

### Base URL: `http://localhost:5000/api`

### 1. Submit New Order
- **Endpoint**: `POST /api/orders`
- **Body**:
```json
{
  "side": "BUY",
  "type": "LIMIT",
  "price": 100.00,
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

### 2. Get Order Book Depth
- **Endpoint**: `GET /api/orderbook`
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "bids": [{ "price": 100, "quantity": 7, "orderCount": 1 }],
    "asks": [{ "price": 105, "quantity": 12, "orderCount": 2 }]
  }
}
```

### 3. Get Recent Trades
- **Endpoint**: `GET /api/trades?limit=50`
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "trade_1785825166369_36881df4",
      "buyOrderId": "buy_1785825166348_a3e2f8ef",
      "sellOrderId": "sell_1785825166368_301df89f",
      "price": 100,
      "quantity": 3,
      "timestamp": "2026-08-04T06:32:46.369Z"
    }
  ]
}
```

### 4. Get Exchange Statistics
- **Endpoint**: `GET /api/stats`
- **Response (`200 OK`)**:
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

### 5. Cancel Order (Bonus)
- **Endpoint**: `DELETE /api/orders/:id`
- **Response (`200 OK`)**:
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

---

## ⚙️ Core Matching Logic & Price-Time Priority

1. **Bids (Buy Orders)**: Sorted **Price Descending** (highest bid price matches first), then **Timestamp Ascending** (oldest first).
2. **Asks (Sell Orders)**: Sorted **Price Ascending** (lowest ask price matches first), then **Timestamp Ascending** (oldest first).
3. **Execution Price Policy**: Matches execute at the **resting maker order's price**.
4. **Partial Fill Sweeps**: Sweeps through available opposing liquidity until remaining quantity reaches $0$ or no compatible price levels remain.

---

## 🚀 Scaling Strategy & Future Improvements

For full architectural deep-dives and performance scaling calculations (scaling to **100,000 active orders** and **10,000 trades/minute**), refer to [design-decisions.md](file:///c:/Users/rohit/OneDrive/Desktop/resumes/Projects%20copy/BYTE/design-decisions.md) and [architecture.md](file:///c:/Users/rohit/OneDrive/Desktop/resumes/Projects%20copy/BYTE/architecture.md).

- **Ring Buffer Async Disk Batching**: Batching trade persistence writes every $50\text{ms}$ using background worker threads.
- **Red-Black Tree + Linked List Orderbook**: Optimizing price level lookup to $O(\log P)$ and order cancellation to $O(1)$.
- **Multi-Node Redis Pub/Sub Partitioning**: Horizontally scaling matching engine instances by trading symbol.
