import React, { useState } from 'react';
import { User, Monitor, Shield, Save, Sun, Moon, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/ui/Toast';
import { useTheme } from '../context/ThemeContext';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [traderName, setTraderName] = useState('Institutional Trader');
  const [defaultQuantity, setDefaultQuantity] = useState('5');
  const [defaultOrderType, setDefaultOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [confirmMarketOrders, setConfirmMarketOrders] = useState(true);
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-byte-border">
        <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-byte-accent mb-1">
          <span>Preferences & Control</span>
        </div>
        <h1 className="text-2xl font-semibold text-byte-primary tracking-tight">Workstation Configuration</h1>
        <p className="text-xs text-byte-muted mt-1">
          Customize your trading workstation appearance, layout density, safety confirmations, and execution defaults.
        </p>
      </div>

      {savedToast && (
        <Toast
          type="success"
          title="Preferences Stored"
          message="Your custom terminal configuration and theme settings have been saved."
          onClose={() => setSavedToast(false)}
        />
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Appearance & Theme Selector */}
        <div className="bg-byte-surface border border-byte-border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-byte-primary font-semibold pb-3 border-b border-byte-border">
            <Monitor className="w-4 h-4 text-byte-accent" />
            <h2 className="text-sm">Appearance & Visual Theme</h2>
          </div>

          <p className="text-xs text-byte-muted">
            BYTE features tailored palettes for high-focus trading environments. Dark mode is institutional standard, while Light mode offers clean editorial clarity.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dark Theme Card */}
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-lg border text-left cursor-pointer transition-all relative ${
                theme === 'dark'
                  ? 'bg-[#161E27] border-[#E7BD72] shadow-md'
                  : 'bg-[#161E27]/60 border-[#303A43] opacity-75 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded bg-[#202A34] text-[#E7BD72]">
                    <Moon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-[#F2F0E9]">Dark Mode (Default)</span>
                </div>
                {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-[#E7BD72]" />}
              </div>
              <p className="text-[11px] text-[#9BA49F] mb-3 leading-relaxed">
                Background #0E141B, surfaces #161E27, champagne-gold accent #E7BD72. Designed for long market sessions.
              </p>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0E141B] border border-[#303A43]" title="Background #0E141B" />
                <span className="w-4 h-4 rounded-full bg-[#161E27] border border-[#303A43]" title="Surface #161E27" />
                <span className="w-4 h-4 rounded-full bg-[#E7BD72]" title="Champagne Gold #E7BD72" />
                <span className="w-4 h-4 rounded-full bg-[#22B982]" title="Bullish Green #22B982" />
                <span className="w-4 h-4 rounded-full bg-[#EF6262]" title="Bearish Red #EF6262" />
              </div>
            </button>

            {/* Light Theme Card */}
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-4 rounded-lg border text-left cursor-pointer transition-all relative ${
                theme === 'light'
                  ? 'bg-[#FFFFFF] border-[#687451] shadow-md'
                  : 'bg-[#EFEFE8] border-[#E3E3DA] opacity-75 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded bg-[#EFEFE8] text-[#687451]">
                    <Sun className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-[#20251F]">Light Mode</span>
                </div>
                {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-[#687451]" />}
              </div>
              <p className="text-[11px] text-[#74796F] mb-3 leading-relaxed">
                Background #F7F7F3, white surfaces #FFFFFF, muted olive accent #687451. Clean and balanced contrast.
              </p>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded-full bg-[#F7F7F3] border border-[#E3E3DA]" title="Background #F7F7F3" />
                <span className="w-4 h-4 rounded-full bg-[#FFFFFF] border border-[#E3E3DA]" title="Surface #FFFFFF" />
                <span className="w-4 h-4 rounded-full bg-[#687451]" title="Muted Olive #687451" />
                <span className="w-4 h-4 rounded-full bg-[#22B982]" title="Bullish Green #22B982" />
                <span className="w-4 h-4 rounded-full bg-[#EF6262]" title="Bearish Red #EF6262" />
              </div>
            </button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-byte-surface border border-byte-border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-byte-primary font-semibold pb-3 border-b border-byte-border">
            <User className="w-4 h-4 text-byte-accent" />
            <h2 className="text-sm">Trader Profile & Defaults</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Display Handle"
              value={traderName}
              onChange={(e) => setTraderName(e.target.value)}
            />
            <Input
              label="Default Order Quantity"
              type="number"
              value={defaultQuantity}
              onChange={(e) => setDefaultQuantity(e.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-xs font-medium text-byte-muted">Default Order Type</label>
              <select
                value={defaultOrderType}
                onChange={(e) => setDefaultOrderType(e.target.value as any)}
                className="w-full bg-byte-secondary border border-byte-border text-byte-primary rounded px-3 py-1.5 text-xs focus:outline-none focus:border-byte-accent font-sans"
              >
                <option value="LIMIT">Limit Order (Maker)</option>
                <option value="MARKET">Market Order (Taker)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Workstation Display Density */}
        <div className="bg-byte-surface border border-byte-border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-byte-primary font-semibold pb-3 border-b border-byte-border">
            <Monitor className="w-4 h-4 text-byte-accent" />
            <h2 className="text-sm">Workstation Display Density</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <button
              type="button"
              onClick={() => setDensity('compact')}
              className={`p-3.5 rounded-lg border text-left cursor-pointer transition-colors ${
                density === 'compact'
                  ? 'bg-byte-secondary border-byte-accent text-byte-primary'
                  : 'bg-byte-bg border-byte-border text-byte-muted hover:text-byte-primary'
              }`}
            >
              <span className="font-semibold text-byte-primary block mb-1">High-Density Workstation (Recommended)</span>
              <span className="text-[11px] text-byte-muted">Compact row heights and tabular metrics inspired by TradingView.</span>
            </button>

            <button
              type="button"
              onClick={() => setDensity('comfortable')}
              className={`p-3.5 rounded-lg border text-left cursor-pointer transition-colors ${
                density === 'comfortable'
                  ? 'bg-byte-secondary border-byte-accent text-byte-primary'
                  : 'bg-byte-bg border-byte-border text-byte-muted hover:text-byte-primary'
              }`}
            >
              <span className="font-semibold text-byte-primary block mb-1">Standard Padding</span>
              <span className="text-[11px] text-byte-muted">Generous line heights and relaxed spacing across tables.</span>
            </button>
          </div>
        </div>

        {/* Trade Execution Protections */}
        <div className="bg-byte-surface border border-byte-border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-byte-primary font-semibold pb-3 border-b border-byte-border">
            <Shield className="w-4 h-4 text-byte-accent" />
            <h2 className="text-sm">Execution Safety & Notifications</h2>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3.5 rounded bg-byte-bg border border-byte-border cursor-pointer">
              <div>
                <span className="text-byte-primary font-medium block">Confirm Market Orders Before Execution</span>
                <span className="text-byte-muted text-[11px]">Display confirmation dialog before sweeping resting book liquidity.</span>
              </div>
              <input
                type="checkbox"
                checked={confirmMarketOrders}
                onChange={(e) => setConfirmMarketOrders(e.target.checked)}
                className="w-4 h-4 rounded bg-byte-surface border-byte-border text-byte-accent accent-byte-accent"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded bg-byte-bg border border-byte-border cursor-pointer">
              <div>
                <span className="text-byte-primary font-medium block">Audio Feedback on Trade Execution</span>
                <span className="text-byte-muted text-[11px]">Play subtle confirmation chime when an order completes matching.</span>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="w-4 h-4 rounded bg-byte-surface border-byte-border text-byte-accent accent-byte-accent"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" leftIcon={<Save className="w-4 h-4" />}>
            Save Preferences
          </Button>
        </div>
      </form>
    </div>
  );
};
