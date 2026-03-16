import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { sendError } from '../utils/apiError';

type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const ipKey = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown';
const rateLimitKey = (req: Request) => `${req.method}:${req.baseUrl}${req.path}:${ipKey(req)}`;

type RedisClient = ReturnType<typeof createClient>;
let redisClientPromise: Promise<RedisClient | null> | null = null;

const getRedisClient = async () => {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const client = createClient({ url: redisUrl });

      client.on('error', (error) => {
        console.error('Redis rate-limit client error:', error);
      });

      await client.connect();
      return client;
    })().catch(() => null);
  }

  return redisClientPromise;
};

export const createRateLimiter = ({ windowMs, max }: RateLimitOptions) => {
  const buckets = new Map<string, Bucket>();

  return async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const redis = await getRedisClient();
    const key = `rate_limit:${rateLimitKey(req)}`;

    if (redis) {
      const result = (await redis.eval(
        `
          local current = redis.call('INCR', KEYS[1])
          if current == 1 then
            redis.call('PEXPIRE', KEYS[1], ARGV[1])
          end
          local ttl = redis.call('PTTL', KEYS[1])
          return { current, ttl }
        `,
        {
          keys: [key],
          arguments: [String(windowMs)],
        }
      )) as [number, number];

      const currentCount = Number(result[0]);
      const ttlMs = Number(result[1]);

      if (currentCount > max) {
        const retryAfterSeconds = Math.ceil(Math.max(ttlMs, 1000) / 1000);
        res.setHeader('Retry-After', String(retryAfterSeconds));
        return sendError(res, 429, 'Too many requests');
      }

      return next();
    }

    // Fallback for local environments when Redis is temporarily unavailable.
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || now >= current.resetAt) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfterSeconds, 1)));
      return sendError(res, 429, 'Too many requests');
    }

    current.count += 1;
    buckets.set(key, current);

    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }

    return next();
  };
};
