import { z } from 'zod';
import { EXCHANGE_MARKET_TYPES } from '@cryptosparrow/shared';

export const ExecutionModeSchema = z.enum(['PAPER', 'LIVE']);

export const PreTradeAnalysisInputSchema = z.object({
  userId: z.string().trim().min(1),
  botId: z.string().trim().min(1).optional(),
  symbol: z.string().trim().min(1),
  marketType: z.enum(EXCHANGE_MARKET_TYPES).optional(),
  mode: ExecutionModeSchema,
  liveOptIn: z.boolean().default(false),
  globalKillSwitch: z.boolean().default(false),
  emergencyStop: z.boolean().default(false),
  maxOpenPositionsPerUser: z.number().int().min(1).optional(),
  maxOpenPositionsPerBot: z.number().int().min(1).optional(),
  enforceOnePositionPerSymbol: z.boolean().default(true),
  maxDailyLossUsd: z.number().positive().optional(),
  maxDrawdownPercent: z.number().positive().max(100).optional(),
  maxConsecutiveLosses: z.number().int().min(1).optional(),
  dailyPnlUsd: z.number().optional(),
  peakEquityUsd: z.number().positive().optional(),
  currentEquityUsd: z.number().nonnegative().optional(),
  consecutiveLosses: z.number().int().min(0).optional(),
  cooldownAfterLossMinutes: z.number().int().min(1).optional(),
  lastLossAtEpochMs: z.number().int().positive().optional(),
  nowEpochMs: z.number().int().positive().optional(),
});

export type PreTradeAnalysisInput = z.input<typeof PreTradeAnalysisInputSchema>;
export type PreTradeAnalysisParsedInput = z.output<typeof PreTradeAnalysisInputSchema>;

export type PreTradeBotLiveConfig = {
  mode: 'PAPER' | 'LIVE';
  marketType: 'FUTURES' | 'SPOT';
  positionMode: 'ONE_WAY' | 'HEDGE';
  liveOptIn: boolean;
  consentTextVersion: string | null;
};

export type PreTradeDecision = {
  allowed: boolean;
  reasons: string[];
  metrics: {
    userOpenPositions: number;
    botOpenPositions: number | null;
    hasOpenPositionOnSymbol: boolean;
  };
};
