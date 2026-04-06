import {
  PaymentIntentStatus,
  PaymentProvider,
  SubscriptionPlanCode,
  UserSubscriptionSource,
  UserSubscriptionStatus,
} from '@prisma/client';

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

export type CreateSubscriptionCheckoutIntentRequest = {
  planCode: SubscriptionPlanCode;
  successUrl?: string;
  cancelUrl?: string;
};

export type ProfileCheckoutIntentResponse = {
  id: string;
  planCode: SubscriptionPlanCode;
  provider: PaymentProvider;
  status: PaymentIntentStatus;
  amountMinor: number;
  currency: string;
  checkoutUrl: string | null;
  clientSecret: string | null;
  expiresAt: string | null;
  createdAt: string;
};
