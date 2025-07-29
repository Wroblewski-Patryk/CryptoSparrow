import { Request, Response, NextFunction } from 'express';

export function requireRole(role: 'USER' | 'ADMIN') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || user.role !== role) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    next();
  };
}
