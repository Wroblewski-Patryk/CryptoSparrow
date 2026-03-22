import api from "../../../lib/api";
import { Bot, CreateBotInput, TradeMarket, UpdateBotInput } from "../types/bot.type";

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
