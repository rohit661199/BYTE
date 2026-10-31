import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MarketInstrument {
  symbol: string;
  name: string;
  category: 'Crypto' | 'Tech Stock' | 'Forex' | 'Utility';
  price: string;
  change: string;
  high: string;
  low: string;
  volume: string;
  isPositive: boolean;
  status?: string;
  sparkline: number[];
}

const ALL_INSTRUMENTS: MarketInstrument[] = [
  {
    symbol: 'BTC-USD',
    name: 'Bitcoin',
    category: 'Crypto',
    price: '$88,532.41',
    change: '+1.42%',
    high: '$89,210.40',
    low: '$86,128.00',
    volume: '$48.2M',
    isPositive: true,
    status: 'Market Feed',
    sparkline: [86500, 87100, 86800, 87600, 87900, 88200, 88532],
  },
  {
    symbol: 'BYTE-USD',
    name: 'Byte Utility Token',
    category: 'Utility',
    price: '$100.00',
    change: '+0.00%',
    high: '$105.00',
    low: '$95.00',
    volume: '$3,450.00',
    isPositive: true,
    status: 'FIFO Engine',
    sparkline: [100, 100, 100, 100, 100, 100, 100],
  },
  {
    symbol: 'ETH-USD',
    name: 'Ethereum',
    category: 'Crypto',
    price: '$3,240.50',
    change: '+1.18%',
    high: '$3,290.00',
    low: '$3,180.00',
    volume: '$19.4M',
    isPositive: true,
    sparkline: [3150, 3180, 3140, 3210, 3230, 3220, 3240],
  },
  {
    symbol: 'SOL-USD',
    name: 'Solana',
    category: 'Crypto',
    price: '$184.20',
    change: '+3.92%',
    high: '$189.50',
    low: '$176.00',
    volume: '$8.6M',
    isPositive: true,
    sparkline: [175, 178, 174, 180, 182, 181, 184],
  },
  {
    symbol: 'NVDA-USD',
    name: 'NVIDIA Corp',
    category: 'Tech Stock',
    price: '$135.50',
    change: '+1.64%',
    high: '$138.00',
    low: '$133.20',
    volume: '$42.8M',
    isPositive: true,
    sparkline: [132, 133, 132.5, 134, 134.8, 135, 135.5],
  },
  {
    symbol: 'AAPL-USD',
    name: 'Apple Inc',
    category: 'Tech Stock',
    price: '$228.10',
    change: '-0.42%',
    high: '$230.50',
    low: '$226.40',
    volume: '$28.1M',
    isPositive: false,
    sparkline: [230, 229, 229.5, 228, 227.5, 228.4, 228.1],
  },
  {
    symbol: 'TSLA-USD',
    name: 'Tesla Inc',
    category: 'Tech Stock',
    price: '$260.80',
    change: '+4.12%',
    high: '$266.00',
    low: '$252.00',
    volume: '$35.9M',
    isPositive: true,
    sparkline: [248, 251, 250, 255, 258, 257, 260.8],
  },
  {
    symbol: 'MSFT-USD',
    name: 'Microsoft Corp',
    category: 'Tech Stock',
    price: '$416.20',
    change: '+0.65%',
    high: '$419.00',
    low: '$414.00',
    volume: '$16.7M',
    isPositive: true,
    sparkline: [412, 414, 413, 415, 415.5, 416, 416.2],
  },
];

export const MarketsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Crypto' | 'Tech Stock' | 'Watchlist'>('All');
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(['BTC-USD', 'BYTE-USD']);
  const navigate = useNavigate();

  const toggleWatchlist = (e: React.MouseEvent, sym: string) => {
    e.stopPropagation();
    setWatchlistSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const filteredInstruments = ALL_INSTRUMENTS.filter((inst) => {
    const matchesSearch =
      inst.symbol.toLowerCase().includes(search.toLowerCase()) ||
      inst.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      activeTab === 'All'
        ? true
        : activeTab === 'Watchlist'
        ? watchlistSymbols.includes(inst.symbol)
        : inst.category === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="max-w-[1780px] mx-auto space-y-4 animate-fade-in pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-byte-border">
        <div>
          <h1 className="text-xl font-normal text-byte-primary tracking-tight">Markets Directory</h1>
          <p className="text-xs text-byte-muted mt-0.5">
            Real-time multi-asset market prices, volume turnover, and trading pairs.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <div className="px-2.5 py-1 rounded bg-byte-secondary/60 text-byte-muted border border-byte-border/60">
            Top Gainer: <span className="text-bull font-medium">TSLA (+4.12%)</span>
          </div>
          <div className="px-2.5 py-1 rounded bg-byte-secondary/60 text-byte-muted border border-byte-border/60">
            24h Volume: <span className="text-byte-primary font-medium">$208.5M</span>
          </div>
        </div>
      </div>

      {/* Search & Categories Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-byte-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search symbol or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-byte-secondary border border-byte-border rounded pl-8 pr-3 py-1.5 text-xs text-byte-primary placeholder:text-byte-muted/60 focus:outline-none focus:border-byte-accent transition-colors"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center space-x-1 bg-byte-surface p-0.5 rounded border border-byte-border w-full sm:w-auto text-xs">
          {(['All', 'Crypto', 'Tech Stock', 'Watchlist'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-xs font-normal transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-byte-secondary text-byte-accent font-medium'
                  : 'text-byte-muted hover:text-byte-primary'
              }`}
            >
              {tab === 'Watchlist' ? '★ Watchlist' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Professional Markets Table */}
      <div className="bg-byte-surface border border-byte-border rounded overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-byte-border bg-byte-secondary/40 text-byte-muted font-normal text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-4 font-normal">Asset</th>
                <th className="py-2.5 px-3 font-normal text-right">Price</th>
                <th className="py-2.5 px-3 font-normal text-right">24h Change</th>
                <th className="py-2.5 px-3 font-normal text-right hidden md:table-cell">24h High</th>
                <th className="py-2.5 px-3 font-normal text-right hidden md:table-cell">24h Low</th>
                <th className="py-2.5 px-3 font-normal text-right">24h Volume</th>
                <th className="py-2.5 px-3 font-normal text-center hidden lg:table-cell">Trend (7d)</th>
                <th className="py-2.5 px-3 font-normal text-center hidden sm:table-cell">Status</th>
                <th className="py-2.5 px-4 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-byte-border/40">
              {filteredInstruments.map((inst) => {
                const isWatch = watchlistSymbols.includes(inst.symbol);
                return (
                  <tr
                    key={inst.symbol}
                    onClick={() => navigate(`/trade/${inst.symbol}`)}
                    className="hover:bg-byte-secondary/40 transition-colors cursor-pointer group"
                  >
                    {/* Asset Name & Ticker */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        <button
                          onClick={(e) => toggleWatchlist(e, inst.symbol)}
                          className="text-byte-tertiary hover:text-byte-accent transition-colors"
                          title="Toggle Watchlist"
                        >
                          <Star className={`w-3.5 h-3.5 ${isWatch ? 'text-byte-accent fill-byte-accent' : ''}`} />
                        </button>
                        <div>
                          <span className="font-semibold text-byte-primary block text-xs group-hover:text-byte-accent transition-colors">
                            {inst.symbol}
                          </span>
                          <span className="text-[11px] text-byte-muted font-sans font-normal">
                            {inst.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-2.5 px-3 text-right font-medium text-byte-primary tnum">
                      {inst.price}
                    </td>

                    {/* 24h Change */}
                    <td className="py-2.5 px-3 text-right tnum">
                      <span
                        className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                          inst.isPositive
                            ? 'text-bull bg-bull/10'
                            : 'text-bear bg-bear/10'
                        }`}
                      >
                        {inst.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        <span>{inst.change}</span>
                      </span>
                    </td>

                    {/* 24h High */}
                    <td className="py-2.5 px-3 text-right text-byte-muted tnum hidden md:table-cell">
                      {inst.high}
                    </td>

                    {/* 24h Low */}
                    <td className="py-2.5 px-3 text-right text-byte-muted tnum hidden md:table-cell">
                      {inst.low}
                    </td>

                    {/* 24h Volume */}
                    <td className="py-2.5 px-3 text-right text-byte-muted tnum">
                      {inst.volume}
                    </td>

                    {/* 7d Trend Sparkline */}
                    <td className="py-2.5 px-3 text-center hidden lg:table-cell">
                      <div className="w-20 h-6 mx-auto">
                        <svg viewBox="0 0 80 24" className="w-full h-full overflow-visible">
                          <polyline
                            fill="none"
                            stroke={inst.isPositive ? '#22B982' : '#EF6262'}
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points="0,18 12,14 26,16 40,8 54,6 66,10 80,4"
                          />
                        </svg>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-byte-muted bg-byte-secondary/80 border border-byte-border/60">
                        {inst.status || 'Market Feed'}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-4 text-right">
                      <span className="text-xs text-byte-primary group-hover:text-byte-accent font-medium inline-flex items-center space-x-0.5">
                        <span>Trade</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
