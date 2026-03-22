export type BotMode = "PAPER" | "LIVE" | "LOCAL";
export type TradeMarket = "FUTURES" | "SPOT";
export type PositionMode = "ONE_WAY" | "HEDGE";

export type Bot = {
  id: string;
  name: string;
  mode: BotMode;
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
