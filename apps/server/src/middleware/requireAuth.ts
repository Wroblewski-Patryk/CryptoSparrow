import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Brak tokena' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);

    // Tu robisz zawsze user.id
    (req as any).user = {
      id: (payload as any).userId,
      email: (payload as any).email,
      role: (payload as any).role,
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Nieprawidłowy token' });
  }
}
