import { Activity, Wifi, WifiOff } from 'lucide-react';

interface NavbarProps {
  isConnected: boolean;
}

export function Navbar({ isConnected }: NavbarProps) {
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

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-emerald-400">Live WebSockets Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400">Reconnecting...</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
