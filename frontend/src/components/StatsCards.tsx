import { TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';
import { ExchangeStats } from '../types/index';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface StatsCardsProps {
  stats: ExchangeStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total Buy Orders */}
      <div className="bg-byte-surface border border-byte-border rounded-lg p-4 relative overflow-hidden group hover:border-bull/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-byte-muted uppercase tracking-wider">Total Buy Orders</span>
          <div className="w-7 h-7 rounded bg-bull/10 flex items-center justify-center text-bull">
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-xl font-semibold font-mono text-byte-primary">{formatNumber(stats.totalBuyOrders, 0)}</span>
        </div>
      </div>

      {/* Total Sell Orders */}
      <div className="bg-byte-surface border border-byte-border rounded-lg p-4 relative overflow-hidden group hover:border-bear/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-byte-muted uppercase tracking-wider">Total Sell Orders</span>
          <div className="w-7 h-7 rounded bg-bear/10 flex items-center justify-center text-bear">
            <ArrowDownRight className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-xl font-semibold font-mono text-byte-primary">{formatNumber(stats.totalSellOrders, 0)}</span>
        </div>
      </div>

      {/* Total Trades Executed */}
      <div className="bg-byte-surface border border-byte-border rounded-lg p-4 relative overflow-hidden group hover:border-byte-accent/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-byte-muted uppercase tracking-wider">Trades Executed</span>
          <div className="w-7 h-7 rounded bg-byte-accent/10 flex items-center justify-center text-byte-accent">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-xl font-semibold font-mono text-byte-primary">{formatNumber(stats.totalTradesExecuted, 0)}</span>
        </div>
      </div>

      {/* Total Traded Volume */}
      <div className="bg-byte-surface border border-byte-border rounded-lg p-4 relative overflow-hidden group hover:border-byte-accent/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-byte-muted uppercase tracking-wider">Total Volume</span>
          <div className="w-7 h-7 rounded bg-byte-secondary flex items-center justify-center text-byte-accent">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-xl font-semibold font-mono text-byte-primary">{formatCurrency(stats.totalVolume)}</span>
        </div>
      </div>
    </div>
  );
}
