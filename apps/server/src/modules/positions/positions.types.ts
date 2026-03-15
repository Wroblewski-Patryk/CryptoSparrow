import { PositionStatus } from '@prisma/client';
import { z } from 'zod';

export const ListPositionsQuerySchema = z.object({
  status: z.nativeEnum(PositionStatus).optional(),
  symbol: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListPositionsQuery = z.infer<typeof ListPositionsQuerySchema>;
