import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useMarketData } from '../context/MarketDataContext';
import { formatPrice, formatChange, formatVolume, getStatusBadgeConfig } from '../utils/formatters';

const INSTRUMENT_METADATA: Record<
  string,
  { name: string; category: 'Crypto' | 'US Equities' | 'Indian Equities (NSE)' | 'Utility' }
> = {
  'BYTE-USD': { name: 'Byte Utility Token (FIFO Engine)', category: 'Utility' },
  'BTC-USD': { name: 'Bitcoin', category: 'Crypto' },
  'ETH-USD': { name: 'Ethereum', category: 'Crypto' },
  'SOL-USD': { name: 'Solana', category: 'Crypto' },
  'AAPL': { name: 'Apple Inc', category: 'US Equities' },
  'MSFT': { name: 'Microsoft Corp', category: 'US Equities' },
  'NVDA': { name: 'NVIDIA Corp', category: 'US Equities' },
  'TSLA': { name: 'Tesla Inc', category: 'US Equities' },
  'AMZN': { name: 'Amazon.com Inc', category: 'US Equities' },
  'RELIANCE': { name: 'Reliance Industries Ltd', category: 'Indian Equities (NSE)' },
  'TCS': { name: 'Tata Consultancy Services', category: 'Indian Equities (NSE)' },
  'HDFCBANK': { name: 'HDFC Bank Ltd', category: 'Indian Equities (NSE)' },
  'INFY': { name: 'Infosys Ltd', category: 'Indian Equities (NSE)' },
  'ICICIBANK': { name: 'ICICI Bank Ltd', category: 'Indian Equities (NSE)' },
  'SBIN': { name: 'State Bank of India', category: 'Indian Equities (NSE)' },
  'BHARTIARTL': { name: 'Bharti Airtel Ltd', category: 'Indian Equities (NSE)' },
  'ITC': { name: 'ITC Ltd', category: 'Indian Equities (NSE)' },
  'LT': { name: 'Larsen & Toubro Ltd', category: 'Indian Equities (NSE)' },
  'WIPRO': { name: 'Wipro Ltd', category: 'Indian Equities (NSE)' },
  'AXISBANK': { name: 'Axis Bank Ltd', category: 'Indian Equities (NSE)' },
  'BAJFINANCE': { name: 'Bajaj Finance Ltd', category: 'Indian Equities (NSE)' },
  'MARUTI': { name: 'Maruti Suzuki India Ltd', category: 'Indian Equities (NSE)' },
  'HINDUNILVR': { name: 'Hindustan Unilever Ltd', category: 'Indian Equities (NSE)' },
  'TATAMOTORS': { name: 'Tata Motors Ltd', category: 'Indian Equities (NSE)' },
};

type CategoryTab = 'All' | 'Crypto' | 'US Equities' | 'Indian Equities (NSE)' | 'Watchlist';

export const MarketsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryTab>('All');
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([
    'BYTE-USD',
    'BTC-USD',
    'AAPL',
    'RELIANCE',
  ]);
  const navigate = useNavigate();
  const { quotesList } = useMarketData();

  const toggleWatchlist = (e: React.MouseEvent, sym: string) => {
    e.stopPropagation();
    setWatchlistSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  // Enhance quotes with category and friendly company names
  const enhancedInstruments = useMemo(() => {
    return quotesList.map((q) => {
      const meta = INSTRUMENT_METADATA[q.symbol] || {
        name: q.symbol,
        category: q.assetType === 'CRYPTO' ? 'Crypto' : q.currency === 'INR' ? 'Indian Equities (NSE)' : 'US Equities',
      };
      return {
        ...q,
        name: meta.name,
        category: meta.category,
      };
    });
  }, [quotesList]);

  // Compute stats
  const { topGainer, totalVolumeDisplay } = useMemo(() => {
    let best = enhancedInstruments[0];
    let totalUsdVol = 0;

    enhancedInstruments.forEach((inst) => {
      if ((inst.changePercent || 0) > (best?.changePercent || 0)) {
        best = inst;
      }
      // Add volume in approximate USD
      const vol = inst.volume || 0;
      totalUsdVol += inst.currency === 'INR' ? vol / 84 : vol;
    });

    return {
      topGainer: best,
      totalVolumeDisplay: formatVolume(totalUsdVol, 'USD'),
    };
  }, [enhancedInstruments]);

  const filteredInstruments = useMemo(() => {
    return enhancedInstruments.filter((inst) => {
      const q = search.toLowerCase();
      const matchesSearch =
        inst.symbol.toLowerCase().includes(q) ||
        inst.name.toLowerCase().includes(q) ||
        inst.exchange.toLowerCase().includes(q);

      const matchesTab =
        activeTab === 'All'
          ? true
          : activeTab === 'Watchlist'
          ? watchlistSymbols.includes(inst.symbol)
          : inst.category === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [enhancedInstruments, search, activeTab, watchlistSymbols]);

  const tabs: CategoryTab[] = ['All', 'Crypto', 'US Equities', 'Indian Equities (NSE)', 'Watchlist'];

  return (
    <div className="max-w-[1780px] mx-auto space-y-4 animate-fade-in pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-byte-border">
        <div>
          <h1 className="text-xl font-normal text-byte-primary tracking-tight">Markets Directory</h1>
          <p className="text-xs text-byte-muted mt-0.5">
            Real-time multi-asset market prices across US Equities, Indian Equities (NSE), and Crypto.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          {topGainer && (
            <div className="px-2.5 py-1 rounded bg-byte-secondary/60 text-byte-muted border border-byte-border/60">
              Top Gainer:{' '}
              <span className="text-bull font-medium">
                {topGainer.symbol} (+{(topGainer.changePercent || 0).toFixed(2)}%)
              </span>
            </div>
          )}
          <div className="px-2.5 py-1 rounded bg-byte-secondary/60 text-byte-muted border border-byte-border/60">
            24h Turnover: <span className="text-byte-primary font-medium">{totalVolumeDisplay}</span>
          </div>
        </div>
      </div>

      {/* Search & Categories Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-byte-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search symbol, company, or exchange..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-byte-secondary border border-byte-border rounded pl-8 pr-3 py-1.5 text-xs text-byte-primary placeholder:text-byte-muted/60 focus:outline-none focus:border-byte-accent transition-colors font-mono"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center space-x-1 bg-byte-surface p-0.5 rounded border border-byte-border w-full sm:w-auto text-xs overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-colors cursor-pointer ${
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
                <th className="py-2.5 px-3 font-normal text-center hidden lg:table-cell">Category</th>
                <th className="py-2.5 px-3 font-normal text-center hidden sm:table-cell">Feed Status</th>
                <th className="py-2.5 px-4 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-byte-border/40">
              {filteredInstruments.map((inst) => {
                const isWatch = watchlistSymbols.includes(inst.symbol);
                const { percentText, isPositive } = formatChange(inst.change, inst.changePercent);
                const priceFormatted = formatPrice(inst.price, inst.currency);
                const highFormatted = formatPrice(inst.high, inst.currency);
                const lowFormatted = formatPrice(inst.low, inst.currency);
                const volFormatted = formatVolume(inst.volume, inst.currency);
                const statusBadge = getStatusBadgeConfig(inst.status);
                const isNSE = inst.exchange === 'NSE' || inst.currency === 'INR';

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
                          <Star
                            className={`w-3.5 h-3.5 ${
                              isWatch ? 'text-byte-accent fill-byte-accent' : ''
                            }`}
                          />
                        </button>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-byte-primary text-xs group-hover:text-byte-accent transition-colors">
                              {inst.symbol}
                            </span>
                            <span className="text-[9px] text-byte-tertiary px-1 rounded bg-byte-bg border border-byte-border/40">
                              {inst.exchange}
                            </span>
                          </div>
                          <span className="text-[11px] text-byte-muted font-sans font-normal block truncate max-w-[200px]">
                            {inst.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Dynamic Price with Currency */}
                    <td className="py-2.5 px-3 text-right font-medium text-byte-primary tnum">
                      {priceFormatted}
                    </td>

                    {/* 24h Change */}
                    <td className="py-2.5 px-3 text-right tnum">
                      <span
                        className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                          isPositive ? 'text-bull bg-bull/10' : 'text-bear bg-bear/10'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        <span>{percentText}</span>
                      </span>
                    </td>

                    {/* 24h High */}
                    <td className="py-2.5 px-3 text-right text-byte-muted tnum hidden md:table-cell">
                      {highFormatted}
                    </td>

                    {/* 24h Low */}
                    <td className="py-2.5 px-3 text-right text-byte-muted tnum hidden md:table-cell">
                      {lowFormatted}
                    </td>

                    {/* 24h Volume */}
                    <td className="py-2.5 px-3 text-right text-byte-muted tnum">
                      {volFormatted}
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-3 text-center hidden lg:table-cell">
                      <span className="text-[10px] text-byte-muted font-mono px-2 py-0.5 rounded bg-byte-secondary border border-byte-border/40">
                        {inst.category}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                      <div className="inline-flex items-center space-x-1">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                          title={statusBadge.description}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                          <span className="font-semibold uppercase">{statusBadge.label}</span>
                        </span>
                        {isNSE && (
                          <span
                            className="text-[9px] text-blue-400 bg-blue-500/10 px-1 rounded border border-blue-500/20"
                            title="NSE Reference Feed · Public preview"
                          >
                            NSE
                          </span>
                        )}
                      </div>
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
