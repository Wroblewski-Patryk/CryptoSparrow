import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { createHash } from 'crypto';
import { sendError } from '../utils/apiError';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyScope?: 'ip' | 'auth' | 'user' | 'user_exchange';
};

type Bucket = {
  count: number;
  resetAt: number;
};

const normalizeToken = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const getRequestIp = (req: Request) => {
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const apiKeyFingerprint = (raw: unknown) => {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  return createHash('sha256').update(raw.trim()).digest('hex').slice(0, 12);
};

const resolveRateLimitSubject = (
  req: Request,
  keyScope: NonNullable<RateLimitOptions['keyScope']>
) => {
  const ip = getRequestIp(req);
  const userId = normalizeToken(req.user?.id);
  const body = (req.body as Record<string, unknown> | undefined) ?? {};
  const query = (req.query as Record<string, unknown> | undefined) ?? {};

  if (keyScope === 'ip') {
    return `ip:${ip}`;
  }

  if (keyScope === 'auth') {
    const email = normalizeToken(body.email);
    return email ? `auth:${email}` : `ip:${ip}`;
  }

  if (keyScope === 'user') {
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  const exchange = normalizeToken(body.exchange) || normalizeToken(query.exchange) || 'unknown';
  const apiKeyHash = apiKeyFingerprint(body.apiKey);
  const savedKeyId = normalizeToken(req.params?.id);
  const keyPart = apiKeyHash ? `hash:${apiKeyHash}` : savedKeyId ? `saved:${savedKeyId}` : 'none';
  const actor = userId ? `user:${userId}` : `ip:${ip}`;
  return `${actor}:exchange:${exchange}:key:${keyPart}`;
};

const rateLimitKey = (
  req: Request,
  keyScope: NonNullable<RateLimitOptions['keyScope']>
) => `${req.method}:${req.baseUrl}${req.path}:${resolveRateLimitSubject(req, keyScope)}`;

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

export const createRateLimiter = ({ windowMs, max, keyScope = 'user' }: RateLimitOptions) => {
  const buckets = new Map<string, Bucket>();

  return async (req: Request, res: Response, next: NextFunction) => {
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.RATE_LIMIT_ENABLE_TEST_MODE !== 'true'
    ) {
      return next();
    }

    const redis = await getRedisClient();
    const key = `rate_limit:${rateLimitKey(req, keyScope)}`;

    if (redis) {
      try {
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
      } catch (error) {
        // Fail open to in-memory limiter if Redis write path is temporarily broken
        // (for example MISCONF during snapshot failures).
        console.error('Redis rate-limit eval failed, falling back to in-memory limiter:', error);
      }
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

export const __rateLimitInternals = {
  resolveRateLimitSubject,
};
