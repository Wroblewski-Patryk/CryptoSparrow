import { z } from 'zod';

export const BotModeSchema = z.enum(['PAPER', 'LIVE', 'LOCAL']);

export const CreateBotSchema = z.object({
  name: z.string().trim().min(1),
  mode: BotModeSchema.default('PAPER'),
  isActive: z.boolean().default(false),
  liveOptIn: z.boolean().default(false),
  maxOpenPositions: z.number().int().min(1).max(100).default(1),
});

export const UpdateBotSchema = CreateBotSchema.partial();

export type CreateBotDto = z.infer<typeof CreateBotSchema>;
export type UpdateBotDto = z.infer<typeof UpdateBotSchema>;
