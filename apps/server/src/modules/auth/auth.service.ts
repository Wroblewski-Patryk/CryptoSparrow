import { prisma } from '../../prisma/client';
import { RegisterInput } from './auth.types';
import { hashPassword } from '../../utils/hash';

export const registerUser = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new Error('User already exists');
  }

  const hashed = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashed,
    },
  });

  return user;
};
