import { z } from 'zod';
import { OhlcvCandle } from './marketData.types';

export const IndicatorKindSchema = z.enum(['SMA', 'EMA', 'RSI']);
export type IndicatorKind = z.infer<typeof IndicatorKindSchema>;

export const IndicatorRequestSchema = z.object({
  kind: IndicatorKindSchema,
  period: z.number().int().min(2).max(500),
});

export type IndicatorRequest = z.infer<typeof IndicatorRequestSchema>;

export type IndicatorResultPoint = {
  timestamp: number;
  value: number | null;
};

export interface IndicatorAdapter {
  calculate(input: IndicatorRequest, candles: OhlcvCandle[]): IndicatorResultPoint[];
}
