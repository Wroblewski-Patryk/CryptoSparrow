const normalizeSymbols = (symbols: string[]) =>
  [...new Set(symbols.map((item) => item.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

const normalizeKlineInterval = (value?: string | null) => {
  if (!value) return '1m';
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    '1 min': '1m',
    '3 min': '3m',
    '5 min': '5m',
    '10 min': '10m',
    '15 min': '15m',
    '30 min': '30m',
    '60 min': '1h',
  };
  return aliases[normalized] ?? normalized;
};

const klineFallbackCache = new Map<string, { fetchedAt: number; closes: number[] }>();
const KLINE_FALLBACK_TTL_MS = 10_000;
const tickerPriceFallbackCache = new Map<string, { fetchedAt: number; prices: Map<string, number> }>();
const TICKER_PRICE_FALLBACK_TTL_MS = 5_000;

export const fetchFallbackKlineCloses = async (params: {
  marketType: 'FUTURES' | 'SPOT';
  symbol: string;
  interval: string;
  limit?: number;
}) => {
  if (process.env.NODE_ENV === 'test') return [];
  const normalizedInterval = normalizeKlineInterval(params.interval);
  const limit = Math.min(1000, Math.max(20, params.limit ?? 300));
  const cacheKey = `${params.marketType}|${params.symbol.toUpperCase()}|${normalizedInterval}|${limit}`;
  const now = Date.now();
  const cached = klineFallbackCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < KLINE_FALLBACK_TTL_MS) {
    return cached.closes;
  }

  const base =
    params.marketType === 'SPOT'
      ? process.env.BINANCE_SPOT_REST_URL ?? 'https://api.binance.com'
      : process.env.BINANCE_FUTURES_REST_URL ?? 'https://fapi.binance.com';
  const endpoint = params.marketType === 'SPOT' ? '/api/v3/klines' : '/fapi/v1/klines';
  const url = `${base}${endpoint}?symbol=${encodeURIComponent(
    params.symbol.toUpperCase()
  )}&interval=${encodeURIComponent(normalizedInterval)}&limit=${limit}`;

  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) return [];
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) return [];
    const now = Date.now();
    const closes = payload
      .map((row) => {
        if (!Array.isArray(row)) return Number.NaN;
        const close = Number(row[4]);
        const closeTime = Number(row[6]);
        if (Number.isFinite(closeTime) && closeTime > now) return Number.NaN;
        return close;
      })
      .filter((value): value is number => Number.isFinite(value));
    if (closes.length > 0) {
      klineFallbackCache.set(cacheKey, { fetchedAt: now, closes });
    }
    return closes;
  } catch {
    return [];
  }
};

export const fetchFallbackTickerPrices = async (params: {
  marketType: 'FUTURES' | 'SPOT';
  symbols: string[];
}) => {
  if (process.env.NODE_ENV === 'test') return new Map<string, number>();
  const normalizedSymbols = normalizeSymbols(params.symbols);
  if (normalizedSymbols.length === 0) return new Map<string, number>();

  const cacheKey = params.marketType;
  const now = Date.now();
  const cached = tickerPriceFallbackCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < TICKER_PRICE_FALLBACK_TTL_MS) {
    const fromCache = normalizedSymbols
      .map((symbol) => [symbol, cached.prices.get(symbol)] as const)
      .filter((entry): entry is [string, number] => Number.isFinite(entry[1]));
    return new Map(fromCache);
  }

  const base =
    params.marketType === 'SPOT'
      ? process.env.BINANCE_SPOT_REST_URL ?? 'https://api.binance.com'
      : process.env.BINANCE_FUTURES_REST_URL ?? 'https://fapi.binance.com';
  const endpoint = params.marketType === 'SPOT' ? '/api/v3/ticker/price' : '/fapi/v1/ticker/price';
  const url = `${base}${endpoint}`;

  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) return new Map<string, number>();
    const payload = (await response.json()) as unknown;
    const allPrices = new Map<string, number>();
    const rows = Array.isArray(payload) ? payload : [payload];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const parsedRow = row as { symbol?: unknown; price?: unknown };
      if (typeof parsedRow.symbol !== 'string') continue;
      const symbol = parsedRow.symbol.trim().toUpperCase();
      if (!symbol) continue;
      const priceRaw =
        typeof parsedRow.price === 'number'
          ? parsedRow.price
          : typeof parsedRow.price === 'string'
            ? Number.parseFloat(parsedRow.price)
            : Number.NaN;
      if (!Number.isFinite(priceRaw) || priceRaw <= 0) continue;
      allPrices.set(symbol, priceRaw);
    }

    if (allPrices.size > 0) {
      tickerPriceFallbackCache.set(cacheKey, {
        fetchedAt: now,
        prices: allPrices,
      });
    }

    const selected = normalizedSymbols
      .map((symbol) => [symbol, allPrices.get(symbol)] as const)
      .filter((entry): entry is [string, number] => Number.isFinite(entry[1]));
    return new Map(selected);
  } catch {
    return new Map<string, number>();
  }
};

