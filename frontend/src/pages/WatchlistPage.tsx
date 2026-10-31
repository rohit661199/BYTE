import React, { useState } from 'react';
import { Star, Bell, TrendingUp, TrendingDown, ArrowUpRight, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

interface WatchlistItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  sparkline: number[];
  isPositive: boolean;
}

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { symbol: 'BTC-USD', name: 'Bitcoin', price: '$88,532.41', change: '+1.42%', sparkline: [40, 42, 41, 44, 46, 45, 48, 50], isPositive: true },
  { symbol: 'BYTE-USD', name: 'Byte Utility Token', price: '$100.00', change: '+0.00%', sparkline: [50, 50, 50, 50, 50, 50, 50, 50], isPositive: true },
  { symbol: 'ETH-USD', name: 'Ethereum', price: '$3,240.50', change: '+1.18%', sparkline: [30, 31, 29, 32, 34, 33, 35, 36], isPositive: true },
  { symbol: 'SOL-USD', name: 'Solana', price: '$184.20', change: '+3.92%', sparkline: [20, 22, 21, 25, 27, 26, 29, 31], isPositive: true },
  { symbol: 'NVDA-USD', name: 'NVIDIA Corp', price: '$135.50', change: '+1.64%', sparkline: [55, 54, 56, 58, 57, 59, 61, 62], isPositive: true },
  { symbol: 'AAPL-USD', name: 'Apple Inc', price: '$228.10', change: '-0.42%', sparkline: [45, 46, 44, 43, 44, 42, 43, 41], isPositive: false },
  { symbol: 'TSLA-USD', name: 'Tesla Inc', price: '$260.80', change: '+4.12%', sparkline: [35, 37, 36, 40, 42, 41, 45, 48], isPositive: true },
];

export const WatchlistPage: React.FC = () => {
  const [items, setItems] = useState<WatchlistItem[]>(DEFAULT_WATCHLIST);
  const [activeBoard, setActiveBoard] = useState('Core Assets');
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTargetPrice, setAlertTargetPrice] = useState('89000.00');

  const boards = ['Core Assets', 'Tech Equities', 'Crypto High Beta'];

  const handleRemove = (symbol: string) => {
    setItems(items.filter((i) => i.symbol !== symbol));
  };

  return (
    <div className="max-w-[1780px] mx-auto space-y-4 animate-fade-in pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-byte-border">
        <div>
          <h1 className="text-xl font-normal text-byte-primary tracking-tight">Watchlist & Alerts</h1>
          <p className="text-xs text-byte-muted mt-0.5 font-normal">
            Monitor real-time price movements, momentum sparklines, and target price alerts.
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
          {items.length} Tracked Instruments
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
                <th className="py-2.5 px-3 font-normal text-center hidden sm:table-cell">24h Sparkline</th>
                <th className="py-2.5 px-3 font-normal text-center">Alert Target</th>
                <th className="py-2.5 px-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-byte-border/40">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-byte-muted italic font-sans">
                    Your watchlist is empty. Add instruments from the Markets directory.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.symbol} className="hover:bg-byte-secondary/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2.5">
                        <Star className="w-3.5 h-3.5 text-byte-accent fill-byte-accent shrink-0" />
                        <div>
                          <span className="font-semibold text-byte-primary text-xs block">{item.symbol}</span>
                          <span className="text-[11px] text-byte-muted font-sans font-normal">{item.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-byte-primary tnum">{item.price}</td>
                    <td className="py-3 px-3 text-right tnum">
                      <span
                        className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                          item.isPositive ? 'text-bull bg-bull/10' : 'text-bear bg-bear/10'
                        }`}
                      >
                        {item.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{item.change}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center hidden sm:table-cell">
                      {/* Mini Sparkline SVG */}
                      <div className="w-24 h-5 mx-auto">
                        <svg className="w-full h-full" viewBox="0 0 100 24" fill="none">
                          <polyline
                            fill="none"
                            stroke={item.isPositive ? '#22B982' : '#EF6262'}
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={item.sparkline
                              .map((val, idx) => `${idx * 14},${24 - (val / 70) * 20}`)
                              .join(' ')}
                          />
                        </svg>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-byte-secondary text-[10px] text-byte-muted border border-byte-border font-mono">
                        None Set
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/trade/${item.symbol}`}
                          className="px-2 py-1 rounded bg-byte-secondary hover:bg-byte-accent hover:text-byte-accent-contrast text-byte-primary text-xs font-normal transition-colors inline-flex items-center space-x-0.5"
                        >
                          <span>Trade</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={() => handleRemove(item.symbol)}
                          className="p-1 rounded text-byte-muted hover:text-[#EF6262] transition-colors cursor-pointer"
                          title="Remove from Watchlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Price Alert Modal */}
      <Modal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        title="Set Price Alert"
        description="Receive instant notifications when asset crosses target price."
      >
        <div className="space-y-4 pt-1">
          <Input
            label="Target Price (USD)"
            type="number"
            value={alertTargetPrice}
            onChange={(e) => setAlertTargetPrice(e.target.value)}
          />
          <div className="p-3 rounded bg-byte-secondary border border-byte-border text-xs text-byte-muted font-normal leading-relaxed">
            Alert trigger condition: when <strong>BTC/USD</strong> price reaches or exceeds{' '}
            <span className="font-mono text-byte-primary">${alertTargetPrice}</span>.
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => setShowAlertModal(false)}
          >
            Activate Price Alert
          </Button>
        </div>
      </Modal>
    </div>
  );
};
