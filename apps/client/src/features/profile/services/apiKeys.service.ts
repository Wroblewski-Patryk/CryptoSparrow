import api from "../../../lib/api"; 
import type { ApiKey } from "../types/apiKey.type";

const API = "/dashboard/profile/apiKeys";

export async function fetchApiKeys(): Promise<ApiKey[]> {
  const res = await api.get(API);
  return res.data;
}

export async function addApiKey(payload: Partial<ApiKey>): Promise<ApiKey> {
  const res = await api.post(API, payload);
  return res.data;
}

export async function editApiKey(id: string, payload: Partial<ApiKey>): Promise<ApiKey> {
  const res = await api.patch(`${API}/${id}`, payload);
  return res.data;
}

export async function deleteApiKey(id: string): Promise<void> {
  await api.delete(`${API}/${id}`);
}
