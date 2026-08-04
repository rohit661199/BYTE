import { useState } from 'react';
import { Activity, Wifi, RotateCcw, Loader2 } from 'lucide-react';
import { apiService } from '../services/api';

interface NavbarProps {
  isConnected: boolean;
  onResetCompleted?: () => void;
}

export function Navbar({ isConnected, onResetCompleted }: NavbarProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = async () => {
    try {
      setIsResetting(true);
      await apiService.resetExchange();
      setShowConfirm(false);
      if (onResetCompleted) onResetCompleted();
    } catch (err) {
      console.error('Failed to reset exchange engine:', err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-white tracking-wide">BYTE</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono border border-cyan-500/20">
                EXCHANGE
              </span>
            </div>
            <p className="text-xs text-slate-400">Order Matching Engine & Live Trading Terminal</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Sync Status Indicator */}
          <div className="flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-emerald-400">Live WebSockets Connected</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span className="text-cyan-400">REST Live Syncing</span>
              </>
            )}
          </div>

          {/* Reset Exchange Engine Button */}
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-all shadow-sm active:scale-95"
            title="Clear all orders, trades, and reset exchange engine"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Engine</span>
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">Reset Exchange Engine?</h3>
              <p className="text-xs text-slate-400">
                This will wipe all active buy/sell orders, clear trade execution history, and reset statistics back to zero.
              </p>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isResetting}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all flex items-center justify-center space-x-1 disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <span>Yes, Reset All</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
