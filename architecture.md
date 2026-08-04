# BYTE Exchange — System Architecture & Component Flow Diagrams

This document contains visual diagrams illustrating the system architecture, component relationships, and execution flow of the **BYTE Order Matching System**.

---

## 1. High-Level System Architecture Diagram

```mermaid
graph TD
    subgraph Client Layer
        UI["React 18 Trading Terminal"]
        WS_Client["WebSocket Client (useWebSocket Hook)"]
        Axios["Axios REST API Client"]
    end

    subgraph Server Layer (Express + TypeScript)
        CORS["CORS & Request Middleware"]
        ZOD["Zod Request Validation"]
        Router["Express API Routers (/orders, /trades, /stats, /orderbook)"]
        Controllers["Controllers Layer"]
        Services["Services Layer (OrderService, TradeService, StatsService)"]
        Engine["In-Memory MatchingEngine (Price-Time Priority)"]
        WS_Server["WebSocket Server (ws Broadcaster)"]
    end

    subgraph Data & Persistence Layer
        Model["Repository Models (OrderModel, TradeModel)"]
        DB[(SQLite Database - WAL Mode)]
    end

    UI --> Axios
    UI --> WS_Client
    Axios -->|HTTP POST/GET/DELETE| CORS
    CORS --> ZOD
    ZOD --> Router
    Router --> Controllers
    Controllers --> Services
    Services --> Engine
    Engine -->|Persist Order / Trade| Model
    Model -->|Prepared SQL Statements| DB
    Engine -->|Trigger Broadcast| WS_Server
    WS_Server -->|WS Events: ORDER_BOOK_UPDATE, TRADE_EXECUTED| WS_Client
    WS_Client -->|Live React State Update| UI
```

---

## 2. Order Submission & Matching Engine Execution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Trader as Client (Browser)
    participant API as Express Controller
    participant Zod as Zod Validation Middleware
    participant Service as OrderService
    participant Engine as MatchingEngine (In-Memory)
    participant Model as Order / Trade Model
    participant DB as SQLite DB
    participant WS as WebSocket Broadcaster

    Trader->>API: POST /api/orders { side: "BUY", price: 100, quantity: 5 }
    API->>Zod: Validate Request Body
    alt Invalid Payload
        Zod-->>Trader: 400 Bad Request (Validation Error Details)
    else Valid Payload
        Zod->>Service: Create Order DTO
        Service->>Model: OrderModel.create(order)
        Model->>DB: INSERT INTO orders (PENDING)
        Service->>Engine: processOrder(order)
        
        loop Matching Loop against Opposing Book
            Engine->>Engine: Evaluate Buy Price >= Sell Price
            alt Match Compatible
                Engine->>Model: Create Trade Record & Update Order Statuses
                Model->>DB: INSERT INTO trades & UPDATE orders (FILLED / PARTIALLY_FILLED)
            end
        end

        Engine-->>Service: Return Updated Order & Executed Trades
        Service->>WS: broadcastStateUpdates()
        WS-->>Trader: Push ORDER_BOOK_UPDATE, TRADE_EXECUTED, STATS_UPDATE
        Service-->>API: Return Order & Trade Result
        API-->>Trader: 201 Created { success: true, data: { order, trades } }
    end
```

---

## 3. Orderbook Data Structure Organization

```mermaid
graph LR
    subgraph OrderBook Snapshot
        subgraph Bids [BUY Book - Sorted Price DESC]
            B1["Bid $105 (Qty 10) - Oldest"]
            B2["Bid $100 (Qty 5) - Newer"]
        end

        subgraph Spread [Spread Gap]
            S["Best Ask ($108) - Best Bid ($105) = $3 Spread"]
        end

        subgraph Asks [SELL Book - Sorted Price ASC]
            A1["Ask $108 (Qty 3) - Oldest"]
            A2["Ask $110 (Qty 15) - Newer"]
        end
    end
```
