import React, { useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TradingHeaderProps {
  currentSymbol?: string;
}

const AVAILABLE_PAIRS = [
  { symbol: 'BTC-USD', display: 'BTC/USD', name: 'Bitcoin', price: '88,532.41', change: '+1,235.42 (+1.42%)', high: '89,210.40', low: '86,120.00', vol: '12.4K BTC', isPositive: true },
  { symbol: 'BYTE-USD', display: 'BYTE/USD', name: 'Byte Utility Token (FIFO Engine)', price: '100.00', change: '+0.00 (+0.00%)', high: '105.00', low: '95.00', vol: '3,450 BYTE', isPositive: true },
  { symbol: 'ETH-USD', display: 'ETH/USD', name: 'Ethereum', price: '3,240.50', change: '+37.80 (+1.18%)', high: '3,290.00', low: '3,180.00', vol: '19.4K ETH', isPositive: true },
  { symbol: 'SOL-USD', display: 'SOL/USD', name: 'Solana', price: '184.20', change: '+6.90 (+3.92%)', high: '189.50', low: '176.00', vol: '48.2K SOL', isPositive: true },
  { symbol: 'NVDA-USD', display: 'NVDA/USD', name: 'NVIDIA Corp', price: '135.50', change: '+2.18 (+1.64%)', high: '138.00', low: '133.20', vol: '42.8M SHARES', isPositive: true },
  { symbol: 'AAPL-USD', display: 'AAPL/USD', name: 'Apple Inc', price: '228.10', change: '-0.96 (-0.42%)', high: '230.50', low: '226.40', vol: '28.1M SHARES', isPositive: false },
  { symbol: 'TSLA-USD', display: 'TSLA/USD', name: 'Tesla Inc', price: '260.80', change: '+10.32 (+4.12%)', high: '266.00', low: '252.00', vol: '35.9M SHARES', isPositive: true },
];

export const TradingHeader: React.FC<TradingHeaderProps> = ({ currentSymbol = 'BYTE-USD' }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const safeSymbol = (currentSymbol || 'BYTE-USD').toLowerCase();
  const selectedPair =
    AVAILABLE_PAIRS.find((p) => p.symbol.toLowerCase() === safeSymbol) ||
    AVAILABLE_PAIRS[1]; // BYTE-USD default

  return (
    <div className="bg-byte-surface border border-byte-border rounded-lg p-3 flex flex-wrap items-center justify-between gap-4 select-none transition-colors">
      {/* Left: Instrument Selector & Last Price */}
      <div className="flex items-center space-x-4">
        {/* Pair Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded bg-byte-secondary border border-byte-border hover:border-byte-accent/50 transition-colors cursor-pointer group"
          >
            <div className="w-5 h-5 rounded flex items-center justify-center text-byte-accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                <path d="M3 12h3.5l2.5-6 4 12 3-6H21" />
              </svg>
            </div>
            <div className="text-left font-mono">
              <span className="font-bold text-sm text-byte-primary block leading-none">{selectedPair.display}</span>
              <span className="text-[10px] text-byte-muted">{selectedPair.name.slice(0, 16)}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-byte-muted group-hover:text-byte-primary transition-colors" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-64 bg-byte-surface border border-byte-border rounded-md shadow-xl p-1 z-50">
              <div className="text-[10px] uppercase font-mono font-semibold text-byte-muted px-2.5 py-1 border-b border-byte-border">
                Select Pair
              </div>
              <div className="max-h-60 overflow-y-auto space-y-0.5 mt-1 font-mono text-xs">
                {AVAILABLE_PAIRS.map((pair) => (
                  <button
                    key={pair.symbol}
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate(`/trade/${pair.symbol}`);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer ${
                      pair.symbol === selectedPair.symbol
                        ? 'bg-byte-secondary text-byte-primary font-bold'
                        : 'hover:bg-byte-secondary text-byte-muted hover:text-byte-primary'
                    }`}
                  >
                    <div>
                      <span className="font-semibold block">{pair.display}</span>
                      <span className="text-[10px] text-byte-muted block">{pair.name.slice(0, 14)}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-byte-primary">{pair.price}</span>
                      <span className={`text-[10px] ${pair.isPositive ? 'text-[#22B982]' : 'text-[#EF6262]'}`}>
                        {pair.change.split(' ')[1] || pair.change}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Big Price & Change Pill */}
        <div className="flex items-baseline space-x-2 font-mono">
          <span className="text-xl sm:text-2xl font-bold text-byte-primary tnum tracking-tight">
            ${selectedPair.price}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold tnum ${
              selectedPair.isPositive ? 'text-[#22B982] bg-[#22B982]/10' : 'text-[#EF6262] bg-[#EF6262]/10'
            }`}
          >
            {selectedPair.isPositive ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {selectedPair.change}
          </span>
        </div>
      </div>

      {/* Right: 24h High, Low, Volume, and Status matching reference image */}
      <div className="flex items-center space-x-6 font-mono text-xs">
        <div className="hidden sm:block">
          <span className="text-[10px] text-byte-muted uppercase block">24h High</span>
          <span className="text-byte-primary tnum font-semibold">${selectedPair.high}</span>
        </div>

        <div className="hidden sm:block">
          <span className="text-[10px] text-byte-muted uppercase block">24h Low</span>
          <span className="text-byte-primary tnum font-semibold">${selectedPair.low}</span>
        </div>

        <div className="hidden md:block">
          <span className="text-[10px] text-byte-muted uppercase block">24h Volume</span>
          <span className="text-byte-primary tnum font-semibold">{selectedPair.vol}</span>
        </div>

        <div className="hidden lg:flex items-center space-x-1.5 px-2 py-1 rounded bg-byte-secondary text-[11px] text-byte-accent border border-byte-border">
          <Activity className="w-3 h-3" />
          <span>FIFO In-Memory</span>
        </div>
      </div>
    </div>
  );
};
