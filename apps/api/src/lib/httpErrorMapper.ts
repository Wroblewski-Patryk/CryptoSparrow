import { ZodError } from 'zod';
import { formatZodError } from '../utils/formatZodError';
import { isAppErrorLike, normalizeHttpStatus } from './errors';

type LegacyHttpErrorLike = Error & {
  status: number;
  toDetails?: () => unknown;
  details?: unknown;
};

const isLegacyHttpErrorLike = (value: unknown): value is LegacyHttpErrorLike => {
  if (!(value instanceof Error)) return false;
  const candidate = value as Partial<LegacyHttpErrorLike>;
  return typeof candidate.status === 'number' && Number.isFinite(candidate.status);
};

const resolveDetails = (
  error: Pick<LegacyHttpErrorLike, 'toDetails' | 'details'>
): unknown => {
  if (typeof error.toDetails === 'function') {
    return error.toDetails();
  }
  return error.details;
};

export type MappedHttpError = {
  status: number;
  message: string;
  details?: unknown;
  code?: string;
  source: 'validation' | 'app' | 'legacy' | 'unknown';
};

export const mapErrorToHttpResponse = (error: unknown): MappedHttpError => {
  if (error instanceof ZodError) {
    return {
      status: 400,
      message: 'Validation failed',
      details: formatZodError(error),
      source: 'validation',
    };
  }

  if (isAppErrorLike(error)) {
    return {
      status: normalizeHttpStatus(error.status),
      message: error.message,
      details: resolveDetails(error),
      code: error.code,
      source: 'app',
    };
  }

  if (isLegacyHttpErrorLike(error)) {
    return {
      status: normalizeHttpStatus(error.status),
      message: error.message,
      details: resolveDetails(error),
      source: 'legacy',
    };
  }

  return {
    status: 500,
    message: 'Internal server error',
    source: 'unknown',
  };
};
