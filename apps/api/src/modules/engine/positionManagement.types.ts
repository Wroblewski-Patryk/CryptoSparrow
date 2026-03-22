import { z } from 'zod';

export const PositionSideSchema = z.enum(['LONG', 'SHORT']);

export const TrailingStopConfigSchema = z.object({
  enabled: z.boolean().default(false),
  type: z.enum(['percent', 'absolute']).default('percent'),
  value: z.number().positive(),
});

export const DcaConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxAdds: z.number().int().min(0).default(0),
  stepPercent: z.number().positive().max(1).default(0.01),
  addSizeFraction: z.number().positive().max(2).default(0.5),
});

export const PositionManagementInputSchema = z.object({
  side: PositionSideSchema,
  currentPrice: z.number().positive(),
  takeProfitPrice: z.number().positive().optional(),
  stopLossPrice: z.number().positive().optional(),
  trailingStop: TrailingStopConfigSchema.optional(),
  dca: DcaConfigSchema.optional(),
});

export const PositionManagementStateSchema = z.object({
  averageEntryPrice: z.number().positive(),
  quantity: z.number().positive(),
  currentAdds: z.number().int().min(0).default(0),
  trailingAnchorPrice: z.number().positive().optional(),
  lastDcaPrice: z.number().positive().optional(),
});

export type PositionManagementInput = z.input<typeof PositionManagementInputSchema>;
export type PositionManagementState = z.infer<typeof PositionManagementStateSchema>;

export type PositionManagementResult = {
  shouldClose: boolean;
  closeReason?: 'take_profit' | 'stop_loss' | 'trailing_stop';
  dcaExecuted: boolean;
  dcaAddedQuantity: number;
  nextState: PositionManagementState;
};
