import api from "../../../lib/api";
import { ListPositionsQuery, Position } from "../types/position.type";

export const listPositions = async (query: ListPositionsQuery): Promise<Position[]> => {
  const res = await api.get<Position[]>("/dashboard/positions", { params: query });
  return res.data;
};

