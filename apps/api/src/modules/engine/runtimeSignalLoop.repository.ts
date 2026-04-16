import { Prisma, SignalDirection } from '@prisma/client';
import { prisma } from '../../prisma/client';

export const listActiveRuntimeBotsRaw = () =>
  prisma.bot.findMany({
    where: {
      isActive: true,
      mode: { in: ['PAPER', 'LIVE'] },
    },
    select: {
      id: true,
      userId: true,
      walletId: true,
      mode: true,
      exchange: true,
      paperStartBalance: true,
      marketType: true,
      botMarketGroups: {
        where: {
          isEnabled: true,
          lifecycleStatus: { in: ['ACTIVE', 'PAUSED'] },
        },
        select: {
          id: true,
          symbolGroupId: true,
          executionOrder: true,
          maxOpenPositions: true,
          symbolGroup: {
            select: {
              symbols: true,
              marketUniverse: {
                select: {
                  exchange: true,
                  marketType: true,
                  baseCurrency: true,
                  filterRules: true,
                  whitelist: true,
                  blacklist: true,
                },
              },
            },
          },
          strategyLinks: {
            where: { isEnabled: true },
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
            select: {
              strategyId: true,
              priority: true,
              weight: true,
              strategy: {
                select: {
                  interval: true,
                  config: true,
                  leverage: true,
                  walletRisk: true,
                },
              },
            },
          },
        },
        orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

const formatTopologyVersionPart = (name: string, count: number, updatedAt: Date | null) =>
  `${name}:${count}:${updatedAt ? updatedAt.toISOString() : 'none'}`;

export const readRuntimeTopologyVersionRaw = async () => {
  const [bots, groups, links, strategies, symbolGroups, universes] = await prisma.$transaction([
    prisma.bot.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.botMarketGroup.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.marketGroupStrategyLink.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.strategy.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.symbolGroup.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.marketUniverse.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
  ]);

  return [
    formatTopologyVersionPart('bot', bots._count._all, bots._max.updatedAt),
    formatTopologyVersionPart('group', groups._count._all, groups._max.updatedAt),
    formatTopologyVersionPart('link', links._count._all, links._max.updatedAt),
    formatTopologyVersionPart('strategy', strategies._count._all, strategies._max.updatedAt),
    formatTopologyVersionPart('symbol_group', symbolGroups._count._all, symbolGroups._max.updatedAt),
    formatTopologyVersionPart('market_universe', universes._count._all, universes._max.updatedAt),
  ].join('|');
};

export const listRuntimeManagedExternalPositionsRaw = () =>
  prisma.position.findMany({
    where: {
      status: 'OPEN',
      origin: 'EXCHANGE_SYNC',
      managementMode: 'BOT_MANAGED',
    },
    select: {
      userId: true,
      symbol: true,
    },
    distinct: ['userId', 'symbol'],
  });

export const countOpenPositionsForBotAndSymbolsRaw = (params: {
  userId: string;
  botId: string;
  normalizedSymbols: string[];
}) =>
  prisma.position.count({
    where: {
      userId: params.userId,
      botId: params.botId,
      status: 'OPEN',
      ...(params.normalizedSymbols.length > 0 ? { symbol: { in: params.normalizedSymbols } } : {}),
    },
  });

export const createRuntimeSignalRecord = async (params: {
  userId: string;
  botId?: string;
  strategyId?: string;
  symbol: string;
  direction: SignalDirection;
  confidence: number;
  payload: Record<string, unknown>;
}) => {
  await prisma.signal.create({
    data: {
      userId: params.userId,
      botId: params.botId,
      strategyId: params.strategyId,
      symbol: params.symbol,
      timeframe: '1m',
      direction: params.direction,
      confidence: params.confidence,
      payload: params.payload as Prisma.InputJsonValue,
    },
  });
};
