import { prisma } from '../../prisma/client';

export const getRuntimeSymbolStatsBaseData = async (params: {
  userId: string;
  botId: string;
  sessionId: string;
  normalizedSymbol?: string;
  limit: number;
}) => {
  const where = {
    userId: params.userId,
    botId: params.botId,
    sessionId: params.sessionId,
    ...(params.normalizedSymbol ? { symbol: params.normalizedSymbol } : {}),
  };

  const [items, summary, configuredMarketGroups, configuredBotStrategies, configuredMarketGroupStrategyLinks, botContext] =
    await Promise.all([
      prisma.botRuntimeSymbolStat.findMany({
        where,
        orderBy: [{ realizedPnl: 'desc' }, { updatedAt: 'desc' }],
        take: params.limit,
      }),
      prisma.botRuntimeSymbolStat.aggregate({
        where,
        _sum: {
          totalSignals: true,
          longEntries: true,
          shortEntries: true,
          exits: true,
          dcaCount: true,
          closedTrades: true,
          winningTrades: true,
          losingTrades: true,
          realizedPnl: true,
          grossProfit: true,
          grossLoss: true,
          feesPaid: true,
        },
      }),
      prisma.botMarketGroup.findMany({
        where: {
          userId: params.userId,
          botId: params.botId,
          isEnabled: true,
          lifecycleStatus: {
            in: ['ACTIVE', 'PAUSED'],
          },
        },
        select: {
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
        },
        orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.botStrategy.findMany({
        where: {
          botId: params.botId,
          isEnabled: true,
          bot: {
            userId: params.userId,
          },
        },
        select: {
          strategyId: true,
          symbolGroup: {
            select: {
              symbols: true,
              marketUniverse: {
                select: {
                  whitelist: true,
                  blacklist: true,
                },
              },
            },
          },
          strategy: {
            select: {
              id: true,
              name: true,
              interval: true,
              config: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      }),
      prisma.marketGroupStrategyLink.findMany({
        where: {
          userId: params.userId,
          botId: params.botId,
          isEnabled: true,
          botMarketGroup: {
            lifecycleStatus: {
              in: ['ACTIVE', 'PAUSED'],
            },
            isEnabled: true,
          },
        },
        select: {
          strategyId: true,
          strategy: {
            select: {
              id: true,
              name: true,
              interval: true,
              config: true,
            },
          },
          botMarketGroup: {
            select: {
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
            },
          },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.bot.findFirst({
        where: {
          id: params.botId,
          userId: params.userId,
        },
        select: {
          exchange: true,
          marketType: true,
        },
      }),
    ]);

  return {
    items,
    summary,
    configuredMarketGroups,
    configuredBotStrategies,
    configuredMarketGroupStrategyLinks,
    botContext,
  };
};

export const listRuntimeFallbackSymbolsFromEvents = async (params: {
  userId: string;
  botId: string;
  sessionId: string;
  limit: number;
}) =>
  prisma.botRuntimeEvent.findMany({
    where: {
      userId: params.userId,
      botId: params.botId,
      sessionId: params.sessionId,
      symbol: { not: null },
    },
    select: { symbol: true },
    orderBy: [{ eventAt: 'desc' }, { createdAt: 'desc' }],
    take: params.limit,
  });

export const getRuntimeSymbolLiveRows = async (params: {
  userId: string;
  botId: string;
  sessionId: string;
  symbols: string[];
  windowStart: Date;
  windowEnd: Date;
}) =>
  Promise.all([
    prisma.position.findMany({
      where: {
        userId: params.userId,
        botId: params.botId,
        status: 'OPEN',
        managementMode: 'BOT_MANAGED',
        symbol: { in: params.symbols },
        openedAt: {
          gte: params.windowStart,
          lte: params.windowEnd,
        },
      },
      select: {
        symbol: true,
        side: true,
        entryPrice: true,
        quantity: true,
      },
    }),
    prisma.trade.groupBy({
      by: ['symbol'],
      where: {
        userId: params.userId,
        botId: params.botId,
        symbol: { in: params.symbols },
        executedAt: {
          gte: params.windowStart,
          lte: params.windowEnd,
        },
      },
      _max: {
        executedAt: true,
      },
    }),
    prisma.botRuntimeEvent.findMany({
      where: {
        sessionId: params.sessionId,
        eventType: 'SIGNAL_DECISION',
        symbol: { in: params.symbols },
      },
      orderBy: [{ eventAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        symbol: true,
        signalDirection: true,
        eventAt: true,
        message: true,
        strategyId: true,
        payload: true,
      },
    }),
  ]);

export const listStrategiesByIds = async (params: {
  userId: string;
  strategyIds: string[];
}) =>
  prisma.strategy.findMany({
    where: {
      userId: params.userId,
      id: { in: params.strategyIds },
    },
    select: {
      id: true,
      name: true,
      interval: true,
      config: true,
    },
  });

export const listMarketCandleCloses = async (params: {
  marketType: 'FUTURES' | 'SPOT';
  symbol: string;
  interval: string;
  limit: number;
}) =>
  prisma.marketCandleCache.findMany({
    where: {
      marketType: params.marketType,
      symbol: params.symbol,
      timeframe: params.interval,
    },
    orderBy: [{ openTime: 'desc' }],
    take: params.limit,
    select: {
      close: true,
    },
  });
