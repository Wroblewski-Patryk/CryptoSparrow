import { prisma } from '../../prisma/client';
import { normalizeSymbols } from './runtimeSymbolUniverse.service';

type OwnedStrategy = {
  id: string;
  config: unknown;
};

type OwnedSymbolGroupWithMarketUniverse = {
  id: string;
  marketUniverse: {
    marketType: 'FUTURES' | 'SPOT';
    exchange: import('@prisma/client').Exchange;
  };
};

const getOwnedSymbolGroup = async (userId: string, symbolGroupId: string) =>
  prisma.symbolGroup.findFirst({
    where: { id: symbolGroupId, userId },
    select: {
      id: true,
      marketUniverse: {
        select: { marketType: true, exchange: true },
      },
    },
  });

const getOwnedMarketUniverse = async (userId: string, marketUniverseId: string) =>
  prisma.marketUniverse.findFirst({
    where: { id: marketUniverseId, userId },
    select: {
      id: true,
      name: true,
      whitelist: true,
      blacklist: true,
    },
  });

export const getOwnedStrategy = async (
  userId: string,
  strategyId: string
): Promise<OwnedStrategy | null> =>
  prisma.strategy.findFirst({
    where: { id: strategyId, userId },
    select: {
      id: true,
      config: true,
    },
  });

export const deriveMaxOpenPositionsFromStrategy = (config: unknown) => {
  if (!config || typeof config !== 'object') return 1;

  const cfg = config as Record<string, unknown>;
  const candidates = [
    cfg.maxOpenPositions,
    (cfg.risk as Record<string, unknown> | undefined)?.maxOpenPositions,
    (cfg.open as Record<string, unknown> | undefined)?.maxOpenPositions,
    (cfg.position as Record<string, unknown> | undefined)?.maxOpenPositions,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return 1;
};

export const resolveCreateMarketGroupToSymbolGroup = async (
  userId: string,
  marketGroupId: string
): Promise<OwnedSymbolGroupWithMarketUniverse | null> => {
  const directSymbolGroup = await getOwnedSymbolGroup(userId, marketGroupId);
  if (directSymbolGroup) return directSymbolGroup;

  const marketUniverse = await getOwnedMarketUniverse(userId, marketGroupId);
  if (!marketUniverse) return null;

  const existingSymbolGroup = await prisma.symbolGroup.findFirst({
    where: {
      userId,
      marketUniverseId: marketUniverse.id,
    },
    select: {
      id: true,
      marketUniverse: {
        select: { marketType: true, exchange: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (existingSymbolGroup) return existingSymbolGroup;

  const normalizedWhitelist = normalizeSymbols(marketUniverse.whitelist);
  const blacklistSet = new Set(normalizeSymbols(marketUniverse.blacklist));
  const resolvedSymbols = normalizedWhitelist.filter((symbol) => !blacklistSet.has(symbol));

  return prisma.symbolGroup.create({
    data: {
      userId,
      marketUniverseId: marketUniverse.id,
      name: `${marketUniverse.name} Group`,
      symbols: resolvedSymbols,
    },
    select: {
      id: true,
      marketUniverse: {
        select: { marketType: true, exchange: true },
      },
    },
  });
};

export const findDuplicateActiveBotByStrategyAndSymbolGroup = async (params: {
  userId: string;
  strategyId: string;
  symbolGroupId: string;
  excludeBotId?: string;
}) =>
  prisma.marketGroupStrategyLink.findFirst({
    where: {
      userId: params.userId,
      strategyId: params.strategyId,
      isEnabled: true,
      bot: {
        userId: params.userId,
        isActive: true,
        ...(params.excludeBotId ? { id: { not: params.excludeBotId } } : {}),
      },
      botMarketGroup: {
        userId: params.userId,
        symbolGroupId: params.symbolGroupId,
        isEnabled: true,
        lifecycleStatus: 'ACTIVE',
      },
    },
    select: {
      bot: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
