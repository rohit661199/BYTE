import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TickerItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
}

const PREVIEW_TICKERS: TickerItem[] = [
  { symbol: 'BYTE-USD', name: 'Byte Token', price: '$100.00', change: '+0.00%', isPositive: true },
  { symbol: 'BTC-USD', name: 'Bitcoin', price: '$88,532.41', change: '+1.42%', isPositive: true },
  { symbol: 'ETH-USD', name: 'Ethereum', price: '$3,240.50', change: '+1.18%', isPositive: true },
  { symbol: 'SOL-USD', name: 'Solana', price: '$184.20', change: '+3.92%', isPositive: true },
  { symbol: 'NVDA-USD', name: 'NVIDIA', price: '$135.50', change: '+1.64%', isPositive: true },
  { symbol: 'AAPL-USD', name: 'Apple', price: '$228.10', change: '-0.42%', isPositive: false },
  { symbol: 'TSLA-USD', name: 'Tesla', price: '$260.80', change: '+4.12%', isPositive: true },
];

export const TickerBar: React.FC = () => {
  const marqueeItems = [...PREVIEW_TICKERS, ...PREVIEW_TICKERS];

  return (
    <div className="border-b border-byte-border bg-byte-surface text-xs font-mono overflow-hidden select-none py-1 flex items-center transition-colors">
      <div className="flex items-center px-3 shrink-0 border-r border-byte-border text-[10px] font-mono text-byte-muted uppercase tracking-wider space-x-1.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-bull" />
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
              <span className="font-semibold text-byte-primary">{ticker.symbol}</span>
              <span className="text-byte-muted tnum">{ticker.price}</span>
              <span
                className={`inline-flex items-center px-1 rounded text-[10px] font-semibold ${
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
