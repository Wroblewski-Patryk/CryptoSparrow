import { NextFunction, Request, Response } from 'express';
import { metricsStore } from '../observability/metrics';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    metricsStore.recordHttp({
      statusCode: res.statusCode,
      durationMs,
    });

    const payload = {
      event: 'http_request',
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify(payload));
    }
  });

  return next();
};
