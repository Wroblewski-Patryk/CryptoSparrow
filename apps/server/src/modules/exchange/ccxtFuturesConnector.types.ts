import { z } from 'zod';

export const CcxtFuturesConnectorConfigSchema = z.object({
  exchangeId: z.string().trim().min(1),
  apiKey: z.string().trim().min(1).optional(),
  secret: z.string().trim().min(1).optional(),
  password: z.string().trim().min(1).optional(),
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
  clientOrderId: z.string().trim().min(1).optional(),
});

export type CcxtFuturesConnectorConfig = z.input<typeof CcxtFuturesConnectorConfigSchema>;
export type CcxtFuturesOrderRequest = z.input<typeof CcxtFuturesOrderRequestSchema>;

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
  raw: unknown;
};
