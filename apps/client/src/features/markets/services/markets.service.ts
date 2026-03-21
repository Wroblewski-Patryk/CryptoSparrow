import api from '../../../lib/api';
import { CreateMarketUniverseInput, MarketCatalog, MarketUniverse } from '../types/marketUniverse.type';

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

export const getMarketUniverse = async (id: string): Promise<MarketUniverse> => {
  const res = await api.get<MarketUniverse>(`/dashboard/markets/universes/${id}`);
  return res.data;
};

export const updateMarketUniverse = async (
  id: string,
  payload: Partial<CreateMarketUniverseInput>
): Promise<MarketUniverse> => {
  const res = await api.put<MarketUniverse>(`/dashboard/markets/universes/${id}`, payload);
  return res.data;
};

export const deleteMarketUniverse = async (id: string): Promise<void> => {
  await api.delete(`/dashboard/markets/universes/${id}`);
};

export const fetchMarketCatalog = async (
  params?: { baseCurrency?: string; marketType?: 'SPOT' | 'FUTURES' }
): Promise<MarketCatalog> => {
  const res = await api.get<MarketCatalog>('/dashboard/markets/catalog', {
    params: params ?? undefined,
  });
  return res.data;
};
