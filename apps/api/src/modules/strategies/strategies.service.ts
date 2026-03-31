import { prisma } from "../../prisma/client";
import type { Prisma } from '@prisma/client';
import {
  CreateStrategyDto,
  STRATEGY_EXPORT_FORMAT_VERSION,
  StrategyExportPackage,
} from './strategies.types';

export const getStrategies = async (userId: string) => {
    return prisma.strategy.findMany({ where: { userId } });
};

export const getStrategyById = async (id: string, userId: string) => {
    return prisma.strategy.findFirst({ where: { id, userId } });
};

export const createStrategy = async (userId: string, data: CreateStrategyDto) => {
    return prisma.strategy.create({
      data: {
        ...data,
        userId,
        config: data.config as Prisma.InputJsonValue,
      },
    });
};

export const updateStrategy = async (id: string, userId: string, data: Partial<CreateStrategyDto>) => {
    const existing = await getStrategyById(id, userId);
    if (!existing) return null;

    const usedByActiveCanonicalBot = await prisma.marketGroupStrategyLink.findFirst({
      where: {
        userId,
        strategyId: existing.id,
        isEnabled: true,
        bot: {
          userId,
          isActive: true,
        },
        botMarketGroup: {
          userId,
          isEnabled: true,
          lifecycleStatus: 'ACTIVE',
        },
      },
      select: { id: true },
    });

    const usedByActiveLegacyBot = await prisma.botStrategy.findFirst({
      where: {
        strategyId: existing.id,
        isEnabled: true,
        bot: {
          userId,
          isActive: true,
        },
      },
      select: { id: true },
    });

    if (usedByActiveCanonicalBot || usedByActiveLegacyBot) {
      throw new Error('STRATEGY_USED_BY_ACTIVE_BOT');
    }

    return prisma.strategy.update({
      where: { id: existing.id },
      data: {
        ...data,
        config: data.config as Prisma.InputJsonValue | undefined,
      },
    });
};

export const deleteStrategy = async (id: string, userId: string) => {
    const existing = await getStrategyById(id, userId);
    if (!existing) return false;

    await prisma.strategy.delete({ where: { id: existing.id } });
    return true;
};

export const exportStrategy = async (
  id: string,
  userId: string
): Promise<StrategyExportPackage | null> => {
  const existing = await getStrategyById(id, userId);
  if (!existing) return null;

  return {
    formatVersion: STRATEGY_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    strategy: {
      name: existing.name,
      description: existing.description ?? undefined,
      interval: existing.interval,
      leverage: existing.leverage,
      walletRisk: existing.walletRisk,
      config: existing.config,
    },
  };
};

const isValidImportPayload = (payload: unknown): payload is StrategyExportPackage => {
  if (!payload || typeof payload !== 'object') return false;
  const maybePackage = payload as Partial<StrategyExportPackage>;
  const maybeStrategy = maybePackage.strategy as Partial<CreateStrategyDto> | undefined;

  if (maybePackage.formatVersion !== STRATEGY_EXPORT_FORMAT_VERSION) return false;
  if (!maybeStrategy || typeof maybeStrategy !== 'object') return false;
  if (typeof maybeStrategy.name !== 'string' || !maybeStrategy.name.trim()) return false;
  if (typeof maybeStrategy.interval !== 'string' || !maybeStrategy.interval.trim()) return false;
  if (typeof maybeStrategy.leverage !== 'number') return false;
  if (typeof maybeStrategy.walletRisk !== 'number') return false;
  return true;
};

export const importStrategy = async (userId: string, payload: unknown) => {
  if (!isValidImportPayload(payload)) {
    throw new Error('INVALID_STRATEGY_IMPORT_PAYLOAD');
  }

  const source = payload.strategy;
  return prisma.strategy.create({
    data: {
      userId,
      name: source.name,
      description: source.description,
      interval: source.interval,
      leverage: source.leverage,
      walletRisk: source.walletRisk,
      config: source.config as Prisma.InputJsonValue,
    },
  });
};
