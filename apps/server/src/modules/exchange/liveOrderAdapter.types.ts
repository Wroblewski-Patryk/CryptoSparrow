import { z } from 'zod';
import { CcxtFuturesOrderRequestSchema } from './ccxtFuturesConnector.types';

export const LiveOrderRetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(3),
  baseDelayMs: z.number().int().min(0).max(60_000).default(300),
});

export const PlaceLiveOrderInputSchema = z.object({
  order: CcxtFuturesOrderRequestSchema,
  retryPolicy: LiveOrderRetryPolicySchema.default({
    maxAttempts: 3,
    baseDelayMs: 300,
  }),
});

export type LiveOrderRetryPolicy = z.infer<typeof LiveOrderRetryPolicySchema>;
export type PlaceLiveOrderInput = z.input<typeof PlaceLiveOrderInputSchema>;
