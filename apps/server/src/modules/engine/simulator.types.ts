import { z } from 'zod';

export const SimulatorSideSchema = z.enum(['LONG', 'SHORT']);

export const SimulatorInputSchema = z.object({
  side: SimulatorSideSchema,
  entryPrice: z.number().positive(),
  exitPrice: z.number().positive(),
  quantity: z.number().positive(),
  feeRate: z.number().min(0).default(0),
  slippageRate: z.number().min(0).default(0),
  fundingRate: z.number().default(0),
});

export type SimulatorInput = z.input<typeof SimulatorInputSchema>;

export type SimulatorResult = {
  grossPnl: number;
  fees: number;
  slippageCost: number;
  fundingCost: number;
  netPnl: number;
};
