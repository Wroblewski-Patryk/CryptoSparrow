import { z } from 'zod';
import { EXCHANGE_OPTIONS } from '@/features/exchanges/exchangeCapabilities';

export const apiKeySchema = z.object({
  label: z.string().min(2).max(100),
  exchange: z.enum(EXCHANGE_OPTIONS),
  apiKey: z.string().min(8).max(100),
  apiSecret: z.string().min(8).max(100),
});
export type ApiKeyFormData = z.infer<typeof apiKeySchema>;
