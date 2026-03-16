import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiError';
import { verifyAuthToken } from '../modules/auth/auth.jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.token;
  if (!token) return sendError(res, 401, 'Missing token');

  try {
    const payload = verifyAuthToken(token);

    if (!payload.userId || !payload.email || !payload.role) {
      return sendError(res, 401, 'Invalid token');
    }

    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch {
    return sendError(res, 401, 'Invalid token');
  }
}
