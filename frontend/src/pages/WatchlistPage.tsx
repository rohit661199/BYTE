import React, { useState } from 'react';
import { Star, Bell, TrendingUp, TrendingDown, ArrowUpRight, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useMarketData } from '../context/MarketDataContext';
import { formatPrice, formatChange, getStatusBadgeConfig } from '../utils/formatters';

const INSTRUMENT_NAMES: Record<string, string> = {
  'BYTE-USD': 'Byte Utility Token',
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',
  'SOL-USD': 'Solana',
  'AAPL': 'Apple Inc',
  'MSFT': 'Microsoft Corp',
  'NVDA': 'NVIDIA Corp',
  'TSLA': 'Tesla Inc',
  'AMZN': 'Amazon.com Inc',
  'RELIANCE': 'Reliance Industries',
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
  'MARUTI': 'Maruti Suzuki Ltd',
  'HINDUNILVR': 'Hindustan Unilever',
  'TATAMOTORS': 'Tata Motors Ltd',
};

const BOARD_SYMBOLS: Record<string, string[]> = {
  'Core Assets': ['BTC-USD', 'BYTE-USD', 'ETH-USD', 'SOL-USD', 'AAPL', 'RELIANCE', 'TCS'],
  'Tech Equities': ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'INFY', 'TCS'],
  'Indian Equities (NSE)': ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'TATAMOTORS'],
};

export const WatchlistPage: React.FC = () => {
  const [activeBoard, setActiveBoard] = useState('Core Assets');
  const [boardCustomMap, setBoardCustomMap] = useState<Record<string, string[]>>(BOARD_SYMBOLS);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTargetPrice, setAlertTargetPrice] = useState('89000.00');

  const { getQuote } = useMarketData();
  const boards = ['Core Assets', 'Tech Equities', 'Indian Equities (NSE)'];

  const currentSymbols = boardCustomMap[activeBoard] || [];

  const handleRemove = (symbol: string) => {
    setBoardCustomMap((prev) => ({
      ...prev,
      [activeBoard]: (prev[activeBoard] || []).filter((s) => s !== symbol),
    }));
  };

  return (
    <div className="max-w-[1780px] mx-auto space-y-4 animate-fade-in pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-byte-border">
        <div>
          <h1 className="text-xl font-normal text-byte-primary tracking-tight">Watchlist & Alerts</h1>
          <p className="text-xs text-byte-muted mt-0.5 font-normal">
            Monitor real-time price movements across multi-asset boards and setup price target alerts.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Bell className="w-3.5 h-3.5" />}
            onClick={() => setShowAlertModal(true)}
          >
            Create Price Alert
          </Button>
        </div>
      </div>

      {/* Board Selector Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-1 bg-byte-surface p-0.5 rounded border border-byte-border text-xs">
          {boards.map((b) => (
            <button
              key={b}
              onClick={() => setActiveBoard(b)}
              className={`px-3 py-1 rounded font-normal transition-colors cursor-pointer ${
                activeBoard === b
                  ? 'bg-byte-secondary text-byte-accent font-medium'
                  : 'text-byte-muted hover:text-byte-primary'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <span className="text-xs text-byte-muted font-mono">
          {currentSymbols.length} Tracked Instruments
        </span>
      </div>

      {/* Watchlist Table */}
      <div className="bg-byte-surface border border-byte-border rounded shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-byte-border bg-byte-secondary/40 text-byte-muted uppercase text-[11px] tracking-wider font-normal">
                <th className="py-2.5 px-4 font-normal">Asset</th>
                <th className="py-2.5 px-3 font-normal text-right">Price</th>
                <th className="py-2.5 px-3 font-normal text-right">24h Change</th>
                <th className="py-2.5 px-3 font-normal text-center hidden sm:table-cell">Feed Status</th>
                <th className="py-2.5 px-3 font-normal text-center">Alert Target</th>
                <th className="py-2.5 px-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-byte-border/40">
              {currentSymbols.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-byte-muted italic font-sans">
                    Your watchlist is empty. Add instruments from the Markets directory.
                  </td>
                </tr>
              ) : (
                currentSymbols.map((sym) => {
                  const quote = getQuote(sym);
                  const currency = quote?.currency || (sym.includes('-') ? 'USD' : 'INR');
                  const priceFormatted = formatPrice(quote?.price, currency);
                  const { percentText, isPositive } = formatChange(quote?.change, quote?.changePercent);
                  const statusBadge = getStatusBadgeConfig(quote?.status);
                  const displayName = INSTRUMENT_NAMES[sym] || sym;

                  return (
                    <tr key={sym} className="hover:bg-byte-secondary/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <Star className="w-3.5 h-3.5 text-byte-accent fill-byte-accent shrink-0" />
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-semibold text-byte-primary text-xs block">
                                {sym.replace('-USD', '')}
                              </span>
                              <span className="text-[9px] text-byte-tertiary px-1 rounded bg-byte-bg border border-byte-border/40">
                                {quote?.exchange || (sym.includes('-') ? 'CRYPTO' : 'EQUITY')}
                              </span>
                            </div>
                            <span className="text-[11px] text-byte-muted font-sans font-normal block truncate max-w-[160px]">
                              {displayName}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-medium text-byte-primary tnum">
                        {priceFormatted}
                      </td>

                      <td className="py-3 px-3 text-right tnum">
                        <span
                          className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                            isPositive ? 'text-bull bg-bull/10' : 'text-bear bg-bear/10'
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          <span>{percentText}</span>
                        </span>
                      </td>

                      {/* Feed Status */}
                      <td className="py-3 px-3 text-center hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                          title={statusBadge.description}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                          <span className="font-semibold uppercase">{statusBadge.label}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center text-byte-muted tnum text-[11px]">
                        {formatPrice((quote?.price || 100) * 1.05, currency)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to={`/trade/${sym}`}
                            className="text-xs text-byte-primary hover:text-byte-accent font-medium inline-flex items-center space-x-0.5 px-2 py-1 rounded hover:bg-byte-secondary transition-colors"
                          >
                            <span>Trade</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </Link>
                          <button
                            onClick={() => handleRemove(sym)}
                            className="p-1 text-byte-muted hover:text-bear rounded hover:bg-bear/10 transition-colors cursor-pointer"
                            title="Remove from board"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert Configuration Modal */}
      <Modal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        title="Create Price Target Alert"
      >
        <div className="space-y-4 font-mono text-xs">
          <p className="text-byte-muted font-sans">
            Set an automated webhook or in-app notification when the price crosses your specified threshold.
          </p>

          <div>
            <label className="text-byte-muted block mb-1">Target Price (USD/INR)</label>
            <Input
              value={alertTargetPrice}
              onChange={(e) => setAlertTargetPrice(e.target.value)}
              placeholder="e.g. 89500.00"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAlertModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowAlertModal(false);
              }}
            >
              Arm Alert
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
