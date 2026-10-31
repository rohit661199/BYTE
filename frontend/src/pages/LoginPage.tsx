import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('trader@byte.exchange');
  const [password, setPassword] = useState('••••••••');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/trade/BYTE-USD');
  };

  return (
    <div className="bg-byte-surface border border-byte-border rounded-lg p-6 sm:p-8 shadow-xl space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-byte-secondary border border-byte-border text-[11px] font-mono text-byte-accent mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>INSTITUTIONAL SIMULATION</span>
        </div>
        <h1 className="text-2xl font-semibold text-byte-primary tracking-tight">Sign In to Workstation</h1>
        <p className="text-xs text-byte-muted">Access your paper trading portfolio and multi-asset matching engine.</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          label="Account Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="trader@domain.com"
          leftAddon={<Mail className="w-3.5 h-3.5 text-byte-muted" />}
          required
        />

        <div className="space-y-1">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            leftAddon={<Lock className="w-3.5 h-3.5 text-byte-muted" />}
            required
          />
          <div className="flex justify-end pt-1">
            <span className="text-[11px] text-byte-muted hover:text-byte-accent cursor-pointer transition-colors">
              Forgot password?
            </span>
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full mt-2 font-semibold" rightIcon={<ArrowRight className="w-4 h-4" />}>
          Access Trading Terminal
        </Button>
      </form>

      <div className="pt-4 border-t border-byte-border text-center text-xs text-byte-muted">
        Need an exchange account?{' '}
        <Link to="/register" className="text-byte-accent hover:underline font-semibold transition-colors">
          Create Demo Account
        </Link>
      </div>
    </div>
  );
};
