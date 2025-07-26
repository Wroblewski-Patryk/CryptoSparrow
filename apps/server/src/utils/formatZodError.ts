import { ZodError } from 'zod';

export const formatZodError = (err: ZodError) => {
  return err.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
};