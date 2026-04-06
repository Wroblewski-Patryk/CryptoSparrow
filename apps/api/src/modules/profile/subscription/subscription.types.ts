import { SubscriptionPlanCode, UserSubscriptionSource, UserSubscriptionStatus } from '@prisma/client';

export type ProfileSubscriptionCatalogItem = {
  code: SubscriptionPlanCode;
  slug: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  priceMonthlyMinor: number;
  currency: string;
  entitlements: unknown;
};

export type ProfileActiveSubscription = {
  id: string;
  planCode: SubscriptionPlanCode;
  planDisplayName: string;
  status: UserSubscriptionStatus;
  source: UserSubscriptionSource;
  autoRenew: boolean;
  startsAt: string;
  endsAt: string | null;
};

export type ProfileSubscriptionResponse = {
  catalog: ProfileSubscriptionCatalogItem[];
  activeSubscription: ProfileActiveSubscription | null;
  activePlanCode: SubscriptionPlanCode | null;
};

