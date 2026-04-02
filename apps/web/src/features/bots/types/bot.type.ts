export type BotMode = "PAPER" | "LIVE";
export type TradeMarket = "FUTURES" | "SPOT";
export type PositionMode = "ONE_WAY" | "HEDGE";
export type Exchange = "BINANCE";

export type Bot = {
  id: string;
  name: string;
  mode: BotMode;
  paperStartBalance: number;
  exchange: Exchange;
  marketType: TradeMarket;
  positionMode: PositionMode;
  apiKeyId?: string | null;
  strategyId?: string | null;
  isActive: boolean;
  liveOptIn: boolean;
  consentTextVersion?: string | null;
  maxOpenPositions: number;
  createdAt?: string;
  updatedAt?: string;
};

export type BotRuntimeGraph = {
  bot: {
    id: string;
    userId: string;
    name: string;
    mode: BotMode;
    marketType: TradeMarket;
    positionMode: PositionMode;
    isActive: boolean;
    liveOptIn: boolean;
    maxOpenPositions: number;
    createdAt: string;
    updatedAt: string;
  };
  marketGroups: Array<{
    id: string;
    botId: string;
    symbolGroupId: string;
    lifecycleStatus: string;
    executionOrder: number;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    symbolGroup: {
      id: string;
      name: string;
      symbols: string[];
      marketUniverseId: string;
    };
    strategies: Array<{
      id: string;
      strategyId: string;
      priority: number;
      weight: number;
      isEnabled: boolean;
      createdAt: string;
      updatedAt: string;
      strategy: {
        id: string;
        name: string;
        interval: string;
      };
    }>;
  }>;
  legacyBotStrategies: Array<{
    id: string;
    strategyId: string;
    symbolGroupId: string;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    strategy: {
      id: string;
      name: string;
      interval: string;
    };
    symbolGroup: {
      id: string;
      name: string;
      symbols: string[];
      marketUniverseId: string;
    };
  }>;
};

export type BotRuntimeSessionStatus = "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";

export type BotRuntimeSessionListItem = {
  id: string;
  botId: string;
  mode: BotMode;
  status: BotRuntimeSessionStatus;
  startedAt: string;
  finishedAt: string | null;
  lastHeartbeatAt: string | null;
  stopReason: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  durationMs: number;
  eventsCount: number;
  symbolsTracked: number;
  summary: {
    totalSignals: number;
    dcaCount: number;
    closedTrades: number;
    realizedPnl: number;
  };
};

export type BotRuntimeSessionDetail = {
  id: string;
  botId: string;
  mode: BotMode;
  status: BotRuntimeSessionStatus;
  startedAt: string;
  finishedAt: string | null;
  lastHeartbeatAt: string | null;
  stopReason: string | null;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  durationMs: number;
  eventsCount: number;
  symbolsTracked: number;
  summary: {
    totalSignals: number;
    longEntries: number;
    shortEntries: number;
    exits: number;
    dcaCount: number;
    closedTrades: number;
    winningTrades: number;
    losingTrades: number;
    realizedPnl: number;
    grossProfit: number;
    grossLoss: number;
    feesPaid: number;
    openPositionCount?: number;
    openPositionQty?: number;
  };
};

export type BotRuntimeSymbolStat = {
  id: string;
  userId: string;
  botId: string;
  sessionId: string;
  symbol: string;
  totalSignals: number;
  longEntries: number;
  shortEntries: number;
  exits: number;
  dcaCount: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  realizedPnl: number;
  grossProfit: number;
  grossLoss: number;
  feesPaid: number;
  openPositionCount: number;
  openPositionQty: number;
  unrealizedPnl?: number;
  lastPrice: number | null;
  lastSignalAt: string | null;
  lastSignalDirection?: "LONG" | "SHORT" | "EXIT" | null;
  lastSignalDecisionAt?: string | null;
  lastSignalMessage?: string | null;
  lastSignalReason?: string | null;
  lastSignalStrategyId?: string | null;
  lastSignalStrategyName?: string | null;
  lastSignalConditionSummary?: string | null;
  lastSignalIndicatorSummary?: string | null;
  lastSignalConditionLines?: Array<{
    scope: "LONG" | "SHORT";
    left: string;
    value: string;
    operator: string;
    right: string;
  }> | null;
  lastSignalScoreSummary?: {
    longScore: number;
    shortScore: number;
  } | null;
  lastTradeAt: string | null;
  snapshotAt: string;
  createdAt: string;
  updatedAt: string;
};

export type BotRuntimeSymbolStatsResponse = {
  sessionId: string;
  items: BotRuntimeSymbolStat[];
  summary: {
    totalSignals: number;
    longEntries: number;
    shortEntries: number;
    exits: number;
    dcaCount: number;
    closedTrades: number;
    winningTrades: number;
    losingTrades: number;
    realizedPnl: number;
    unrealizedPnl?: number;
    totalPnl?: number;
    grossProfit: number;
    grossLoss: number;
    feesPaid: number;
    openPositionCount?: number;
    openPositionQty?: number;
  };
};

export type BotRuntimeTrade = {
  id: string;
  symbol: string;
  side: string;
  lifecycleAction: "OPEN" | "DCA" | "CLOSE" | "UNKNOWN";
  price: number;
  quantity: number;
  fee: number;
  feeSource: "ESTIMATED" | "EXCHANGE_FILL";
  feePending: boolean;
  feeCurrency: string | null;
  realizedPnl: number;
  executedAt: string;
  orderId: string;
  positionId: string;
  strategyId: string;
  origin: string;
  managementMode: string;
  notional: number;
  margin: number;
};

export type BotRuntimeTradesResponse = {
  sessionId: string;
  total: number;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
  window: {
    startedAt: string;
    finishedAt: string;
  };
  items: BotRuntimeTrade[];
};

export type BotRuntimePositionItem = {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  status: "OPEN" | "CLOSED";
  quantity: number;
  leverage: number;
  entryPrice: number;
  entryNotional: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: string;
  closedAt: string | null;
  holdMs: number;
  dcaCount: number;
  feesPaid: number;
  realizedPnl: number;
  unrealizedPnl: number | null;
  markPrice: number | null;
  dynamicTtpStopLoss?: number | null;
  dynamicTslStopLoss?: number | null;
  firstTradeAt: string | null;
  lastTradeAt: string | null;
  tradesCount: number;
};

export type BotRuntimeOpenOrderItem = {
  id: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  quantity: number;
  filledQuantity: number;
  price: number | null;
  stopPrice: number | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BotRuntimePositionsResponse = {
  sessionId: string;
  total: number;
  openCount: number;
  closedCount: number;
  openOrdersCount: number;
  showDynamicStopColumns?: boolean;
  window: {
    startedAt: string;
    finishedAt: string;
  };
  summary: {
    realizedPnl: number;
    unrealizedPnl: number;
    feesPaid: number;
  };
  openOrders: BotRuntimeOpenOrderItem[];
  openItems: BotRuntimePositionItem[];
  historyItems: BotRuntimePositionItem[];
};

export type CreateBotInput = {
  name: string;
  mode: BotMode;
  paperStartBalance: number;
  apiKeyId?: string | null;
  strategyId: string;
  marketGroupId: string;
  isActive: boolean;
  liveOptIn: boolean;
  consentTextVersion?: string | null;
};

export type UpdateBotInput = Partial<{
  name: string;
  mode: BotMode;
  paperStartBalance: number;
  apiKeyId: string | null;
  strategyId: string | null;
  marketGroupId: string | null;
  isActive: boolean;
  liveOptIn: boolean;
  consentTextVersion: string | null;
}>;

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
