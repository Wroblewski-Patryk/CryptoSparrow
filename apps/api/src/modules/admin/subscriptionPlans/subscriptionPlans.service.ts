import { Prisma, SubscriptionPlanCode } from '@prisma/client';
import { prisma } from '../../../prisma/client';
import { ensureSubscriptionCatalog } from '../../subscriptions/subscriptions.service';
import { AdminSubscriptionPlanItem, UpdateAdminSubscriptionPlanDto } from './subscriptionPlans.types';

const toAdminPlanItem = (plan: {
  code: SubscriptionPlanCode;
  slug: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  monthlyPriceMinor: number;
  currency: string;
  entitlements: unknown;
  updatedAt: Date;
}): AdminSubscriptionPlanItem => ({
  code: plan.code,
  slug: plan.slug,
  displayName: plan.displayName,
  sortOrder: plan.sortOrder,
  isActive: plan.isActive,
  monthlyPriceMinor: plan.monthlyPriceMinor,
  currency: plan.currency,
  entitlements: plan.entitlements as AdminSubscriptionPlanItem['entitlements'],
  updatedAt: plan.updatedAt.toISOString(),
});

export const listAdminSubscriptionPlans = async (): Promise<AdminSubscriptionPlanItem[]> => {
  await ensureSubscriptionCatalog(prisma);

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
    select: {
      code: true,
      slug: true,
      displayName: true,
      sortOrder: true,
      isActive: true,
      monthlyPriceMinor: true,
      currency: true,
      entitlements: true,
      updatedAt: true,
    },
  });

  return plans.map((plan) => toAdminPlanItem(plan));
};

export const updateAdminSubscriptionPlan = async (
  code: SubscriptionPlanCode,
  payload: UpdateAdminSubscriptionPlanDto,
): Promise<AdminSubscriptionPlanItem | null> => {
  await ensureSubscriptionCatalog(prisma);

  const existing = await prisma.subscriptionPlan.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!existing) return null;

  const updated = await prisma.subscriptionPlan.update({
    where: { code },
    data: {
      ...(payload.displayName !== undefined ? { displayName: payload.displayName } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      ...(payload.monthlyPriceMinor !== undefined
        ? { monthlyPriceMinor: payload.monthlyPriceMinor }
        : {}),
      ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
      ...(payload.entitlements !== undefined
        ? { entitlements: payload.entitlements as Prisma.InputJsonValue }
        : {}),
    },
    select: {
      code: true,
      slug: true,
      displayName: true,
      sortOrder: true,
      isActive: true,
      monthlyPriceMinor: true,
      currency: true,
      entitlements: true,
      updatedAt: true,
    },
  });

  return toAdminPlanItem(updated);
};
