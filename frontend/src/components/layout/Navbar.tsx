import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Sun,
  Moon,
  RotateCcw,
  Menu,
  X,
  Wallet,
  Settings,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { apiService } from '../../services/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface NavbarProps {
  isConnected?: boolean;
  onResetCompleted?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isConnected = true, onResetCompleted }) => {
  const { theme, toggleTheme } = useTheme();
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFaucetModal, setShowFaucetModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleReset = async () => {
    try {
      setIsResetting(true);
      await apiService.resetExchange();
      setShowResetConfirm(false);
      if (onResetCompleted) onResetCompleted();
    } catch (err) {
      console.error('Failed to reset exchange engine:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const clean = searchQuery.trim().toUpperCase();
    if (clean.includes('BTC')) navigate('/trade/BTC-USD');
    else if (clean.includes('ETH')) navigate('/trade/ETH-USD');
    else if (clean.includes('SOL')) navigate('/trade/SOL-USD');
    else if (clean.includes('AAPL')) navigate('/trade/AAPL-USD');
    else if (clean.includes('TSLA')) navigate('/trade/TSLA-USD');
    else if (clean.includes('NVDA')) navigate('/trade/NVDA-USD');
    else if (clean.includes('BYTE')) navigate('/trade/BYTE-USD');
    else navigate(`/markets`);
    setSearchQuery('');
  };

  const navLinks = [
    { to: '/markets', label: 'Markets' },
    { to: '/trade/BYTE-USD', label: 'Trade' },
    { to: '/portfolio', label: 'Portfolio' },
    { to: '/watchlist', label: 'Watchlist' },
    { to: '/analytics', label: 'Analytics' },
    { to: '/orders', label: 'Orders' },
    { to: '/docs', label: 'Docs' },
  ];

  return (
    <header className="border-b border-byte-border bg-byte-surface sticky top-0 z-40 select-none transition-colors duration-150">
      <div className="max-w-[1780px] mx-auto px-3 sm:px-6 h-12 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Main Navigation */}
        <div className="flex items-center space-x-6 shrink-0">
          <Link to="/" className="flex items-center space-x-2 group cursor-pointer">
            {/* Minimal Gold Pulse Logo */}
            <div className="w-6 h-6 flex items-center justify-center text-byte-accent group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M3 12h3.5l2.5-6 4 12 3-6H21" />
              </svg>
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-semibold text-sm tracking-wider text-byte-primary font-sans">
                BYTE
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1" aria-label="Main Navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }: { isActive: boolean }) =>
                  `px-2.5 py-1 text-xs font-normal transition-colors rounded ${
                    isActive
                      ? 'text-byte-accent font-medium bg-byte-secondary'
                      : 'text-byte-muted hover:text-byte-primary hover:bg-byte-secondary/60'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Center: Global Asset Search Bar (Matching Reference Image) */}
        <div className="hidden md:flex flex-1 max-w-xs mx-auto">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-byte-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search assets (BTC, AAPL, TSLA...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-byte-secondary border border-byte-border rounded pl-8 pr-8 py-1 text-xs text-byte-primary placeholder:text-byte-muted/60 focus:outline-none focus:border-byte-accent transition-colors"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-byte-muted font-mono bg-byte-surface px-1 py-0.2 rounded border border-byte-border">
              ⌘K
            </span>
          </form>
        </div>

        {/* Right Actions: Faucet, Status, Theme Toggle, Settings & Auth */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Paper Wallet Balance */}
          <button
            onClick={() => setShowFaucetModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-byte-secondary/70 border border-byte-border hover:border-byte-accent/40 text-xs transition-colors cursor-pointer"
            title="Simulated Paper Wallet"
          >
            <Wallet className="w-3.5 h-3.5 text-byte-accent" />
            <span className="font-mono text-xs text-byte-primary tnum font-medium">$10,000.00</span>
          </button>

          {/* Engine Status Dot */}
          <div className="hidden xl:flex items-center space-x-1.5 px-2 py-1 text-[11px] font-mono text-byte-muted">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#22B982]' : 'bg-amber-400'}`} />
            <span className={isConnected ? 'text-[#22B982]' : 'text-amber-400'}>
              {isConnected ? 'FIFO Engine' : 'Syncing'}
            </span>
          </div>

          {/* Reset Engine Button */}
          <button
            onClick={() => setShowResetConfirm(true)}
            className="p-1.5 rounded text-byte-muted hover:text-[#EF6262] transition-colors cursor-pointer"
            title="Reset Matching Engine State"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Theme Toggle (Dark / Light) */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded text-byte-muted hover:text-byte-primary transition-colors cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-byte-accent" /> : <Moon className="w-3.5 h-3.5 text-byte-primary" />}
          </button>

          {/* Settings Link */}
          <Link
            to="/settings"
            className="p-1.5 rounded text-byte-muted hover:text-byte-primary transition-colors"
            title="Workstation Preferences"
          >
            <Settings className="w-3.5 h-3.5" />
          </Link>

          {/* Minimal Auth Buttons Matching Reference Image */}
          <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-byte-border">
            <Link
              to="/login"
              className="px-2.5 py-1 text-xs text-byte-primary hover:text-byte-accent transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="px-3 py-1 text-xs font-medium bg-byte-accent text-byte-accent-contrast rounded transition-colors shadow-xs hover:opacity-90"
            >
              Get started
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded text-byte-muted hover:text-byte-primary cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-byte-border bg-byte-surface p-4 space-y-2 animate-in slide-in-from-top-2">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2 rounded text-xs text-byte-muted hover:text-byte-primary hover:bg-byte-secondary transition-colors"
            >
              <span>{link.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-byte-muted/60" />
            </Link>
          ))}
          <div className="pt-3 border-t border-byte-border flex space-x-2">
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 py-1.5 rounded bg-byte-secondary text-center text-xs text-byte-primary border border-byte-border"
            >
              Log in
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 py-1.5 rounded bg-byte-accent text-center text-xs font-medium text-byte-accent-contrast"
            >
              Get started
            </Link>
          </div>
        </div>
      )}

      {/* Reset Engine Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset Exchange Engine?"
        description="This will purge active orders, trade logs, and reset matching engine state in memory and database."
      >
        <div className="space-y-4 pt-1">
          <div className="p-3 rounded bg-[#EF6262]/10 border border-[#EF6262]/20 text-[#EF6262] text-xs">
            Resting order books and execution history will be purged from SQLite WAL and in-memory engine.
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowResetConfirm(false)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleReset}
              isLoading={isResetting}
            >
              Confirm Reset
            </Button>
          </div>
        </div>
      </Modal>

      {/* Paper Wallet Faucet Modal */}
      <Modal
        isOpen={showFaucetModal}
        onClose={() => setShowFaucetModal(false)}
        title="Paper Trading Wallet"
        description="Simulated demo balances for risk-free trading."
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 rounded bg-byte-secondary border border-byte-border space-y-2 text-xs">
            <div className="flex justify-between items-center text-byte-muted">
              <span>Simulated Cash Balance</span>
              <span className="font-mono text-byte-primary font-semibold text-sm">$10,000.00 USD</span>
            </div>
            <div className="flex justify-between items-center text-byte-muted">
              <span>Simulated BYTE Balance</span>
              <span className="font-mono text-byte-accent font-semibold text-sm">100.00 BYTE</span>
            </div>
          </div>

          <div className="p-3 rounded bg-byte-accent/10 border border-byte-accent/20 text-byte-accent text-xs flex items-start space-x-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              100% paper trading capital. Test limit and market orders freely on the live FIFO matching engine.
            </p>
          </div>

          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              setShowFaucetModal(false);
              navigate('/portfolio');
            }}
          >
            Open Portfolio Overview
          </Button>
        </div>
      </Modal>
    </header>
  );
};
