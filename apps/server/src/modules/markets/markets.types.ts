import { z } from 'zod';

export const MarketUniverseCreateSchema = z.object({
  name: z.string().trim().min(1),
  marketType: z.enum(['FUTURES', 'SPOT']).default('FUTURES'),
  baseCurrency: z.string().trim().min(2).max(16).default('USDT'),
  filterRules: z.any().optional(),
  whitelist: z.array(z.string().trim().min(1)).default([]),
  blacklist: z.array(z.string().trim().min(1)).default([]),
  autoExcludeRules: z.any().optional(),
});

export const MarketUniverseUpdateSchema = MarketUniverseCreateSchema.partial();

export const MarketCatalogQuerySchema = z.object({
  baseCurrency: z.string().trim().min(2).max(16).optional(),
  marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
});

export type CreateMarketUniverseDto = z.infer<typeof MarketUniverseCreateSchema>;
export type UpdateMarketUniverseDto = z.infer<typeof MarketUniverseUpdateSchema>;
export type MarketCatalogQueryDto = z.infer<typeof MarketCatalogQuerySchema>;
