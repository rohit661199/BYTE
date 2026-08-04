# BYTE Exchange — Technical Design Decisions & System Architecture

This document details the architectural, algorithmic, and engineering decisions made during the design and implementation of the **BYTE Order Matching Engine & Real-Time Trading Terminal**.

---

## 1. Architectural Overview & Choice

We adopted **Clean Architecture** combined with a **Monorepo Directory Structure**:

```
BYTE/
├── backend/            # Express.js + TypeScript + SQLite REST & WebSocket Engine
│   ├── src/
│   │   ├── config/           # Environment & configuration management
│   │   ├── controllers/      # Express request/response handlers
│   │   ├── database/         # SQLite DB connection, schema & WAL mode initialization
│   │   ├── matching-engine/  # In-memory Price-Time Priority Matching Engine
│   │   ├── middlewares/      # Zod validation & centralized error handling
│   │   ├── models/           # Data Repositories using prepared statements
│   │   ├── routes/           # Express REST routers
│   │   ├── services/         # Business logic layer & engine bridges
│   │   ├── types/            # Strict TypeScript domain interfaces
│   │   └── utils/            # Logging & formatting utilities
│   └── tests/                # Vitest automated unit test suite
├── frontend/           # React 18 + Vite + TypeScript + TailwindCSS Trading Dashboard
│   ├── src/
│   │   ├── components/       # Trading UI components (OrderForm, OrderBook, etc.)
│   │   ├── hooks/            # Custom hooks (useWebSocket real-time sync)
│   │   ├── pages/            # Page layouts (Dashboard)
│   │   ├── services/         # Axios API client
│   │   └── utils/            # Currency and number formatting
├── docker-compose.yml  # Multi-container orchestration
├── README.md           # Submission documentation
└── architecture.md     # System architecture & Mermaid sequence diagrams
```

### Why Clean Architecture?
- **Decoupled Business Logic**: The core matching engine algorithm (`MatchingEngine.ts`) is completely isolated from HTTP controllers, framework routing, or UI views.
- **Portability & Testability**: The matching engine can be tested independently without launching HTTP servers or web browsers.
- **Strict Unidirectional Data Flow**: Requests flow predictably: `Client -> Controller -> Middleware -> Service -> Engine -> Model -> SQLite Database`.

---

## 2. Database Choice & Persistence Strategy

### Selected Database: SQLite (via `better-sqlite3`)

For a simplified exchange simulation, **SQLite configured in WAL (Write-Ahead Logging) mode** was selected over heavy client-server relational databases (PostgreSQL/MySQL) or NoSQL databases (MongoDB).

#### **Key Advantages**:
1. **In-Process Microsecond Latency**: SQLite runs directly inside the Node.js application process memory space, eliminating TCP network round-trip latencies incurred by external DB servers.
2. **Synchronous Speed via `better-sqlite3`**: `better-sqlite3` uses Node.js C++ bindings to execute SQL synchronously without async promise overhead, matching the speed of in-memory data structures while guaranteeing write durability.
3. **WAL (Write-Ahead Logging) Mode**:
   - Standard SQLite locks the entire database file during writes.
   - WAL mode (`PRAGMA journal_mode = WAL;`) allows concurrent readers (e.g. `GET /api/orderbook` or `GET /api/stats`) while write transactions (trade execution persistence) occur simultaneously.
4. **ACID Durability**: In the event of a system crash, SQLite's WAL log guarantees zero trade or order data corruption. On reboot, the matching engine automatically hydrates its orderbook state from persistent DB rows (`status IN ('PENDING', 'PARTIALLY_FILLED')`).

---

## 3. Matching Engine Algorithm & Data Structures

### Matching Strategy: Price-Time Priority (FIFO)

The matching engine enforces strict **Price-Time Priority**:

- **Bids (Buy Book)**:
  1. **Primary Sort Key**: **Price (Descending)** — Buyers offering higher prices get filled first.
  2. **Secondary Sort Key**: **Timestamp (Ascending)** — If prices match, the oldest order gets filled first.
- **Asks (Sell Book)**:
  1. **Primary Sort Key**: **Price (Ascending)** — Sellers offering lower prices get filled first.
  2. **Secondary Sort Key**: **Timestamp (Ascending)** — If prices match, the oldest order gets filled first.

### Execution Condition
A trade is executed whenever:
$$\text{Incoming Buy Price} \ge \text{Top Resting Sell Price}$$
$$\text{OR}$$
$$\text{Incoming Sell Price} \le \text{Top Resting Buy Price}$$

### Maker Price Execution Policy
Trades execute at the **resting maker order's price**. If a buyer submits `BUY 10 @ $100` and matches against a resting ask `SELL 3 @ $95`, the trade executes at **$95** (the maker price), leaving $7$ remaining on the buy order at **$100**.

### Partial Fill Mechanics
- If `Incoming Quantity < Resting Quantity`: The incoming order status becomes `FILLED`, the resting order status becomes `PARTIALLY_FILLED`, and the remaining quantity stays resting on the book.
- If `Incoming Quantity > Resting Quantity`: The resting order becomes `FILLED`, removed from the book, and the incoming order continues matching down the opposing book until filled or resting.

---

## 4. Time & Space Complexity Analysis

| Operation | In-Memory Complexity | Database Complexity | Description |
| :--- | :--- | :--- | :--- |
| **Top-of-Book Lookup** | $O(1)$ | $O(1)$ | Accessing best bid (`bids[0]`) or best ask (`asks[0]`) |
| **Order Insertion** | $O(\log N + N)$ | $O(1)$ | Binary search insertion into sorted bid/ask array |
| **Trade Matching Sweep** | $O(M)$ | $O(M)$ | $M$ is the number of counter-orders filled during the sweep |
| **Order Cancellation** | $O(N)$ | $O(1)$ | Finding order ID in array (optimizable to $O(1)$ with HashMap) |
| **Orderbook Snapshot** | $O(N \log N)$ | $O(1)$ | Price level aggregation for depth visualization |

---

## 5. Scaling Strategy to High Throughput

### Challenge 1: Scaling to 100,000 Active Orders

#### **Memory Footprint Calculation**:
Each `Order` object in memory consumes $\approx 150 \text{ bytes}$.
$$\text{Memory for 100,000 Orders} = 100,000 \times 150 \text{ bytes} \approx 15 \text{ MB RAM}$$
Node.js default heap limit ($4 \text{ GB}$) can easily handle millions of active resting orders in memory.

#### **Data Structure Optimization**:
Instead of JavaScript arrays ($O(N)$ insertion shifts), production scaling uses:
- **Red-Black Tree / B-Tree for Price Levels**: $O(\log P)$ price level lookup, where $P$ is the number of unique price points.
- **Doubly-Linked List per Price Level**: $O(1)$ order insertion and $O(1)$ cancellation via HashMap pointer mapping (`Map<OrderId, OrderNode>`).

---

### Challenge 2: Scaling to 10,000 Trades Per Minute (~166 Trades/Sec)

To process **10,000 trades per minute** without I/O bottlenecks:

1. **Asynchronous Write Queue / Ring Buffer (LMAX Disruptor Pattern)**:
   - Synchronous SQLite writes per trade introduce disk I/O latency ($\approx 1\text{ms}$ per disk flush).
   - **Solution**: The matching engine executes matches purely in memory at sub-microsecond speeds and pushes trade event objects to an in-memory Ring Buffer. A background worker thread flushes trades to SQLite in bulk batches every $50\text{ms}$ (`INSERT INTO trades VALUES (...), (...)...`).

2. **WebSocket Backpressure & Broadcast Throttling**:
   - Broadcasting WebSockets on every individual partial match causes browser DOM lag.
   - **Solution**: Debounce WebSocket orderbook depth broadcasts to $100\text{ms}$ intervals ($10\text{ FPS}$ depth updates), while streaming executed trade events instantly.

3. **Horizontal Scaling via Symbol Partitioning**:
   - Exchange orderbooks for different trading pairs (`BYTE-USD`, `ETH-USD`, `BTC-USD`) are embarrassingly parallel.
   - **Solution**: Deploy dedicated Matching Engine microservices per asset pair, routed via an API Gateway.

---

## 6. Security & Production Preparedness

- **Strict Input Validation**: Zod schemas validate numerical bounds ($>0$), enums, and string lengths before engine execution.
- **Error Handling**: Custom `AppError` class prevents stack trace leakage to production API consumers.
- **CORS & Environment Control**: strict origin white-listing via `.env` configuration.
