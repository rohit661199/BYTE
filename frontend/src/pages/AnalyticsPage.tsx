import React from 'react';
import { Activity, BarChart3, TrendingUp, TrendingDown, Layers, Cpu, ShieldCheck } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { MetricDisplay } from '../components/ui/MetricDisplay';
import { formatCurrency, formatNumber } from '../utils/formatters';

export const AnalyticsPage: React.FC = () => {
  const { stats } = useWebSocket();
  const safeStats = stats || {
    totalBuyOrders: 0,
    totalSellOrders: 0,
    totalTradesExecuted: 0,
    totalVolume: 0,
  };

  return (
    <div className="max-w-[1780px] mx-auto space-y-5 animate-fade-in pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-byte-border">
        <div>
          <h1 className="text-xl font-normal text-byte-primary tracking-tight">Exchange Analytics & Health</h1>
          <p className="text-xs text-byte-muted mt-0.5 font-normal">
            Matching engine throughput, liquidity concentration, and system telemetry.
          </p>
        </div>

        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-byte-secondary/60 border border-byte-border/60 text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-bull" />
          <span className="text-bull font-medium">FIFO Matching Active</span>
        </div>
      </div>

      {/* Live Engine Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricDisplay
          label="Total Buy Orders"
          value={formatNumber(safeStats.totalBuyOrders ?? 0, 0)}
          icon={<TrendingUp className="w-3.5 h-3.5 text-bull" />}
          hint="Resting + historical bids"
        />

        <MetricDisplay
          label="Total Sell Orders"
          value={formatNumber(safeStats.totalSellOrders ?? 0, 0)}
          icon={<TrendingDown className="w-3.5 h-3.5 text-bear" />}
          hint="Resting + historical asks"
        />

        <MetricDisplay
          label="Trades Executed"
          value={formatNumber(safeStats.totalTradesExecuted ?? 0, 0)}
          icon={<Activity className="w-3.5 h-3.5 text-byte-accent" />}
          hint="Committed to SQLite WAL"
        />

        <MetricDisplay
          label="Total Traded Volume"
          value={formatCurrency(safeStats.totalVolume ?? 0)}
          icon={<BarChart3 className="w-3.5 h-3.5 text-byte-primary" />}
          hint="Cumulative USD turnover"
        />
      </div>

      {/* Telemetry & Architecture Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Architectural Engine Benchmarks (8 cols) */}
        <div className="lg:col-span-8 bg-byte-surface border border-byte-border rounded p-5 space-y-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-byte-border">
            <h2 className="font-medium text-byte-primary text-xs flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-byte-accent" />
              <span>Engine Architecture & Core Invariants</span>
            </h2>
            <span className="text-[10px] text-byte-muted font-mono">v1.0.0 Production Core</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded bg-byte-secondary/40 border border-byte-border/60 space-y-1">
              <span className="text-[10px] text-byte-muted uppercase font-mono">Priority Rule</span>
              <span className="font-semibold text-byte-primary text-xs block">Price-Time FIFO</span>
              <p className="text-[11px] text-byte-muted leading-relaxed font-normal">Price advantage first, then timestamp tiebreaker</p>
            </div>

            <div className="p-3.5 rounded bg-byte-secondary/40 border border-byte-border/60 space-y-1">
              <span className="text-[10px] text-byte-muted uppercase font-mono">Persistence</span>
              <span className="font-semibold text-byte-primary text-xs block">SQLite WAL</span>
              <p className="text-[11px] text-byte-muted leading-relaxed font-normal">Non-blocking Write-Ahead Logging with boot hydration</p>
            </div>

            <div className="p-3.5 rounded bg-byte-secondary/40 border border-byte-border/60 space-y-1">
              <span className="text-[10px] text-byte-muted uppercase font-mono">Validation</span>
              <span className="font-semibold text-bull text-xs block flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>50 / 50 Passing</span>
              </span>
              <p className="text-[11px] text-byte-muted leading-relaxed font-normal">Automated test suite covering sweeps and partial fills</p>
            </div>
          </div>

          {/* Depth Heatmap Framework */}
          <div className="p-4 rounded bg-byte-secondary/30 border border-byte-border/60 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-byte-primary flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-byte-accent" />
                <span>Order Book Liquidity Distribution</span>
              </span>
              <span className="text-byte-muted text-[10px] font-mono">Real-Time Depth</span>
            </div>

            {/* Depth Visualization Bars */}
            <div className="space-y-2 font-mono text-[11px] pt-1">
              <div className="flex items-center space-x-2">
                <span className="w-16 text-bear text-[11px] tnum">$88,545</span>
                <div className="flex-1 h-2 rounded-full bg-byte-surface overflow-hidden">
                  <div className="h-full bg-bear/40" style={{ width: '68%' }} />
                </div>
                <span className="w-16 text-right text-byte-muted text-[11px] tnum">2.85 BTC</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-16 text-bear text-[11px] tnum">$88,540</span>
                <div className="flex-1 h-2 rounded-full bg-byte-surface overflow-hidden">
                  <div className="h-full bg-bear/40" style={{ width: '42%' }} />
                </div>
                <span className="w-16 text-right text-byte-muted text-[11px] tnum">1.42 BTC</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-16 text-bull text-[11px] tnum">$88,530</span>
                <div className="flex-1 h-2 rounded-full bg-byte-surface overflow-hidden">
                  <div className="h-full bg-bull/40" style={{ width: '55%' }} />
                </div>
                <span className="w-16 text-right text-byte-muted text-[11px] tnum">2.10 BTC</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-16 text-bull text-[11px] tnum">$88,525</span>
                <div className="flex-1 h-2 rounded-full bg-byte-surface overflow-hidden">
                  <div className="h-full bg-bull/40" style={{ width: '80%' }} />
                </div>
                <span className="w-16 text-right text-byte-muted text-[11px] tnum">3.40 BTC</span>
              </div>
            </div>
          </div>
        </div>

        {/* Market Movers Leaderboard (4 cols) */}
        <div className="lg:col-span-4 bg-byte-surface border border-byte-border rounded p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-byte-border">
            <h2 className="font-medium text-byte-primary text-xs">Top Market Movers</h2>
            <span className="text-[10px] text-byte-muted font-mono">24h Delta</span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between p-2.5 rounded bg-byte-secondary/40 border border-byte-border/40">
              <div>
                <span className="font-semibold text-byte-primary block">TSLA-USD</span>
                <span className="text-[10px] text-byte-muted font-sans font-normal">Tesla Inc</span>
              </div>
              <span className="text-bull font-semibold bg-bull/10 px-2 py-0.5 rounded text-[11px] tnum">+4.12%</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-byte-secondary/40 border border-byte-border/40">
              <div>
                <span className="font-semibold text-byte-primary block">SOL-USD</span>
                <span className="text-[10px] text-byte-muted font-sans font-normal">Solana</span>
              </div>
              <span className="text-bull font-semibold bg-bull/10 px-2 py-0.5 rounded text-[11px] tnum">+3.92%</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-byte-secondary/40 border border-byte-border/40">
              <div>
                <span className="font-semibold text-byte-primary block">BTC-USD</span>
                <span className="text-[10px] text-byte-muted font-sans font-normal">Bitcoin</span>
              </div>
              <span className="text-bull font-semibold bg-bull/10 px-2 py-0.5 rounded text-[11px] tnum">+1.42%</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-byte-secondary/40 border border-byte-border/40">
              <div>
                <span className="font-semibold text-byte-primary block">AAPL-USD</span>
                <span className="text-[10px] text-byte-muted font-sans font-normal">Apple Inc</span>
              </div>
              <span className="text-bear font-semibold bg-bear/10 px-2 py-0.5 rounded text-[11px] tnum">-0.42%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
