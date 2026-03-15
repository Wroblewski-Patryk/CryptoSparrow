import { prisma } from '../../prisma/client';
import { ListPositionsQuery } from './positions.types';

export const listPositions = async (userId: string, query: ListPositionsQuery) => {
  const where = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.symbol ? { symbol: query.symbol } : {}),
  };

  return prisma.position.findMany({
    where,
    take: query.limit,
    orderBy: { openedAt: 'desc' },
  });
};

export const getPosition = async (userId: string, id: string) => {
  return prisma.position.findFirst({
    where: { id, userId },
  });
};
