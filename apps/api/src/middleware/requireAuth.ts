import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiError';
import { prisma } from '../prisma/client';
import {
  getCandidateTokensFromRequest,
  getVerifiedAuthTokenCandidates,
} from '../modules/auth/sessionToken';
import { getCookieDomain, getSessionCookieBaseOptions } from '../modules/auth/auth.cookie';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const clearSession = () => {
    const baseOptions = getSessionCookieBaseOptions();

    res.clearCookie('token', baseOptions);
    const cookieDomain = getCookieDomain();
    if (cookieDomain) {
      res.clearCookie('token', { ...baseOptions, domain: cookieDomain });
    }
  };

  const candidateTokens = getCandidateTokensFromRequest(req);
  if (candidateTokens.length === 0) {
    clearSession();
    return sendError(res, 401, 'Missing token');
  }

  const verifiedCandidates = getVerifiedAuthTokenCandidates(req);

  for (const candidate of verifiedCandidates) {
    let userExists: { id: string; sessionVersion: number } | null = null;
    try {
      userExists = await prisma.user.findUnique({
        where: { id: candidate.claims.userId },
        select: { id: true, sessionVersion: true },
      });
    } catch {
      return sendError(res, 503, 'Auth service temporarily unavailable');
    }

    if (!userExists) {
      continue;
    }

    // Backward-compatible: legacy tokens without sessionVersion are treated as v1.
    const candidateSessionVersion = candidate.claims.sessionVersion ?? 1;
    if (candidateSessionVersion !== userExists.sessionVersion) {
      continue;
    }

    req.user = {
      id: candidate.claims.userId,
      email: candidate.claims.email,
      role: candidate.claims.role,
    };

    return next();
  }

  clearSession();
  return sendError(res, 401, 'Invalid token');
}
