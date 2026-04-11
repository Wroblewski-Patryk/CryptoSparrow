import { NextFunction, Request, Response } from 'express';
import { metricsStore } from '../observability/metrics';
import { createModuleLogger } from '../lib/logger';

const logger = createModuleLogger('http.request');

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    metricsStore.recordHttp({
      statusCode: res.statusCode,
      durationMs,
    });

    logger.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  return next();
};
