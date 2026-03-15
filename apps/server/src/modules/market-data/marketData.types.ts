import { z } from 'zod';

export const OhlcvRequestSchema = z.object({
  symbol: z.string().trim().min(1),
  timeframe: z.string().trim().min(1),
  limit: z.number().int().min(1).max(1000).default(200),
});

export type OhlcvRequest = z.infer<typeof OhlcvRequestSchema>;

export interface OhlcvCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
