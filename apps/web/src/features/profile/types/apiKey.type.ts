import type { ExchangeOption } from "@/features/exchanges/exchangeCapabilities";

export type ApiKey = {
  id: string;
  label: string;
  exchange: ExchangeOption;
  apiKey: string;
  apiSecret: string;
  syncExternalPositions: boolean;
  manageExternalPositions: boolean;
  createdAt: string;
  lastUsed?: string;
  maskedKey?: string;
};
