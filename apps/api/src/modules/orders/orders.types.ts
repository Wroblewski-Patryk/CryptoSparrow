import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const ListOrdersQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  symbol: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  page: z.coerce.number().int().min(1).default(1),
});

export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;

export const OrderExecutionModeSchema = z.enum(['PAPER', 'LIVE']);

export const OpenOrderSchema = z.object({
  botId: z.string().uuid().optional(),
  strategyId: z.string().uuid().optional(),
  symbol: z.string().trim().min(1),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'TAKE_PROFIT', 'TRAILING']),
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  mode: OrderExecutionModeSchema.default('PAPER'),
  riskAck: z.boolean().default(false),
});

export const CancelOrderSchema = z.object({
  riskAck: z.boolean().default(false),
});

export const CloseOrderSchema = z.object({
  riskAck: z.boolean().default(false),
});

export type OpenOrderDto = z.infer<typeof OpenOrderSchema>;
export type CancelOrderDto = z.infer<typeof CancelOrderSchema>;
export type CloseOrderDto = z.infer<typeof CloseOrderSchema>;
