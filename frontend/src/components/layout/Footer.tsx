import React from 'react';
import { Shield, BookOpen, Github } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-byte-border bg-byte-surface text-byte-muted text-xs transition-colors">
      <div className="max-w-[1780px] mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand info */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded flex items-center justify-center text-byte-accent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M3 12h3.5l2.5-6 4 12 3-6H21" />
                </svg>
              </div>
              <span className="font-bold text-byte-primary tracking-wider text-sm">BYTE EXCHANGE</span>
            </div>
            <p className="text-byte-muted text-xs leading-relaxed">
              High-performance in-memory order matching engine and simulated multi-asset paper trading workstation.
            </p>
            <div className="flex items-center space-x-2 text-[11px] font-mono">
              <span className="w-2 h-2 rounded-full bg-[#22B982]" />
              <span className="text-byte-muted">FIFO Matching Engine Operational</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="font-semibold text-byte-primary uppercase text-[11px] tracking-wider mb-3">Markets & Trading</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/markets" className="hover:text-byte-accent transition-colors">
                  All Instruments
                </Link>
              </li>
              <li>
                <Link to="/trade/BYTE-USD" className="hover:text-byte-accent transition-colors">
                  BYTE / USD Terminal
                </Link>
              </li>
              <li>
                <Link to="/trade/BTC-USD" className="hover:text-byte-accent transition-colors">
                  Bitcoin (BTC) Order Book
                </Link>
              </li>
              <li>
                <Link to="/watchlist" className="hover:text-byte-accent transition-colors">
                  Watchlists & Alerts
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform & Account */}
          <div>
            <h4 className="font-semibold text-byte-primary uppercase text-[11px] tracking-wider mb-3">Platform</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/portfolio" className="hover:text-byte-accent transition-colors">
                  Portfolio & Holdings
                </Link>
              </li>
              <li>
                <Link to="/analytics" className="hover:text-byte-accent transition-colors">
                  Exchange Analytics
                </Link>
              </li>
              <li>
                <Link to="/orders" className="hover:text-byte-accent transition-colors">
                  Orders Ledger
                </Link>
              </li>
              <li>
                <Link to="/settings" className="hover:text-byte-accent transition-colors">
                  Workstation Preferences
                </Link>
              </li>
            </ul>
          </div>

          {/* Engineering & Docs */}
          <div>
            <h4 className="font-semibold text-byte-primary uppercase text-[11px] tracking-wider mb-3">Engineering</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/docs" className="hover:text-byte-accent transition-colors flex items-center space-x-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>API Documentation</span>
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/rohit661199/BYTE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-byte-accent transition-colors flex items-center space-x-1.5"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Repository</span>
                </a>
              </li>
              <li>
                <span className="text-byte-muted font-mono text-[11px]">
                  Algorithm: FIFO Price-Time Priority
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Disclaimer */}
        <div className="pt-6 border-t border-byte-border flex flex-col sm:flex-row items-center justify-between text-[11px] text-byte-muted font-mono gap-3">
          <p>
            BYTE Exchange © 2026 — Educational Paper Trading Platform. Simulated credentials and virtual currency only.
          </p>
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-byte-accent" />
              <span>Simulated Execution</span>
            </span>
            <span>v1.0 Production Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
