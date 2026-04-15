import { Prisma, PrismaClient, SubscriptionPlanCode, UserSubscriptionSource } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { subscriptionErrors } from './subscriptions.errors';

type DbClient = PrismaClient | Prisma.TransactionClient;
type EnsureSubscriptionCatalogOptions = {
  seedDefaults?: boolean;
};

type SetActiveSubscriptionInput = {
  userId: string;
  planCode: SubscriptionPlanCode;
  source: UserSubscriptionSource;
  autoRenew?: boolean;
  metadata?: Prisma.InputJsonValue;
};

type SubscriptionPlanSeed = {
  code: SubscriptionPlanCode;
  slug: string;
  displayName: string;
  sortOrder: number;
  monthlyPriceMinor: number;
  currency: string;
  entitlements: Prisma.InputJsonValue;
};

export const OWNER_ACCOUNT_EMAIL = 'wroblewskipatryk@gmail.com';

export const SUBSCRIPTION_PLAN_SEED: SubscriptionPlanSeed[] = [
  {
    code: 'FREE',
    slug: 'free',
    displayName: 'Free',
    sortOrder: 1,
    monthlyPriceMinor: 0,
    currency: 'USD',
    entitlements: {
      version: 1,
      limits: {
        maxBotsTotal: 1,
        maxBotsByMode: { PAPER: 1, LIVE: 0 },
        maxConcurrentBacktests: 1,
      },
      features: {
        liveTrading: false,
        syncExternalPositions: true,
        manageExternalPositions: false,
      },
      cadence: {
        allowedIntervals: ['5m', '15m'],
        defaultMarketScanInterval: '5m',
        defaultPositionScanInterval: '5m',
      },
    } satisfies Prisma.InputJsonValue,
  },
  {
    code: 'ADVANCED',
    slug: 'advanced',
    displayName: 'Advanced',
    sortOrder: 2,
    monthlyPriceMinor: 4900,
    currency: 'USD',
    entitlements: {
      version: 1,
      limits: {
        maxBotsTotal: 3,
        maxBotsByMode: { PAPER: 3, LIVE: 3 },
        maxConcurrentBacktests: 3,
      },
      features: {
        liveTrading: true,
        syncExternalPositions: true,
        manageExternalPositions: true,
      },
      cadence: {
        allowedIntervals: ['1m', '5m', '15m', '30m', '1h'],
        defaultMarketScanInterval: '1h',
        defaultPositionScanInterval: '1h',
      },
    } satisfies Prisma.InputJsonValue,
  },
  {
    code: 'PROFESSIONAL',
    slug: 'professional',
    displayName: 'Professional',
    sortOrder: 3,
    monthlyPriceMinor: 14900,
    currency: 'USD',
    entitlements: {
      version: 1,
      limits: {
        maxBotsTotal: 10,
        maxBotsByMode: { PAPER: 10, LIVE: 10 },
        maxConcurrentBacktests: 10,
      },
      features: {
        liveTrading: true,
        syncExternalPositions: true,
        manageExternalPositions: true,
      },
      cadence: {
        allowedIntervals: ['1m', '5m', '15m', '30m', '1h', '4h', '8h', '12h', '1d', '1w', '1M'],
        defaultMarketScanInterval: '1m',
        defaultPositionScanInterval: '1m',
      },
    } satisfies Prisma.InputJsonValue,
  },
];

export const ensureSubscriptionCatalog = async (
  db: DbClient = prisma,
  options: EnsureSubscriptionCatalogOptions = {},
) => {
  const shouldSeedDefaults = options.seedDefaults === true;

  for (const plan of SUBSCRIPTION_PLAN_SEED) {
    await db.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: shouldSeedDefaults
        ? {
            slug: plan.slug,
            displayName: plan.displayName,
            isActive: true,
            sortOrder: plan.sortOrder,
            monthlyPriceMinor: plan.monthlyPriceMinor,
            currency: plan.currency,
            entitlements: plan.entitlements,
          }
        : {},
      create: {
        code: plan.code,
        slug: plan.slug,
        displayName: plan.displayName,
        sortOrder: plan.sortOrder,
        monthlyPriceMinor: plan.monthlyPriceMinor,
        currency: plan.currency,
        entitlements: plan.entitlements,
      },
    });
  }
};

export const setActiveSubscriptionForUser = async (db: DbClient, input: SetActiveSubscriptionInput) => {
  const plan = await db.subscriptionPlan.findUnique({
    where: { code: input.planCode },
    select: { id: true, code: true },
  });
  if (!plan) {
    throw subscriptionErrors.subscriptionPlanNotFound(input.planCode);
  }

  const existingActive = await db.userSubscription.findFirst({
    where: {
      userId: input.userId,
      status: 'ACTIVE',
    },
    include: {
      subscriptionPlan: {
        select: { code: true },
      },
    },
    orderBy: { startsAt: 'desc' },
  });

  if (
    existingActive &&
    existingActive.subscriptionPlan.code === input.planCode &&
    existingActive.source === input.source &&
    existingActive.autoRenew === (input.autoRenew ?? true)
  ) {
    return existingActive;
  }

  await db.userSubscription.updateMany({
    where: {
      userId: input.userId,
      status: 'ACTIVE',
    },
    data: {
      status: 'CANCELED',
      endsAt: new Date(),
    },
  });

  return db.userSubscription.create({
    data: {
      userId: input.userId,
      subscriptionPlanId: plan.id,
      status: 'ACTIVE',
      source: input.source,
      autoRenew: input.autoRenew ?? true,
      startsAt: new Date(),
      metadata: input.metadata,
    },
  });
};

export const ensureDefaultSubscriptionForUser = async (db: DbClient, userId: string) => {
  const active = await db.userSubscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (active) return active;

  return setActiveSubscriptionForUser(db, {
    userId,
    planCode: 'FREE',
    source: 'DEFAULT',
    autoRenew: true,
  });
};
