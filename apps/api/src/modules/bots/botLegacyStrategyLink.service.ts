import { prisma } from '../../prisma/client';

const getOrCreateDefaultSymbolGroup = async (
  userId: string,
  marketType: 'FUTURES' | 'SPOT'
) => {
  const existing = await prisma.symbolGroup.findFirst({
    where: {
      userId,
      marketUniverse: {
        marketType,
      },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) return existing.id;

  const baseCurrency = marketType === 'SPOT' ? 'USDT' : 'USDT';
  const universe = await prisma.marketUniverse.create({
    data: {
      userId,
      name: `Auto ${marketType} Universe`,
      marketType,
      baseCurrency,
      whitelist: [],
      blacklist: [],
    },
    select: { id: true },
  });

  const symbolGroup = await prisma.symbolGroup.create({
    data: {
      userId,
      marketUniverseId: universe.id,
      name: `Auto ${marketType} Group`,
      symbols: [],
    },
    select: { id: true },
  });

  return symbolGroup.id;
};

export const upsertBotStrategy = async (params: {
  userId: string;
  botId: string;
  strategyId: string | null;
  marketType: 'FUTURES' | 'SPOT';
}) => {
  if (!params.strategyId) {
    await prisma.botStrategy.deleteMany({
      where: { botId: params.botId },
    });
    return;
  }

  const strategy = await prisma.strategy.findFirst({
    where: {
      id: params.strategyId,
      userId: params.userId,
    },
    select: { id: true },
  });

  if (!strategy) {
    throw new Error('BOT_STRATEGY_NOT_FOUND');
  }

  const symbolGroupId = await getOrCreateDefaultSymbolGroup(params.userId, params.marketType);

  await prisma.$transaction([
    prisma.botStrategy.deleteMany({
      where: { botId: params.botId },
    }),
    prisma.botStrategy.create({
      data: {
        botId: params.botId,
        strategyId: strategy.id,
        symbolGroupId,
        isEnabled: true,
      },
    }),
  ]);
};
