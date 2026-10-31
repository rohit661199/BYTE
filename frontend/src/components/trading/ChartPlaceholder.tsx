import React, { useState } from 'react';
import { BarChart3, CandlestickChart, LineChart, Maximize2, Settings2, Info } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ChartPlaceholderProps {
  symbol: string;
}

export const ChartPlaceholder: React.FC<ChartPlaceholderProps> = ({ symbol }) => {
  const [activeTimeframe, setActiveTimeframe] = useState('15m');
  const [chartType, setChartType] = useState<'candles' | 'line'>('candles');

  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col h-[460px] relative overflow-hidden select-none">
      {/* Chart Toolbar */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs gap-2">
        {/* Timeframe buttons */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800/80">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={cn(
                'px-2.5 py-1 rounded font-mono font-medium transition-colors cursor-pointer',
                activeTimeframe === tf
                  ? 'bg-slate-800 text-cyan-400 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart View Switches */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800/80">
            <button
              onClick={() => setChartType('candles')}
              className={cn(
                'p-1.5 rounded transition-colors cursor-pointer',
                chartType === 'candles' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
              )}
              title="Candlestick Chart"
            >
              <CandlestickChart className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('line')}
              className={cn(
                'p-1.5 rounded transition-colors cursor-pointer',
                chartType === 'line' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
              )}
              title="Line Chart"
            >
              <LineChart className="w-3.5 h-3.5" />
            </button>
          </div>

          <button className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="flex-1 relative flex flex-col justify-between p-4 bg-slate-950/60 rounded-xl border border-slate-800/60 overflow-hidden">
        {/* Background Grid Lines */}
        <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none opacity-20">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="border-b border-r border-slate-700" />
          ))}
        </div>

        {/* Simulated Candlestick Graphic */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-md p-6 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-wide">
                TradingView Financial Canvas Workspace
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Visual chart canvas for <span className="font-mono text-cyan-400 font-semibold">{symbol}</span> ({activeTimeframe}).
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-center space-x-2">
              <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Lightweight Charts GPU-accelerated engine integration is scheduled for Phase 02/03.</span>
            </div>
          </div>
        </div>

        {/* Bottom Time Axis */}
        <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-slate-600 pt-2 border-t border-slate-800/60">
          <span>09:30</span>
          <span>11:00</span>
          <span>12:30</span>
          <span>14:00</span>
          <span>15:30</span>
          <span>Live Ticks</span>
        </div>
      </div>
    </div>
  );
};
