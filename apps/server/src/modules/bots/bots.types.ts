import { z } from 'zod';

export const BotModeSchema = z.enum(['PAPER', 'LIVE', 'LOCAL']);
export const TradeMarketSchema = z.enum(['FUTURES', 'SPOT']);

export const CreateBotSchema = z.object({
  name: z.string().trim().min(1),
  mode: BotModeSchema.default('PAPER'),
  marketType: TradeMarketSchema.default('FUTURES'),
  isActive: z.boolean().default(false),
  liveOptIn: z.boolean().default(false),
  consentTextVersion: z.string().trim().min(1).max(64).optional().nullable(),
  maxOpenPositions: z.number().int().min(1).max(100).default(1),
}).superRefine((value, ctx) => {
  if (value.liveOptIn && !value.consentTextVersion) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'consentTextVersion is required when liveOptIn is enabled',
      path: ['consentTextVersion'],
    });
  }
});

export const UpdateBotSchema = CreateBotSchema.partial();

export type CreateBotDto = z.infer<typeof CreateBotSchema>;
export type UpdateBotDto = z.infer<typeof UpdateBotSchema>;
