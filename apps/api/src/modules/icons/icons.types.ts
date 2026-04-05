import { z } from 'zod';

const normalizeSymbolsInput = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : [value];
  const tokens = values.flatMap((item) => {
    if (typeof item !== 'string') return [];
    return item.split(',');
  });

  return tokens
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
};

export const CoinIconLookupQuerySchema = z.object({
  symbols: z.preprocess(
    normalizeSymbolsInput,
    z.array(z.string().min(2).max(64)).min(1).max(200)
  ),
});

export type CoinIconLookupQuery = z.infer<typeof CoinIconLookupQuerySchema>;

