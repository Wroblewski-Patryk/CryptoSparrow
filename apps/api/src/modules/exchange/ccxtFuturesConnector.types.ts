import { z } from 'zod';

const CcxtMarketTypeSchema = z
  .enum(['future', 'spot', 'FUTURES', 'SPOT'])
  .transform((value) => (value === 'FUTURES' ? 'future' : value === 'SPOT' ? 'spot' : value));

export const CcxtFuturesConnectorConfigSchema = z.object({
  exchangeId: z.string().trim().min(1),
  apiKey: z.string().trim().min(1).optional(),
  secret: z.string().trim().min(1).optional(),
  password: z.string().trim().min(1).optional(),
  marketType: CcxtMarketTypeSchema.default('future'),
  sandbox: z.boolean().default(false),
  enableRateLimit: z.boolean().default(true),
});

export const CcxtFuturesOrderRequestSchema = z.object({
  symbol: z.string().trim().min(1),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit']),
  amount: z.number().positive(),
  price: z.number().positive().optional(),
  reduceOnly: z.boolean().optional(),
  positionMode: z.enum(['ONE_WAY', 'HEDGE']).optional(),
  positionSide: z.enum(['LONG', 'SHORT']).optional(),
  clientOrderId: z.string().trim().min(1).optional(),
});

export const CcxtFetchOrderWithFillsInputSchema = z.object({
  symbol: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
});

export const CcxtFetchTradesForOrderInputSchema = z.object({
  symbol: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  since: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
});

export type CcxtFuturesConnectorConfig = z.input<typeof CcxtFuturesConnectorConfigSchema>;
export type CcxtFuturesOrderRequest = z.input<typeof CcxtFuturesOrderRequestSchema>;
export type CcxtFetchOrderWithFillsInput = z.input<typeof CcxtFetchOrderWithFillsInputSchema>;
export type CcxtFetchTradesForOrderInput = z.input<typeof CcxtFetchTradesForOrderInputSchema>;

export type CcxtFuturesOrderFill = {
  exchangeTradeId: string | null;
  exchangeOrderId: string | null;
  symbol: string;
  side: string | null;
  price: number;
  quantity: number;
  notional: number;
  feeCost: number;
  feeCurrency: string | null;
  feeRate: number | null;
  executedAt: Date | null;
  source: 'createOrder' | 'fetchOrder' | 'fetchMyTrades';
  raw: unknown;
};

export type CcxtFuturesOrderResult = {
  id: string;
  status?: string;
  symbol?: string;
  side?: string;
  type?: string;
  amount?: number;
  filled?: number;
  price?: number;
  average?: number;
  fills?: CcxtFuturesOrderFill[];
  raw: unknown;
};
