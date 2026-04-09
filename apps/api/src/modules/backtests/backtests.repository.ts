import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { ListBacktestRunsQuery, ListBacktestTradesQuery } from './backtests.types';

export const updateBacktestRunById = (runId: string, data: Prisma.BacktestRunUpdateInput) =>
  prisma.backtestRun.update({
    where: { id: runId },
    data,
  });

export const findBacktestRunById = (runId: string) =>
  prisma.backtestRun.findUnique({ where: { id: runId } });

export const findOwnedStrategyForBacktest = (userId: string, strategyId: string) =>
  prisma.strategy.findFirst({
    where: { id: strategyId, userId },
    select: { id: true, leverage: true, config: true },
  });

export const findOwnedStrategySignalConfig = (userId: string, strategyId: string) =>
  prisma.strategy.findFirst({
    where: { id: strategyId, userId },
    select: { config: true, walletRisk: true },
  });

export const createBacktestTrades = (data: Prisma.BacktestTradeCreateManyInput[]) =>
  prisma.backtestTrade.createMany({
    data,
    skipDuplicates: false,
  });

export const countWinningBacktestTrades = (userId: string, runId: string) =>
  prisma.backtestTrade.count({
    where: { backtestRunId: runId, userId, pnl: { gt: 0 } },
  });

export const countLosingBacktestTrades = (userId: string, runId: string) =>
  prisma.backtestTrade.count({
    where: { backtestRunId: runId, userId, pnl: { lt: 0 } },
  });

export const upsertBacktestReportForRun = (input: {
  backtestRunId: string;
  create: Prisma.BacktestReportUncheckedCreateInput;
  update: Prisma.BacktestReportUpdateInput;
}) =>
  prisma.backtestReport.upsert({
    where: { backtestRunId: input.backtestRunId },
    update: input.update,
    create: input.create,
  });

export const findOwnedMarketUniverseById = (userId: string, marketUniverseId: string) =>
  prisma.marketUniverse.findFirst({
    where: {
      id: marketUniverseId,
      userId,
    },
  });

export const listOwnedBacktestRuns = (userId: string, query: ListBacktestRunsQuery) =>
  prisma.backtestRun.findMany({
    where: {
      userId,
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });

export const findOwnedBacktestRun = (userId: string, runId: string) =>
  prisma.backtestRun.findFirst({
    where: { id: runId, userId },
  });

export const findOwnedBacktestRunId = (userId: string, runId: string) =>
  prisma.backtestRun.findFirst({
    where: { id: runId, userId },
    select: { id: true },
  });

export const deleteOwnedBacktestRunCascade = async (userId: string, runId: string) => {
  await prisma.$transaction([
    prisma.backtestReport.deleteMany({
      where: {
        userId,
        backtestRunId: runId,
      },
    }),
    prisma.backtestTrade.deleteMany({
      where: {
        userId,
        backtestRunId: runId,
      },
    }),
    prisma.backtestRun.delete({
      where: { id: runId },
    }),
  ]);
};

export const createBacktestRun = (data: Prisma.BacktestRunUncheckedCreateInput) =>
  prisma.backtestRun.create({ data });

export const listOwnedBacktestTrades = (userId: string, runId: string, query: ListBacktestTradesQuery) =>
  prisma.backtestTrade.findMany({
    where: { userId, backtestRunId: runId },
    orderBy: { closedAt: 'desc' },
    take: query.limit,
  });

export const findOwnedBacktestReport = (userId: string, runId: string) =>
  prisma.backtestReport.findFirst({
    where: { userId, backtestRunId: runId },
  });

export const findOwnedBacktestRunTimelineSeed = (userId: string, runId: string) =>
  prisma.backtestRun.findFirst({
    where: { id: runId, userId },
    select: {
      id: true,
      strategyId: true,
      timeframe: true,
      symbol: true,
      seedConfig: true,
      status: true,
      finishedAt: true,
    },
  });
