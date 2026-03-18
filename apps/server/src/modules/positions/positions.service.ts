import { prisma } from '../../prisma/client';
import { ListPositionsQuery } from './positions.types';

export const listPositions = async (userId: string, query: ListPositionsQuery) => {
  const skip = (query.page - 1) * query.limit;
  const where = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.symbol ? { symbol: query.symbol } : {}),
  };

  return prisma.position.findMany({
    where,
    skip,
    take: query.limit,
    orderBy: { openedAt: 'desc' },
  });
};

export const getPosition = async (userId: string, id: string) => {
  return prisma.position.findFirst({
    where: { id, userId },
  });
};
