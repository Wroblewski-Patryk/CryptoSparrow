import { z } from 'zod';

export const ExecutionModeSchema = z.enum(['PAPER', 'LIVE', 'LOCAL']);

export const PreTradeAnalysisInputSchema = z.object({
  userId: z.string().trim().min(1),
  botId: z.string().trim().min(1).optional(),
  symbol: z.string().trim().min(1),
  mode: ExecutionModeSchema,
  liveOptIn: z.boolean().default(false),
  globalKillSwitch: z.boolean().default(false),
  emergencyStop: z.boolean().default(false),
  maxOpenPositionsPerUser: z.number().int().min(1).optional(),
  maxOpenPositionsPerBot: z.number().int().min(1).optional(),
  enforceOnePositionPerSymbol: z.boolean().default(true),
});

export type PreTradeAnalysisInput = z.input<typeof PreTradeAnalysisInputSchema>;
export type PreTradeAnalysisParsedInput = z.output<typeof PreTradeAnalysisInputSchema>;

export type PreTradeBotLiveConfig = {
  mode: 'PAPER' | 'LIVE' | 'LOCAL';
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
