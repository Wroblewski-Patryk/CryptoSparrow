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
    return prisma.strategy.update({ where: { id, userId }, data });
};

export const deleteStrategy = async (id: string, userId: string) => {
    return prisma.strategy.delete({ where: { id, userId } });
};
