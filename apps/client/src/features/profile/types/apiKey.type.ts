export type ApiKey = {
  id: string;
  label: string;
  exchange: string;
  apiKey: string;
  apiSecret: string;
  createdAt: string;
  lastUsed?: string;
  maskedKey?: string;
};