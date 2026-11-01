import React, { useState } from 'react';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMarketData } from '../../context/MarketDataContext';
import { formatPrice, formatChange, getStatusBadgeConfig } from '../../utils/formatters';

const INSTRUMENT_NAMES: Record<string, string> = {
  'BYTE-USD': 'Byte FIFO Engine',
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',
  'SOL-USD': 'Solana',
  'AAPL': 'Apple Inc',
  'MSFT': 'Microsoft Corp',
  'NVDA': 'NVIDIA Corp',
  'TSLA': 'Tesla Inc',
  'AMZN': 'Amazon.com Inc',
  'RELIANCE': 'Reliance Industries',
  'TCS': 'Tata Consultancy',
  'HDFCBANK': 'HDFC Bank',
  'INFY': 'Infosys Ltd',
  'ICICIBANK': 'ICICI Bank',
  'SBIN': 'State Bank of India',
  'BHARTIARTL': 'Bharti Airtel',
  'ITC': 'ITC Ltd',
  'LT': 'Larsen & Toubro',
  'WIPRO': 'Wipro Ltd',
  'AXISBANK': 'Axis Bank',
  'BAJFINANCE': 'Bajaj Finance',
  'MARUTI': 'Maruti Suzuki',
  'HINDUNILVR': 'Hindustan Unilever',
  'TATAMOTORS': 'Tata Motors',
};

interface TradingWatchlistProps {
  currentSymbol: string;
}

export const TradingWatchlist: React.FC<TradingWatchlistProps> = ({ currentSymbol }) => {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { quotesList } = useMarketData();

  const cleanCurrent = (currentSymbol || 'BYTE-USD').trim().toUpperCase();

  const filtered = quotesList.filter((item) => {
    const sym = item.symbol.toLowerCase();
    const name = (INSTRUMENT_NAMES[item.symbol] || '').toLowerCase();
    const q = search.toLowerCase();
    return sym.includes(q) || name.includes(q);
  });

  return (
    <div className="bg-byte-surface border border-byte-border rounded-lg flex flex-col h-[520px] select-none text-xs font-mono">
      {/* Header & Search */}
      <div className="p-2.5 border-b border-byte-border space-y-2">
        <div className="flex items-center justify-between text-byte-muted text-[11px] font-semibold uppercase tracking-wider">
          <span>Watchlist</span>
          <span>{filtered.length} Assets</span>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-byte-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search symbol or name..."
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

      {/* Scrollable Dynamic Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-byte-border/40">
        {filtered.map((item) => {
          const isSelected = item.symbol.toUpperCase() === cleanCurrent;
          const { percentText, isPositive } = formatChange(item.change, item.changePercent);
          const priceDisplay = formatPrice(item.price, item.currency);
          const statusConfig = getStatusBadgeConfig(item.status);
          const companyName = INSTRUMENT_NAMES[item.symbol] || item.exchange;

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
                <div className="flex items-center space-x-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                  <span className="text-byte-primary block font-semibold text-[11px]">
                    {item.symbol.replace('-USD', '')}
                  </span>
                </div>
                <span className="text-[9px] text-byte-muted block truncate max-w-[85px]">
                  {companyName}
                </span>
              </div>
              <span className="text-byte-primary tnum text-[11px]">{priceDisplay}</span>
              <span
                className={`inline-flex items-center px-1 rounded text-[10px] font-semibold tnum ${
                  isPositive ? 'text-[#22B982]' : 'text-[#EF6262]'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                )}
                {percentText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
