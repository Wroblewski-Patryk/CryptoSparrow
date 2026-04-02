import { z } from 'zod';

export const BotModeSchema = z.enum(['PAPER', 'LIVE']);
export const TradeMarketSchema = z.enum(['FUTURES', 'SPOT']);
export const BotMarketGroupStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']);
export const AssistantSafetyModeSchema = z.enum(['STRICT', 'BALANCED', 'EXPERIMENTAL']);

export const CreateBotSchema = z.object({
  name: z.string().trim().min(1),
  mode: BotModeSchema.default('PAPER'),
  paperStartBalance: z.number().min(0).max(100_000_000).default(10_000),
  apiKeyId: z.string().trim().min(1).optional().nullable(),
  strategyId: z.string().trim().min(1),
  marketGroupId: z.string().trim().min(1),
  isActive: z.boolean().default(false),
  liveOptIn: z.boolean().default(false),
  consentTextVersion: z.string().trim().min(1).max(64).optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.liveOptIn && !value.consentTextVersion) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'consentTextVersion is required when liveOptIn is enabled',
      path: ['consentTextVersion'],
    });
  }
});

export const UpdateBotSchema = CreateBotSchema.partial().extend({
  marketType: TradeMarketSchema.optional(),
  strategyId: z.string().trim().min(1).optional().nullable(),
  marketGroupId: z.string().trim().min(1).optional().nullable(),
});
export const ListBotsQuerySchema = z.object({
  marketType: TradeMarketSchema.optional(),
});

export const CreateBotMarketGroupSchema = z.object({
  symbolGroupId: z.string().trim().min(1),
  lifecycleStatus: BotMarketGroupStatusSchema.default('ACTIVE'),
  executionOrder: z.number().int().min(0).max(10_000).default(100),
  maxOpenPositions: z.number().int().min(1).max(1000).default(1),
  isEnabled: z.boolean().default(true),
});

export const UpdateBotMarketGroupSchema = z.object({
  symbolGroupId: z.string().trim().min(1).optional(),
  lifecycleStatus: BotMarketGroupStatusSchema.optional(),
  executionOrder: z.number().int().min(0).max(10_000).optional(),
  maxOpenPositions: z.number().int().min(1).max(1000).optional(),
  isEnabled: z.boolean().optional(),
});

export const AttachMarketGroupStrategySchema = z.object({
  strategyId: z.string().trim().min(1),
  priority: z.number().int().min(0).max(10_000).default(100),
  weight: z.number().min(0).max(1000).default(1),
  isEnabled: z.boolean().default(true),
});

export const UpdateMarketGroupStrategySchema = z.object({
  priority: z.number().int().min(0).max(10_000).optional(),
  weight: z.number().min(0).max(1000).optional(),
  isEnabled: z.boolean().optional(),
});

export const ReorderMarketGroupStrategiesSchema = z.object({
  items: z.array(z.object({
    id: z.string().trim().min(1),
    priority: z.number().int().min(0).max(10_000),
  })).min(1),
});

export const UpsertBotAssistantConfigSchema = z.object({
  mainAgentEnabled: z.boolean().default(false),
  mandate: z.string().trim().min(1).max(500).optional().nullable(),
  modelProfile: z.string().trim().min(1).max(64).default('balanced'),
  safetyMode: AssistantSafetyModeSchema.default('STRICT'),
  maxDecisionLatencyMs: z.number().int().min(200).max(30_000).default(2500),
});

export const UpsertBotSubagentConfigSchema = z.object({
  role: z.string().trim().min(1).max(64),
  enabled: z.boolean().default(false),
  modelProfile: z.string().trim().min(1).max(64).default('balanced'),
  timeoutMs: z.number().int().min(100).max(15_000).default(1200),
  safetyMode: AssistantSafetyModeSchema.default('STRICT'),
});

export const AssistantDryRunSchema = z.object({
  symbol: z.string().trim().min(1).max(40),
  intervalWindow: z.string().trim().min(1).max(20).default('5m'),
  mode: z.enum(['BACKTEST', 'PAPER', 'LIVE']).default('PAPER'),
});

export const BotRuntimeSessionStatusSchema = z.enum([
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELED',
]);

export const ListBotRuntimeSessionsQuerySchema = z.object({
  status: BotRuntimeSessionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const ListBotRuntimeSymbolStatsQuerySchema = z.object({
  symbol: z.string().trim().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const ListBotRuntimeTradesQuerySchema = z.object({
  symbol: z.string().trim().min(1).max(40).optional(),
  side: z.enum(['BUY', 'SELL']).optional(),
  action: z.enum(['OPEN', 'DCA', 'CLOSE', 'UNKNOWN']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  sortBy: z
    .enum(['executedAt', 'symbol', 'side', 'lifecycleAction', 'margin', 'fee', 'realizedPnl'])
    .optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from.getTime() > value.to.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '`from` must be before or equal to `to`',
      path: ['from'],
    });
  }
});

export const ListBotRuntimePositionsQuerySchema = z.object({
  symbol: z.string().trim().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type CreateBotDto = z.infer<typeof CreateBotSchema>;
export type UpdateBotDto = z.infer<typeof UpdateBotSchema>;
export type ListBotsQueryDto = z.infer<typeof ListBotsQuerySchema>;
export type CreateBotMarketGroupDto = z.infer<typeof CreateBotMarketGroupSchema>;
export type UpdateBotMarketGroupDto = z.infer<typeof UpdateBotMarketGroupSchema>;
export type AttachMarketGroupStrategyDto = z.infer<typeof AttachMarketGroupStrategySchema>;
export type UpdateMarketGroupStrategyDto = z.infer<typeof UpdateMarketGroupStrategySchema>;
export type ReorderMarketGroupStrategiesDto = z.infer<typeof ReorderMarketGroupStrategiesSchema>;
export type UpsertBotAssistantConfigDto = z.infer<typeof UpsertBotAssistantConfigSchema>;
export type UpsertBotSubagentConfigDto = z.infer<typeof UpsertBotSubagentConfigSchema>;
export type AssistantDryRunDto = z.infer<typeof AssistantDryRunSchema>;
export type ListBotRuntimeSessionsQueryDto = z.infer<typeof ListBotRuntimeSessionsQuerySchema>;
export type ListBotRuntimeSymbolStatsQueryDto = z.infer<typeof ListBotRuntimeSymbolStatsQuerySchema>;
export type ListBotRuntimeTradesQueryDto = z.infer<typeof ListBotRuntimeTradesQuerySchema>;
export type ListBotRuntimePositionsQueryDto = z.infer<typeof ListBotRuntimePositionsQuerySchema>;
