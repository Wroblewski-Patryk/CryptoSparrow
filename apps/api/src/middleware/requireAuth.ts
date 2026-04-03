import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiError';
import { verifyAuthToken } from '../modules/auth/auth.jwt';
import { prisma } from '../prisma/client';

const getCookieDomain = () => {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  return domain && domain.length > 0 ? domain : undefined;
};

const getCandidateTokens = (req: Request) => {
  const parsedToken = typeof req.cookies?.token === 'string' ? req.cookies.token : null;
  const rawCookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';

  const rawTokens = rawCookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('token='))
    .map((part) => decodeURIComponent(part.slice('token='.length)))
    .filter((value) => value.length > 0);

  return [...new Set([...(parsedToken ? [parsedToken] : []), ...rawTokens])];
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const clearSession = () => {
    const baseOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax' as const,
    };

    res.clearCookie('token', baseOptions);
    const cookieDomain = getCookieDomain();
    if (cookieDomain) {
      res.clearCookie('token', { ...baseOptions, domain: cookieDomain });
    }
  };

  const candidateTokens = getCandidateTokens(req);
  if (candidateTokens.length === 0) {
    clearSession();
    return sendError(res, 401, 'Missing token');
  }

  for (const token of candidateTokens) {
    try {
      const payload = verifyAuthToken(token);

      if (!payload.userId || !payload.email || !payload.role) {
        continue;
      }

      let userExists: { id: string } | null = null;
      try {
        userExists = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { id: true },
        });
      } catch {
        return sendError(res, 503, 'Auth service temporarily unavailable');
      }

      if (!userExists) {
        continue;
      }

      req.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      };

      return next();
    } catch {
      continue;
    }
  }

  clearSession();
  return sendError(res, 401, 'Invalid token');
}
