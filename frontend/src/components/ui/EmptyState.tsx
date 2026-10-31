import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/30',
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
        {icon || <Inbox className="w-6 h-6 text-slate-500" />}
      </div>
      <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
      {description && (
        <p className="mt-1 text-xs text-slate-400 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
