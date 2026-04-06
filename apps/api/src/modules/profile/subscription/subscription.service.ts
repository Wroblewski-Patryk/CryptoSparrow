import { prisma } from '../../../prisma/client';
import { ensureDefaultSubscriptionForUser, ensureSubscriptionCatalog } from '../../subscriptions/subscriptions.service';
import { ProfileSubscriptionResponse } from './subscription.types';

const toIso = (value: Date | null) => (value ? value.toISOString() : null);

export const getProfileSubscription = async (userId: string): Promise<ProfileSubscriptionResponse> => {
  await ensureSubscriptionCatalog(prisma);
  await ensureDefaultSubscriptionForUser(prisma, userId);

  const [catalog, active] = await Promise.all([
    prisma.subscriptionPlan.findMany({
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
      },
    }),
    prisma.userSubscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: { startsAt: 'desc' },
      include: {
        subscriptionPlan: {
          select: {
            code: true,
            displayName: true,
          },
        },
      },
    }),
  ]);

  return {
    catalog: catalog.map((plan) => ({
      code: plan.code,
      slug: plan.slug,
      displayName: plan.displayName,
      sortOrder: plan.sortOrder,
      isActive: plan.isActive,
      priceMonthlyMinor: plan.monthlyPriceMinor,
      currency: plan.currency,
      entitlements: plan.entitlements,
    })),
    activeSubscription: active
      ? {
          id: active.id,
          planCode: active.subscriptionPlan.code,
          planDisplayName: active.subscriptionPlan.displayName,
          status: active.status,
          source: active.source,
          autoRenew: active.autoRenew,
          startsAt: active.startsAt.toISOString(),
          endsAt: toIso(active.endsAt),
        }
      : null,
    activePlanCode: active?.subscriptionPlan.code ?? null,
  };
};

