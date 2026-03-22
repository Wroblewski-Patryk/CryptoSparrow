import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiError';
import { AuthRole } from '../types/express';

export function requireRole(role: AuthRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || user.role !== role) {
      return sendError(res, 403, 'Forbidden');
    }
    next();
  };
}
