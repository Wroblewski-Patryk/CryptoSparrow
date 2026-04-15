import { normalizeSymbol } from '@/lib/symbols';

export const SIGNAL_CARDS_DESKTOP_MIN_WIDTH = 1280;
const SIGNAL_CARDS_TABLET_MIN_WIDTH = 768;

const KNOWN_QUOTE_CURRENCIES = [
  'USDT',
  'USDC',
  'BUSD',
  'FDUSD',
  'TUSD',
  'USDP',
  'DAI',
  'USD',
  'BTC',
  'ETH',
  'BNB',
  'EUR',
  'TRY',
  'BRL',
  'GBP',
  'AUD',
  'JPY',
] as const;

export const resolveQuoteCurrency = (symbol: string) => {
  const normalized = normalizeSymbol(symbol);
  for (const quote of KNOWN_QUOTE_CURRENCIES) {
    if (normalized.endsWith(quote) && normalized.length > quote.length) return quote;
  }
  return null;
};

export const resolveSignalCardsPerView = (width: number) => {
  if (width >= SIGNAL_CARDS_DESKTOP_MIN_WIDTH) return 4;
  if (width >= SIGNAL_CARDS_TABLET_MIN_WIDTH) return 3;
  return 2;
};

export const formatAgeCompact = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1_000))}s`;
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

export const readFiniteNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const interpolateTemplate = (
  template: string,
  values: Record<string, string | number>
) => template.replace(/\{(\w+)\}/g, (_, token) => String(values[token] ?? ''));

export const sessionBadge = (status?: string | null) => {
  if (status === 'RUNNING') return 'badge-info';
  if (status === 'COMPLETED') return 'badge-success';
  if (status === 'FAILED') return 'badge-error';
  if (status === 'CANCELED') return 'badge-warning';
  return 'badge-ghost';
};
