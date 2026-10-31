import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ArrowLeft, Shield, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const AuthLayout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-byte-bg text-byte-primary flex flex-col justify-between font-sans antialiased relative selection:bg-byte-accent/20 selection:text-byte-accent transition-colors duration-150">
      {/* Top minimal header */}
      <header className="p-4 sm:p-6 relative z-10 flex items-center justify-between max-w-5xl mx-auto w-full">
        <Link to="/" className="flex items-center space-x-2 text-xs text-byte-muted hover:text-byte-primary transition-colors group">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Exchange</span>
        </Link>
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded hover:bg-byte-secondary text-byte-muted hover:text-byte-primary transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-byte-accent" /> : <Moon className="w-4 h-4 text-byte-primary" />}
          </button>
          <Link to="/" className="flex items-center space-x-1.5">
            <div className="w-6 h-6 rounded flex items-center justify-center text-byte-accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M3 12h3.5l2.5-6 4 12 3-6H21" />
              </svg>
            </div>
            <span className="font-bold text-byte-primary text-sm tracking-wider">BYTE</span>
          </Link>
        </div>
      </header>

      {/* Main Centered Auth Form */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10 my-4">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>

      {/* Bottom Disclaimer */}
      <footer className="p-4 text-center text-xs text-byte-muted font-mono relative z-10 flex items-center justify-center space-x-2">
        <Shield className="w-3.5 h-3.5 text-byte-muted" />
        <span>BYTE Paper Trading Sandbox — Simulated Credentials Only</span>
      </footer>
    </div>
  );
};
