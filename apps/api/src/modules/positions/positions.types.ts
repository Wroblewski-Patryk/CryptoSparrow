import { PositionStatus } from '@prisma/client';
import { z } from 'zod';

export const ListPositionsQuerySchema = z.object({
  status: z.nativeEnum(PositionStatus).optional(),
  symbol: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  page: z.coerce.number().int().min(1).default(1),
});

export type ListPositionsQuery = z.infer<typeof ListPositionsQuerySchema>;

export const UpdatePositionManagementModeSchema = z.object({
  managementMode: z.enum(['BOT_MANAGED', 'MANUAL_MANAGED']),
});

export type UpdatePositionManagementModeInput = z.infer<typeof UpdatePositionManagementModeSchema>;
