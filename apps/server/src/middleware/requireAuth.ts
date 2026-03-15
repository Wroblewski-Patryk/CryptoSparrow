import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/apiError';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.token;
  if (!token) return sendError(res, 401, 'Missing token');

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);

    (req as any).user = {
      id: (payload as any).userId,
      email: (payload as any).email,
      role: (payload as any).role,
    };

    next();
  } catch {
    return sendError(res, 401, 'Invalid token');
  }
}
