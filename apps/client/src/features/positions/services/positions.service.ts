import api from "../../../lib/api";
import { ExchangePositionsSnapshot, ListPositionsQuery, Position } from "../types/position.type";

export const listPositions = async (query: ListPositionsQuery): Promise<Position[]> => {
  const res = await api.get<Position[]>("/dashboard/positions", { params: query });
  return res.data;
};

export const fetchExchangePositionsSnapshot = async (): Promise<ExchangePositionsSnapshot> => {
  const res = await api.get<ExchangePositionsSnapshot>("/dashboard/positions/exchange-snapshot");
  return res.data;
};
