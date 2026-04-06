import api from "../../../lib/api"; 
import type { ApiKey } from "../types/apiKey.type";
import type { ExchangeOption } from "@/features/exchanges/exchangeCapabilities";

const API = "/dashboard/profile/apiKeys";

export type ApiKeyConnectionTestPayload = {
  exchange: ExchangeOption;
  apiKey: string;
  apiSecret: string;
};

export type ApiKeyConnectionTestResult = {
  ok: boolean;
  message?: string;
};

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

export async function testApiKeyConnection(
  payload: ApiKeyConnectionTestPayload
): Promise<ApiKeyConnectionTestResult> {
  const res = await api.post(`${API}/test`, payload);
  return res.data;
}

export async function testStoredApiKeyConnection(id: string): Promise<ApiKeyConnectionTestResult> {
  const res = await api.post(`${API}/${id}/test`);
  return res.data;
}
