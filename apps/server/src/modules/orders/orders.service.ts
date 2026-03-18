import { prisma } from '../../prisma/client';
import { ListOrdersQuery } from './orders.types';

export const listOrders = async (userId: string, query: ListOrdersQuery) => {
  const skip = (query.page - 1) * query.limit;
  const where = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.symbol ? { symbol: query.symbol } : {}),
  };

  return prisma.order.findMany({
    where,
    skip,
    take: query.limit,
    orderBy: { createdAt: 'desc' },
  });
};

export const getOrder = async (userId: string, id: string) => {
  return prisma.order.findFirst({
    where: { id, userId },
  });
};
