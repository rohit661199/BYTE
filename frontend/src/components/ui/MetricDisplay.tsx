import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface MetricDisplayProps {
  label: string;
  value: string | number;
  delta?: {
    value: string | number;
    percent?: number;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  hint?: string;
  className?: string;
}

export const MetricDisplay: React.FC<MetricDisplayProps> = ({
  label,
  value,
  delta,
  icon,
  hint,
  className,
}) => {
  return (
    <div className={cn('bg-byte-surface border border-byte-border rounded-lg p-4 relative overflow-hidden transition-colors', className)}>
      <div className="flex items-center justify-between text-xs text-byte-muted uppercase tracking-wider font-medium">
        <span>{label}</span>
        {icon && <div className="text-byte-muted">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-xl sm:text-2xl font-semibold font-mono tracking-tight text-byte-primary tnum">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              'inline-flex items-center text-xs font-mono font-semibold px-1.5 py-0.5 rounded',
              delta.isPositive === true
                ? 'text-[#22B982] bg-[#22B982]/10'
                : delta.isPositive === false
                ? 'text-[#EF6262] bg-[#EF6262]/10'
                : 'text-byte-muted bg-byte-secondary'
            )}
          >
            {delta.isPositive === true ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : delta.isPositive === false ? (
              <TrendingDown className="w-3 h-3 mr-1" />
            ) : (
              <Minus className="w-3 h-3 mr-1" />
            )}
            {delta.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-byte-muted">{hint}</p>}
    </div>
  );
};
