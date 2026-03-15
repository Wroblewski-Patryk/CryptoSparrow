import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { registerUser, loginUser } from './auth.service';
import { RegisterSchema, LoginSchema } from './auth.types';
import { sendValidationError } from '../../utils/formatZodError';
import { sendError } from '../../utils/apiError';

export const register = async (req: Request, res: Response) => {
  try {
    const input = RegisterSchema.parse(req.body);
    const user = await registerUser(input);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      {
        expiresIn: '30d',
        algorithm: 'HS256',
      }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
      sameSite: 'lax',
    });

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

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24,
      path: '/',
      sameSite: 'lax',
    });

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
  try {
    const token = req.cookies.token;
    if (!token) return sendError(res, 401, 'Missing token');

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
    };

    return res.status(200).json({
      id: payload.userId,
      email: payload.email,
    });
  } catch {
    return sendError(res, 401, 'Invalid token');
  }
};

export const logout = async (_req: Request, res: Response) => {
  res.clearCookie('token', { path: '/' });
  return res.status(200).json({ message: 'Logged out' });
};
