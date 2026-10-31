import React from 'react';
import { cn } from '../../utils/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underline' | 'segmented';
  className?: string;
  size?: 'sm' | 'md';
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'segmented',
  className,
  size = 'md',
}) => {
  if (variant === 'underline') {
    return (
      <div className={cn('flex space-x-6 border-b border-slate-800', className)} role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative pb-3 text-sm font-medium transition-colors flex items-center space-x-2 select-none cursor-pointer',
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-300 font-mono">
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Segmented or Pill variant
  return (
    <div
      className={cn(
        'inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800/80',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all select-none cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
              isActive
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {tab.icon && <span className="w-3.5 h-3.5">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-700/60 text-slate-300 font-mono">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
