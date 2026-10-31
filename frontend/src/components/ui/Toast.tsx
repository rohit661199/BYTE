import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ToastProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  title,
  message,
  onClose,
  className,
}) => {
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-bull shrink-0" />,
    error: <XCircle className="w-4 h-4 text-bear shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-byte-accent shrink-0" />,
    info: <Info className="w-4 h-4 text-byte-accent shrink-0" />,
  };

  const borders = {
    success: 'border-bull/30 bg-bull/10 text-byte-primary',
    error: 'border-bear/30 bg-bear/10 text-byte-primary',
    warning: 'border-byte-accent/30 bg-byte-accent/10 text-byte-primary',
    info: 'border-byte-border bg-byte-surface text-byte-primary',
  };

  return (
    <div
      role="status"
      className={cn(
        'flex items-start space-x-3 p-3.5 rounded-lg border backdrop-blur-md shadow-lg text-xs transition-all',
        borders[type],
        className
      )}
    >
      <div className="mt-0.5">{icons[type]}</div>
      <div className="flex-1 space-y-0.5">
        {title && <p className="font-semibold text-byte-primary">{title}</p>}
        <p className="text-byte-muted leading-relaxed">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss toast"
          className="text-byte-muted hover:text-byte-primary p-0.5 rounded cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
