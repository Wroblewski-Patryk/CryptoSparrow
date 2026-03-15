import api from '../../../lib/api';
import { CreateMarketUniverseInput, MarketUniverse } from '../types/marketUniverse.type';

export const listMarketUniverses = async (): Promise<MarketUniverse[]> => {
  const res = await api.get<MarketUniverse[]>('/dashboard/markets/universes');
  return res.data;
};

export const createMarketUniverse = async (
  payload: CreateMarketUniverseInput
): Promise<MarketUniverse> => {
  const res = await api.post<MarketUniverse>('/dashboard/markets/universes', payload);
  return res.data;
};

export const deleteMarketUniverse = async (id: string): Promise<void> => {
  await api.delete(`/dashboard/markets/universes/${id}`);
};
