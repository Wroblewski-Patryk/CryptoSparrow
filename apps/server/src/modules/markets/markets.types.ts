import { z } from 'zod';

export const MarketUniverseCreateSchema = z.object({
  name: z.string().trim().min(1),
  baseCurrency: z.string().trim().min(2).max(16).default('USDT'),
  filterRules: z.any().optional(),
  whitelist: z.array(z.string().trim().min(1)).default([]),
  blacklist: z.array(z.string().trim().min(1)).default([]),
  autoExcludeRules: z.any().optional(),
});

export const MarketUniverseUpdateSchema = MarketUniverseCreateSchema.partial();

export type CreateMarketUniverseDto = z.infer<typeof MarketUniverseCreateSchema>;
export type UpdateMarketUniverseDto = z.infer<typeof MarketUniverseUpdateSchema>;
