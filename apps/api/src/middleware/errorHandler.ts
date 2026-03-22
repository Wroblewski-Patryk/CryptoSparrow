import { ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { sendValidationError } from '../utils/formatZodError';
import { sendError } from '../utils/apiError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return sendValidationError(res, err);
  }

  console.error(err);

  return sendError(res, 500, 'Internal server error');
}
