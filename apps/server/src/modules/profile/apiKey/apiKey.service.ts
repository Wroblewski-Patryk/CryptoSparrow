import { encrypt, decrypt } from "../../../utils/crypto";
import { prisma } from "../../../prisma/client";
import { ApiKey, Prisma } from "@prisma/client";
import { probeBinanceApiKeyPermissions, BinanceApiKeyTestCode } from "./binanceApiKeyProbe.service";

export enum Exchange {
  BINANCE = "BINANCE"
}

export type ApiKeyPayload = {
  label: string;
  exchange: Exchange;
  apiKey: string;
  apiSecret: string;
};

export type ApiKeyTestPayload = Pick<ApiKeyPayload, "exchange" | "apiKey" | "apiSecret">;

export type ApiKeyTestResult = {
  ok: boolean;
  code: BinanceApiKeyTestCode;
  message: string;
  permissions: {
    spot: boolean;
    futures: boolean;
  };
};

const writeApiKeyTestAudit = async (params: {
  userId: string;
  exchange: Exchange;
  ok: boolean;
  code: BinanceApiKeyTestCode;
  permissions: {
    spot: boolean;
    futures: boolean;
  };
}) => {
  try {
    await prisma.log.create({
      data: {
        userId: params.userId,
        action: "profile.api_key.test_connection",
        level: params.ok ? "INFO" : "WARN",
        source: "profile.apiKey.service",
        message: params.ok ? "API key connection test accepted." : "API key connection test failed.",
        category: "SECURITY",
        entityType: "API_KEY",
        metadata: {
          exchange: params.exchange,
          ok: params.ok,
          code: params.code,
          permissions: params.permissions,
        },
      },
    });
  } catch {
    // Audit failures should not block user-triggered test calls.
  }
};

const maskValue = (value: string) => {
  if (!value) return "";
  if (value.length <= 4) return "*".repeat(value.length);
  return `${value.slice(0, 2)}********${value.slice(-2)}`;
};

const safeMaskStoredApiKey = (encryptedApiKey: string) => {
  try {
    return maskValue(decrypt(encryptedApiKey));
  } catch {
    return "********";
  }
};

const toPublicApiKey = (record: ApiKey) => ({
  id: record.id,
  userId: record.userId,
  label: record.label,
  exchange: record.exchange,
  apiKey: safeMaskStoredApiKey(record.apiKey),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  lastUsed: record.lastUsed,
});

export const listApiKeys = async (userId: string) => {
  const records = await prisma.apiKey.findMany({
    where: { userId }
  });

  return records.map(toPublicApiKey);
};

export const createApiKey = async (userId: string, data: ApiKeyPayload) => {
  const created = await prisma.apiKey.create({
    data: {
        ...data,
        apiKey: encrypt(data.apiKey),
        apiSecret: encrypt(data.apiSecret),
        userId
    }
  });

  return toPublicApiKey(created);
};

export const updateApiKey = async (
  userId: string,
  id: string,
  data: Partial<ApiKeyPayload>
) => {
  const updateData: Prisma.ApiKeyUpdateManyMutationInput = {
    ...(data.label && { label: data.label }),
    ...(data.exchange && { exchange: data.exchange }),
    ...(data.apiKey && { apiKey: encrypt(data.apiKey) }),
    ...(data.apiSecret && { apiSecret: encrypt(data.apiSecret) }),
  };

  const result = await prisma.apiKey.updateMany({
    where: { id, userId },
    data: updateData,
  });

  if (result.count === 0) return null;

  const updated = await prisma.apiKey.findFirst({
    where: { id, userId },
  });

  if (!updated) return null;
  return toPublicApiKey(updated);
};

export const deleteApiKey = async (userId: string, id: string) => {
  const result = await prisma.apiKey.deleteMany({ 
    where: { id, userId } 
  });

  return result.count > 0;
};

export const rotateApiKeySecretPair = async (
  userId: string,
  id: string,
  data: Pick<ApiKeyPayload, 'apiKey' | 'apiSecret'>
) => {
  const result = await prisma.apiKey.updateMany({
    where: { id, userId },
    data: {
      apiKey: encrypt(data.apiKey),
      apiSecret: encrypt(data.apiSecret),
    },
  });

  if (result.count === 0) return null;

  const updated = await prisma.apiKey.findFirst({
    where: { id, userId },
  });

  if (!updated) return null;
  return toPublicApiKey(updated);
};

export const revokeApiKey = async (userId: string, id: string) => {
  return deleteApiKey(userId, id);
};

export const testApiKeyConnection = async (
  userId: string,
  data: ApiKeyTestPayload
): Promise<ApiKeyTestResult> => {
  const result =
    process.env.NODE_ENV === "test"
      ? {
          ok: true,
          code: "OK" as const,
          message: "Binance API key permissions validated.",
          permissions: {
            spot: true,
            futures: true,
          },
        }
      : await probeBinanceApiKeyPermissions({
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
        });

  await writeApiKeyTestAudit({
    userId,
    exchange: data.exchange,
    ok: result.ok,
    code: result.code,
    permissions: result.permissions,
  });

  return result;
};
