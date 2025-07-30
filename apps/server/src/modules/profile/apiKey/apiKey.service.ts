import { encrypt } from "../../../utils/crypto";
import { prisma } from "../../../prisma/client";

export enum Exchange {
  BINANCE = "BINANCE"
}

export type ApiKeyPayload = {
  label: string;
  exchange: Exchange;
  apiKey: string;
  apiSecret: string;
};

export const listApiKeys = async (userId: string) => {
  return prisma.apiKey.findMany({ 
    where: { userId } 
  });
};

export const createApiKey = async (userId: string, data: ApiKeyPayload) => {
  return prisma.apiKey.create({ 
    data: { ...data,
        apiKey: encrypt(data.apiKey),
        apiSecret: encrypt(data.apiSecret),
        userId 
    } 
});
};

export const updateApiKey = async (
  userId: string,
  id: string,
  data: Partial<ApiKeyPayload>
) => {
  const updateData: any = {
    ...(data.label && { label: data.label }),
    ...(data.exchange && { exchange: data.exchange }),
    ...(data.apiKey && { apiKey: encrypt(data.apiKey) }),
    ...(data.apiSecret && { apiSecret: encrypt(data.apiSecret) }),
  };

  return prisma.apiKey.updateMany({
    where: { id, userId },
    data: updateData,
  });
};

export const deleteApiKey = async (userId: string, id: string) => {
  return prisma.apiKey.deleteMany({ 
    where: { id, userId } 
  });
};
