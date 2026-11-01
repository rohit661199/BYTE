import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMarketData } from '../../context/MarketDataContext';
import { formatPrice, formatChange, getStatusBadgeConfig } from '../../utils/formatters';

const FEATURED_SYMBOLS = [
  'BYTE-USD',
  'BTC-USD',
  'ETH-USD',
  'SOL-USD',
  'NVDA',
  'AAPL',
  'TSLA',
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
];

export const TickerBar: React.FC = () => {
  const { getQuote } = useMarketData();

  const activeTickers = FEATURED_SYMBOLS.map((sym) => {
    const q = getQuote(sym);
    const { percentText, isPositive } = formatChange(q?.change, q?.changePercent);
    const formattedPrice = formatPrice(q?.price, q?.currency || 'USD');
    const badge = getStatusBadgeConfig(q?.status);

    return {
      symbol: q?.symbol || sym,
      displaySymbol: (q?.symbol || sym).replace('-USD', ''),
      price: formattedPrice,
      change: percentText,
      isPositive,
      status: q?.status || 'PREVIEW',
      dotClass: badge.dot,
    };
  });

  // Duplicate for seamless infinite marquee loop
  const marqueeItems = [...activeTickers, ...activeTickers];

  return (
    <div className="border-b border-byte-border bg-byte-surface text-xs font-mono overflow-hidden select-none py-1 flex items-center transition-colors">
      <div className="flex items-center px-3 shrink-0 border-r border-byte-border text-[10px] font-mono text-byte-muted uppercase tracking-wider space-x-1.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />
        <span className="text-byte-primary font-medium">Markets</span>
      </div>

      <div className="flex whitespace-nowrap overflow-hidden w-full relative">
        <div className="flex space-x-7 animate-ticker hover:[animation-play-state:paused]">
          {marqueeItems.map((ticker, index) => (
            <Link
              key={`${ticker.symbol}-${index}`}
              to={`/trade/${ticker.symbol}`}
              className="inline-flex items-center space-x-2 text-byte-muted hover:text-byte-primary transition-colors py-0.5 cursor-pointer text-[11px]"
            >
              <div className="flex items-center space-x-1">
                <span className={`w-1.5 h-1.5 rounded-full ${ticker.dotClass}`} />
                <span className="font-semibold text-byte-primary">{ticker.displaySymbol}</span>
              </div>
              <span className="text-byte-muted tnum">{ticker.price}</span>
              <span
                className={`inline-flex items-center px-1 rounded text-[10px] font-semibold tnum ${
                  ticker.isPositive
                    ? 'text-[#22B982] bg-[#22B982]/10'
                    : 'text-[#EF6262] bg-[#EF6262]/10'
                }`}
              >
                {ticker.isPositive ? (
                  <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                )}
                {ticker.change}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
