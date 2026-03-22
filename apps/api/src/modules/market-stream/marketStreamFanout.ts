import { createClient } from 'redis';
import { MarketStreamEvent } from './binanceStream.types';

const marketStreamChannel = 'market_stream.events';

type RedisClient = ReturnType<typeof createClient>;

let publisherPromise: Promise<RedisClient | null> | null = null;

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
      onEvent(parsed);
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

