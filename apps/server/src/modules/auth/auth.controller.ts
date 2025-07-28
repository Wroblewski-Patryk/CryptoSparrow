import { Request, Response } from 'express';
import { registerUser, loginUser } from './auth.service';
import { RegisterSchema, LoginSchema } from './auth.types';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response) => {
  try {
    const input = RegisterSchema.parse(req.body);
    const user = await registerUser(input);

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      {
        expiresIn: '7d',
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
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    return res.status(500).json({ error: 'Registration failed' });
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
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const errorMessage =
      typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message?: string }).message
        : undefined;

    return res.status(401).json({ error: errorMessage || 'Login failed' });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Brak tokena' });

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
    };

    return res.status(200).json({
      id: payload.userId,
      email: payload.email,
    });
  } catch {
    return res.status(401).json({ message: 'Nieprawidłowy token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie('token', { path: '/' });
  return res.status(200).json({ message: 'Wylogowano' });
};
