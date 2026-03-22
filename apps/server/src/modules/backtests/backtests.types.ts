import { BacktestStatus } from '@prisma/client';
import { z } from 'zod';

export const CreateBacktestRunSchema = z.object({
  name: z.string().trim().min(1),
  symbol: z.string().trim().min(1).optional(),
  timeframe: z.string().trim().min(1),
  strategyId: z.string().trim().min(1).optional(),
  marketUniverseId: z.string().uuid().optional(),
  seedConfig: z.any().optional(),
  notes: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (!value.symbol && !value.marketUniverseId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide symbol or marketUniverseId',
      path: ['symbol'],
    });
  }
});

export const ListBacktestRunsQuerySchema = z.object({
  status: z.nativeEnum(BacktestStatus).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const ListBacktestTradesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type CreateBacktestRunDto = z.infer<typeof CreateBacktestRunSchema>;
export type ListBacktestRunsQuery = z.infer<typeof ListBacktestRunsQuerySchema>;
export type ListBacktestTradesQuery = z.infer<typeof ListBacktestTradesQuerySchema>;
