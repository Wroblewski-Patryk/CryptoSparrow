import { ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { formatZodError } from '../utils/formatZodError';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({ errors: formatZodError(err) });
  }

  console.error(err);

  return res.status(500).json({ error: 'Internal server error' });
}
