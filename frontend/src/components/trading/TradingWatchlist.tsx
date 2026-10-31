import React, { useState } from 'react';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WatchlistInstrument {
  symbol: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
}

const INSTRUMENTS: WatchlistInstrument[] = [
  { symbol: 'BTC-USD', name: 'Bitcoin', price: '88,532.41', change: '+1.42%', isPositive: true },
  { symbol: 'BYTE-USD', name: 'Byte Token (FIFO)', price: '100.00', change: '+0.00%', isPositive: true },
  { symbol: 'ETH-USD', name: 'Ethereum', price: '3,240.50', change: '+1.18%', isPositive: true },
  { symbol: 'SOL-USD', name: 'Solana', price: '184.20', change: '+3.92%', isPositive: true },
  { symbol: 'NVDA-USD', name: 'NVIDIA Corp', price: '135.50', change: '+1.64%', isPositive: true },
  { symbol: 'AAPL-USD', name: 'Apple Inc', price: '228.10', change: '-0.42%', isPositive: false },
  { symbol: 'TSLA-USD', name: 'Tesla Inc', price: '260.80', change: '+4.12%', isPositive: true },
  { symbol: 'MSFT-USD', name: 'Microsoft', price: '416.20', change: '+0.65%', isPositive: true },
];

interface TradingWatchlistProps {
  currentSymbol: string;
}

export const TradingWatchlist: React.FC<TradingWatchlistProps> = ({ currentSymbol }) => {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filtered = INSTRUMENTS.filter(
    (i) =>
      i.symbol.toLowerCase().includes(search.toLowerCase()) ||
      i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-byte-surface border border-byte-border rounded-lg flex flex-col h-[520px] select-none text-xs font-mono">
      {/* Header & Search */}
      <div className="p-2.5 border-b border-byte-border space-y-2">
        <div className="flex items-center justify-between text-byte-muted text-[11px] font-semibold uppercase tracking-wider">
          <span>Watchlist</span>
          <span>8 Assets</span>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-byte-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-byte-secondary border border-byte-border rounded pl-7 pr-2 py-1 text-xs text-byte-primary placeholder:text-byte-muted/60 focus:outline-none focus:border-byte-accent font-mono"
          />
        </div>
      </div>

      {/* Column Titles */}
      <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] text-byte-muted border-b border-byte-border/60 bg-byte-secondary/40 font-semibold uppercase">
        <span>Symbol</span>
        <span>Price</span>
        <span>24h%</span>
      </div>

      {/* Scrollable Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-byte-border/40">
        {filtered.map((item) => {
          const isSelected = item.symbol.toLowerCase() === (currentSymbol || '').toLowerCase();
          return (
            <button
              key={item.symbol}
              onClick={() => navigate(`/trade/${item.symbol}`)}
              className={`w-full flex items-center justify-between px-2.5 py-2 text-left transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-byte-secondary text-byte-primary font-bold border-l-2 border-byte-accent'
                  : 'hover:bg-byte-secondary/50 text-byte-muted hover:text-byte-primary'
              }`}
            >
              <div className="leading-tight">
                <span className="text-byte-primary block font-semibold text-[11px]">{item.symbol.replace('-USD', '')}</span>
                <span className="text-[9px] text-byte-muted block">{item.name.slice(0, 10)}</span>
              </div>
              <span className="text-byte-primary tnum text-[11px]">{item.price}</span>
              <span
                className={`inline-flex items-center px-1 rounded text-[10px] font-semibold tnum ${
                  item.isPositive ? 'text-[#22B982]' : 'text-[#EF6262]'
                }`}
              >
                {item.isPositive ? (
                  <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                )}
                {item.change}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
