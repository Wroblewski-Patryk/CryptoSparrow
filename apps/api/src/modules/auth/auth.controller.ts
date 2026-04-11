import { Request, Response } from 'express';
import { registerUser, loginUser } from './auth.service';
import { RegisterSchema, LoginSchema } from './auth.types';
import { sendValidationError } from '../../utils/formatZodError';
import { sendError } from '../../utils/apiError';
import { prisma } from '../../prisma/client';
import { mapLoginError } from './auth.errors';
import {
  getSessionJwtExpiresIn,
  getSessionTtlMs,
  REMEMBER_ME_TTL_MS,
} from './auth.session';
import { signAuthToken } from './auth.jwt';
import {
  getCandidateTokensFromRequest,
  getVerifiedAuthTokenCandidates,
  VerifiedAuthTokenCandidate,
} from './sessionToken';
import { getCookieDomain, getSessionCookieBaseOptions } from './auth.cookie';

const setSessionCookie = (res: Response, token: string, maxAge: number) => {
  const cookieDomain = getCookieDomain();
  const baseOptions = getSessionCookieBaseOptions();

  // Always set host-only cookie so legacy sessions on api subdomain are overwritten.
  res.cookie('token', token, {
    ...baseOptions,
    maxAge,
  });

  // Additionally set shared cookie for web + api subdomains when configured.
  if (cookieDomain) {
    res.cookie('token', token, {
      ...baseOptions,
      domain: cookieDomain,
      maxAge,
    });
  }
};

const clearSessionCookie = (res: Response) => {
  const cookieDomain = getCookieDomain();
  const baseOptions = getSessionCookieBaseOptions();

  res.clearCookie('token', baseOptions);
  if (cookieDomain) {
    res.clearCookie('token', { ...baseOptions, domain: cookieDomain });
  }
};

const getTokenMaxAgeMs = (candidate: VerifiedAuthTokenCandidate): number | null => {
  const exp = candidate.claims.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
  const maxAge = exp * 1000 - Date.now();
  if (!Number.isFinite(maxAge) || maxAge <= 0) return null;
  return maxAge;
};

export const register = async (req: Request, res: Response) => {
  try {
    const input = RegisterSchema.parse(req.body);
    const user = await registerUser(input);

    const token = signAuthToken(
      { userId: user.id, email: user.email, role: user.role, sessionVersion: 1 },
      getSessionJwtExpiresIn(true)
    );

    setSessionCookie(res, token, REMEMBER_ME_TTL_MS);

    return res.status(201).json({ message: 'User registered', user });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'issues' in error
    ) {
      return sendValidationError(res, error);
    }
    return sendError(res, 500, 'Registration failed');
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const input = LoginSchema.parse(req.body);
    const { token, user } = await loginUser(input);
    const maxAge = getSessionTtlMs(input.remember);

    setSessionCookie(res, token, maxAge);

    return res.status(200).json({ user });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'issues' in error
    ) {
      return sendValidationError(res, error);
    }

    const mapped = mapLoginError(error);
    return sendError(res, mapped.status, mapped.message);
  }
};

export const me = async (req: Request, res: Response) => {
  const clearSession = () => {
    clearSessionCookie(res);
  };

  try {
    const candidateTokens = getCandidateTokensFromRequest(req);
    if (candidateTokens.length === 0) {
      clearSession();
      return sendError(res, 401, 'Missing token');
    }

    const verifiedCandidates = getVerifiedAuthTokenCandidates(req);
    for (const candidate of verifiedCandidates) {
      let user: { id: string; email: string; role: 'USER' | 'ADMIN'; sessionVersion: number } | null = null;
      try {
        user = await prisma.user.findUnique({
          where: { id: candidate.claims.userId },
          select: { id: true, email: true, role: true, sessionVersion: true },
        });
      } catch {
        return sendError(res, 503, 'Auth service temporarily unavailable');
      }

      if (!user) {
        continue;
      }

      const candidateSessionVersion = candidate.claims.sessionVersion ?? 1;
      if (candidateSessionVersion !== user.sessionVersion) {
        continue;
      }

      // Heal legacy dual-cookie sessions by writing the selected session token back.
      const maxAge = getTokenMaxAgeMs(candidate);
      if (maxAge) {
        setSessionCookie(res, candidate.token, maxAge);
      }

      return res.status(200).json({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    }

    clearSession();
    return sendError(res, 401, 'Session expired. Please sign in again.');
  } catch {
    clearSession();
    return sendError(res, 401, 'Invalid token');
  }
};

export const logout = async (_req: Request, res: Response) => {
  clearSessionCookie(res);
  return res.status(200).json({ message: 'Logged out' });
};
