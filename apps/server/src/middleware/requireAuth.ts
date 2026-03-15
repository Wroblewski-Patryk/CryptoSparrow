import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { sendError } from '../utils/apiError';
import { AuthRole } from '../types/express';

type TokenPayload = JwtPayload & {
  userId?: string;
  email?: string;
  role?: AuthRole;
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.token;
  if (!token) return sendError(res, 401, 'Missing token');

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;

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
