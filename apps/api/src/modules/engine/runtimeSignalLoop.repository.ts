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
        include: {
          symbolGroup: {
            select: {
              id: true,
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
            include: {
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

export const listRuntimeManagedExternalPositionsRaw = () =>
  prisma.position.findMany({
    where: {
      status: 'OPEN',
      botId: null,
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
