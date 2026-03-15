import { Request, Response, NextFunction } from 'express';
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

export const createRateLimiter = ({ windowMs, max }: RateLimitOptions) => {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const now = Date.now();
    const key = ipKey(req);
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
    return next();
  };
};
