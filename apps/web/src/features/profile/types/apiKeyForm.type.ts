import { z } from 'zod';

export const apiKeySchema = z.object({
  label: z.string().min(2).max(100),
  exchange: z.enum(["BINANCE"]),
  apiKey: z.string().min(8).max(100),
  apiSecret: z.string().min(8).max(100),
});
export type ApiKeyFormData = z.infer<typeof apiKeySchema>;