import { prisma } from '../../prisma/client';
import { RegisterInput, LoginInput } from './auth.types';
import { hashPassword, comparePassword } from '../../utils/hash';
import { serverUrl } from '../../config/runtime';
import { getSessionJwtExpiresIn } from './auth.session';
import { signAuthToken } from './auth.jwt';
import { publicUserSelect } from '../users/publicUser';
import { ensureDefaultSubscriptionForUser, ensureSubscriptionCatalog } from '../subscriptions/subscriptions.service';

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

  const avatarUrl = `${serverUrl}/avatars/default.png`;

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: input.email,
        password: hashed,
        avatarUrl: avatarUrl
      },
      select: publicUserSelect,
    });

    await ensureSubscriptionCatalog(tx);
    await ensureDefaultSubscriptionForUser(tx, createdUser.id);

    return createdUser;
  });

  return user;
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      ...publicUserSelect,
      password: true,
      sessionVersion: true,
    },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isValid = await comparePassword(input.password, user.password);

  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  const token = signAuthToken(
    { userId: user.id, email: user.email, role: user.role, sessionVersion: user.sessionVersion },
    getSessionJwtExpiresIn(input.remember)
  );

  const { password: _passwordHash, ...publicUser } = user;
  return { token, user: publicUser };
};
