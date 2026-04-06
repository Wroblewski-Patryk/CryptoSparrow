export type AdminSubscriptionPlanCode = "FREE" | "ADVANCED" | "PROFESSIONAL";

export type AdminSubscriptionEntitlements = {
  version: number;
  limits: {
    maxBotsTotal: number;
    maxBotsByMode: {
      PAPER: number;
      LIVE: number;
    };
    maxConcurrentBacktests: number;
  };
  features: {
    liveTrading: boolean;
    syncExternalPositions: boolean;
    manageExternalPositions: boolean;
  };
  cadence: {
    allowedIntervals: string[];
    defaultMarketScanInterval: string;
    defaultPositionScanInterval: string;
  };
  [key: string]: unknown;
};

export type AdminSubscriptionPlan = {
  code: AdminSubscriptionPlanCode;
  slug: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  monthlyPriceMinor: number;
  currency: string;
  entitlements: AdminSubscriptionEntitlements;
  updatedAt: string;
};

export type AdminSubscriptionPlansResponse = {
  plans: AdminSubscriptionPlan[];
};

export type UpdateAdminSubscriptionPlanPayload = {
  monthlyPriceMinor: number;
  currency: string;
  entitlements: AdminSubscriptionEntitlements;
};
