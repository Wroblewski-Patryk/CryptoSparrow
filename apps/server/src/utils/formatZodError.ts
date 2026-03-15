import { ZodError } from 'zod';
import { Response } from 'express';
import { sendError } from './apiError';

export const formatZodError = (err: ZodError) => {
  return err.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
};

export const sendValidationError = (res: Response, err: unknown) => {
  if (err instanceof ZodError) {
    return sendError(res, 400, 'Validation failed', formatZodError(err));
  }

  return sendError(res, 400, 'Validation failed');
};
