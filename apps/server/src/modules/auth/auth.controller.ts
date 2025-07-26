import { Request, Response } from 'express';
import { registerUser } from './auth.service';
import { RegisterSchema } from './auth.types';

export const register = async (req: Request, res: Response) => {
  const input = RegisterSchema.parse(req.body);
  const user = await registerUser(input);
  res.status(201).json({ message: 'User registered', user });
};
