import { encrypt, decrypt } from "../../../utils/crypto";
import { prisma } from "../../../prisma/client";
import { ApiKey, Exchange, Prisma } from "@prisma/client";
import { assertExchangeCapability } from "../../exchange/exchangeCapabilities";
import { probeBinanceApiKeyPermissions, BinanceApiKeyTestCode } from "./binanceApiKeyProbe.service";

export type ApiKeyPayload = {
  label: string;
  exchange: Exchange;
  apiKey: string;
  apiSecret: string;
  syncExternalPositions?: boolean;
  manageExternalPositions?: boolean;
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

const API_KEY_TEST_CODES: BinanceApiKeyTestCode[] = [
  "OK",
  "INVALID_KEY",
  "INVALID_SECRET",
  "IP_RESTRICTED",
  "MISSING_SPOT_SCOPE",
  "MISSING_FUTURES_SCOPE",
  "NETWORK_TIMEOUT",
  "UNKNOWN",
];

const getForcedApiKeyTestCode = (): BinanceApiKeyTestCode | null => {
  if (process.env.NODE_ENV !== "test") return null;
  const value = process.env.API_KEY_TEST_FORCE_CODE;
  if (!value) return null;
  return API_KEY_TEST_CODES.includes(value as BinanceApiKeyTestCode)
    ? (value as BinanceApiKeyTestCode)
    : null;
};

const buildApiKeyTestResultForCode = (code: BinanceApiKeyTestCode): ApiKeyTestResult => {
  switch (code) {
    case "OK":
      return {
        ok: true,
        code,
        message: "Binance API key permissions validated.",
        permissions: { spot: true, futures: true },
      };
    case "MISSING_FUTURES_SCOPE":
      return {
        ok: false,
        code,
        message: "Binance key has no Futures permission.",
        permissions: { spot: true, futures: false },
      };
    case "MISSING_SPOT_SCOPE":
      return {
        ok: false,
        code,
        message: "Binance key has no Spot permission.",
        permissions: { spot: false, futures: true },
      };
    case "INVALID_KEY":
      return {
        ok: false,
        code,
        message: "Binance rejected API key format or value.",
        permissions: { spot: false, futures: false },
      };
    case "INVALID_SECRET":
      return {
        ok: false,
        code,
        message: "Binance rejected API secret/signature.",
        permissions: { spot: false, futures: false },
      };
    case "IP_RESTRICTED":
      return {
        ok: false,
        code,
        message: "Binance rejected request due to IP restriction.",
        permissions: { spot: false, futures: false },
      };
    case "NETWORK_TIMEOUT":
      return {
        ok: false,
        code,
        message: "Binance connection timed out.",
        permissions: { spot: false, futures: false },
      };
    default:
      return {
        ok: false,
        code: "UNKNOWN",
        message: "Binance validation failed.",
        permissions: { spot: false, futures: false },
      };
  }
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
  syncExternalPositions: record.syncExternalPositions,
  manageExternalPositions: record.manageExternalPositions,
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
        syncExternalPositions: data.syncExternalPositions ?? true,
        manageExternalPositions: data.manageExternalPositions ?? false,
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
    ...(data.label !== undefined ? { label: data.label } : {}),
    ...(data.exchange !== undefined ? { exchange: data.exchange } : {}),
    ...(data.apiKey !== undefined ? { apiKey: encrypt(data.apiKey) } : {}),
    ...(data.apiSecret !== undefined ? { apiSecret: encrypt(data.apiSecret) } : {}),
    ...(data.syncExternalPositions !== undefined
      ? { syncExternalPositions: data.syncExternalPositions }
      : {}),
    ...(data.manageExternalPositions !== undefined
      ? { manageExternalPositions: data.manageExternalPositions }
      : {}),
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
  assertExchangeCapability(data.exchange, "API_KEY_PROBE");

  const forcedCode = getForcedApiKeyTestCode();
  const result = forcedCode
    ? buildApiKeyTestResultForCode(forcedCode)
    : process.env.NODE_ENV === "test"
      ? buildApiKeyTestResultForCode("OK")
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
