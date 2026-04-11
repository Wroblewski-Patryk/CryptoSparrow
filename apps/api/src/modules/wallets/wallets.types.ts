import { z } from 'zod';

export const WalletModeSchema = z.enum(['PAPER', 'LIVE']);
export const WalletAllocationModeSchema = z.enum(['PERCENT', 'FIXED']);

export const CreateWalletSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    mode: WalletModeSchema.default('PAPER'),
    exchange: z.enum(['BINANCE', 'BYBIT', 'OKX', 'KRAKEN', 'COINBASE']).default('BINANCE'),
    marketType: z.enum(['FUTURES', 'SPOT']).default('FUTURES'),
    baseCurrency: z.string().trim().min(2).max(16).default('USDT'),
    paperInitialBalance: z.number().min(0).max(1_000_000_000).default(10_000),
    liveAllocationMode: WalletAllocationModeSchema.optional().nullable(),
    liveAllocationValue: z.number().positive().max(1_000_000_000).optional().nullable(),
    apiKeyId: z.string().trim().min(1).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'PAPER') {
      return;
    }

    if (!value.apiKeyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'apiKeyId is required for LIVE wallet',
        path: ['apiKeyId'],
      });
    }

    if (!value.liveAllocationMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'liveAllocationMode is required for LIVE wallet',
        path: ['liveAllocationMode'],
      });
    }

    if (
      typeof value.liveAllocationValue !== 'number' ||
      !Number.isFinite(value.liveAllocationValue) ||
      value.liveAllocationValue <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'liveAllocationValue is required for LIVE wallet',
        path: ['liveAllocationValue'],
      });
      return;
    }

    if (value.liveAllocationMode === 'PERCENT' && value.liveAllocationValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'liveAllocationValue cannot exceed 100 for PERCENT mode',
        path: ['liveAllocationValue'],
      });
    }
  });

export const UpdateWalletSchema = CreateWalletSchema.partial();

export const ListWalletsQuerySchema = z.object({
  mode: WalletModeSchema.optional(),
  marketType: z.enum(['FUTURES', 'SPOT']).optional(),
  exchange: z.enum(['BINANCE', 'BYBIT', 'OKX', 'KRAKEN', 'COINBASE']).optional(),
});

export const WalletBalancePreviewSchema = z
  .object({
    exchange: z.enum(['BINANCE', 'BYBIT', 'OKX', 'KRAKEN', 'COINBASE']).default('BINANCE'),
    marketType: z.enum(['FUTURES', 'SPOT']).default('FUTURES'),
    baseCurrency: z.string().trim().min(2).max(16).default('USDT'),
    apiKeyId: z.string().trim().min(1),
    liveAllocationMode: WalletAllocationModeSchema.optional().nullable(),
    liveAllocationValue: z.number().positive().max(1_000_000_000).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.liveAllocationMode && value.liveAllocationValue == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'liveAllocationValue is required when liveAllocationMode is provided',
        path: ['liveAllocationValue'],
      });
      return;
    }

    if (!value.liveAllocationMode && value.liveAllocationValue != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'liveAllocationMode is required when liveAllocationValue is provided',
        path: ['liveAllocationMode'],
      });
      return;
    }

    if (
      value.liveAllocationMode === 'PERCENT' &&
      typeof value.liveAllocationValue === 'number' &&
      value.liveAllocationValue > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'liveAllocationValue cannot exceed 100 for PERCENT mode',
        path: ['liveAllocationValue'],
      });
    }
  });

export type CreateWalletDto = z.infer<typeof CreateWalletSchema>;
export type UpdateWalletDto = z.infer<typeof UpdateWalletSchema>;
export type ListWalletsQueryDto = z.infer<typeof ListWalletsQuerySchema>;
export type WalletBalancePreviewDto = z.infer<typeof WalletBalancePreviewSchema>;
