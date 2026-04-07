import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../../prisma/client';
import { setActiveSubscriptionForUser } from '../../subscriptions/subscriptions.service';
import {
  AdminUserItem,
  AdminUsersListQueryDto,
  AdminUsersListResult,
  UpdateAdminUserDto,
} from './users.types';

const adminUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  subscriptionAssignments: {
    where: { status: 'ACTIVE' as const },
    orderBy: { startsAt: 'desc' as const },
    take: 1,
    select: {
      source: true,
      startsAt: true,
      endsAt: true,
      subscriptionPlan: {
        select: {
          code: true,
          displayName: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type AdminUserRow = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

const toAdminUserItem = (user: AdminUserRow): AdminUserItem => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  activeSubscription: user.subscriptionAssignments[0]
    ? {
        planCode: user.subscriptionAssignments[0].subscriptionPlan.code,
        planDisplayName: user.subscriptionAssignments[0].subscriptionPlan.displayName,
        source: user.subscriptionAssignments[0].source,
        startsAt: user.subscriptionAssignments[0].startsAt.toISOString(),
        endsAt: user.subscriptionAssignments[0].endsAt?.toISOString() ?? null,
      }
    : null,
});

export const listAdminUsers = async (
  query: AdminUsersListQueryDto,
): Promise<AdminUsersListResult> => {
  const search = query.search?.trim();
  const page = query.page;
  const pageSize = query.pageSize;

  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: adminUserSelect,
    }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    users: users.map((user) => toAdminUserItem(user)),
    meta: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
};

type UpdateAdminUserInput = UpdateAdminUserDto & {
  actorUserId: string;
  userId: string;
};

type UpdateAdminUserResult =
  | { status: 'ok'; user: AdminUserItem }
  | { status: 'not_found' }
  | { status: 'self_demotion_forbidden' }
  | { status: 'last_admin_demotion_forbidden' }
  | { status: 'subscription_plan_not_found' };

export const updateAdminUser = async (
  input: UpdateAdminUserInput,
): Promise<UpdateAdminUserResult> => {
  const existing = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true },
  });
  if (!existing) return { status: 'not_found' };

  if (
    input.role === Role.USER &&
    input.userId === input.actorUserId &&
    existing.role === Role.ADMIN
  ) {
    return { status: 'self_demotion_forbidden' };
  }

  if (input.role === Role.USER && existing.role === Role.ADMIN) {
    const adminsCount = await prisma.user.count({
      where: { role: Role.ADMIN },
    });
    if (adminsCount <= 1) {
      return { status: 'last_admin_demotion_forbidden' };
    }
  }

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      if (input.role !== undefined && input.role !== existing.role) {
        await tx.user.update({
          where: { id: input.userId },
          data: { role: input.role },
        });
      }

      if (input.subscriptionPlanCode) {
        await setActiveSubscriptionForUser(tx, {
          userId: input.userId,
          planCode: input.subscriptionPlanCode,
          source: 'ADMIN_OVERRIDE',
          autoRenew: false,
          metadata: {
            reason: 'admin_user_management',
          },
        });
      }

      return tx.user.findUnique({
        where: { id: input.userId },
        select: adminUserSelect,
      });
    });

    if (!updatedUser) return { status: 'not_found' };

    return {
      status: 'ok',
      user: toAdminUserItem(updatedUser),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('SUBSCRIPTION_PLAN_NOT_FOUND:')
    ) {
      return { status: 'subscription_plan_not_found' };
    }
    throw error;
  }
};

