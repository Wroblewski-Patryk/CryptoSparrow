import { Request } from 'express';
import { verifyAuthToken } from './auth.jwt';
import { AuthRole } from '../../types/express';

type AuthTokenClaims = {
  userId: string;
  email: string;
  role: AuthRole;
  sessionVersion?: number;
  iat?: number;
  exp?: number;
};

export type VerifiedAuthTokenCandidate = {
  token: string;
  claims: AuthTokenClaims;
};

const hasRequiredClaims = (payload: unknown): payload is AuthTokenClaims => {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Partial<AuthTokenClaims>;
  return (
    typeof candidate.userId === 'string' &&
    candidate.userId.length > 0 &&
    typeof candidate.email === 'string' &&
    candidate.email.length > 0 &&
    (candidate.role === 'USER' || candidate.role === 'ADMIN') &&
    (candidate.sessionVersion === undefined ||
      (typeof candidate.sessionVersion === 'number' &&
        Number.isFinite(candidate.sessionVersion) &&
        candidate.sessionVersion >= 1))
  );
};

const tokenIssuedAt = (claims: AuthTokenClaims) =>
  typeof claims.iat === 'number' && Number.isFinite(claims.iat) ? claims.iat : 0;

export const getCandidateTokensFromRequest = (req: Request): string[] => {
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

export const getVerifiedAuthTokenCandidates = (req: Request): VerifiedAuthTokenCandidate[] => {
  const candidates = getCandidateTokensFromRequest(req)
    .map((token, index) => ({ token, index }))
    .map(({ token, index }) => {
      try {
        const claims = verifyAuthToken(token);
        if (!hasRequiredClaims(claims)) {
          return null;
        }
        return { token, claims, index };
      } catch {
        return null;
      }
    })
    .filter((item): item is { token: string; claims: AuthTokenClaims; index: number } => item !== null);

  candidates.sort((a, b) => {
    const iatDelta = tokenIssuedAt(b.claims) - tokenIssuedAt(a.claims);
    if (iatDelta !== 0) return iatDelta;
    return a.index - b.index;
  });

  return candidates.map(({ token, claims }) => ({ token, claims }));
};
