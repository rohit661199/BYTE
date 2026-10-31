import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('Institutional Trader');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/portfolio');
  };

  return (
    <div className="bg-byte-surface border border-byte-border rounded-lg p-6 sm:p-8 shadow-xl space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-byte-secondary border border-byte-border text-[11px] font-mono text-byte-accent mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>ZERO FINANCIAL RISK</span>
        </div>
        <h1 className="text-2xl font-semibold text-byte-primary tracking-tight">Create Exchange Account</h1>
        <p className="text-xs text-byte-muted">Simulate institutional order flow with $10,000 USD virtual capital.</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <Input
          label="Trader Name / Handle"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Mercer"
          leftAddon={<User className="w-3.5 h-3.5 text-byte-muted" />}
          required
        />

        <Input
          label="Corporate / Personal Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="trader@domain.com"
          leftAddon={<Mail className="w-3.5 h-3.5 text-byte-muted" />}
          required
        />

        <Input
          label="Create Security Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          leftAddon={<Lock className="w-3.5 h-3.5 text-byte-muted" />}
          required
        />

        <div className="p-3 rounded bg-byte-secondary/60 border border-byte-border text-[11px] text-byte-muted leading-relaxed">
          By registering, you acknowledge that BYTE is a simulated paper-trading environment. No real funds or fiat currency are accepted or disbursed.
        </div>

        <Button type="submit" variant="primary" className="w-full mt-2 font-semibold" rightIcon={<ArrowRight className="w-4 h-4" />}>
          Create Account & Access Funds
        </Button>
      </form>

      <div className="pt-4 border-t border-byte-border text-center text-xs text-byte-muted">
        Already registered?{' '}
        <Link to="/login" className="text-byte-accent hover:underline font-semibold transition-colors">
          Sign In
        </Link>
      </div>
    </div>
  );
};
