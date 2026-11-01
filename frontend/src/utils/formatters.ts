import { DataStatus } from '../types/marketData';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format price with correct currency prefix and localized digit grouping:
 * - INR: ₹ prefix, en-IN grouping (e.g. ₹2,950.00, ₹1,42,850.00)
 * - USD: $ prefix, en-US grouping (e.g. $88,532.41, $228.10)
 */
export function formatPrice(
  price: number | undefined | null,
  currency: 'USD' | 'INR' = 'USD',
  decimals = 2
): string {
  if (price === undefined || price === null || isNaN(price)) {
    return currency === 'INR' ? '₹--' : '$--';
  }

  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const prefix = currency === 'INR' ? '₹' : '$';

  // For very small crypto or penny stocks
  const precision = price < 1 && price > 0 ? Math.max(decimals, 4) : decimals;

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(price);

  return `${prefix}${formatted}`;
}

/**
 * Format 24h change with signed prefix (+ / -)
 */
export function formatChange(
  change?: number,
  changePercent?: number
): { text: string; percentText: string; isPositive: boolean } {
  const pct = changePercent ?? 0;
  const isPositive = pct >= 0;
  const sign = isPositive ? '+' : '';
  const percentText = `${sign}${pct.toFixed(2)}%`;
  const text = change !== undefined ? `${sign}${change.toFixed(2)} (${percentText})` : percentText;

  return {
    text,
    percentText,
    isPositive,
  };
}

/**
 * Format volume in compact readable notation (K, M, B)
 */
export function formatVolume(vol: number | undefined | null, currency: 'USD' | 'INR' = 'USD'): string {
  if (vol === undefined || vol === null || isNaN(vol)) return '--';
  const prefix = currency === 'INR' ? '₹' : '$';

  if (vol >= 1_000_000_000) {
    return `${prefix}${(vol / 1_000_000_000).toFixed(1)}B`;
  }
  if (vol >= 1_000_000) {
    return `${prefix}${(vol / 1_000_000).toFixed(1)}M`;
  }
  if (vol >= 1_000) {
    return `${prefix}${(vol / 1_000).toFixed(1)}K`;
  }
  return `${prefix}${vol.toFixed(0)}`;
}

/**
 * Status indicator badge styling configuration for LIVE, DELAYED, STALE, PREVIEW, UNAVAILABLE
 */
export function getStatusBadgeConfig(status: DataStatus | undefined): {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  description: string;
} {
  switch (status) {
    case 'LIVE':
      return {
        label: 'LIVE',
        bg: 'bg-[#22B982]/10',
        text: 'text-[#22B982]',
        border: 'border-[#22B982]/30',
        dot: 'bg-[#22B982] animate-pulse',
        description: 'Real-time WebSocket feed active',
      };
    case 'DELAYED':
      return {
        label: 'DELAYED',
        bg: 'bg-[#E7BD72]/10',
        text: 'text-[#E7BD72]',
        border: 'border-[#E7BD72]/30',
        dot: 'bg-[#E7BD72]',
        description: 'Exchange 15-minute delayed stream',
      };
    case 'STALE':
      return {
        label: 'STALE',
        bg: 'bg-[#F97316]/10',
        text: 'text-[#F97316]',
        border: 'border-[#F97316]/30',
        dot: 'bg-[#F97316]',
        description: 'No market ticks received in >60 seconds',
      };
    case 'PREVIEW':
      return {
        label: 'PREVIEW',
        bg: 'bg-[#3B82F6]/10',
        text: 'text-[#3B82F6]',
        border: 'border-[#3B82F6]/30',
        dot: 'bg-[#3B82F6]',
        description: 'Baseline reference preview · Non-redistributable session',
      };
    case 'UNAVAILABLE':
    default:
      return {
        label: 'OFFLINE',
        bg: 'bg-byte-border/40',
        text: 'text-byte-muted',
        border: 'border-byte-border',
        dot: 'bg-byte-muted',
        description: 'Provider disconnected or market closed',
      };
  }
}

export function formatTime(isoString: string): string {
  if (!isoString) return '--:--:--';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
