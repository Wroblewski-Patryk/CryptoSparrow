import { prisma } from '../../prisma/client';
import {
  CreateBotDto,
  CreateBotMarketGroupDto,
  ListBotsQueryDto,
  ReorderMarketGroupStrategiesDto,
  AttachMarketGroupStrategyDto,
  UpdateBotDto,
  UpdateBotMarketGroupDto,
  UpdateMarketGroupStrategyDto,
} from './bots.types';

type BotConsentState = {
  mode: 'PAPER' | 'LIVE' | 'LOCAL';
  liveOptIn: boolean;
  consentTextVersion?: string | null;
};

const normalizeConsentTextVersion = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const validateLiveConsentState = (state: BotConsentState) => {
  if (state.liveOptIn && !normalizeConsentTextVersion(state.consentTextVersion)) {
    throw new Error('LIVE_CONSENT_VERSION_REQUIRED');
  }
};

const mapBotResponse = <T extends { botStrategies: Array<{ strategyId: string; isEnabled: boolean }> }>(
  bot: T
) => {
  const { botStrategies, ...rest } = bot;
  const activeStrategy = botStrategies.find((item) => item.isEnabled) ?? botStrategies[0] ?? null;
  return {
    ...rest,
    strategyId: activeStrategy?.strategyId ?? null,
  };
};

const getOrCreateDefaultSymbolGroup = async (userId: string, marketType: 'FUTURES' | 'SPOT') => {
  const existing = await prisma.symbolGroup.findFirst({
    where: {
      userId,
      marketUniverse: {
        marketType,
      },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) return existing.id;

  const baseCurrency = marketType === 'SPOT' ? 'USDT' : 'USDT';
  const universe = await prisma.marketUniverse.create({
    data: {
      userId,
      name: `Auto ${marketType} Universe`,
      marketType,
      baseCurrency,
      whitelist: [],
      blacklist: [],
    },
    select: { id: true },
  });

  const symbolGroup = await prisma.symbolGroup.create({
    data: {
      userId,
      marketUniverseId: universe.id,
      name: `Auto ${marketType} Group`,
      symbols: [],
    },
    select: { id: true },
  });

  return symbolGroup.id;
};

const upsertBotStrategy = async (params: {
  userId: string;
  botId: string;
  strategyId: string | null;
  marketType: 'FUTURES' | 'SPOT';
}) => {
  if (!params.strategyId) {
    await prisma.botStrategy.deleteMany({
      where: { botId: params.botId },
    });
    return;
  }

  const strategy = await prisma.strategy.findFirst({
    where: {
      id: params.strategyId,
      userId: params.userId,
    },
    select: { id: true },
  });

  if (!strategy) {
    throw new Error('BOT_STRATEGY_NOT_FOUND');
  }

  const symbolGroupId = await getOrCreateDefaultSymbolGroup(params.userId, params.marketType);

  await prisma.$transaction([
    prisma.botStrategy.deleteMany({
      where: { botId: params.botId },
    }),
    prisma.botStrategy.create({
      data: {
        botId: params.botId,
        strategyId: strategy.id,
        symbolGroupId,
        isEnabled: true,
      },
    }),
  ]);
};

const writeLiveConsentAudit = async (params: {
  userId: string;
  botId: string;
  mode: 'PAPER' | 'LIVE' | 'LOCAL';
  liveOptIn: boolean;
  consentTextVersion: string;
  action: 'bot.live_consent.accepted' | 'bot.live_consent.updated';
}) => {
  try {
    await prisma.log.create({
      data: {
        userId: params.userId,
        botId: params.botId,
        action: params.action,
        level: 'INFO',
        source: 'bots.service',
        message: `LIVE consent recorded (${params.consentTextVersion})`,
        category: 'RISK_CONSENT',
        entityType: 'BOT',
        entityId: params.botId,
        metadata: {
          mode: params.mode,
          liveOptIn: params.liveOptIn,
          consentTextVersion: params.consentTextVersion,
        },
      },
    });
  } catch {
    // Audit failures should not block core bot updates.
  }
};

const getOwnedBot = async (userId: string, botId: string) =>
  prisma.bot.findFirst({
    where: { id: botId, userId },
    select: { id: true, marketType: true },
  });

const getOwnedSymbolGroup = async (userId: string, symbolGroupId: string) =>
  prisma.symbolGroup.findFirst({
    where: { id: symbolGroupId, userId },
    select: {
      id: true,
      marketUniverse: {
        select: { marketType: true },
      },
    },
  });

const getOwnedStrategy = async (userId: string, strategyId: string) =>
  prisma.strategy.findFirst({
    where: { id: strategyId, userId },
    select: { id: true },
  });

const validateSymbolGroupForBot = async (params: {
  userId: string;
  botId: string;
  symbolGroupId: string;
}) => {
  const bot = await getOwnedBot(params.userId, params.botId);
  if (!bot) throw new Error('BOT_NOT_FOUND');

  const symbolGroup = await getOwnedSymbolGroup(params.userId, params.symbolGroupId);
  if (!symbolGroup) throw new Error('SYMBOL_GROUP_NOT_FOUND');

  if (symbolGroup.marketUniverse.marketType !== bot.marketType) {
    throw new Error('BOT_MARKET_GROUP_MARKET_TYPE_MISMATCH');
  }
};

export const listBots = async (userId: string, query: ListBotsQueryDto = {}) => {
  const bots = await prisma.bot.findMany({
    where: {
      userId,
      ...(query.marketType ? { marketType: query.marketType } : {}),
    },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return bots.map((bot) => mapBotResponse(bot));
};

export const getBot = async (userId: string, id: string) => {
  const bot = await prisma.bot.findFirst({
    where: { id, userId },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
  });

  return bot ? mapBotResponse(bot) : null;
};

export const createBot = async (userId: string, data: CreateBotDto) => {
  validateLiveConsentState(data);

  const { strategyId = null, ...botData } = data;
  const created = await prisma.bot.create({
    data: {
      userId,
      ...botData,
      consentTextVersion: botData.liveOptIn
        ? normalizeConsentTextVersion(botData.consentTextVersion)
        : null,
    },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
  });

  await upsertBotStrategy({
    userId,
    botId: created.id,
    strategyId,
    marketType: created.marketType,
  });

  if (created.liveOptIn && created.consentTextVersion) {
    await writeLiveConsentAudit({
      userId,
      botId: created.id,
      mode: created.mode,
      liveOptIn: created.liveOptIn,
      consentTextVersion: created.consentTextVersion,
      action: 'bot.live_consent.accepted',
    });
  }

  const withStrategy = await prisma.bot.findUnique({
    where: { id: created.id },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
  });

  return withStrategy ? mapBotResponse(withStrategy) : mapBotResponse(created);
};

export const updateBot = async (userId: string, id: string, data: UpdateBotDto) => {
  const existing = await getBot(userId, id);
  if (!existing) return null;

  const nextState: BotConsentState = {
    mode: data.mode ?? existing.mode,
    liveOptIn: data.liveOptIn ?? existing.liveOptIn,
    consentTextVersion:
      data.consentTextVersion !== undefined
        ? data.consentTextVersion
        : existing.consentTextVersion,
  };
  validateLiveConsentState(nextState);

  const nextConsentTextVersion = nextState.liveOptIn
    ? normalizeConsentTextVersion(nextState.consentTextVersion)
    : null;

  const strategyIdUpdateRequested = Object.prototype.hasOwnProperty.call(data, 'strategyId');
  const requestedStrategyId = strategyIdUpdateRequested ? (data.strategyId ?? null) : undefined;

  const { strategyId: _ignoredStrategyId, ...botData } = data;
  const updated = await prisma.bot.update({
    where: { id: existing.id },
    data: {
      ...botData,
      consentTextVersion: nextConsentTextVersion,
    },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
  });

  if (strategyIdUpdateRequested) {
    await upsertBotStrategy({
      userId,
      botId: updated.id,
      strategyId: requestedStrategyId ?? null,
      marketType: updated.marketType,
    });
  }

  if (updated.liveOptIn && updated.consentTextVersion) {
    const consentChanged = updated.consentTextVersion !== existing.consentTextVersion;
    const optInChanged = updated.liveOptIn !== existing.liveOptIn;
    if (consentChanged || optInChanged) {
      await writeLiveConsentAudit({
        userId,
        botId: updated.id,
        mode: updated.mode,
        liveOptIn: updated.liveOptIn,
        consentTextVersion: updated.consentTextVersion,
        action: optInChanged ? 'bot.live_consent.accepted' : 'bot.live_consent.updated',
      });
    }
  }

  const withStrategy = await prisma.bot.findUnique({
    where: { id: updated.id },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
  });

  return withStrategy ? mapBotResponse(withStrategy) : mapBotResponse(updated);
};

export const deleteBot = async (userId: string, id: string) => {
  const existing = await getBot(userId, id);
  if (!existing) return false;

  await prisma.bot.delete({
    where: { id: existing.id },
  });

  return true;
};

export const listBotMarketGroups = async (userId: string, botId: string) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  return prisma.botMarketGroup.findMany({
    where: {
      userId,
      botId,
    },
    orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
  });
};

export const getBotMarketGroup = async (userId: string, botId: string, marketGroupId: string) => {
  return prisma.botMarketGroup.findFirst({
    where: {
      id: marketGroupId,
      userId,
      botId,
    },
  });
};

export const createBotMarketGroup = async (
  userId: string,
  botId: string,
  data: CreateBotMarketGroupDto
) => {
  await validateSymbolGroupForBot({ userId, botId, symbolGroupId: data.symbolGroupId });

  return prisma.botMarketGroup.create({
    data: {
      userId,
      botId,
      symbolGroupId: data.symbolGroupId,
      lifecycleStatus: data.lifecycleStatus,
      executionOrder: data.executionOrder,
      isEnabled: data.isEnabled,
    },
  });
};

export const updateBotMarketGroup = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  data: UpdateBotMarketGroupDto
) => {
  const existing = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!existing) return null;

  if (data.symbolGroupId) {
    await validateSymbolGroupForBot({ userId, botId, symbolGroupId: data.symbolGroupId });
  }

  return prisma.botMarketGroup.update({
    where: { id: existing.id },
    data: {
      ...(data.symbolGroupId ? { symbolGroupId: data.symbolGroupId } : {}),
      ...(data.lifecycleStatus ? { lifecycleStatus: data.lifecycleStatus } : {}),
      ...(data.executionOrder !== undefined ? { executionOrder: data.executionOrder } : {}),
      ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
    },
  });
};

export const deleteBotMarketGroup = async (userId: string, botId: string, marketGroupId: string) => {
  const existing = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!existing) return false;

  await prisma.botMarketGroup.delete({
    where: { id: existing.id },
  });

  return true;
};

export const listMarketGroupStrategyLinks = async (userId: string, botId: string, marketGroupId: string) => {
  const group = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!group) return null;

  return prisma.marketGroupStrategyLink.findMany({
    where: {
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
};

export const attachMarketGroupStrategy = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  data: AttachMarketGroupStrategyDto
) => {
  const group = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!group) throw new Error('BOT_MARKET_GROUP_NOT_FOUND');

  const strategy = await getOwnedStrategy(userId, data.strategyId);
  if (!strategy) throw new Error('BOT_STRATEGY_NOT_FOUND');

  try {
    return prisma.marketGroupStrategyLink.create({
      data: {
        userId,
        botId,
        botMarketGroupId: marketGroupId,
        strategyId: data.strategyId,
        priority: data.priority,
        weight: data.weight,
        isEnabled: data.isEnabled,
      },
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new Error('MARKET_GROUP_STRATEGY_ALREADY_ATTACHED');
    }
    throw error;
  }
};

export const updateMarketGroupStrategy = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  linkId: string,
  data: UpdateMarketGroupStrategyDto
) => {
  const existing = await prisma.marketGroupStrategyLink.findFirst({
    where: {
      id: linkId,
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    select: { id: true },
  });

  if (!existing) return null;

  return prisma.marketGroupStrategyLink.update({
    where: { id: existing.id },
    data: {
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.weight !== undefined ? { weight: data.weight } : {}),
      ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
    },
  });
};

export const detachMarketGroupStrategy = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  linkId: string
) => {
  const existing = await prisma.marketGroupStrategyLink.findFirst({
    where: {
      id: linkId,
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    select: { id: true },
  });

  if (!existing) return false;

  await prisma.marketGroupStrategyLink.delete({
    where: { id: existing.id },
  });

  return true;
};

export const reorderMarketGroupStrategies = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  data: ReorderMarketGroupStrategiesDto
) => {
  const group = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!group) return null;

  const ids = data.items.map((item) => item.id);
  const existing = await prisma.marketGroupStrategyLink.findMany({
    where: {
      id: { in: ids },
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    select: { id: true },
  });

  if (existing.length !== ids.length) {
    throw new Error('MARKET_GROUP_STRATEGY_LINK_NOT_FOUND');
  }

  await prisma.$transaction(
    data.items.map((item) =>
      prisma.marketGroupStrategyLink.update({
        where: { id: item.id },
        data: { priority: item.priority },
      })
    )
  );

  return prisma.marketGroupStrategyLink.findMany({
    where: {
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
};
