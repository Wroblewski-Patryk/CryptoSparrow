import { z } from "zod";

export const apiKeySchema = z.object({
  label: z.string().min(2).max(100),
  exchange: z.enum(["BINANCE", "BYBIT", "OKX", "KRAKEN", "COINBASE"]),
  apiKey: z.string().min(8).max(100),
  apiSecret: z.string().min(8).max(100),
  syncExternalPositions: z.boolean().optional().default(true),
  manageExternalPositions: z.boolean().optional().default(false),
});

export const apiKeyRotateSchema = z.object({
  apiKey: z.string().min(8).max(100),
  apiSecret: z.string().min(8).max(100),
});

export const apiKeyTestSchema = z.object({
  exchange: z.enum(["BINANCE", "BYBIT", "OKX", "KRAKEN", "COINBASE"]),
  apiKey: z.string().min(8).max(100),
  apiSecret: z.string().min(8).max(100),
});

export type ApiKeyFormData = z.infer<typeof apiKeySchema>;
export type ApiKeyRotateFormData = z.infer<typeof apiKeyRotateSchema>;
export type ApiKeyTestFormData = z.infer<typeof apiKeyTestSchema>;
