import { z } from 'zod';

export const EngineOrderTypeSchema = z.enum([
  'MARKET',
  'LIMIT',
  'STOP',
  'STOP_LIMIT',
  'TAKE_PROFIT',
  'TRAILING',
]);

export const EngineOrderSideSchema = z.enum(['BUY', 'SELL']);

export const OrderEvaluationInputSchema = z.object({
  type: EngineOrderTypeSchema,
  side: EngineOrderSideSchema,
  quantity: z.number().positive(),
  markPrice: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  trailingOffsetPercent: z.number().positive().max(1).optional(),
});

export type EngineOrderType = z.infer<typeof EngineOrderTypeSchema>;
export type EngineOrderSide = z.infer<typeof EngineOrderSideSchema>;
export type OrderEvaluationInput = z.input<typeof OrderEvaluationInputSchema>;

export type OrderEvaluationState = {
  stopTriggered?: boolean;
  trailingAnchorPrice?: number;
};

export type OrderEvaluationResult = {
  shouldExecute: boolean;
  reason: string;
  nextState: OrderEvaluationState;
};
