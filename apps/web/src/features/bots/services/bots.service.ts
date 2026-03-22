import api from "../../../lib/api";
import {
  Bot,
  BotAssistantConfig,
  BotAssistantConfigResponse,
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
