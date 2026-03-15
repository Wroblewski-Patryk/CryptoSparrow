import { OhlcvCandle, OhlcvRequest, OhlcvRequestSchema } from './marketData.types';

export interface MarketDataProvider {
  fetchOHLCV(input: OhlcvRequest): Promise<OhlcvCandle[]>;
}

type CacheEntry = {
  value: OhlcvCandle[];
  expiresAt: number;
  createdAt: number;
};

type MarketDataServiceOptions = {
  cacheTtlMs?: number;
  maxEntries?: number;
};

const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_MAX_ENTRIES = 500;

export class MarketDataService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs: number;
  private readonly maxEntries: number;

  constructor(
    private readonly provider: MarketDataProvider,
    options: MarketDataServiceOptions = {}
  ) {
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  async ingestOHLCV(input: OhlcvRequest, forceRefresh = false): Promise<OhlcvCandle[]> {
    const parsed = OhlcvRequestSchema.parse(input);
    const cacheKey = this.toCacheKey(parsed);
    const now = Date.now();

    this.pruneExpired(now);

    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }
    }

    const fresh = await this.provider.fetchOHLCV(parsed);

    this.cache.set(cacheKey, {
      value: fresh,
      expiresAt: now + this.cacheTtlMs,
      createdAt: now,
    });
    this.enforceMaxEntries();

    return fresh;
  }

  clearCache() {
    this.cache.clear();
  }

  private toCacheKey(input: OhlcvRequest) {
    return `${input.symbol.toUpperCase()}|${input.timeframe}|${input.limit}`;
  }

  private pruneExpired(now: number) {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  private enforceMaxEntries() {
    if (this.cache.size <= this.maxEntries) return;

    const oldestEntry = [...this.cache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldestEntry) {
      this.cache.delete(oldestEntry[0]);
    }
  }
}
