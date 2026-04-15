import type { TranslationKey } from '@/i18n/translations';
import type { Bot, BotMode, BotRuntimeSessionStatus } from '../../types/bot.type';

export const MONITOR_STALE_WARNING_AFTER_MS = 20_000;
export const FIELD_WRAPPER_CLASS = 'form-control gap-1';
export const META_CARD_CLASS = 'rounded-box border border-base-300/60 bg-base-200/60 px-3 py-2';

export const toModeBadge = (mode: BotMode) => {
  if (mode === 'LIVE') return 'live';
  return 'paper';
};

export const toRiskBadge = (bot: Bot) => {
  if (bot.mode === 'LIVE' && bot.liveOptIn) {
    return { value: 'danger', labelKey: 'dashboard.bots.badges.liveEnabled' as TranslationKey } as const;
  }
  if (bot.mode === 'LIVE' && !bot.liveOptIn) {
    return { value: 'warning', labelKey: 'dashboard.bots.badges.liveBlocked' as TranslationKey } as const;
  }
  return { value: 'safe', labelKey: 'dashboard.bots.badges.safeMode' as TranslationKey } as const;
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);

export const formatNumber = (value: number, digits = 2) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export const formatDuration = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

export const formatAgeCompact = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1_000))}s`;
  return formatDuration(ms);
};

export const interpolateTemplate = (
  template: string,
  values: Record<string, string | number>
) => template.replace(/\{(\w+)\}/g, (_, token) => String(values[token] ?? ''));

export const toSessionStatusBadgeClass = (status: BotRuntimeSessionStatus) => {
  if (status === 'RUNNING') return 'badge-info';
  if (status === 'COMPLETED') return 'badge-success';
  if (status === 'FAILED') return 'badge-error';
  return 'badge-warning';
};

export const toTradeSideBadgeClass = (side: string) => {
  if (side === 'BUY' || side === 'LONG') return 'badge-success';
  if (side === 'SELL' || side === 'SHORT') return 'badge-error';
  return 'badge-ghost';
};

export const toTradeLifecycleBadgeClass = (value: 'OPEN' | 'DCA' | 'CLOSE' | 'UNKNOWN') => {
  if (value === 'OPEN') return 'badge-success';
  if (value === 'DCA') return 'badge-warning';
  if (value === 'CLOSE') return 'badge-primary';
  return 'badge-ghost';
};

export const toTradeLifecycleLabelKey = (value: 'OPEN' | 'DCA' | 'CLOSE' | 'UNKNOWN') => {
  if (value === 'OPEN') return 'dashboard.bots.actions.open' as TranslationKey;
  if (value === 'DCA') return 'dashboard.bots.actions.dca' as TranslationKey;
  if (value === 'CLOSE') return 'dashboard.bots.actions.close' as TranslationKey;
  return 'dashboard.bots.actions.unknown' as TranslationKey;
};

export const formatTradeFeeMeta = (trade: {
  feeSource: 'ESTIMATED' | 'EXCHANGE_FILL';
  feePending: boolean;
  feeCurrency: string | null;
}) => {
  const currencySuffix = trade.feeCurrency ? ` ${trade.feeCurrency}` : '';
  if (trade.feePending) return `PENDING${currencySuffix}`;
  const sourceLabel = trade.feeSource === 'EXCHANGE_FILL' ? 'EXCHANGE' : 'EST.';
  return `${sourceLabel}${currencySuffix}`;
};
