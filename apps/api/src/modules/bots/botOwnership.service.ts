import { prisma } from '../../prisma/client';
import { botErrors } from './bots.errors';

export const getOwnedBot = async (userId: string, botId: string) =>
  prisma.bot.findFirst({
    where: { id: botId, userId },
    select: {
      id: true,
      marketType: true,
      exchange: true,
      apiKeyId: true,
      walletId: true,
      wallet: {
        select: {
          baseCurrency: true,
        },
      },
    },
  });

export const getOwnedBotRuntimeSession = async (
  userId: string,
  botId: string,
  sessionId: string
) =>
  prisma.botRuntimeSession.findFirst({
    where: {
      id: sessionId,
      userId,
      botId,
    },
  });

export const resolveSessionWindowEnd = (session: {
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  finishedAt: Date | null;
  lastHeartbeatAt: Date | null;
  startedAt: Date;
}) => {
  if (session.finishedAt) return session.finishedAt;
  if (session.status === 'RUNNING') return new Date();
  return session.lastHeartbeatAt ?? session.startedAt;
};

export const getOwnedSymbolGroup = async (userId: string, symbolGroupId: string) =>
  prisma.symbolGroup.findFirst({
    where: { id: symbolGroupId, userId },
    select: {
      id: true,
      marketUniverse: {
        select: { marketType: true, exchange: true, baseCurrency: true },
      },
    },
  });

export const validateSymbolGroupForBot = async (params: {
  userId: string;
  botId: string;
  symbolGroupId: string;
}) => {
  const bot = await getOwnedBot(params.userId, params.botId);
  if (!bot) throw botErrors.botNotFound();

  const symbolGroup = await getOwnedSymbolGroup(params.userId, params.symbolGroupId);
  if (!symbolGroup) throw botErrors.symbolGroupNotFound();

  if (symbolGroup.marketUniverse.marketType !== bot.marketType) {
    throw botErrors.botMarketGroupMarketTypeMismatch();
  }
  if (symbolGroup.marketUniverse.exchange !== bot.exchange) {
    throw botErrors.botMarketGroupExchangeMismatch();
  }
  if (
    bot.wallet &&
    symbolGroup.marketUniverse.baseCurrency.toUpperCase() !== bot.wallet.baseCurrency.toUpperCase()
  ) {
    throw botErrors.walletMarketContextMismatch();
  }
};
