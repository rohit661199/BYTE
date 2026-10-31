import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'bull' | 'bear' | 'accent' | 'neutral' | 'warning';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  size = 'sm',
  children,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-0.5 text-xs',
  }[size];

  const variantClasses = {
    bull: 'bg-[#22B982]/10 text-[#22B982] border border-[#22B982]/25',
    bear: 'bg-[#EF6262]/10 text-[#EF6262] border border-[#EF6262]/25',
    accent: 'bg-byte-accent/10 text-byte-accent border border-byte-accent/25',
    neutral: 'bg-byte-secondary text-byte-muted border border-byte-border',
    warning: 'bg-amber-500/10 text-amber-500 border border-amber-500/25',
  }[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center font-mono font-medium rounded tracking-wide',
        sizeClasses,
        variantClasses,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
