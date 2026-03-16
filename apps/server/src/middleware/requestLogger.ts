import { NextFunction, Request, Response } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const payload = {
      event: 'http_request',
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(payload));
  });

  return next();
};

