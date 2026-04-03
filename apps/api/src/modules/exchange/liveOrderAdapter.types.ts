import { z } from 'zod';
import { CcxtFuturesOrderRequestSchema } from './ccxtFuturesConnector.types';
import type { LiveFeeReconciliationResult } from './liveFeeReconciliation.service';

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
export type PlaceLiveOrderWithFeesResult = {
  exchangeOrderId: string | null;
  status: string | undefined;
  fee: LiveFeeReconciliationResult['fee'];
  feeSource: LiveFeeReconciliationResult['feeSource'];
  feePending: LiveFeeReconciliationResult['feePending'];
  feeCurrency: LiveFeeReconciliationResult['feeCurrency'];
  effectiveFeeRate: LiveFeeReconciliationResult['effectiveFeeRate'];
  exchangeTradeId: LiveFeeReconciliationResult['exchangeTradeId'];
  fills: LiveFeeReconciliationResult['fills'];
  rawOrderStatus?: string;
};
