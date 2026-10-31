import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'inset' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', children, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-byte-surface border border-byte-border shadow-sm',
      elevated: 'bg-byte-surface border border-byte-border shadow-md',
      inset: 'bg-byte-secondary border border-byte-border',
      subtle: 'bg-byte-surface/50 border border-byte-border/60',
    }[variant];

    const paddingClasses = {
      none: '',
      sm: 'p-3',
      md: 'p-4 sm:p-5',
      lg: 'p-6 sm:p-8',
    }[padding];

    return (
      <div
        ref={ref}
        className={cn('rounded-lg transition-colors text-byte-primary', variantClasses, paddingClasses, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
