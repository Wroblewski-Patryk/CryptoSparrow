import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiError';

export function requireRole(role: 'USER' | 'ADMIN') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || user.role !== role) {
      return sendError(res, 403, 'Forbidden');
    }
    next();
  };
}
