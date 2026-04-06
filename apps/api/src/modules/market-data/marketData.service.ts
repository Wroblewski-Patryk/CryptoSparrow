import {
  FundingRateSnapshot,
  MarketSnapshotRequest,
  MarketSnapshotRequestSchema,
  OhlcvCandle,
  OhlcvRequest,
  OhlcvRequestSchema,
  OpenInterestSnapshot,
  OrderBookRequest,
  OrderBookRequestSchema,
  OrderBookSnapshot,
} from './marketData.types';
import { createClient } from 'redis';

export interface MarketDataProvider {
  fetchOHLCV(input: OhlcvRequest): Promise<OhlcvCandle[]>;
  fetchOrderBook?(input: OrderBookRequest): Promise<OrderBookSnapshot>;
  fetchFundingRate?(input: MarketSnapshotRequest): Promise<FundingRateSnapshot>;
  fetchOpenInterest?(input: MarketSnapshotRequest): Promise<OpenInterestSnapshot>;
}

type CacheEntry = {
  value: OhlcvCandle[];
  expiresAt: number;
  createdAt: number;
};

type MarketDataServiceOptions = {
  cacheTtlMs?: number;
  maxEntries?: number;
  useRedisCache?: boolean;
};

const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

type RedisClient = ReturnType<typeof createClient>;
let redisClientPromise: Promise<RedisClient | null> | null = null;

const getRedisClient = async () => {
  if (process.env.NODE_ENV === 'test') return null;

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const client = createClient({
          url: process.env.REDIS_URL || DEFAULT_REDIS_URL,
        });
        client.on('error', () => {
          // Fallback to local cache when Redis is unavailable.
        });
        await client.connect();
        return client;
      } catch {
        return null;
      }
    })();
  }

  return redisClientPromise;
};

export class MarketDataService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs: number;
  private readonly maxEntries: number;
  private readonly useRedisCache: boolean;

  constructor(
    private readonly provider: MarketDataProvider,
    options: MarketDataServiceOptions = {}
  ) {
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.useRedisCache = options.useRedisCache ?? true;
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

      const redisCached = await this.readFromRedis(cacheKey);
      if (redisCached) {
        this.cache.set(cacheKey, {
          value: redisCached,
          expiresAt: now + this.cacheTtlMs,
          createdAt: now,
        });
        this.enforceMaxEntries();
        return redisCached;
      }
    }

    const fresh = await this.provider.fetchOHLCV(parsed);

    this.cache.set(cacheKey, {
      value: fresh,
      expiresAt: now + this.cacheTtlMs,
      createdAt: now,
    });
    this.enforceMaxEntries();
    await this.writeToRedis(cacheKey, fresh);

    return fresh;
  }

  clearCache() {
    this.cache.clear();
  }

  async getOrderBook(input: OrderBookRequest): Promise<OrderBookSnapshot> {
    const parsed = OrderBookRequestSchema.parse(input);
    if (!this.provider.fetchOrderBook) {
      throw new Error('ORDER_BOOK_PROVIDER_UNAVAILABLE');
    }
    return this.provider.fetchOrderBook(parsed);
  }

  async getFundingRate(input: MarketSnapshotRequest): Promise<FundingRateSnapshot> {
    const parsed = MarketSnapshotRequestSchema.parse(input);
    if (!this.provider.fetchFundingRate) {
      throw new Error('FUNDING_RATE_PROVIDER_UNAVAILABLE');
    }
    return this.provider.fetchFundingRate(parsed);
  }

  async getOpenInterest(input: MarketSnapshotRequest): Promise<OpenInterestSnapshot> {
    const parsed = MarketSnapshotRequestSchema.parse(input);
    if (!this.provider.fetchOpenInterest) {
      throw new Error('OPEN_INTEREST_PROVIDER_UNAVAILABLE');
    }
    return this.provider.fetchOpenInterest(parsed);
  }

  private toCacheKey(input: OhlcvRequest) {
    return `${input.exchange}|${input.marketType}|${input.symbol.toUpperCase()}|${input.timeframe}|${input.limit}`;
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

  private async readFromRedis(cacheKey: string) {
    if (!this.useRedisCache) return null;
    const client = await getRedisClient();
    if (!client) return null;

    try {
      const raw = await client.get(`market:${cacheKey}`);
      if (!raw) return null;
      return JSON.parse(raw) as OhlcvCandle[];
    } catch {
      return null;
    }
  }

  private async writeToRedis(cacheKey: string, value: OhlcvCandle[]) {
    if (!this.useRedisCache) return;
    const client = await getRedisClient();
    if (!client) return;

    try {
      await client.set(`market:${cacheKey}`, JSON.stringify(value), {
        PX: this.cacheTtlMs,
      });
    } catch {
      // Redis write failures should not block market ingestion path.
    }
  }
}
