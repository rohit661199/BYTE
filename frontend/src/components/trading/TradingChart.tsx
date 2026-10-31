import React, { useState } from 'react';
import {
  Crosshair,
  TrendingUp,
  Maximize2,
  Sliders,
  Type,
  Ruler,
  Trash2,
  BarChart2,
} from 'lucide-react';

interface TradingChartProps {
  symbol?: string;
}

export const TradingChart: React.FC<TradingChartProps> = ({ symbol = 'BYTE-USD' }) => {
  const [activeTf, setActiveTf] = useState('15m');
  const [activeTool, setActiveTool] = useState('crosshair');
  const timeframes = ['1m', '5m', '15m', '1h', '4h', 'D', 'W'];

  // High-fidelity 28-candlestick sequence matching realistic TradingView market patterns
  const candles = [
    { o: 86900, h: 87300, l: 86700, c: 87200, vol: 35, isUp: true },
    { o: 87200, h: 87450, l: 87050, c: 87120, vol: 28, isUp: false },
    { o: 87120, h: 87600, l: 87000, c: 87580, vol: 42, isUp: true },
    { o: 87580, h: 87900, l: 87400, c: 87850, vol: 55, isUp: true },
    { o: 87850, h: 88100, l: 87700, c: 87780, vol: 38, isUp: false },
    { o: 87780, h: 88250, l: 87650, c: 88190, vol: 62, isUp: true },
    { o: 88190, h: 88400, l: 88000, c: 88350, vol: 48, isUp: true },
    { o: 88350, h: 88600, l: 88150, c: 88200, vol: 34, isUp: false },
    { o: 88200, h: 88500, l: 87950, c: 88420, vol: 45, isUp: true },
    { o: 88420, h: 88850, l: 88300, c: 88790, vol: 72, isUp: true },
    { o: 88790, h: 89100, l: 88600, c: 88950, vol: 80, isUp: true },
    { o: 88950, h: 89200, l: 88750, c: 88820, vol: 50, isUp: false },
    { o: 88820, h: 89350, l: 88700, c: 89280, vol: 65, isUp: true },
    { o: 89280, h: 89500, l: 89100, c: 89450, vol: 88, isUp: true },
    { o: 89450, h: 89650, l: 89200, c: 89320, vol: 58, isUp: false },
    { o: 89320, h: 89480, l: 88900, c: 89050, vol: 70, isUp: false },
    { o: 89050, h: 89200, l: 88700, c: 88800, vol: 64, isUp: false },
    { o: 88800, h: 89150, l: 88650, c: 89080, vol: 52, isUp: true },
    { o: 89080, h: 89400, l: 88950, c: 89340, vol: 68, isUp: true },
    { o: 89340, h: 89550, l: 89100, c: 89210, vol: 46, isUp: false },
    { o: 89210, h: 89350, l: 88750, c: 88850, vol: 75, isUp: false },
    { o: 88850, h: 89050, l: 88500, c: 88620, vol: 82, isUp: false },
    { o: 88620, h: 88900, l: 88400, c: 88780, vol: 59, isUp: true },
    { o: 88780, h: 89100, l: 88600, c: 88940, vol: 61, isUp: true },
    { o: 88940, h: 89050, l: 88550, c: 88680, vol: 54, isUp: false },
    { o: 88680, h: 88850, l: 88350, c: 88450, vol: 67, isUp: false },
    { o: 88450, h: 88750, l: 88300, c: 88680, vol: 58, isUp: true },
    { o: 88680, h: 88780, l: 88380, c: 88532, vol: 95, isUp: false }, // Live candle
  ];

  return (
    <div className="bg-byte-surface border border-byte-border rounded flex flex-col h-[520px] select-none text-xs font-mono relative overflow-hidden transition-colors">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-byte-border bg-byte-surface">
        {/* Timeframe Buttons */}
        <div className="flex items-center space-x-1">
          <span className="font-mono text-[11px] font-semibold text-byte-primary mr-2 hidden sm:inline">
            {symbol}
          </span>
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTf(tf)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                activeTf === tf
                  ? 'bg-byte-secondary text-byte-accent font-semibold'
                  : 'text-byte-muted hover:text-byte-primary hover:bg-byte-secondary/60 font-normal'
              }`}
            >
              {tf}
            </button>
          ))}
          <div className="h-3.5 w-px bg-byte-border mx-1.5" />
          <button className="flex items-center space-x-1 px-2 py-0.5 text-byte-muted hover:text-byte-primary rounded hover:bg-byte-secondary text-[11px]">
            <BarChart2 className="w-3 h-3 text-byte-accent" />
            <span className="font-sans font-normal">Indicators</span>
          </button>
        </div>

        {/* Right Tools */}
        <div className="flex items-center space-x-3 text-byte-muted text-[11px]">
          <span className="hidden sm:inline font-mono">
            MA(7): <span className="text-[#E7BD72]">88,840</span> MA(25): <span className="text-[#22B982]">88,410</span>
          </span>
          <button className="p-1 rounded hover:bg-byte-secondary hover:text-byte-primary transition-colors cursor-pointer" title="Fullscreen">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Workspace (Left Drawing Toolbar + SVG Candlestick Canvas + Right Price Scale) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Vertical Drawing Toolbar (Matching Reference Image) */}
        <div className="w-8 border-r border-byte-border bg-byte-surface flex flex-col items-center py-2 space-y-2 shrink-0 text-byte-muted">
          <button
            onClick={() => setActiveTool('crosshair')}
            className={`p-1.5 rounded transition-colors ${activeTool === 'crosshair' ? 'bg-byte-secondary text-byte-accent' : 'hover:bg-byte-secondary hover:text-byte-primary'}`}
            title="Crosshair"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('trendline')}
            className={`p-1.5 rounded transition-colors ${activeTool === 'trendline' ? 'bg-byte-secondary text-byte-accent' : 'hover:bg-byte-secondary hover:text-byte-primary'}`}
            title="Trend Line"
          >
            <TrendingUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('fib')}
            className={`p-1.5 rounded transition-colors ${activeTool === 'fib' ? 'bg-byte-secondary text-byte-accent' : 'hover:bg-byte-secondary hover:text-byte-primary'}`}
            title="Fibonacci Retracement"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('text')}
            className={`p-1.5 rounded transition-colors ${activeTool === 'text' ? 'bg-byte-secondary text-byte-accent' : 'hover:bg-byte-secondary hover:text-byte-primary'}`}
            title="Annotation"
          >
            <Type className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('ruler')}
            className={`p-1.5 rounded transition-colors ${activeTool === 'ruler' ? 'bg-byte-secondary text-byte-accent' : 'hover:bg-byte-secondary hover:text-byte-primary'}`}
            title="Measure Range"
          >
            <Ruler className="w-3.5 h-3.5" />
          </button>
          <div className="w-4 h-px bg-byte-border my-1" />
          <button
            onClick={() => {}}
            className="p-1.5 rounded text-byte-muted hover:text-[#EF6262] transition-colors"
            title="Clear Drawings"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center SVG Chart Graphic */}
        <div className="flex-1 flex flex-col bg-byte-surface relative overflow-hidden">
          {/* SVG Canvas for Candles + Volume */}
          <div className="flex-1 relative p-2">
            <svg className="w-full h-full" viewBox="0 0 720 330" preserveAspectRatio="none">
              {/* Very Subtle Horizontal Grid Lines */}
              <line x1="0" y1="50" x2="720" y2="50" stroke="currentColor" className="text-byte-border/25" strokeDasharray="2 4" />
              <line x1="0" y1="110" x2="720" y2="110" stroke="currentColor" className="text-byte-border/25" strokeDasharray="2 4" />
              <line x1="0" y1="170" x2="720" y2="170" stroke="currentColor" className="text-byte-border/25" strokeDasharray="2 4" />
              <line x1="0" y1="230" x2="720" y2="230" stroke="currentColor" className="text-byte-border/25" strokeDasharray="2 4" />

              {/* Smooth Moving Average Curves */}
              <path
                d="M 15 210 Q 180 180, 360 120 T 700 85"
                fill="none"
                stroke="#E7BD72"
                strokeWidth="1.2"
                strokeOpacity="0.85"
              />
              <path
                d="M 15 235 Q 220 205, 420 145 T 700 110"
                fill="none"
                stroke="#22B982"
                strokeWidth="1.1"
                strokeOpacity="0.65"
              />

              {/* Render Candlesticks */}
              {candles.map((c, i) => {
                const candleWidth = 6;
                const candleSpacing = 24.5;
                const x = 18 + i * candleSpacing;
                // Scale prices 86,200 - 89,900 into height 15 - 250
                const minY = 86200;
                const maxY = 89900;
                const getY = (price: number) => 250 - ((price - minY) / (maxY - minY)) * 230;

                const yOpen = getY(c.o);
                const yClose = getY(c.c);
                const yHigh = getY(c.h);
                const yLow = getY(c.l);

                const topY = Math.min(yOpen, yClose);
                const height = Math.max(Math.abs(yOpen - yClose), 2);
                const color = c.isUp ? '#22B982' : '#EF6262';

                // Volume bar at bottom
                const volHeight = (c.vol / 95) * 45;
                const volY = 320 - volHeight;

                return (
                  <g key={i}>
                    {/* Wick */}
                    <line x1={x + candleWidth / 2} y1={yHigh} x2={x + candleWidth / 2} y2={yLow} stroke={color} strokeWidth="1" />
                    {/* Body */}
                    <rect x={x} y={topY} width={candleWidth} height={height} fill={color} rx="0.5" />
                    {/* Volume bar */}
                    <rect x={x} y={volY} width={candleWidth} height={volHeight} fill={color} opacity="0.25" rx="0.5" />
                  </g>
                );
              })}

              {/* Current Price Dashed Guide Line */}
              <line x1="0" y1="126" x2="720" y2="126" stroke="#22B982" strokeDasharray="3 3" strokeWidth="0.8" opacity="0.8" />
            </svg>
          </div>

          {/* Bottom Time Axis */}
          <div className="h-6 border-t border-byte-border flex items-center justify-between px-4 text-[10px] text-byte-muted bg-byte-surface">
            <span>08:00</span>
            <span>10:00</span>
            <span>12:00</span>
            <span>14:00</span>
            <span>15:30</span>
            <span className="text-bull">Live</span>
          </div>
        </div>

        {/* Right Vertical Price Axis */}
        <div className="w-20 border-l border-byte-border bg-byte-surface flex flex-col justify-between py-3 text-[10px] text-byte-muted text-right pr-2 shrink-0">
          <span>89,500.00</span>
          <span>89,000.00</span>
          {/* Active Price Tag */}
          <div className="bg-[#22B982] text-[#0E141B] px-1 py-0.5 rounded text-[10px] font-semibold font-mono shadow-xs -mr-1.5 text-center">
            88,532.41
          </div>
          <span>88,000.00</span>
          <span>87,500.00</span>
          <span>87,000.00</span>
          <span className="text-[9px] text-byte-tertiary">USD</span>
        </div>
      </div>
    </div>
  );
};
