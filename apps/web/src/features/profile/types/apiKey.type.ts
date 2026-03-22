export type ApiKey = {
  id: string;
  label: string;
  exchange: string;
  apiKey: string;
  apiSecret: string;
  syncExternalPositions: boolean;
  manageExternalPositions: boolean;
  createdAt: string;
  lastUsed?: string;
  maskedKey?: string;
};
