import { BotRuntimeSessionStatus } from '@prisma/client';
import { prisma } from '../../prisma/client';

const resolveSessionWindowEnd = (session: {
  finishedAt: Date | null;
  lastHeartbeatAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}) =>
  session.finishedAt ??
  session.lastHeartbeatAt ??
  session.updatedAt ??
  session.createdAt;

export const listRuntimeSessionsWithSummary = async (params: {
  userId: string;
  botId: string;
  status?: BotRuntimeSessionStatus;
  limit: number;
}) => {
  const sessions = await prisma.botRuntimeSession.findMany({
    where: {
      userId: params.userId,
      botId: params.botId,
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: [{ lastHeartbeatAt: 'desc' }, { startedAt: 'desc' }, { createdAt: 'desc' }],
    take: params.limit,
  });

  if (sessions.length === 0) return [];
  const sessionIds = sessions.map((session) => session.id);

  const [eventCounts, symbolCounts, symbolSums] = await Promise.all([
    prisma.botRuntimeEvent.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _count: { _all: true },
    }),
    prisma.botRuntimeSymbolStat.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _count: { _all: true },
    }),
    prisma.botRuntimeSymbolStat.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _sum: {
        totalSignals: true,
        dcaCount: true,
        closedTrades: true,
        realizedPnl: true,
      },
    }),
  ]);

  const eventCountMap = new Map(eventCounts.map((entry) => [entry.sessionId, entry._count._all]));
  const symbolCountMap = new Map(symbolCounts.map((entry) => [entry.sessionId, entry._count._all]));
  const symbolSumMap = new Map(
    symbolSums.map((entry) => [
      entry.sessionId,
      {
        totalSignals: entry._sum.totalSignals ?? 0,
        dcaCount: entry._sum.dcaCount ?? 0,
        closedTrades: entry._sum.closedTrades ?? 0,
        realizedPnl: entry._sum.realizedPnl ?? 0,
      },
    ])
  );

  return sessions.map((session) => {
    const summary = symbolSumMap.get(session.id) ?? {
      totalSignals: 0,
      dcaCount: 0,
      closedTrades: 0,
      realizedPnl: 0,
    };
    const windowEnd = resolveSessionWindowEnd(session);
    const durationMs = Math.max(0, windowEnd.getTime() - session.startedAt.getTime());

    return {
      id: session.id,
      botId: session.botId,
      mode: session.mode,
      status: session.status,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
      stopReason: session.stopReason,
      errorMessage: session.errorMessage,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      durationMs,
      eventsCount: eventCountMap.get(session.id) ?? 0,
      symbolsTracked: symbolCountMap.get(session.id) ?? 0,
      summary,
    };
  });
};

export const getRuntimeSessionSummaryMetrics = async (sessionId: string) => {
  const [eventCount, symbolsTracked, symbolStatsAggregate] = await Promise.all([
    prisma.botRuntimeEvent.count({
      where: { sessionId },
    }),
    prisma.botRuntimeSymbolStat.count({
      where: { sessionId },
    }),
    prisma.botRuntimeSymbolStat.aggregate({
      where: { sessionId },
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
        openPositionCount: true,
        openPositionQty: true,
      },
    }),
  ]);

  return {
    eventsCount: eventCount,
    symbolsTracked,
    summary: {
      totalSignals: symbolStatsAggregate._sum.totalSignals ?? 0,
      longEntries: symbolStatsAggregate._sum.longEntries ?? 0,
      shortEntries: symbolStatsAggregate._sum.shortEntries ?? 0,
      exits: symbolStatsAggregate._sum.exits ?? 0,
      dcaCount: symbolStatsAggregate._sum.dcaCount ?? 0,
      closedTrades: symbolStatsAggregate._sum.closedTrades ?? 0,
      winningTrades: symbolStatsAggregate._sum.winningTrades ?? 0,
      losingTrades: symbolStatsAggregate._sum.losingTrades ?? 0,
      realizedPnl: symbolStatsAggregate._sum.realizedPnl ?? 0,
      grossProfit: symbolStatsAggregate._sum.grossProfit ?? 0,
      grossLoss: symbolStatsAggregate._sum.grossLoss ?? 0,
      feesPaid: symbolStatsAggregate._sum.feesPaid ?? 0,
      openPositionCount: symbolStatsAggregate._sum.openPositionCount ?? 0,
      openPositionQty: symbolStatsAggregate._sum.openPositionQty ?? 0,
    },
  };
};
