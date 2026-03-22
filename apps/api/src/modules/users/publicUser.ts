import { Prisma } from '@prisma/client';

export const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  name: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

