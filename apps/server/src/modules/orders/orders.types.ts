import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const ListOrdersQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  symbol: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  page: z.coerce.number().int().min(1).default(1),
});

export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;
