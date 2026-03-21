import { z } from 'zod';

const MarketFilterRulesSchema = z
  .object({
    minQuoteVolumeEnabled: z.boolean().default(false),
    minQuoteVolume24h: z.number().nonnegative().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.minQuoteVolumeEnabled && typeof value.minQuoteVolume24h !== 'number') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minQuoteVolume24h is required when minQuoteVolumeEnabled is true',
        path: ['minQuoteVolume24h'],
      });
    }
  });

export const MarketUniverseCreateSchema = z.object({
  name: z.string().trim().min(1),
  marketType: z.enum(['FUTURES', 'SPOT']).default('FUTURES'),
  baseCurrency: z.string().trim().min(2).max(16).default('USDT'),
  filterRules: MarketFilterRulesSchema.optional(),
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
