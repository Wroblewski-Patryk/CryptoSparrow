import { Exchange } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { botErrors } from './bots.errors';

const getOwnedApiKey = async (userId: string, apiKeyId: string) =>
  prisma.apiKey.findFirst({
    where: { id: apiKeyId, userId },
    select: {
      id: true,
      exchange: true,
    },
  });

const findLatestApiKeyByExchange = async (userId: string, exchange: Exchange) =>
  prisma.apiKey.findFirst({
    where: {
      userId,
      exchange,
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      exchange: true,
    },
  });

export const resolveCompatibleBotApiKey = async (params: {
  userId: string;
  exchange: Exchange;
  requestedApiKeyId?: string | null;
  requireForActivation: boolean;
}) => {
  if (params.requestedApiKeyId) {
    const apiKey = await getOwnedApiKey(params.userId, params.requestedApiKeyId);
    if (!apiKey) throw botErrors.botLiveApiKeyNotFound();
    if (apiKey.exchange !== params.exchange) {
      throw botErrors.botLiveApiKeyExchangeMismatch();
    }
    return apiKey.id;
  }

  if (!params.requireForActivation) return null;

  const latest = await findLatestApiKeyByExchange(params.userId, params.exchange);
  if (!latest) throw botErrors.botLiveApiKeyNotFound();
  return latest.id;
};
