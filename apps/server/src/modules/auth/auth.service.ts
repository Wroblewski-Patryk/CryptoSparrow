import { prisma } from '../../prisma/client';
import { RegisterInput, LoginInput } from './auth.types';
import { hashPassword, comparePassword } from '../../utils/hash';
import jwt from 'jsonwebtoken';

export const registerUser = async (
    input: RegisterInput
  ) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  }); 

  if (existing) {
    throw new Error('User with this email already exists');
  }

  const hashed = await hashPassword(input.password);

  const serverUrl = process.env.SERVER_URL+':'+process.env.SERVER_PORT;
  const avatarUrl = serverUrl + "/avatars/default.png";

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashed,
      avatarUrl: avatarUrl
    },
  });

  return user;
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isValid = await comparePassword(input.password, user.password);

  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  const expiresIn = input.remember ? '30d' : '1h';

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn, algorithm: "HS256" }
  );

  return { token, user };
};
