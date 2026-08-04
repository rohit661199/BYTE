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
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Buy Orders</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl font-bold font-mono text-white">{formatNumber(stats.totalBuyOrders, 0)}</span>
        </div>
      </div>

      {/* Total Sell Orders */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-rose-500/30 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Sell Orders</span>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl font-bold font-mono text-white">{formatNumber(stats.totalSellOrders, 0)}</span>
        </div>
      </div>

      {/* Total Trades Executed */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Trades Executed</span>
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl font-bold font-mono text-white">{formatNumber(stats.totalTradesExecuted, 0)}</span>
        </div>
      </div>

      {/* Total Traded Volume */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-blue-500/30 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Volume</span>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl font-bold font-mono text-white">{formatCurrency(stats.totalVolume)}</span>
        </div>
      </div>
    </div>
  );
}
