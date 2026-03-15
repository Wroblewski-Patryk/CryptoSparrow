import { prisma } from '../../prisma/client';
import { CreateMarketUniverseDto, UpdateMarketUniverseDto } from './markets.types';

export const listUniverses = async (userId: string) => {
  return prisma.marketUniverse.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

export const getUniverse = async (userId: string, id: string) => {
  return prisma.marketUniverse.findFirst({
    where: { id, userId },
  });
};

export const createUniverse = async (userId: string, data: CreateMarketUniverseDto) => {
  return prisma.marketUniverse.create({
    data: {
      userId,
      ...data,
    },
  });
};

export const updateUniverse = async (
  userId: string,
  id: string,
  data: UpdateMarketUniverseDto
) => {
  const existing = await getUniverse(userId, id);
  if (!existing) return null;

  return prisma.marketUniverse.update({
    where: { id: existing.id },
    data,
  });
};

export const deleteUniverse = async (userId: string, id: string) => {
  const existing = await getUniverse(userId, id);
  if (!existing) return false;

  await prisma.marketUniverse.delete({
    where: { id: existing.id },
  });

  return true;
};
