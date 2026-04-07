import {
  Role,
  SubscriptionPlanCode,
  UserSubscriptionSource,
} from '@prisma/client';
import { z } from 'zod';

const positiveIntSchema = z.coerce.number().int().min(1);

export const AdminUsersListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  role: z.nativeEnum(Role).optional(),
  page: positiveIntSchema.default(1),
  pageSize: positiveIntSchema.max(100).default(20),
});

export const AdminUserParamsSchema = z.object({
  userId: z.string().cuid(),
});

export const UpdateAdminUserSchema = z
  .object({
    role: z.nativeEnum(Role).optional(),
    subscriptionPlanCode: z.nativeEnum(SubscriptionPlanCode).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === undefined && value.subscriptionPlanCode === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at least one field is required',
      });
    }
  });

export type AdminUsersListQueryDto = z.infer<typeof AdminUsersListQuerySchema>;
export type AdminUserParamsDto = z.infer<typeof AdminUserParamsSchema>;
export type UpdateAdminUserDto = z.infer<typeof UpdateAdminUserSchema>;

export type AdminUserActiveSubscriptionItem = {
  planCode: SubscriptionPlanCode;
  planDisplayName: string;
  source: UserSubscriptionSource;
  startsAt: string;
  endsAt: string | null;
};

export type AdminUserItem = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
  activeSubscription: AdminUserActiveSubscriptionItem | null;
};

export type AdminUsersListResult = {
  users: AdminUserItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

