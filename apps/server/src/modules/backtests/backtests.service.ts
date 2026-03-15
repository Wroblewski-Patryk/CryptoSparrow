import { prisma } from '../../prisma/client';
import { CreateBacktestRunDto, ListBacktestRunsQuery } from './backtests.types';

export const listRuns = async (userId: string, query: ListBacktestRunsQuery) => {
  return prisma.backtestRun.findMany({
    where: {
      userId,
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });
};

export const getRun = async (userId: string, id: string) => {
  return prisma.backtestRun.findFirst({
    where: { id, userId },
  });
};

export const createRun = async (userId: string, data: CreateBacktestRunDto) => {
  if (data.strategyId) {
    const strategy = await prisma.strategy.findFirst({
      where: { id: data.strategyId, userId },
      select: { id: true },
    });
    if (!strategy) return null;
  }

  return prisma.backtestRun.create({
    data: {
      userId,
      name: data.name,
      symbol: data.symbol,
      timeframe: data.timeframe,
      strategyId: data.strategyId,
      seedConfig: data.seedConfig,
      notes: data.notes,
      status: 'PENDING',
    },
  });
};
