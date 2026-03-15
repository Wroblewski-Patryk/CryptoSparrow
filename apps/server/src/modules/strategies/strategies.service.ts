import { prisma } from "../../prisma/client";
import { CreateStrategyDto } from './strategies.types';

export const getStrategies = async (userId: string) => {
    return prisma.strategy.findMany({ where: { userId } });
};

export const getStrategyById = async (id: string, userId: string) => {
    return prisma.strategy.findFirst({ where: { id, userId } });
};

export const createStrategy = async (userId: string, data: CreateStrategyDto) => {
    return prisma.strategy.create({ data: { ...data, userId } });
};

export const updateStrategy = async (id: string, userId: string, data: Partial<CreateStrategyDto>) => {
    const existing = await getStrategyById(id, userId);
    if (!existing) return null;

    return prisma.strategy.update({ where: { id: existing.id }, data });
};

export const deleteStrategy = async (id: string, userId: string) => {
    const existing = await getStrategyById(id, userId);
    if (!existing) return false;

    await prisma.strategy.delete({ where: { id: existing.id } });
    return true;
};
