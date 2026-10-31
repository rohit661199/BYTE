import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  TrendingUp,
  Layers,
  BarChart2,
  Shield,
  Clock,
  Database,
  Radio,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-16 lg:space-y-24 py-6 sm:py-10 animate-fade-in">
      {/* Editorial Hero Section (Matching Reference Image) */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Column: Editorial Headline & Messaging */}
          <div className="lg:col-span-6 space-y-6">
            {/* Pill Badge */}
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded bg-byte-secondary border border-byte-border text-[10px] font-mono tracking-widest text-byte-muted uppercase">
              <span>Paper Trading Exchange</span>
            </div>

            {/* Headline matching Reference Image */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal text-byte-primary tracking-tight leading-[1.08]">
              Trade Global <br />
              Markets Without <br />
              <span className="font-serif italic font-normal text-byte-accent">
                Financial Risk
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-byte-muted max-w-lg leading-relaxed font-normal">
              A professional paper trading platform with real-time market data, an advanced matching engine, and institutional-grade trading tools.
            </p>

            {/* CTAs matching Reference Image */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/trade/BYTE-USD"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded bg-byte-accent hover:opacity-90 text-byte-accent-contrast text-xs font-semibold transition-all shadow-sm"
              >
                <span>Launch Trading Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/markets"
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded bg-transparent border border-byte-border hover:bg-byte-secondary text-byte-primary text-xs font-normal transition-colors"
              >
                <span>Explore Markets</span>
              </Link>
            </div>
          </div>

          {/* Right Column: High-Fidelity Perspective Workstation Preview (Matching Reference Image) */}
          <div className="lg:col-span-6 relative perspective-1000">
            <div className="relative rounded-lg border border-byte-border bg-byte-surface shadow-2xl p-4 sm:p-5 text-xs font-mono select-none transition-transform hover:scale-[1.01] duration-300">
              {/* Window Titlebar */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-byte-border">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EF6262]/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E7BD72]/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22B982]/80" />
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <span className="text-byte-primary font-semibold text-xs">BTC/USD</span>
                    <span className="text-bull font-medium text-xs tnum">88,532.41 +1.42%</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 text-[10px] text-bull font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />
                  <span>Real-Time Engine</span>
                </div>
              </div>

              {/* Workstation Body: Chart on Left, Mini Order Book on Right */}
              <div className="grid grid-cols-12 gap-3 mb-3">
                {/* Simulated Candlestick Canvas (7 cols) */}
                <div className="col-span-8 bg-byte-bg rounded border border-byte-border/80 p-2.5 flex flex-col justify-between h-[210px] relative overflow-hidden">
                  <div className="flex justify-between text-[10px] text-byte-muted border-b border-byte-border/40 pb-1">
                    <span>15m Candlestick</span>
                    <span className="text-byte-tertiary">O: 87,410 H: 88,900 L: 87,200</span>
                  </div>

                  {/* SVG Candlestick Graphic */}
                  <svg viewBox="0 0 340 130" className="w-full h-[120px] my-auto">
                    {/* Subtle Gridlines */}
                    <line x1="0" y1="30" x2="340" y2="30" stroke="currentColor" className="text-byte-border/30" strokeDasharray="2 3" />
                    <line x1="0" y1="65" x2="340" y2="65" stroke="currentColor" className="text-byte-border/30" strokeDasharray="2 3" />
                    <line x1="0" y1="100" x2="340" y2="100" stroke="currentColor" className="text-byte-border/30" strokeDasharray="2 3" />

                    {/* Smooth Moving Average Line */}
                    <path
                      d="M 10 95 Q 60 90, 110 75 T 210 50 T 310 32"
                      fill="none"
                      stroke="#E7BD72"
                      strokeWidth="1.2"
                      strokeOpacity="0.8"
                    />

                    {/* Crisp Candlesticks */}
                    {/* C1 */}
                    <line x1="25" y1="80" x2="25" y2="110" stroke="#22B982" strokeWidth="1" />
                    <rect x="22" y="88" width="6" height="16" fill="#22B982" rx="0.5" />
                    {/* C2 */}
                    <line x1="60" y1="85" x2="60" y2="115" stroke="#EF6262" strokeWidth="1" />
                    <rect x="57" y="92" width="6" height="18" fill="#EF6262" rx="0.5" />
                    {/* C3 */}
                    <line x1="95" y1="65" x2="95" y2="98" stroke="#22B982" strokeWidth="1" />
                    <rect x="92" y="72" width="6" height="20" fill="#22B982" rx="0.5" />
                    {/* C4 */}
                    <line x1="130" y1="58" x2="130" y2="90" stroke="#22B982" strokeWidth="1" />
                    <rect x="127" y="65" width="6" height="18" fill="#22B982" rx="0.5" />
                    {/* C5 */}
                    <line x1="165" y1="52" x2="165" y2="84" stroke="#EF6262" strokeWidth="1" />
                    <rect x="162" y="58" width="6" height="16" fill="#EF6262" rx="0.5" />
                    {/* C6 */}
                    <line x1="200" y1="42" x2="200" y2="75" stroke="#22B982" strokeWidth="1" />
                    <rect x="197" y="48" width="6" height="20" fill="#22B982" rx="0.5" />
                    {/* C7 */}
                    <line x1="235" y1="35" x2="235" y2="68" stroke="#22B982" strokeWidth="1" />
                    <rect x="232" y="40" width="6" height="22" fill="#22B982" rx="0.5" />
                    {/* C8 */}
                    <line x1="270" y1="28" x2="270" y2="60" stroke="#22B982" strokeWidth="1" />
                    <rect x="267" y="34" width="6" height="20" fill="#22B982" rx="0.5" />
                    {/* C9 */}
                    <line x1="305" y1="20" x2="305" y2="52" stroke="#22B982" strokeWidth="1" />
                    <rect x="302" y="24" width="6" height="22" fill="#22B982" rx="0.5" />

                    {/* Bottom Volume Bars */}
                    <rect x="22" y="118" width="6" height="10" fill="#22B982" opacity="0.3" />
                    <rect x="57" y="115" width="6" height="13" fill="#EF6262" opacity="0.3" />
                    <rect x="92" y="112" width="6" height="16" fill="#22B982" opacity="0.3" />
                    <rect x="127" y="110" width="6" height="18" fill="#22B982" opacity="0.3" />
                    <rect x="162" y="117" width="6" height="11" fill="#EF6262" opacity="0.3" />
                    <rect x="197" y="108" width="6" height="20" fill="#22B982" opacity="0.3" />
                    <rect x="232" y="105" width="6" height="23" fill="#22B982" opacity="0.3" />
                    <rect x="267" y="103" width="6" height="25" fill="#22B982" opacity="0.3" />
                    <rect x="302" y="100" width="6" height="28" fill="#22B982" opacity="0.4" />
                  </svg>

                  <div className="flex justify-between text-[9px] text-byte-tertiary pt-1 border-t border-byte-border/40">
                    <span>14:00</span>
                    <span>14:30</span>
                    <span>15:00</span>
                    <span>15:30</span>
                  </div>
                </div>

                {/* Simulated Mini Order Book (4 cols) */}
                <div className="col-span-4 bg-byte-bg rounded border border-byte-border/80 p-2.5 flex flex-col justify-between h-[210px]">
                  <div>
                    <span className="text-[10px] text-byte-muted uppercase tracking-wider block mb-1.5">Order Book</span>
                    <div className="space-y-1 text-[10px] tnum">
                      <div className="flex justify-between text-bear">
                        <span>88,545.00</span>
                        <span className="text-byte-muted">0.85</span>
                      </div>
                      <div className="flex justify-between text-bear">
                        <span>88,540.00</span>
                        <span className="text-byte-muted">1.42</span>
                      </div>
                      <div className="py-1 px-1.5 my-1 rounded bg-byte-secondary border border-byte-border/60 text-center text-[10px] text-byte-primary font-bold">
                        88,532.41
                      </div>
                      <div className="flex justify-between text-bull">
                        <span>88,530.00</span>
                        <span className="text-byte-muted">2.18</span>
                      </div>
                      <div className="flex justify-between text-bull">
                        <span>88,525.00</span>
                        <span className="text-byte-muted">0.95</span>
                      </div>
                    </div>
                  </div>

                  {/* Buy Button */}
                  <div className="pt-2">
                    <button className="w-full py-1.5 rounded bg-bull text-[#0E141B] font-semibold text-[11px] font-sans hover:opacity-90 transition-opacity">
                      Buy BTC
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Ledger Summary */}
              <div className="pt-2 border-t border-byte-border flex items-center justify-between text-[10px] text-byte-muted">
                <div className="flex items-center space-x-3">
                  <span className="text-byte-accent font-medium">Open Orders (0)</span>
                  <span>Order History</span>
                  <span>Trade History</span>
                </div>
                <span className="text-byte-tertiary">Engine: PENDING_MATCH</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Strip (Matching Reference Image) */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-6 border-y border-byte-border">
          {/* Feature 1 */}
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded bg-byte-secondary flex items-center justify-center text-byte-accent shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-byte-primary">Multiple Assets</h3>
              <p className="text-[11px] text-byte-muted mt-0.5">Crypto • Stocks • More</p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded bg-byte-secondary flex items-center justify-center text-bull shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-byte-primary">Real-Time Data</h3>
              <p className="text-[11px] text-byte-muted mt-0.5">Live market prices</p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded bg-byte-secondary flex items-center justify-center text-byte-accent shrink-0">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-byte-primary">Advanced Charts</h3>
              <p className="text-[11px] text-byte-muted mt-0.5">Professional tools</p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded bg-byte-secondary flex items-center justify-center text-byte-accent shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-byte-primary">Risk-Free Trading</h3>
              <p className="text-[11px] text-byte-muted mt-0.5">Virtual funds</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Exchange Architecture Section */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <span className="text-[10px] font-mono uppercase tracking-wider text-byte-accent block mb-1">
            Institutional Infrastructure
          </span>
          <h2 className="text-2xl font-normal text-byte-primary tracking-tight">
            Deterministic Engine Architecture
          </h2>
          <p className="text-xs text-byte-muted mt-1 max-w-xl">
            BYTE executes orders using strict Price-Time Priority FIFO rules, backed by ACID-compliant SQLite WAL persistence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Col 1 */}
          <div className="p-5 rounded-lg bg-byte-surface border border-byte-border space-y-3">
            <div className="w-7 h-7 rounded bg-byte-secondary flex items-center justify-center text-byte-accent">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-byte-primary">In-Memory FIFO Matching</h3>
            <p className="text-xs text-byte-muted leading-relaxed font-normal">
              Resting orders are sequenced into doubly-linked price levels. Incoming market and limit sweeps execute deterministically against the top of the book.
            </p>
          </div>

          {/* Col 2 */}
          <div className="p-5 rounded-lg bg-byte-surface border border-byte-border space-y-3">
            <div className="w-7 h-7 rounded bg-byte-secondary flex items-center justify-center text-bull">
              <Database className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-byte-primary">SQLite Write-Ahead Logging</h3>
            <p className="text-xs text-byte-muted leading-relaxed font-normal">
              State transitions, executions, and order balances commit via prepared statements with WAL journaling for crash durability and atomic rehydration.
            </p>
          </div>

          {/* Col 3 */}
          <div className="p-5 rounded-lg bg-byte-surface border border-byte-border space-y-3">
            <div className="w-7 h-7 rounded bg-byte-secondary flex items-center justify-center text-byte-accent">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-byte-primary">WebSocket Event Stream</h3>
            <p className="text-xs text-byte-muted leading-relaxed font-normal">
              Live depth snapshots and trade events are broadcast to clients over low-overhead WebSockets, eliminating polling delay.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
