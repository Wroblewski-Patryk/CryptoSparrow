import { prisma } from '../../prisma/client';
import { CreateBotDto, UpdateBotDto } from './bots.types';

export const listBots = async (userId: string) => {
  return prisma.bot.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

export const getBot = async (userId: string, id: string) => {
  return prisma.bot.findFirst({
    where: { id, userId },
  });
};

export const createBot = async (userId: string, data: CreateBotDto) => {
  return prisma.bot.create({
    data: {
      userId,
      ...data,
    },
  });
};

export const updateBot = async (userId: string, id: string, data: UpdateBotDto) => {
  const existing = await getBot(userId, id);
  if (!existing) return null;

  return prisma.bot.update({
    where: { id: existing.id },
    data,
  });
};

export const deleteBot = async (userId: string, id: string) => {
  const existing = await getBot(userId, id);
  if (!existing) return false;

  await prisma.bot.delete({
    where: { id: existing.id },
  });

  return true;
};
