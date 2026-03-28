export type BotMode = "PAPER" | "LIVE" | "LOCAL";
export type TradeMarket = "FUTURES" | "SPOT";
export type PositionMode = "ONE_WAY" | "HEDGE";

export type Bot = {
  id: string;
  name: string;
  mode: BotMode;
  paperStartBalance: number;
  marketType: TradeMarket;
  positionMode: PositionMode;
  strategyId?: string | null;
  isActive: boolean;
  liveOptIn: boolean;
  consentTextVersion?: string | null;
  maxOpenPositions: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateBotInput = {
  name: string;
  mode: BotMode;
  paperStartBalance: number;
  marketType: TradeMarket;
  positionMode: PositionMode;
  strategyId?: string | null;
  isActive: boolean;
  liveOptIn: boolean;
  consentTextVersion?: string | null;
  maxOpenPositions: number;
};

export type UpdateBotInput = Partial<CreateBotInput>;

export type AssistantSafetyMode = "STRICT" | "BALANCED" | "EXPERIMENTAL";

export type BotAssistantConfig = {
  id: string;
  userId: string;
  botId: string;
  mainAgentEnabled: boolean;
  mandate?: string | null;
  modelProfile: string;
  safetyMode: AssistantSafetyMode;
  maxDecisionLatencyMs: number;
  createdAt?: string;
  updatedAt?: string;
};

export type BotSubagentConfig = {
  id: string;
  userId: string;
  botId: string;
  slotIndex: number;
  role: string;
  enabled: boolean;
  modelProfile: string;
  timeoutMs: number;
  safetyMode: AssistantSafetyMode;
  createdAt?: string;
  updatedAt?: string;
};

export type BotAssistantConfigResponse = {
  assistant: BotAssistantConfig | null;
  subagents: BotSubagentConfig[];
};

export type AssistantDecisionTrace = {
  requestId: string;
  botId: string;
  botMarketGroupId: string;
  symbol: string;
  mode: "off" | "strategy_only" | "assistant";
  statuses: Array<{
    slotIndex: number;
    role: string;
    status: "ok" | "timeout" | "error" | "skipped";
    latencyMs: number;
    message?: string;
  }>;
  outputs: Array<{
    slotIndex: number;
    role: string;
    proposal: "LONG" | "SHORT" | "EXIT" | "NO_TRADE";
    confidence: number;
    rationale: string;
    latencyMs: number;
  }>;
  finalDecision: "LONG" | "SHORT" | "EXIT" | "NO_TRADE";
  finalReason: string;
};
