type CoinIconSource = 'coingecko' | 'curated' | 'placeholder';

type CoinGeckoSearchCoin = {
  id?: string;
  symbol?: string;
  market_cap_rank?: number | null;
  thumb?: string;
  small?: string;
  large?: string;
};

type CoinGeckoSearchResponse = {
  coins?: CoinGeckoSearchCoin[];
};

type CoinGeckoCoinResponse = {
  id?: string;
  image?: {
    thumb?: string;
    small?: string;
    large?: string;
  };
};

type IconResolution = {
  iconUrl: string;
  source: CoinIconSource;
  coinGeckoId: string | null;
};

type CacheEntry = {
  value: {
    baseAsset: string;
    iconUrl: string;
    source: CoinIconSource;
    placeholder: boolean;
    coinGeckoId: string | null;
    resolvedAt: string;
  };
  expiresAt: number;
};

export type CoinIconLookupItem = {
  symbol: string;
  baseAsset: string;
  iconUrl: string;
  source: CoinIconSource;
  placeholder: boolean;
  coinGeckoId: string | null;
  cacheHit: boolean;
  resolvedAt: string;
};

const COINGECKO_BASE_URL = process.env.COINGECKO_API_BASE_URL?.trim() || 'https://api.coingecko.com/api/v3';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY?.trim() || '';
const DEFAULT_CACHE_TTL_MINUTES = 360;
const DEFAULT_REQUEST_TIMEOUT_MS = 4000;
const DEFAULT_FETCH_GAP_MS = 120;

const PLACEHOLDER_ICON_DATA_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%231e2233"/><circle cx="32" cy="26" r="13" fill="%234a5568"/><rect x="17" y="42" width="30" height="8" rx="4" fill="%237184a1"/></svg>';

const CURATED_ICON_BY_ASSET: Record<string, string> = {
  BTC: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/btc.png',
  ETH: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/eth.png',
  BNB: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/bnb.png',
  SOL: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/sol.png',
  XRP: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/xrp.png',
  DOGE: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/doge.png',
  ADA: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/ada.png',
  DOT: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/dot.png',
  LTC: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/ltc.png',
  AVAX: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/avax.png',
};

const COINGECKO_ID_HINTS_BY_ASSET: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  DOT: 'polkadot',
  LTC: 'litecoin',
  AVAX: 'avalanche-2',
};

const QUOTE_SUFFIXES = [
  'USDT',
  'USDC',
  'FDUSD',
  'BUSD',
  'TUSD',
  'DAI',
  'EUR',
  'USD',
  'BTC',
  'ETH',
  'BNB',
  'TRY',
  'BRL',
  'JPY',
  'GBP',
  'AUD',
  'BIDR',
  'IDRT',
  'PLN',
];

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const CACHE_TTL_MS = parsePositiveInt(process.env.COIN_ICON_CACHE_TTL_MINUTES, DEFAULT_CACHE_TTL_MINUTES) * 60_000;
const REQUEST_TIMEOUT_MS = parsePositiveInt(process.env.COIN_ICON_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS);
const FETCH_GAP_MS = parsePositiveInt(process.env.COIN_ICON_FETCH_GAP_MS, DEFAULT_FETCH_GAP_MS);

const normalizeSymbol = (value: string) => value.trim().toUpperCase();

const resolveBaseAssetFromSymbol = (rawSymbol: string) => {
  const cleaned = normalizeSymbol(rawSymbol).replace(/[^A-Z0-9/:_-]/g, '');
  if (!cleaned) return '';

  const firstToken = cleaned.split(/[/:_-]/)[0];
  if (!firstToken) return cleaned;

  for (const suffix of QUOTE_SUFFIXES) {
    if (firstToken.length > suffix.length + 1 && firstToken.endsWith(suffix)) {
      return firstToken.slice(0, firstToken.length - suffix.length);
    }
  }

  return firstToken;
};

const selectImageUrl = (input: { large?: string; small?: string; thumb?: string }) =>
  input.large?.trim() || input.small?.trim() || input.thumb?.trim() || null;

const normalizeRank = (value: number | null | undefined) =>
  Number.isFinite(value) ? Number(value) : Number.MAX_SAFE_INTEGER;

class CoinIconResolverService {
  private readonly cache = new Map<string, CacheEntry>();
  private fetchQueue: Promise<void> = Promise.resolve();
  private nextAllowedFetchAt = 0;

  async lookupMany(symbols: string[]): Promise<CoinIconLookupItem[]> {
    const items: CoinIconLookupItem[] = [];
    for (const symbol of symbols) {
      items.push(await this.lookupSymbol(symbol));
    }
    return items;
  }

  async lookupSymbol(symbol: string): Promise<CoinIconLookupItem> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const baseAsset = resolveBaseAssetFromSymbol(normalizedSymbol) || normalizedSymbol;
    const now = Date.now();

    const cached = this.cache.get(baseAsset);
    if (cached && cached.expiresAt > now) {
      return {
        symbol: normalizedSymbol,
        ...cached.value,
        cacheHit: true,
      };
    }

    const resolved = await this.resolveWithFallback(baseAsset);
    const value = {
      baseAsset,
      iconUrl: resolved.iconUrl,
      source: resolved.source,
      placeholder: resolved.source === 'placeholder',
      coinGeckoId: resolved.coinGeckoId,
      resolvedAt: new Date(now).toISOString(),
    };

    this.cache.set(baseAsset, {
      value,
      expiresAt: now + CACHE_TTL_MS,
    });

    return {
      symbol: normalizedSymbol,
      ...value,
      cacheHit: false,
    };
  }

  resetCacheForTests() {
    this.cache.clear();
    this.fetchQueue = Promise.resolve();
    this.nextAllowedFetchAt = 0;
  }

  private async resolveWithFallback(baseAsset: string): Promise<IconResolution> {
    const preferredId = COINGECKO_ID_HINTS_BY_ASSET[baseAsset];
    if (preferredId) {
      const preferred = await this.fetchCoinById(preferredId);
      if (preferred) {
        return {
          iconUrl: preferred.imageUrl,
          source: 'coingecko',
          coinGeckoId: preferred.id,
        };
      }
    }

    const search = await this.searchCoin(baseAsset);
    if (search) {
      if (search.imageUrl) {
        return {
          iconUrl: search.imageUrl,
          source: 'coingecko',
          coinGeckoId: search.id,
        };
      }

      const byId = await this.fetchCoinById(search.id);
      if (byId) {
        return {
          iconUrl: byId.imageUrl,
          source: 'coingecko',
          coinGeckoId: byId.id,
        };
      }
    }

    const curated = CURATED_ICON_BY_ASSET[baseAsset];
    if (curated) {
      return {
        iconUrl: curated,
        source: 'curated',
        coinGeckoId: null,
      };
    }

    return {
      iconUrl: PLACEHOLDER_ICON_DATA_URL,
      source: 'placeholder',
      coinGeckoId: null,
    };
  }

  private async searchCoin(baseAsset: string): Promise<{ id: string; imageUrl: string | null } | null> {
    const payload = await this.fetchJson<CoinGeckoSearchResponse>('/search', {
      query: baseAsset.toLowerCase(),
    });
    if (!payload?.coins?.length) return null;

    const candidates = payload.coins
      .filter((coin) => coin.id && normalizeSymbol(coin.symbol ?? '') === baseAsset)
      .sort((left, right) => {
        const rankDiff = normalizeRank(left.market_cap_rank) - normalizeRank(right.market_cap_rank);
        if (rankDiff !== 0) return rankDiff;
        return String(left.id).localeCompare(String(right.id));
      });

    const selected = candidates[0];
    if (!selected?.id) return null;

    return {
      id: selected.id,
      imageUrl: selectImageUrl(selected),
    };
  }

  private async fetchCoinById(id: string): Promise<{ id: string; imageUrl: string } | null> {
    const payload = await this.fetchJson<CoinGeckoCoinResponse>(`/coins/${encodeURIComponent(id)}`, {
      localization: 'false',
      tickers: 'false',
      market_data: 'false',
      community_data: 'false',
      developer_data: 'false',
      sparkline: 'false',
    });
    const imageUrl = selectImageUrl(payload?.image ?? {});
    if (!payload?.id || !imageUrl) return null;

    return {
      id: payload.id,
      imageUrl,
    };
  }

  private async fetchJson<T>(path: string, params?: Record<string, string>): Promise<T | null> {
    return this.runRateLimited(async () => {
      const url = new URL(`${COINGECKO_BASE_URL}${path}`);
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          url.searchParams.set(key, value);
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const headers: Record<string, string> = {};
        if (COINGECKO_API_KEY) {
          headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
          headers['x-cg-demo-api-key'] = COINGECKO_API_KEY;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        if (!response.ok) return null;
        return (await response.json()) as T;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  private async runRateLimited<T>(task: () => Promise<T>): Promise<T> {
    const scheduled = this.fetchQueue.then(async () => {
      const now = Date.now();
      const waitMs = this.nextAllowedFetchAt > now ? this.nextAllowedFetchAt - now : 0;
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.nextAllowedFetchAt = Date.now() + FETCH_GAP_MS;
      return task();
    });

    this.fetchQueue = scheduled.then(
      () => undefined,
      () => undefined
    );

    return scheduled;
  }
}

const coinIconResolver = new CoinIconResolverService();

export const lookupCoinIcons = (symbols: string[]) => coinIconResolver.lookupMany(symbols);

export const resetCoinIconResolverStateForTests = () => {
  coinIconResolver.resetCacheForTests();
};
