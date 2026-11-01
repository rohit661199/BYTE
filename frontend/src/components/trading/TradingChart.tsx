import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Crosshair,
  TrendingUp,
  Maximize2,
  Sliders,
  Type,
  Ruler,
  Trash2,
  BarChart2,
  Loader2,
  Info,
} from 'lucide-react';
import { Candle, CandleInterval } from '../../types/marketData';
import { apiService } from '../../services/api';
import { useMarketData } from '../../context/MarketDataContext';
import { formatPrice } from '../../utils/formatters';

interface TradingChartProps {
  symbol?: string;
}

export const TradingChart: React.FC<TradingChartProps> = ({ symbol = 'BYTE-USD' }) => {
  const [activeTf, setActiveTf] = useState<CandleInterval>('15m');
  const [activeTool, setActiveTool] = useState('crosshair');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  const { getQuote, subscribeToCandles } = useMarketData();
  const cleanSymbol = (symbol || 'BYTE-USD').trim().toUpperCase();
  const quote = getQuote(cleanSymbol);
  const currency = quote?.currency || (cleanSymbol.includes('-') ? 'USD' : 'INR');

  const timeframes: CandleInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

  // Fetch genuine historical candles from backend API (never synthesize fallback candles)
  const fetchCandles = useCallback(async () => {
    setIsLoading(true);
    setInfoNotice(null);

    try {
      const data = await apiService.getCandles(cleanSymbol, activeTf, 50);

      if (Array.isArray(data) && data.length > 0) {
        setCandles(data);
      } else {
        // Transparent handling: do not fabricate synthetic candles.
        // If provider has no historical candles, present an explicit empty/awaiting state.
        setCandles([]);
        setInfoNotice(`No historical candles available for ${cleanSymbol} (${activeTf})`);
      }
    } catch (err: any) {
      console.warn(`[TradingChart] Candles fetch note for ${cleanSymbol}:`, err.message);
      setCandles([]);
      setInfoNotice(`Historical feed disconnected for ${cleanSymbol}`);
    } finally {
      setIsLoading(false);
    }
  }, [cleanSymbol, activeTf]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  // Subscribe to live genuine candle updates via WebSocket
  useEffect(() => {
    const unsubscribe = subscribeToCandles(cleanSymbol, activeTf, (payload) => {
      if (payload && payload.candle) {
        setCandles((prev) => {
          if (prev.length === 0) return [payload.candle];

          const lastCandle = prev[prev.length - 1];
          // If within the same bucket, update forming candle
          if (lastCandle.timestamp === payload.candle.timestamp) {
            const updated = [...prev];
            updated[updated.length - 1] = payload.candle;
            return updated;
          }

          // New candle bucket: append and limit to max 50 candles
          const appended = [...prev, payload.candle];
          return appended.length > 50 ? appended.slice(appended.length - 50) : appended;
        });
      }
    });

    return () => unsubscribe();
  }, [cleanSymbol, activeTf, subscribeToCandles]);

  // Merge live quote tick into the active forming candle's close if active
  useEffect(() => {
    if (quote?.price && candles.length > 0) {
      setCandles((prev) => {
        if (prev.length === 0) return prev;
        const lastIndex = prev.length - 1;
        const last = prev[lastIndex];
        const newPrice = quote.price;

        if (last.close !== newPrice) {
          const updated = [...prev];
          updated[lastIndex] = {
            ...last,
            close: newPrice,
            high: Math.max(last.high, newPrice),
            low: Math.min(last.low, newPrice),
          };
          return updated;
        }
        return prev;
      });
    }
  }, [quote?.price, candles.length]);

  // Calculate dynamic scaling for SVG Canvas (ViewBox: 720 x 330)
  const { minY, maxY, candleCoords, ma7Points, ma25Points, currentMA7, currentMA25 } =
    useMemo(() => {
      if (candles.length === 0) {
        const refPrice = quote?.price || 100;
        return {
          minY: refPrice * 0.95,
          maxY: refPrice * 1.05,
          candleCoords: [],
          ma7Points: '',
          ma25Points: '',
          currentMA7: null,
          currentMA25: null,
        };
      }

      const lows = candles.map((c) => c.low);
      const highs = candles.map((c) => c.high);
      const minVal = Math.min(...lows);
      const maxVal = Math.max(...highs);
      const padding = (maxVal - minVal) * 0.08 || minVal * 0.01 || 1;

      const calcMinY = minVal - padding;
      const calcMaxY = maxVal + padding;
      const range = calcMaxY - calcMinY || 1;

      // SVG mapping: price to Y (chart area height 230, offset from top 20)
      const getY = (price: number) => 240 - ((price - calcMinY) / range) * 210;

      const count = candles.length;
      const candleWidth = Math.max(Math.min(620 / (count * 2), 10), 4);
      const candleSpacing = 680 / count;

      const maxVol = Math.max(...candles.map((c) => c.volume), 1);

      const coords = candles.map((c, i) => {
        const x = 20 + i * candleSpacing;
        const yOpen = getY(c.open);
        const yClose = getY(c.close);
        const yHigh = getY(c.high);
        const yLow = getY(c.low);
        const topY = Math.min(yOpen, yClose);
        const height = Math.max(Math.abs(yOpen - yClose), 1.5);
        const isUp = c.close >= c.open;

        // Volume bar at bottom
        const volHeight = Math.max((c.volume / maxVol) * 45, 2);
        const volY = 320 - volHeight;

        return {
          x,
          yOpen,
          yClose,
          yHigh,
          yLow,
          topY,
          height,
          isUp,
          volHeight,
          volY,
          timestamp: c.timestamp,
          close: c.close,
        };
      });

      // Calculate Simple Moving Averages (MA7 and MA25)
      const ma7: Array<{ x: number; y: number }> = [];
      const ma25: Array<{ x: number; y: number }> = [];

      for (let i = 0; i < coords.length; i++) {
        if (i >= 6) {
          const slice7 = candles.slice(i - 6, i + 1);
          const avg7 = slice7.reduce((sum, c) => sum + c.close, 0) / 7;
          ma7.push({ x: coords[i].x + candleWidth / 2, y: getY(avg7) });
        }
        if (i >= 24) {
          const slice25 = candles.slice(i - 24, i + 1);
          const avg25 = slice25.reduce((sum, c) => sum + c.close, 0) / 25;
          ma25.push({ x: coords[i].x + candleWidth / 2, y: getY(avg25) });
        }
      }

      const ma7Path =
        ma7.length > 1
          ? `M ${ma7[0].x} ${ma7[0].y} ` + ma7.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
          : '';

      const ma25Path =
        ma25.length > 1
          ? `M ${ma25[0].x} ${ma25[0].y} ` + ma25.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
          : '';

      const lastAvg7 =
        candles.length >= 7
          ? candles.slice(-7).reduce((acc, c) => acc + c.close, 0) / 7
          : null;

      const lastAvg25 =
        candles.length >= 25
          ? candles.slice(-25).reduce((acc, c) => acc + c.close, 0) / 25
          : null;

      return {
        minY: calcMinY,
        maxY: calcMaxY,
        candleCoords: coords,
        ma7Points: ma7Path,
        ma25Points: ma25Path,
        currentMA7: lastAvg7,
        currentMA25: lastAvg25,
      };
    }, [candles, quote?.price]);

  const lastCandle = candles[candles.length - 1];
  const lastPrice = lastCandle ? lastCandle.close : quote?.price || 0;
  const candleWidth = Math.max(Math.min(620 / (candles.length * 2), 10), 4);

  // Status-sensitive feed badge for bottom axis
  const renderFeedStatus = () => {
    switch (quote?.status) {
      case 'LIVE':
        return (
          <span className="text-bull font-semibold flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />
            <span>Live Feed</span>
          </span>
        );
      case 'PREVIEW':
        return (
          <span className="text-blue-400 font-semibold flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Preview Feed</span>
          </span>
        );
      case 'DELAYED':
        return (
          <span className="text-amber-400 font-semibold flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Delayed Feed</span>
          </span>
        );
      case 'STALE':
        return (
          <span className="text-orange-400 font-semibold flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            <span>Stale Feed</span>
          </span>
        );
      default:
        return (
          <span className="text-byte-muted font-semibold flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-byte-muted" />
            <span>Feed Offline</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-byte-surface border border-byte-border rounded flex flex-col h-[520px] select-none text-xs font-mono relative overflow-hidden transition-colors">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-byte-border bg-byte-surface">
        {/* Timeframe Buttons */}
        <div className="flex items-center space-x-1">
          <span className="font-mono text-[11px] font-semibold text-byte-primary mr-2 hidden sm:inline">
            {cleanSymbol}
          </span>
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTf(tf)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer uppercase ${
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

        {/* Right Tools & MA legend */}
        <div className="flex items-center space-x-3 text-byte-muted text-[11px]">
          {infoNotice && (
            <span className="hidden lg:flex items-center space-x-1 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              <Info className="w-3 h-3" />
              <span>{infoNotice}</span>
            </span>
          )}
          <span className="hidden sm:inline font-mono">
            MA(7):{' '}
            <span className="text-[#E7BD72] tnum">
              {currentMA7 !== null ? formatPrice(currentMA7, currency) : '--'}
            </span>{' '}
            MA(25):{' '}
            <span className="text-[#22B982] tnum">
              {currentMA25 !== null ? formatPrice(currentMA25, currency) : '--'}
            </span>
          </span>
          <button
            className="p-1 rounded hover:bg-byte-secondary hover:text-byte-primary transition-colors cursor-pointer"
            title="Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Loading Spinner Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-byte-surface/60 backdrop-blur-xs flex items-center justify-center space-x-2 text-byte-muted">
            <Loader2 className="w-5 h-5 animate-spin text-byte-accent" />
            <span className="text-xs">Loading genuine historical candles...</span>
          </div>
        )}

        {/* Left Vertical Drawing Toolbar */}
        <div className="w-8 border-r border-byte-border bg-byte-surface flex flex-col items-center py-2 space-y-2 shrink-0 text-byte-muted">
          <button
            onClick={() => setActiveTool('crosshair')}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'crosshair'
                ? 'bg-byte-secondary text-byte-accent'
                : 'hover:bg-byte-secondary hover:text-byte-primary'
            }`}
            title="Crosshair"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('trendline')}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'trendline'
                ? 'bg-byte-secondary text-byte-accent'
                : 'hover:bg-byte-secondary hover:text-byte-primary'
            }`}
            title="Trend Line"
          >
            <TrendingUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('fib')}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'fib'
                ? 'bg-byte-secondary text-byte-accent'
                : 'hover:bg-byte-secondary hover:text-byte-primary'
            }`}
            title="Fibonacci Retracement"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('text')}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'text'
                ? 'bg-byte-secondary text-byte-accent'
                : 'hover:bg-byte-secondary hover:text-byte-primary'
            }`}
            title="Annotation"
          >
            <Type className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('ruler')}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'ruler'
                ? 'bg-byte-secondary text-byte-accent'
                : 'hover:bg-byte-secondary hover:text-byte-primary'
            }`}
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

        {/* Center Chart Area */}
        <div className="flex-1 flex flex-col bg-byte-surface relative overflow-hidden">
          {/* SVG Canvas for Candles + Volume */}
          <div className="flex-1 relative p-2">
            <svg className="w-full h-full" viewBox="0 0 720 330" preserveAspectRatio="none">
              {/* Subtle Horizontal Grid Lines */}
              <line
                x1="0"
                y1="50"
                x2="720"
                y2="50"
                stroke="currentColor"
                className="text-byte-border/25"
                strokeDasharray="2 4"
              />
              <line
                x1="0"
                y1="110"
                x2="720"
                y2="110"
                stroke="currentColor"
                className="text-byte-border/25"
                strokeDasharray="2 4"
              />
              <line
                x1="0"
                y1="170"
                x2="720"
                y2="170"
                stroke="currentColor"
                className="text-byte-border/25"
                strokeDasharray="2 4"
              />
              <line
                x1="0"
                y1="230"
                x2="720"
                y2="230"
                stroke="currentColor"
                className="text-byte-border/25"
                strokeDasharray="2 4"
              />

              {/* Dynamic Moving Average Curves (Only for genuine candle sequences) */}
              {ma7Points && (
                <path
                  d={ma7Points}
                  fill="none"
                  stroke="#E7BD72"
                  strokeWidth="1.2"
                  strokeOpacity="0.85"
                />
              )}
              {ma25Points && (
                <path
                  d={ma25Points}
                  fill="none"
                  stroke="#22B982"
                  strokeWidth="1.1"
                  strokeOpacity="0.65"
                />
              )}

              {/* Render Genuine Candlesticks */}
              {candleCoords.map((c, i) => {
                const color = c.isUp ? '#22B982' : '#EF6262';
                const isLast = i === candleCoords.length - 1;

                return (
                  <g key={c.timestamp || i}>
                    {/* Wick */}
                    <line
                      x1={c.x + candleWidth / 2}
                      y1={c.yHigh}
                      x2={c.x + candleWidth / 2}
                      y2={c.yLow}
                      stroke={color}
                      strokeWidth="1"
                    />
                    {/* Body */}
                    <rect
                      x={c.x}
                      y={c.topY}
                      width={candleWidth}
                      height={c.height}
                      fill={color}
                      rx="0.5"
                    />
                    {/* Volume bar */}
                    <rect
                      x={c.x}
                      y={c.volY}
                      width={candleWidth}
                      height={c.volHeight}
                      fill={color}
                      opacity={isLast ? '0.4' : '0.25'}
                      rx="0.5"
                    />
                  </g>
                );
              })}

              {/* Current Price Dashed Guide Line */}
              {candleCoords.length > 0 && (
                <line
                  x1="0"
                  y1={candleCoords[candleCoords.length - 1]?.yClose || 150}
                  x2="720"
                  y2={candleCoords[candleCoords.length - 1]?.yClose || 150}
                  stroke="#22B982"
                  strokeDasharray="3 3"
                  strokeWidth="0.8"
                  opacity="0.8"
                />
              )}
            </svg>

            {/* Empty State Overlay when no genuine historical candles exist */}
            {!isLoading && candles.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-byte-muted select-none pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-byte-secondary flex items-center justify-center mb-2.5 text-byte-accent border border-byte-border">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <span className="font-semibold text-byte-primary text-sm mb-1">
                  No Historical Candle Data Available
                </span>
                <span className="text-xs text-byte-muted max-w-sm mb-3 font-sans">
                  No completed historical candles have been recorded by the provider for {cleanSymbol} ({activeTf}). Real-time candle will form automatically as streaming ticks arrive.
                </span>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-byte-secondary text-[11px] font-mono border border-byte-border">
                  <span className="w-1.5 h-1.5 rounded-full bg-byte-tertiary" />
                  <span>Reference Price: {formatPrice(quote?.price, currency)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Time Axis */}
          <div className="h-6 border-t border-byte-border flex items-center justify-between px-4 text-[10px] text-byte-muted bg-byte-surface">
            {candleCoords.length > 0 ? (
              <>
                <span>{formatCandleTime(candleCoords[0]?.timestamp)}</span>
                <span>
                  {formatCandleTime(
                    candleCoords[Math.floor(candleCoords.length * 0.25)]?.timestamp
                  )}
                </span>
                <span>
                  {formatCandleTime(
                    candleCoords[Math.floor(candleCoords.length * 0.5)]?.timestamp
                  )}
                </span>
                <span>
                  {formatCandleTime(
                    candleCoords[Math.floor(candleCoords.length * 0.75)]?.timestamp
                  )}
                </span>
                {renderFeedStatus()}
              </>
            ) : (
              <>
                <span>--:--</span>
                {renderFeedStatus()}
              </>
            )}
          </div>
        </div>

        {/* Right Vertical Price Axis */}
        <div className="w-24 border-l border-byte-border bg-byte-surface flex flex-col justify-between py-3 text-[10px] text-byte-muted text-right pr-2 shrink-0">
          <span className="tnum">{formatPrice(maxY, currency)}</span>
          <span className="tnum">{formatPrice(maxY - (maxY - minY) * 0.25, currency)}</span>
          {/* Active Price Tag */}
          <div className="bg-[#22B982] text-[#0E141B] px-1 py-0.5 rounded text-[10px] font-semibold font-mono shadow-xs -mr-1.5 text-center tnum">
            {formatPrice(lastPrice, currency)}
          </div>
          <span className="tnum">{formatPrice(minY + (maxY - minY) * 0.25, currency)}</span>
          <span className="tnum">{formatPrice(minY, currency)}</span>
          <span className="text-[9px] text-byte-tertiary font-semibold uppercase">{currency}</span>
        </div>
      </div>
    </div>
  );
};

function formatCandleTime(ts: number | undefined): string {
  if (!ts) return '--:--';
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
