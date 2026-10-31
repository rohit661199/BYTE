import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Layers } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

interface HoldingItem {
  asset: string;
  name: string;
  amount: string;
  available: string;
  inOrders: string;
  avgBuyPrice: string;
  currentPrice: string;
  currentValue: string;
  pnl: string;
  isProfit: boolean;
  allocationPercent: number;
  color: string;
}

const PREVIEW_HOLDINGS: HoldingItem[] = [
  {
    asset: 'USD',
    name: 'Cash Balance',
    amount: '10,000.00',
    available: '10,000.00',
    inOrders: '0.00',
    avgBuyPrice: '$1.00',
    currentPrice: '$1.00',
    currentValue: '$10,000.00',
    pnl: '$0.00 (0.00%)',
    isProfit: true,
    allocationPercent: 50,
    color: '#E7BD72',
  },
  {
    asset: 'BYTE',
    name: 'Byte Utility Token',
    amount: '100.00',
    available: '100.00',
    inOrders: '0.00',
    avgBuyPrice: '$95.00',
    currentPrice: '$100.00',
    currentValue: '$10,000.00',
    pnl: '+$500.00 (+5.26%)',
    isProfit: true,
    allocationPercent: 50,
    color: '#22B982',
  },
];

export const PortfolioPage: React.FC = () => {
  const [showFaucetModal, setShowFaucetModal] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="max-w-[1780px] mx-auto space-y-5 animate-fade-in pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-byte-border">
        <div>
          <h1 className="text-xl font-normal text-byte-primary tracking-tight">Portfolio & Balances</h1>
          <p className="text-xs text-byte-muted mt-0.5 font-normal">
            Account equity, active asset distribution, and paper liquidity overview.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={() => setShowFaucetModal(true)}
          >
            Demo Faucet
          </Button>
        </div>
      </div>

      {/* Portfolio Overview Summary Card */}
      <div className="bg-byte-surface border border-byte-border rounded p-5 shadow-xs space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <span className="text-[11px] font-normal text-byte-muted uppercase tracking-wider block">Total Estimated Net Worth</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-semibold font-mono text-byte-primary tnum">$20,000.00</span>
              <span className="text-xs text-byte-tertiary font-mono">USD</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-normal text-byte-muted uppercase tracking-wider block">Available Cash</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-semibold font-mono text-byte-primary tnum">$10,000.00</span>
              <span className="text-xs text-byte-tertiary font-mono">USD</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-normal text-byte-muted uppercase tracking-wider block">Capital in Active Orders</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-semibold font-mono text-byte-muted tnum">$0.00</span>
              <span className="text-xs text-byte-tertiary font-mono">USD</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-normal text-byte-muted uppercase tracking-wider block">Unrealized P&L</span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-semibold font-mono text-bull tnum">+$500.00</span>
              <span className="text-xs text-bull font-mono font-medium">(+2.50%)</span>
            </div>
          </div>
        </div>

        {/* Multi-Segment Allocation Bar */}
        <div className="space-y-2 pt-3 border-t border-byte-border">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[11px] font-normal text-byte-muted">Asset Allocation</span>
            <div className="flex items-center space-x-4 text-[11px] font-mono">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E7BD72]" />
                <span className="text-byte-primary">USD (50.0%)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22B982]" />
                <span className="text-byte-primary">BYTE (50.0%)</span>
              </div>
            </div>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden flex bg-byte-secondary">
            <div className="h-full bg-[#E7BD72]" style={{ width: '50%' }} />
            <div className="h-full bg-[#22B982]" style={{ width: '50%' }} />
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-byte-surface border border-byte-border rounded overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-byte-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-byte-accent" />
            <span className="text-xs font-semibold text-byte-primary">Asset Holdings</span>
          </div>
          <span className="text-[11px] text-byte-muted font-mono">2 Assets</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-byte-border bg-byte-secondary/40 text-byte-muted text-[11px] uppercase tracking-wider font-normal">
                <th className="py-2.5 px-4 font-normal">Asset</th>
                <th className="py-2.5 px-3 font-normal text-right">Total Balance</th>
                <th className="py-2.5 px-3 font-normal text-right hidden sm:table-cell">Available</th>
                <th className="py-2.5 px-3 font-normal text-right hidden md:table-cell">In Orders</th>
                <th className="py-2.5 px-3 font-normal text-right hidden md:table-cell">Avg Cost</th>
                <th className="py-2.5 px-3 font-normal text-right">Current Price</th>
                <th className="py-2.5 px-3 font-normal text-right">Value (USD)</th>
                <th className="py-2.5 px-3 font-normal text-right">Unrealized P&L</th>
                <th className="py-2.5 px-4 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-byte-border/40">
              {PREVIEW_HOLDINGS.map((h) => (
                <tr key={h.asset} className="hover:bg-byte-secondary/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-6 h-6 rounded bg-byte-secondary flex items-center justify-center text-[10px] font-bold text-byte-primary border border-byte-border">
                        {h.asset.slice(0, 3)}
                      </div>
                      <div>
                        <span className="font-semibold text-byte-primary block text-xs">{h.asset}</span>
                        <span className="text-[11px] text-byte-muted font-sans font-normal">{h.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-byte-primary tnum">{h.amount}</td>
                  <td className="py-3 px-3 text-right text-byte-muted tnum hidden sm:table-cell">{h.available}</td>
                  <td className="py-3 px-3 text-right text-byte-muted tnum hidden md:table-cell">{h.inOrders}</td>
                  <td className="py-3 px-3 text-right text-byte-muted tnum hidden md:table-cell">{h.avgBuyPrice}</td>
                  <td className="py-3 px-3 text-right font-medium text-byte-primary tnum">{h.currentPrice}</td>
                  <td className="py-3 px-3 text-right font-medium text-byte-primary tnum">{h.currentValue}</td>
                  <td className="py-3 px-3 text-right tnum">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium ${h.isProfit ? 'text-bull bg-bull/10' : 'text-bear bg-bear/10'}`}>
                      {h.pnl}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {h.asset !== 'USD' ? (
                      <button
                        onClick={() => navigate(`/trade/${h.asset}-USD`)}
                        className="px-2 py-1 rounded bg-byte-secondary hover:bg-byte-accent hover:text-byte-accent-contrast text-byte-primary text-xs font-normal transition-colors cursor-pointer"
                      >
                        Trade
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowFaucetModal(true)}
                        className="px-2 py-1 rounded bg-byte-secondary hover:bg-byte-accent hover:text-byte-accent-contrast text-byte-primary text-xs font-normal transition-colors cursor-pointer"
                      >
                        Deposit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demo Faucet Modal */}
      <Modal
        isOpen={showFaucetModal}
        onClose={() => setShowFaucetModal(false)}
        title="Simulated Faucet"
        description="Replenish demo paper balances for testing."
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-byte-muted leading-relaxed font-normal">
            Reset or add simulated capital to test trading workflows on the deterministic FIFO matching engine.
          </p>
          <div className="p-3 rounded bg-byte-secondary border border-byte-border space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-byte-muted">Grant Amount:</span>
              <span className="text-byte-primary font-bold">+$10,000.00 USD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-byte-muted">Execution Mode:</span>
              <span className="text-byte-accent font-bold">Risk-Free Paper Mode</span>
            </div>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => setShowFaucetModal(false)}
          >
            Claim Simulated Funds
          </Button>
        </div>
      </Modal>
    </div>
  );
};
