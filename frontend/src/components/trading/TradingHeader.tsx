import React, { useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Activity, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMarketData } from '../../context/MarketDataContext';
import { formatPrice, formatChange, formatVolume, getStatusBadgeConfig } from '../../utils/formatters';

interface TradingHeaderProps {
  currentSymbol?: string;
}

const INSTRUMENT_NAMES: Record<string, string> = {
  'BYTE-USD': 'Byte Utility Token (FIFO)',
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',
  'SOL-USD': 'Solana',
  'AAPL': 'Apple Inc',
  'MSFT': 'Microsoft Corp',
  'NVDA': 'NVIDIA Corp',
  'TSLA': 'Tesla Inc',
  'AMZN': 'Amazon.com Inc',
  'RELIANCE': 'Reliance Industries Ltd',
  'TCS': 'Tata Consultancy Services',
  'HDFCBANK': 'HDFC Bank Ltd',
  'INFY': 'Infosys Ltd',
  'ICICIBANK': 'ICICI Bank Ltd',
  'SBIN': 'State Bank of India',
  'BHARTIARTL': 'Bharti Airtel Ltd',
  'ITC': 'ITC Ltd',
  'LT': 'Larsen & Toubro Ltd',
  'WIPRO': 'Wipro Ltd',
  'AXISBANK': 'Axis Bank Ltd',
  'BAJFINANCE': 'Bajaj Finance Ltd',
  'MARUTI': 'Maruti Suzuki India',
  'HINDUNILVR': 'Hindustan Unilever Ltd',
  'TATAMOTORS': 'Tata Motors Ltd',
};

export const TradingHeader: React.FC<TradingHeaderProps> = ({ currentSymbol = 'BYTE-USD' }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { getQuote, quotesList } = useMarketData();

  const cleanSymbol = (currentSymbol || 'BYTE-USD').trim().toUpperCase();
  const quote = getQuote(cleanSymbol);

  const currency = quote?.currency || (cleanSymbol.includes('-') || !['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'LT', 'WIPRO', 'AXISBANK', 'BAJFINANCE', 'MARUTI', 'HINDUNILVR', 'TATAMOTORS'].includes(cleanSymbol) ? 'USD' : 'INR');
  const priceDisplay = formatPrice(quote?.price, currency);
  const highDisplay = formatPrice(quote?.high, currency);
  const lowDisplay = formatPrice(quote?.low, currency);
  const volDisplay = formatVolume(quote?.volume, currency);
  const { text: changeText, isPositive } = formatChange(quote?.change, quote?.changePercent);

  const statusConfig = getStatusBadgeConfig(quote?.status);
  const displayName = INSTRUMENT_NAMES[cleanSymbol] || cleanSymbol;
  const isNSE = quote?.exchange === 'NSE' || currency === 'INR';

  return (
    <div className="bg-byte-surface border border-byte-border rounded-lg p-3 flex flex-wrap items-center justify-between gap-4 select-none transition-colors">
      {/* Left: Instrument Selector & Dynamic Market Price */}
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
              <span className="font-bold text-sm text-byte-primary block leading-none">
                {cleanSymbol.includes('-') ? cleanSymbol.replace('-', '/') : cleanSymbol}
              </span>
              <span className="text-[10px] text-byte-muted">{displayName.slice(0, 16)}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-byte-muted group-hover:text-byte-primary transition-colors" />
          </button>

          {/* Dropdown Menu with Live Quotes */}
          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-72 bg-byte-surface border border-byte-border rounded-md shadow-xl p-1 z-50">
              <div className="text-[10px] uppercase font-mono font-semibold text-byte-muted px-2.5 py-1 border-b border-byte-border flex justify-between">
                <span>Select Instrument</span>
                <span>24 Assets</span>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-0.5 mt-1 font-mono text-xs divide-y divide-byte-border/20">
                {quotesList.map((item) => {
                  const itemChange = formatChange(item.change, item.changePercent);
                  const itemPrice = formatPrice(item.price, item.currency);
                  const isSelected = item.symbol.toUpperCase() === cleanSymbol;
                  const itemStatus = getStatusBadgeConfig(item.status);

                  return (
                    <button
                      key={item.symbol}
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate(`/trade/${item.symbol}`);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-byte-secondary text-byte-primary font-bold'
                          : 'hover:bg-byte-secondary text-byte-muted hover:text-byte-primary'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${itemStatus.dot}`} />
                          <span className="font-semibold">{item.symbol.replace('-USD', '')}</span>
                          <span className="text-[9px] text-byte-tertiary px-1 rounded bg-byte-bg border border-byte-border/40">
                            {item.exchange}
                          </span>
                        </div>
                        <span className="text-[10px] text-byte-muted block truncate max-w-[120px]">
                          {INSTRUMENT_NAMES[item.symbol] || item.symbol}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-byte-primary tnum">{itemPrice}</span>
                        <span className={`text-[10px] tnum ${itemChange.isPositive ? 'text-[#22B982]' : 'text-[#EF6262]'}`}>
                          {itemChange.percentText}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Big Price & Change Pill */}
        <div className="flex items-baseline space-x-2 font-mono">
          <span className="text-xl sm:text-2xl font-bold text-byte-primary tnum tracking-tight">
            {priceDisplay}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold tnum ${
              isPositive ? 'text-[#22B982] bg-[#22B982]/10' : 'text-[#EF6262] bg-[#EF6262]/10'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {changeText}
          </span>
        </div>

        {/* Live / Delayed / Stale / Preview Badge */}
        <div
          className={`hidden md:inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-mono border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
          title={statusConfig.description}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
          <span className="font-semibold uppercase tracking-wider">{statusConfig.label}</span>
          <span className="text-[9px] text-byte-muted ml-0.5">({quote?.source || 'FEED'})</span>
        </div>
      </div>

      {/* Right: High, Low, Volume, Regulatory Badge & Engine Status */}
      <div className="flex items-center space-x-5 font-mono text-xs">
        <div className="hidden sm:block">
          <span className="text-[10px] text-byte-muted uppercase block">24h High</span>
          <span className="text-byte-primary tnum font-semibold">{highDisplay}</span>
        </div>

        <div className="hidden sm:block">
          <span className="text-[10px] text-byte-muted uppercase block">24h Low</span>
          <span className="text-byte-primary tnum font-semibold">{lowDisplay}</span>
        </div>

        <div className="hidden md:block">
          <span className="text-[10px] text-byte-muted uppercase block">24h Volume</span>
          <span className="text-byte-primary tnum font-semibold">{volDisplay}</span>
        </div>

        {/* Upstox Regulatory Notice Pill if NSE */}
        {isNSE && (
          <div
            className="hidden xl:flex items-center space-x-1 px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px]"
            title={quote?.regulatoryNotice || 'NSE Reference Data · Private Non-Redistributable Feed'}
          >
            <ShieldAlert className="w-3 h-3 text-blue-400" />
            <span>NSE Reference Feed</span>
          </div>
        )}

        {/* BYTE Simulated Engine Status (Strict Separation from External Reference Feeds) */}
        <div
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-byte-secondary text-[11px] text-byte-accent border border-byte-border"
          title="BYTE Order Matching operates strictly in-memory FIFO. Reference market prices do not affect simulated matching."
        >
          <Activity className="w-3.5 h-3.5 text-bull" />
          <span className="font-medium">FIFO Matching Engine</span>
        </div>
      </div>
    </div>
  );
};
