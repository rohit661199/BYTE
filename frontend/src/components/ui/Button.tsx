import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'buy' | 'sell' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      xs: 'px-2 py-1 text-xs rounded',
      sm: 'px-3 py-1.5 text-xs rounded-md',
      md: 'px-4 py-2 text-sm rounded-md',
      lg: 'px-5 py-2.5 text-sm rounded-lg font-medium',
    }[size];

    const variantClasses = {
      primary:
        'bg-byte-accent hover:bg-byte-accent-hover text-byte-accent-contrast font-medium shadow-sm active:scale-[0.99]',
      secondary:
        'bg-byte-secondary hover:bg-byte-surface text-byte-primary border border-byte-border active:scale-[0.99]',
      buy:
        'bg-[#22B982] hover:opacity-95 text-white font-medium shadow-sm active:scale-[0.99]',
      sell:
        'bg-[#EF6262] hover:opacity-95 text-white font-medium shadow-sm active:scale-[0.99]',
      outline:
        'bg-transparent hover:bg-byte-secondary text-byte-primary border border-byte-border active:scale-[0.99]',
      ghost:
        'bg-transparent hover:bg-byte-secondary text-byte-muted hover:text-byte-primary',
      danger:
        'bg-bear/10 hover:bg-bear/20 text-[#EF6262] border border-[#EF6262]/30 active:scale-[0.99]',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-150 select-none cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-byte-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          sizeClasses,
          variantClasses,
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" aria-hidden="true" />
        ) : leftIcon ? (
          <span className="mr-1.5 inline-flex items-center">{leftIcon}</span>
        ) : null}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="ml-1.5 inline-flex items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
