import api from "../../../lib/api";
import {
  Bot,
  BotAssistantConfig,
  BotAssistantConfigResponse,
  AssistantDecisionTrace,
  BotRuntimeGraph,
  BotRuntimeSessionDetail,
  BotRuntimeSessionListItem,
  BotRuntimeSessionStatus,
  BotRuntimeSymbolStatsResponse,
  BotRuntimePositionsResponse,
  BotRuntimeTradesResponse,
  BotSubagentConfig,
  CreateBotInput,
  TradeMarket,
  UpdateBotInput,
} from "../types/bot.type";

export const listBots = async (marketType?: TradeMarket): Promise<Bot[]> => {
  const res = await api.get<Bot[]>("/dashboard/bots", {
    params: marketType ? { marketType } : undefined,
  });
  return res.data;
};

export const getBot = async (id: string): Promise<Bot> => {
  const res = await api.get<Bot>(`/dashboard/bots/${id}`);
  return res.data;
};

export const getBotRuntimeGraph = async (id: string): Promise<BotRuntimeGraph> => {
  const res = await api.get<BotRuntimeGraph>(`/dashboard/bots/${id}/runtime-graph`);
  return res.data;
};

export const createBot = async (payload: CreateBotInput): Promise<Bot> => {
  const res = await api.post<Bot>("/dashboard/bots", payload);
  return res.data;
};

export const updateBot = async (id: string, payload: UpdateBotInput): Promise<Bot> => {
  const res = await api.put<Bot>(`/dashboard/bots/${id}`, payload);
  return res.data;
};

export const deleteBot = async (id: string): Promise<void> => {
  await api.delete(`/dashboard/bots/${id}`);
};

export const listBotRuntimeSessions = async (
  botId: string,
  params?: {
    status?: BotRuntimeSessionStatus;
    limit?: number;
  }
): Promise<BotRuntimeSessionListItem[]> => {
  const res = await api.get<BotRuntimeSessionListItem[]>(`/dashboard/bots/${botId}/runtime-sessions`, { params });
  return res.data;
};

export const getBotRuntimeSession = async (botId: string, sessionId: string): Promise<BotRuntimeSessionDetail> => {
  const res = await api.get<BotRuntimeSessionDetail>(`/dashboard/bots/${botId}/runtime-sessions/${sessionId}`);
  return res.data;
};

export const listBotRuntimeSessionSymbolStats = async (
  botId: string,
  sessionId: string,
  params?: {
    symbol?: string;
    limit?: number;
  }
): Promise<BotRuntimeSymbolStatsResponse> => {
  const res = await api.get<BotRuntimeSymbolStatsResponse>(
    `/dashboard/bots/${botId}/runtime-sessions/${sessionId}/symbol-stats`,
    { params }
  );
  return res.data;
};

export const listBotRuntimeSessionTrades = async (
  botId: string,
  sessionId: string,
  params?: {
    symbol?: string;
    side?: "BUY" | "SELL";
    action?: "OPEN" | "DCA" | "CLOSE" | "UNKNOWN";
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
    sortBy?: "executedAt" | "symbol" | "side" | "lifecycleAction" | "margin" | "fee" | "realizedPnl";
    sortDir?: "asc" | "desc";
    limit?: number;
  }
): Promise<BotRuntimeTradesResponse> => {
  const res = await api.get<BotRuntimeTradesResponse>(`/dashboard/bots/${botId}/runtime-sessions/${sessionId}/trades`, {
    params,
  });
  return res.data;
};

export const listBotRuntimeSessionPositions = async (
  botId: string,
  sessionId: string,
  params?: {
    symbol?: string;
    limit?: number;
  }
): Promise<BotRuntimePositionsResponse> => {
  const res = await api.get<BotRuntimePositionsResponse>(
    `/dashboard/bots/${botId}/runtime-sessions/${sessionId}/positions`,
    { params }
  );
  return res.data;
};

export const getBotAssistantConfig = async (botId: string): Promise<BotAssistantConfigResponse> => {
  const res = await api.get<BotAssistantConfigResponse>(`/dashboard/bots/${botId}/assistant-config`);
  return res.data;
};

export const upsertBotAssistantConfig = async (
  botId: string,
  payload: {
    mainAgentEnabled: boolean;
    mandate?: string | null;
    modelProfile: string;
    safetyMode: "STRICT" | "BALANCED" | "EXPERIMENTAL";
    maxDecisionLatencyMs: number;
  }
): Promise<BotAssistantConfig> => {
  const res = await api.put<BotAssistantConfig>(`/dashboard/bots/${botId}/assistant-config`, payload);
  return res.data;
};

export const upsertBotSubagentConfig = async (
  botId: string,
  slotIndex: number,
  payload: {
    role: string;
    enabled: boolean;
    modelProfile: string;
    timeoutMs: number;
    safetyMode: "STRICT" | "BALANCED" | "EXPERIMENTAL";
  }
): Promise<BotSubagentConfig> => {
  const res = await api.put<BotSubagentConfig>(
    `/dashboard/bots/${botId}/assistant-config/subagents/${slotIndex}`,
    payload
  );
  return res.data;
};

export const deleteBotSubagentConfig = async (botId: string, slotIndex: number): Promise<void> => {
  await api.delete(`/dashboard/bots/${botId}/assistant-config/subagents/${slotIndex}`);
};

export const runBotAssistantDryRun = async (
  botId: string,
  payload: {
    symbol: string;
    intervalWindow: string;
    mode: "BACKTEST" | "PAPER" | "LIVE";
  }
): Promise<AssistantDecisionTrace> => {
  const res = await api.post<AssistantDecisionTrace>(`/dashboard/bots/${botId}/assistant-config/dry-run`, payload);
  return res.data;
};
