import api from '@/lib/api';

export type UpdatePositionManualParamsPayload = {
  takeProfit?: number | null;
  stopLoss?: number | null;
  notes?: string | null;
  lockRules?: boolean;
};

export type PositionManualUpdateResponse = {
  id: string;
  takeProfit: number | null;
  stopLoss: number | null;
};

export const updatePositionManualParams = async (
  positionId: string,
  payload: UpdatePositionManualParamsPayload
): Promise<PositionManualUpdateResponse> => {
  const res = await api.patch<PositionManualUpdateResponse>(
    `/dashboard/positions/${positionId}/manual-update`,
    payload
  );
  return res.data;
};
