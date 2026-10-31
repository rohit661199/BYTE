import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftAddon, rightAddon, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-byte-muted">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-byte-muted text-xs">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              'w-full bg-byte-secondary border border-byte-border rounded px-3 py-1.5 text-xs text-byte-primary placeholder:text-byte-muted/60',
              'font-mono transition-colors duration-150',
              'focus:outline-none focus:border-byte-accent focus:ring-1 focus:ring-byte-accent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-[#EF6262] focus:border-[#EF6262] focus:ring-[#EF6262]',
              leftAddon && 'pl-8',
              rightAddon && 'pr-8',
              className
            )}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 flex items-center text-byte-muted text-xs">
              {rightAddon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-[11px] text-[#EF6262] font-medium" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p className="text-[11px] text-byte-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
