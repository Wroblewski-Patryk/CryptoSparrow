import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiError';
import { mapErrorToHttpResponse } from '../lib/httpErrorMapper';
import { createModuleLogger } from '../lib/logger';

const logger = createModuleLogger('api.error-handler');

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const mapped = mapErrorToHttpResponse(err);

  if (mapped.status >= 500) {
    logger.error('request_error_unhandled', {
      status: mapped.status,
      code: mapped.code ?? null,
      source: mapped.source,
      error: err,
    });
  }

  return sendError(res, mapped.status, mapped.message, mapped.details);
}
