export type SubscriptionPlanCode = "FREE" | "ADVANCED" | "PROFESSIONAL";

export type SubscriptionCatalogItem = {
  code: SubscriptionPlanCode;
  slug: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  priceMonthlyMinor: number;
  currency: string;
  entitlements: {
    limits?: {
      maxBotsTotal?: number;
      maxBotsByMode?: {
        PAPER?: number;
        LIVE?: number;
      };
      maxConcurrentBacktests?: number;
    };
    features?: {
      liveTrading?: boolean;
      syncExternalPositions?: boolean;
      manageExternalPositions?: boolean;
    };
    cadence?: {
      allowedIntervals?: string[];
      defaultMarketScanInterval?: string;
      defaultPositionScanInterval?: string;
    };
  } | null;
};

export type ActiveSubscription = {
  id: string;
  planCode: SubscriptionPlanCode;
  planDisplayName: string;
  status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  source: "DEFAULT" | "ADMIN_OVERRIDE" | "CHECKOUT";
  autoRenew: boolean;
  startsAt: string;
  endsAt: string | null;
};

export type ProfileSubscriptionResponse = {
  catalog: SubscriptionCatalogItem[];
  activeSubscription: ActiveSubscription | null;
  activePlanCode: SubscriptionPlanCode | null;
};

