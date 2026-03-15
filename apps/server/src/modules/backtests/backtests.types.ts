import { BacktestStatus } from '@prisma/client';
import { z } from 'zod';

export const CreateBacktestRunSchema = z.object({
  name: z.string().trim().min(1),
  symbol: z.string().trim().min(1),
  timeframe: z.string().trim().min(1),
  strategyId: z.string().trim().min(1).optional(),
  seedConfig: z.any().optional(),
  notes: z.string().trim().optional(),
});

export const ListBacktestRunsQuerySchema = z.object({
  status: z.nativeEnum(BacktestStatus).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateBacktestRunDto = z.infer<typeof CreateBacktestRunSchema>;
export type ListBacktestRunsQuery = z.infer<typeof ListBacktestRunsQuerySchema>;
