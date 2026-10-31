import React, { useState } from 'react';
import { BookOpen, Terminal, Code2, Server, ShieldCheck, ChevronRight, Copy, Check } from 'lucide-react';

export const DocsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'overview' | 'matching' | 'api' | 'ws'>('overview');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const sections = [
    { id: 'overview', label: 'Architecture Overview', icon: <Server className="w-3.5 h-3.5" /> },
    { id: 'matching', label: 'Matching Algorithm (FIFO)', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'api', label: 'REST API Reference', icon: <Code2 className="w-3.5 h-3.5" /> },
    { id: 'ws', label: 'WebSocket Specifications', icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8 pb-4 border-b border-byte-border">
        <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-byte-accent mb-1">
          <span>BYTE System Documentation</span>
          <span>•</span>
          <span>v1.0.0</span>
        </div>
        <h1 className="text-2xl font-semibold text-byte-primary tracking-tight">Technical Specifications</h1>
        <p className="text-xs text-byte-muted mt-1">
          Complete guide to BYTE's in-memory FIFO matching engine, REST endpoints, and WebSocket event architecture.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Navigation Sidebar (3 cols) */}
        <aside className="md:col-span-3 space-y-4">
          <div className="p-3 rounded-lg bg-byte-surface border border-byte-border space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-byte-muted px-2 block mb-2">
              Navigation
            </span>
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as any)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors text-left cursor-pointer ${
                  activeSection === sec.id
                    ? 'bg-byte-secondary text-byte-accent font-semibold border-l-2 border-byte-accent'
                    : 'text-byte-muted hover:text-byte-primary hover:bg-byte-secondary/60'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className={activeSection === sec.id ? 'text-byte-accent' : 'text-byte-muted'}>
                    {sec.icon}
                  </span>
                  <span>{sec.label}</span>
                </div>
                {activeSection === sec.id && <ChevronRight className="w-3.5 h-3.5 text-byte-accent" />}
              </button>
            ))}
          </div>

          <div className="p-4 rounded-lg bg-byte-surface border border-byte-border text-xs text-byte-muted space-y-2">
            <span className="text-byte-primary font-medium block">Automated Test Verification</span>
            <p className="text-[11px] leading-relaxed">
              50 automated Vitest unit tests validate multi-level sweeps, partial fills, resting limit orders, and maker price execution.
            </p>
            <div className="flex items-center space-x-1.5 text-bull font-mono text-[11px] pt-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>50/50 Tests Passing</span>
            </div>
          </div>
        </aside>

        {/* Right Content Area (9 cols) */}
        <div className="md:col-span-9 space-y-8">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-byte-primary tracking-tight">System Architecture Overview</h2>
                <p className="text-xs text-byte-muted mt-1">
                  Clean Architecture separating pure in-memory execution logic, persistent SQLite storage, and client event streams.
                </p>
              </div>

              <div className="p-5 rounded-lg bg-byte-surface border border-byte-border space-y-4 text-xs leading-relaxed text-byte-muted">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-byte-primary">Core Architectural Layers</h3>
                <ul className="space-y-3 list-none pl-0">
                  <li className="flex items-start space-x-3 p-3 rounded bg-byte-secondary/40 border border-byte-border">
                    <span className="w-2 h-2 rounded-full bg-byte-accent mt-1.5 shrink-0" />
                    <div>
                      <strong className="text-byte-primary block text-xs">Matching Engine Core</strong>
                      <span className="text-[11px]">Pure in-memory doubly-linked order books enforcing deterministic Price-Time Priority (FIFO) matching without blocking disk I/O.</span>
                    </div>
                  </li>
                  <li className="flex items-start space-x-3 p-3 rounded bg-byte-secondary/40 border border-byte-border">
                    <span className="w-2 h-2 rounded-full bg-bull mt-1.5 shrink-0" />
                    <div>
                      <strong className="text-byte-primary block text-xs">Persistence Layer (SQLite WAL)</strong>
                      <span className="text-[11px]">State is committed using prepared transactions with Write-Ahead Logging (<code className="font-mono text-byte-primary">PRAGMA journal_mode = WAL</code>) for high-speed writes and crash safety.</span>
                    </div>
                  </li>
                  <li className="flex items-start space-x-3 p-3 rounded bg-byte-secondary/40 border border-byte-border">
                    <span className="w-2 h-2 rounded-full bg-byte-muted mt-1.5 shrink-0" />
                    <div>
                      <strong className="text-byte-primary block text-xs">Boot Rehydration Protocol</strong>
                      <span className="text-[11px]">Upon server restart, all active resting <code className="font-mono text-byte-primary">PENDING</code> and <code className="font-mono text-byte-primary">PARTIALLY_FILLED</code> limit orders are reconstructed into memory.</span>
                    </div>
                  </li>
                  <li className="flex items-start space-x-3 p-3 rounded bg-byte-secondary/40 border border-byte-border">
                    <span className="w-2 h-2 rounded-full bg-byte-accent mt-1.5 shrink-0" />
                    <div>
                      <strong className="text-byte-primary block text-xs">Real-Time Event Broadcast</strong>
                      <span className="text-[11px]">Depth snapshots (<code className="font-mono text-byte-primary">ORDER_BOOK_UPDATE</code>) and executed trades (<code className="font-mono text-byte-primary">TRADE_EXECUTED</code>) are broadcast immediately to connected WebSocket clients.</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'matching' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-byte-primary tracking-tight">Price-Time Priority (FIFO) Matching</h2>
                <p className="text-xs text-byte-muted mt-1">
                  Deterministic execution model implemented in <code className="text-byte-accent font-mono">MatchingEngine.ts</code>.
                </p>
              </div>

              <div className="p-5 rounded-lg bg-byte-surface border border-byte-border space-y-4 text-xs text-byte-muted">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-byte-primary">Execution Priority Rules</h3>
                <div className="space-y-3">
                  <div className="p-3.5 rounded bg-byte-bg border border-byte-border space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-bull" />
                      <span className="font-semibold text-bull">1. Buy Order Priority</span>
                    </div>
                    <p className="text-byte-muted text-[11px] pl-4">
                      Sorted descending by Price (highest bid first). When prices are identical, sorted ascending by submission timestamp (oldest first).
                    </p>
                  </div>

                  <div className="p-3.5 rounded bg-byte-bg border border-byte-border space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-bear" />
                      <span className="font-semibold text-bear">2. Sell Order Priority</span>
                    </div>
                    <p className="text-byte-muted text-[11px] pl-4">
                      Sorted ascending by Price (lowest ask first). When prices are identical, sorted ascending by submission timestamp (oldest first).
                    </p>
                  </div>

                  <div className="p-3.5 rounded bg-byte-bg border border-byte-border space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-byte-accent" />
                      <span className="font-semibold text-byte-accent">3. Maker Price Execution</span>
                    </div>
                    <p className="text-byte-muted text-[11px] pl-4">
                      Trades execute at the resting maker order's price. If an incoming BUY 10 @ $100 matches against resting SELL 5 @ $95, execution occurs at $95.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'api' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-byte-primary tracking-tight">REST API Reference</h2>
                <p className="text-xs text-byte-muted mt-1">Base URL: <code className="text-byte-accent font-mono">/api</code></p>
              </div>

              <div className="space-y-4 text-xs font-mono">
                {/* POST /api/orders */}
                <div className="p-4 rounded-lg bg-byte-surface border border-byte-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-bull/15 text-bull text-[11px] font-bold border border-bull/30">
                        POST
                      </span>
                      <span className="text-byte-primary font-bold">/api/orders</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard('POST /api/orders', 1)}
                      className="text-byte-muted hover:text-byte-primary cursor-pointer transition-colors"
                      title="Copy Endpoint"
                    >
                      {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-bull" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-byte-muted font-sans text-xs">
                    Submits a new LIMIT or MARKET order into the in-memory matching engine.
                  </p>
                  <pre className="p-3 rounded bg-byte-bg border border-byte-border text-byte-primary overflow-x-auto text-[11px] leading-relaxed">
{`{
  "side": "BUY",
  "type": "LIMIT",
  "price": 100.00,
  "quantity": 5
}`}
                  </pre>
                </div>

                {/* GET /api/orderbook */}
                <div className="p-4 rounded-lg bg-byte-surface border border-byte-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-byte-secondary text-byte-accent text-[11px] font-bold border border-byte-border">
                        GET
                      </span>
                      <span className="text-byte-primary font-bold">/api/orderbook</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard('GET /api/orderbook', 2)}
                      className="text-byte-muted hover:text-byte-primary cursor-pointer transition-colors"
                      title="Copy Endpoint"
                    >
                      {copiedIndex === 2 ? <Check className="w-3.5 h-3.5 text-bull" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-byte-muted font-sans text-xs">
                    Retrieves aggregated price level depth snapshot for bids and asks sorted according to FIFO priority.
                  </p>
                </div>

                {/* DELETE /api/orders/:id */}
                <div className="p-4 rounded-lg bg-byte-surface border border-byte-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-bear/15 text-bear text-[11px] font-bold border border-bear/30">
                        DELETE
                      </span>
                      <span className="text-byte-primary font-bold">/api/orders/:id</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard('DELETE /api/orders/:id', 3)}
                      className="text-byte-muted hover:text-byte-primary cursor-pointer transition-colors"
                      title="Copy Endpoint"
                    >
                      {copiedIndex === 3 ? <Check className="w-3.5 h-3.5 text-bull" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-byte-muted font-sans text-xs">
                    Cancels an active resting limit order from in-memory book and updates SQLite database status.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'ws' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-byte-primary tracking-tight">WebSocket Event Specifications</h2>
                <p className="text-xs text-byte-muted mt-1">Endpoint: <code className="text-byte-accent font-mono">/ws</code></p>
              </div>

              <div className="p-5 rounded-lg bg-byte-surface border border-byte-border space-y-4 text-xs font-mono">
                <div className="space-y-2">
                  <span className="text-byte-primary font-bold block">1. ORDER_BOOK_UPDATE</span>
                  <pre className="p-3 rounded bg-byte-bg border border-byte-border text-byte-primary overflow-x-auto text-[11px] leading-relaxed">
{`{
  "type": "ORDER_BOOK_UPDATE",
  "payload": {
    "bids": [{ "price": 100, "quantity": 7, "orderCount": 1 }],
    "asks": [{ "price": 105, "quantity": 12, "orderCount": 2 }]
  },
  "timestamp": "2026-10-31T07:15:00.000Z"
}`}
                  </pre>
                </div>

                <div className="space-y-2 pt-3 border-t border-byte-border">
                  <span className="text-byte-primary font-bold block">2. TRADE_EXECUTED</span>
                  <pre className="p-3 rounded bg-byte-bg border border-byte-border text-byte-primary overflow-x-auto text-[11px] leading-relaxed">
{`{
  "type": "TRADE_EXECUTED",
  "payload": [{
    "id": "trade_1785825166369_36881df4",
    "price": 95,
    "quantity": 3,
    "timestamp": "2026-10-31T07:15:00.000Z"
  }]
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
