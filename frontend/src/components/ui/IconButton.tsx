import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  label: string; // for accessibility screen readers
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', label, children, ...props }, ref) => {
    const sizeClasses = {
      xs: 'w-6 h-6 text-xs p-1 rounded',
      sm: 'w-8 h-8 text-sm p-1.5 rounded-md',
      md: 'w-9 h-9 text-base p-2 rounded-lg',
      lg: 'w-10 h-10 text-lg p-2.5 rounded-xl',
    }[size];

    const variantClasses = {
      primary: 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-md shadow-cyan-500/20',
      secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700',
      ghost: 'bg-transparent hover:bg-slate-800/80 text-slate-400 hover:text-white',
      danger: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20',
    }[variant];

    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizeClasses,
          variantClasses,
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
