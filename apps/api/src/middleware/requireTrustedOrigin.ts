import { NextFunction, Request, Response } from 'express';
import { clientUrl, corsOrigins, serverUrl } from '../config/runtime';
import { getSessionCookieBaseOptions } from '../modules/auth/auth.cookie';
import { sendError } from '../utils/apiError';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const normalizeOrigin = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const getAllowedOrigins = (): Set<string> => {
  const origins = [clientUrl, serverUrl, ...corsOrigins]
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => origin !== null);
  return new Set(origins);
};

const hasSessionTokenCookie = (req: Request): boolean => {
  if (typeof req.cookies?.token === 'string' && req.cookies.token.length > 0) {
    return true;
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part.startsWith('token=') && part.length > 'token='.length);
};

const getRequestOrigin = (req: Request): string | null => {
  const originHeader =
    typeof req.headers.origin === 'string' && req.headers.origin.trim().length > 0
      ? req.headers.origin.trim()
      : null;
  if (originHeader) {
    return normalizeOrigin(originHeader);
  }

  const refererHeader =
    typeof req.headers.referer === 'string' && req.headers.referer.trim().length > 0
      ? req.headers.referer.trim()
      : null;
  return normalizeOrigin(refererHeader);
};

export const requireTrustedOrigin = (req: Request, res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  // Guard state-changing calls that use session cookies.
  if (!hasSessionTokenCookie(req)) {
    return next();
  }

  const sameSite = getSessionCookieBaseOptions().sameSite;
  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) {
    if (sameSite === 'none') {
      return sendError(res, 403, 'Origin header required for state-changing requests');
    }
    return next();
  }

  const allowedOrigins = getAllowedOrigins();
  if (!allowedOrigins.has(requestOrigin)) {
    return sendError(res, 403, 'Untrusted origin');
  }

  return next();
};
