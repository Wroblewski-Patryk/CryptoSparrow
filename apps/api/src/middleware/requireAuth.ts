import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiError';
import { verifyAuthToken } from '../modules/auth/auth.jwt';
import { prisma } from '../prisma/client';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const clearSession = () => {
    res.clearCookie('token', { path: '/' });
  };

  const token = req.cookies.token;
  if (!token) {
    clearSession();
    return sendError(res, 401, 'Missing token');
  }

  try {
    const payload = verifyAuthToken(token);

    if (!payload.userId || !payload.email || !payload.role) {
      clearSession();
      return sendError(res, 401, 'Invalid token');
    }

    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

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
      clearSession();
      return sendError(res, 401, 'Session expired. Please sign in again.');
    }

    next();
  } catch {
    clearSession();
    return sendError(res, 401, 'Invalid token');
  }
}
