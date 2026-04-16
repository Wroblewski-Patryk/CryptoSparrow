import { createClient } from 'redis';
import { MarketStreamEvent } from './binanceStream.types';

const marketStreamChannel = 'market_stream.events';
const marketStreamWarmupLockKeyPrefix = 'market_stream.runtime_warmup_lock';

type RedisClient = ReturnType<typeof createClient>;

let publisherPromise: Promise<RedisClient | null> | null = null;
let warmupLockClientPromise: Promise<RedisClient | null> | null = null;

const getPublisher = async () => {
  if (process.env.NODE_ENV === 'test') return null;

  if (!publisherPromise) {
    publisherPromise = (async () => {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const client = createClient({ url: redisUrl });
      client.on('error', (error) => {
        console.error('Market stream publisher redis error:', error);
      });
      await client.connect();
      return client;
    })().catch(() => null);
  }

  return publisherPromise;
};

const getWarmupLockClient = async () => {
  if (process.env.NODE_ENV === 'test') return null;

  if (!warmupLockClientPromise) {
    warmupLockClientPromise = (async () => {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const client = createClient({ url: redisUrl });
      client.on('error', (error) => {
        console.error('Market stream warmup-lock redis error:', error);
      });
      await client.connect();
      return client;
    })().catch(() => null);
  }

  return warmupLockClientPromise;
};

export const acquireMarketStreamWarmupLock = async (input: {
  seriesKey: string;
  ttlMs: number;
}) => {
  const client = await getWarmupLockClient();
  if (!client) {
    return {
      acquired: true,
      release: async () => undefined,
    };
  }

  const ttlMs = Math.max(1_000, Math.floor(input.ttlMs));
  const key = `${marketStreamWarmupLockKeyPrefix}:${input.seriesKey}`;
  const ownerToken = `${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

  try {
    const result = await client.set(key, ownerToken, {
      NX: true,
      PX: ttlMs,
    });
    if (result !== 'OK') {
      return {
        acquired: false,
        release: async () => undefined,
      };
    }
  } catch {
    return {
      acquired: true,
      release: async () => undefined,
    };
  }

  return {
    acquired: true,
    release: async () => {
      try {
        await client.eval(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
          {
            keys: [key],
            arguments: [ownerToken],
          }
        );
      } catch {
        // ignore release failures; TTL expiry is the safety net
      }
    },
  };
};

export const publishMarketStreamEvent = async (event: MarketStreamEvent) => {
  const publisher = await getPublisher();
  if (!publisher) return;

  await publisher.publish(
    marketStreamChannel,
    JSON.stringify({
      ...event,
      publishedAt: Date.now(),
    })
  );
};

export const subscribeMarketStreamEvents = async (
  onEvent: (event: MarketStreamEvent) => void
) => {
  if (process.env.NODE_ENV === 'test') {
    return () => Promise.resolve();
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const subscriber = createClient({ url: redisUrl });
  subscriber.on('error', (error) => {
    console.error('Market stream subscriber redis error:', error);
  });

  await subscriber.connect();
  await subscriber.subscribe(marketStreamChannel, (payload) => {
    try {
      const parsed = JSON.parse(payload) as MarketStreamEvent;
      void Promise.resolve(onEvent(parsed)).catch((error) => {
        console.error('Market stream fanout handler error:', error);
      });
    } catch {
      // ignore malformed payload
    }
  });

  return async () => {
    try {
      await subscriber.unsubscribe(marketStreamChannel);
    } finally {
      await subscriber.disconnect().catch(() => undefined);
    }
  };
};
