import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';

const botWithStrategyInclude = Prisma.validator<Prisma.BotInclude>()({
  botStrategies: {
    select: {
      strategyId: true,
      isEnabled: true,
    },
  },
  marketGroupStrategyLinks: {
    select: {
      strategyId: true,
      isEnabled: true,
    },
  },
});

export const listOwnedBotsWithStrategyProjection = async (params: {
  userId: string;
  marketType?: 'FUTURES' | 'SPOT';
}) =>
  prisma.bot.findMany({
    where: {
      userId: params.userId,
      ...(params.marketType ? { marketType: params.marketType } : {}),
    },
    include: botWithStrategyInclude,
    orderBy: { createdAt: 'desc' },
  });

export const getOwnedBotWithStrategyProjection = async (params: {
  userId: string;
  botId: string;
}) =>
  prisma.bot.findFirst({
    where: { id: params.botId, userId: params.userId },
    include: botWithStrategyInclude,
  });

export const getBotWithStrategyProjectionById = async (botId: string) =>
  prisma.bot.findUnique({
    where: { id: botId },
    include: botWithStrategyInclude,
  });
