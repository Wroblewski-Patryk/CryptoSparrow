import { Request, Response } from 'express';
import { registerUser, loginUser } from './auth.service';
import { RegisterSchema, LoginSchema } from './auth.types';
import { sendValidationError } from '../../utils/formatZodError';
import { sendError } from '../../utils/apiError';
import { prisma } from '../../prisma/client';
import {
  getSessionJwtExpiresIn,
  getSessionTtlMs,
  REMEMBER_ME_TTL_MS,
} from './auth.session';
import { signAuthToken, verifyAuthToken } from './auth.jwt';

const getCookieDomain = () => {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  return domain && domain.length > 0 ? domain : undefined;
};

const getCookieBaseOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  sameSite: 'lax' as const,
});

const setSessionCookie = (res: Response, token: string, maxAge: number) => {
  const cookieDomain = getCookieDomain();
  const baseOptions = getCookieBaseOptions();

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
  const baseOptions = getCookieBaseOptions();

  res.clearCookie('token', baseOptions);
  if (cookieDomain) {
    res.clearCookie('token', { ...baseOptions, domain: cookieDomain });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const input = RegisterSchema.parse(req.body);
    const user = await registerUser(input);

    const token = signAuthToken(
      { userId: user.id, email: user.email, role: user.role },
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

    const errorMessage =
      typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message?: string }).message
        : 'Login failed';

    return sendError(res, 401, errorMessage || 'Login failed');
  }
};

export const me = async (req: Request, res: Response) => {
  const clearSession = () => {
    clearSessionCookie(res);
  };

  try {
    const token = req.cookies.token;
    if (!token) {
      clearSession();
      return sendError(res, 401, 'Missing token');
    }

    const payload = verifyAuthToken(token);
    let user: { id: string; email: string } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true },
      });
    } catch {
      return sendError(res, 503, 'Auth service temporarily unavailable');
    }

    if (!user) {
      clearSession();
      return sendError(res, 401, 'Session expired. Please sign in again.');
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
    });
  } catch {
    clearSession();
    return sendError(res, 401, 'Invalid token');
  }
};

export const logout = async (_req: Request, res: Response) => {
  clearSessionCookie(res);
  return res.status(200).json({ message: 'Logged out' });
};
