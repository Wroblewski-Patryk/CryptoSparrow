import { BotMode, Prisma, PrismaClient, SubscriptionPlanCode } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../prisma/client';
import {
  ensureDefaultSubscriptionForUser,
  ensureSubscriptionCatalog,
  SUBSCRIPTION_PLAN_SEED,
} from './subscriptions.service';

type DbClient = PrismaClient | Prisma.TransactionClient;

const subscriptionEntitlementsSchema = z
  .object({
    version: z.number().int().min(1),
    limits: z.object({
      maxBotsTotal: z.number().int().min(0),
      maxBotsByMode: z.object({
        PAPER: z.number().int().min(0),
        LIVE: z.number().int().min(0),
      }),
      maxConcurrentBacktests: z.number().int().min(1),
    }),
    features: z.object({
      liveTrading: z.boolean(),
      syncExternalPositions: z.boolean(),
      manageExternalPositions: z.boolean(),
    }),
    cadence: z.object({
      allowedIntervals: z.array(z.string().min(1)).min(1),
      defaultMarketScanInterval: z.string().min(1),
      defaultPositionScanInterval: z.string().min(1),
    }),
  })
  .passthrough()
  .refine((value) => value.limits.maxBotsByMode.PAPER <= value.limits.maxBotsTotal, {
    message: 'PAPER mode bot limit cannot exceed maxBotsTotal',
    path: ['limits', 'maxBotsByMode', 'PAPER'],
  })
  .refine((value) => value.limits.maxBotsByMode.LIVE <= value.limits.maxBotsTotal, {
    message: 'LIVE mode bot limit cannot exceed maxBotsTotal',
    path: ['limits', 'maxBotsByMode', 'LIVE'],
  })
  .refine(
    (value) => value.cadence.allowedIntervals.includes(value.cadence.defaultMarketScanInterval),
    {
      message: 'defaultMarketScanInterval must be included in allowedIntervals',
      path: ['cadence', 'defaultMarketScanInterval'],
    },
  )
  .refine(
    (value) => value.cadence.allowedIntervals.includes(value.cadence.defaultPositionScanInterval),
    {
      message: 'defaultPositionScanInterval must be included in allowedIntervals',
      path: ['cadence', 'defaultPositionScanInterval'],
    },
  );

export type SubscriptionEntitlements = z.infer<typeof subscriptionEntitlementsSchema>;

const freeEntitlementsSeed = SUBSCRIPTION_PLAN_SEED.find((item) => item.code === 'FREE')?.entitlements;
if (!freeEntitlementsSeed) {
  throw new Error('FREE_SUBSCRIPTION_ENTITLEMENTS_MISSING');
}

const fallbackEntitlements = subscriptionEntitlementsSchema.parse(freeEntitlementsSeed);

export type UserEntitlementsContext = {
  planCode: SubscriptionPlanCode;
  planDisplayName: string;
  entitlements: SubscriptionEntitlements;
};

type BotLimitDetails = {
  planCode: SubscriptionPlanCode;
  planDisplayName: string;
  maxBotsTotal: number;
  currentBotsTotal: number;
  requestedBotsTotal: number;
};

export class SubscriptionBotLimitError extends Error {
  readonly details: BotLimitDetails;

  constructor(details: BotLimitDetails) {
    super('SUBSCRIPTION_BOT_LIMIT_TOTAL_REACHED');
    this.name = 'SubscriptionBotLimitError';
    this.details = details;
  }
}

const coerceEntitlements = (raw: unknown): SubscriptionEntitlements => {
  const parsed = subscriptionEntitlementsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return fallbackEntitlements;
};

export const resolveUserEntitlementsContext = async (
  userId: string,
  db: DbClient = prisma,
): Promise<UserEntitlementsContext> => {
  await ensureSubscriptionCatalog(db);
  await ensureDefaultSubscriptionForUser(db, userId);

  const active = await db.userSubscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
    },
    include: {
      subscriptionPlan: {
        select: {
          code: true,
          displayName: true,
          entitlements: true,
        },
      },
    },
    orderBy: {
      startsAt: 'desc',
    },
  });

  if (!active) {
    return {
      planCode: 'FREE',
      planDisplayName: 'Free',
      entitlements: fallbackEntitlements,
    };
  }

  return {
    planCode: active.subscriptionPlan.code,
    planDisplayName: active.subscriptionPlan.displayName,
    entitlements: coerceEntitlements(active.subscriptionPlan.entitlements),
  };
};

export const assertSubscriptionAllowsBotCreate = async (
  userId: string,
  mode: BotMode,
  db: DbClient = prisma,
) => {
  const context = await resolveUserEntitlementsContext(userId, db);
  const currentBotsTotal = await db.bot.count({
    where: { userId },
  });
  const requestedBotsTotal = currentBotsTotal + 1;

  if (requestedBotsTotal > context.entitlements.limits.maxBotsTotal) {
    throw new SubscriptionBotLimitError({
      planCode: context.planCode,
      planDisplayName: context.planDisplayName,
      maxBotsTotal: context.entitlements.limits.maxBotsTotal,
      currentBotsTotal,
      requestedBotsTotal,
    });
  }

  const modeCap = context.entitlements.limits.maxBotsByMode[mode];
  const currentModeBots = await db.bot.count({
    where: {
      userId,
      mode,
    },
  });
  const requestedModeBots = currentModeBots + 1;
  if (requestedModeBots > modeCap) {
    throw new SubscriptionBotLimitError({
      planCode: context.planCode,
      planDisplayName: context.planDisplayName,
      maxBotsTotal: context.entitlements.limits.maxBotsTotal,
      currentBotsTotal,
      requestedBotsTotal,
    });
  }
};
