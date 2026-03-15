import { ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { formatZodError } from '../utils/formatZodError';
import { sendError } from '../utils/apiError';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return sendError(res, 400, 'Validation failed', formatZodError(err));
  }

  console.error(err);

  return sendError(res, 500, 'Internal server error');
}
