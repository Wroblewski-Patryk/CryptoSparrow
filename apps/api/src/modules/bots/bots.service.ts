import { prisma } from '../../prisma/client';
import { orchestrateAssistantDecision } from '../engine/assistantOrchestrator.service';
import {
  AssistantDryRunDto,
  CreateBotDto,
  CreateBotMarketGroupDto,
  ListBotsQueryDto,
  ReorderMarketGroupStrategiesDto,
  AttachMarketGroupStrategyDto,
  UpsertBotAssistantConfigDto,
  UpsertBotSubagentConfigDto,
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

const mapBotResponse = <
  T extends {
    botStrategies: Array<{ strategyId: string; isEnabled: boolean }>;
    marketGroupStrategyLinks?: Array<{ strategyId: string; isEnabled: boolean }>;
  },
>(bot: T) => {
  const { botStrategies, marketGroupStrategyLinks = [], ...rest } = bot;
  const activeStrategy =
    botStrategies.find((item) => item.isEnabled) ??
    botStrategies[0] ??
    marketGroupStrategyLinks.find((item) => item.isEnabled) ??
    marketGroupStrategyLinks[0] ??
    null;
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
      marketGroupStrategyLinks: {
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
      marketGroupStrategyLinks: {
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

  const { strategyId, marketGroupId, ...botData } = data;
  const strategy = await getOwnedStrategy(userId, strategyId);
  if (!strategy) throw new Error('BOT_STRATEGY_NOT_FOUND');

  const symbolGroup = await getOwnedSymbolGroup(userId, marketGroupId);
  if (!symbolGroup) throw new Error('SYMBOL_GROUP_NOT_FOUND');
  const derivedMarketType = symbolGroup.marketUniverse.marketType;

  const createdBotId = await prisma.$transaction(async (tx) => {
    const createdBot = await tx.bot.create({
      data: {
        userId,
        ...botData,
        marketType: derivedMarketType,
        consentTextVersion: botData.liveOptIn
          ? normalizeConsentTextVersion(botData.consentTextVersion)
          : null,
      },
      select: {
        id: true,
      },
    });

    const createdBotMarketGroup = await tx.botMarketGroup.create({
      data: {
        userId,
        botId: createdBot.id,
        symbolGroupId: marketGroupId,
        lifecycleStatus: 'ACTIVE',
        executionOrder: 100,
        maxOpenPositions: botData.maxOpenPositions,
        isEnabled: true,
      },
      select: {
        id: true,
      },
    });

    await tx.marketGroupStrategyLink.create({
      data: {
        userId,
        botId: createdBot.id,
        botMarketGroupId: createdBotMarketGroup.id,
        strategyId,
        priority: 100,
        weight: 1,
        isEnabled: true,
      },
      select: {
        id: true,
      },
    });

    return createdBot.id;
  });

  if (botData.liveOptIn && botData.consentTextVersion) {
    await writeLiveConsentAudit({
      userId,
      botId: createdBotId,
      mode: botData.mode,
      liveOptIn: botData.liveOptIn,
      consentTextVersion: normalizeConsentTextVersion(botData.consentTextVersion)!,
      action: 'bot.live_consent.accepted',
    });
  }

  const withStrategy = await prisma.bot.findUnique({
    where: { id: createdBotId },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
      marketGroupStrategyLinks: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
  });

  if (!withStrategy) throw new Error('BOT_NOT_FOUND');
  return mapBotResponse(withStrategy);
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
      marketGroupStrategyLinks: {
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
      marketGroupStrategyLinks: {
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

  await prisma.$transaction([
    prisma.marketGroupStrategyLink.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botMarketGroup.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botStrategy.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botSubagentConfig.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botAssistantConfig.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.bot.delete({
      where: { id: existing.id },
    }),
  ]);

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
      maxOpenPositions: data.maxOpenPositions,
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
      ...(data.maxOpenPositions !== undefined ? { maxOpenPositions: data.maxOpenPositions } : {}),
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

export const getBotRuntimeGraph = async (userId: string, botId: string) => {
  const bot = await prisma.bot.findFirst({
    where: { id: botId, userId },
    select: {
      id: true,
      userId: true,
      name: true,
      mode: true,
      marketType: true,
      positionMode: true,
      isActive: true,
      liveOptIn: true,
      maxOpenPositions: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!bot) return null;

  const marketGroups = await prisma.botMarketGroup.findMany({
    where: {
      userId,
      botId,
    },
    include: {
      symbolGroup: {
        select: {
          id: true,
          name: true,
          symbols: true,
          marketUniverseId: true,
        },
      },
      strategyLinks: {
        include: {
          strategy: {
            select: {
              id: true,
              name: true,
              interval: true,
            },
          },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const legacyBotStrategies = await prisma.botStrategy.findMany({
    where: { botId, bot: { userId } },
    include: {
      symbolGroup: {
        select: {
          id: true,
          name: true,
          symbols: true,
          marketUniverseId: true,
        },
      },
      strategy: {
        select: {
          id: true,
          name: true,
          interval: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  return {
    bot,
    marketGroups: marketGroups.map((group) => ({
      id: group.id,
      botId: group.botId,
      symbolGroupId: group.symbolGroupId,
      lifecycleStatus: group.lifecycleStatus,
      executionOrder: group.executionOrder,
      isEnabled: group.isEnabled,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      symbolGroup: group.symbolGroup,
      strategies: group.strategyLinks.map((link) => ({
        id: link.id,
        strategyId: link.strategyId,
        priority: link.priority,
        weight: link.weight,
        isEnabled: link.isEnabled,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
        strategy: link.strategy,
      })),
    })),
    legacyBotStrategies: legacyBotStrategies.map((item) => ({
      id: item.id,
      strategyId: item.strategyId,
      symbolGroupId: item.symbolGroupId,
      isEnabled: item.isEnabled,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      strategy: item.strategy,
      symbolGroup: item.symbolGroup,
    })),
  };
};

export const getBotAssistantConfig = async (userId: string, botId: string) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  const assistant = await prisma.botAssistantConfig.findUnique({
    where: { botId },
  });
  const subagents = await prisma.botSubagentConfig.findMany({
    where: { userId, botId },
    orderBy: { slotIndex: 'asc' },
  });

  return { assistant, subagents };
};

export const upsertBotAssistantConfig = async (
  userId: string,
  botId: string,
  data: UpsertBotAssistantConfigDto
) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  return prisma.botAssistantConfig.upsert({
    where: { botId },
    update: {
      mainAgentEnabled: data.mainAgentEnabled,
      mandate: data.mandate ?? null,
      modelProfile: data.modelProfile,
      safetyMode: data.safetyMode,
      maxDecisionLatencyMs: data.maxDecisionLatencyMs,
    },
    create: {
      userId,
      botId,
      mainAgentEnabled: data.mainAgentEnabled,
      mandate: data.mandate ?? null,
      modelProfile: data.modelProfile,
      safetyMode: data.safetyMode,
      maxDecisionLatencyMs: data.maxDecisionLatencyMs,
    },
  });
};

export const upsertBotSubagentConfig = async (
  userId: string,
  botId: string,
  slotIndex: number,
  data: UpsertBotSubagentConfigDto
) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;
  if (slotIndex < 1 || slotIndex > 4) throw new Error('SUBAGENT_SLOT_OUT_OF_RANGE');

  return prisma.botSubagentConfig.upsert({
    where: {
      botId_slotIndex: {
        botId,
        slotIndex,
      },
    },
    update: {
      role: data.role,
      enabled: data.enabled,
      modelProfile: data.modelProfile,
      timeoutMs: data.timeoutMs,
      safetyMode: data.safetyMode,
    },
    create: {
      userId,
      botId,
      slotIndex,
      role: data.role,
      enabled: data.enabled,
      modelProfile: data.modelProfile,
      timeoutMs: data.timeoutMs,
      safetyMode: data.safetyMode,
    },
  });
};

export const deleteBotSubagentConfig = async (userId: string, botId: string, slotIndex: number) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return false;
  if (slotIndex < 1 || slotIndex > 4) throw new Error('SUBAGENT_SLOT_OUT_OF_RANGE');

  const existing = await prisma.botSubagentConfig.findUnique({
    where: {
      botId_slotIndex: {
        botId,
        slotIndex,
      },
    },
  });

  if (!existing || existing.userId !== userId) return false;

  await prisma.botSubagentConfig.delete({
    where: {
      botId_slotIndex: {
        botId,
        slotIndex,
      },
    },
  });

  return true;
};

export const runAssistantDryRun = async (userId: string, botId: string, input: AssistantDryRunDto) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  const assistantConfig = await prisma.botAssistantConfig.findUnique({
    where: { botId },
    select: {
      mandate: true,
      safetyMode: true,
    },
  });

  const subagents = await prisma.botSubagentConfig.findMany({
    where: { userId, botId },
    orderBy: { slotIndex: 'asc' },
  });

  return orchestrateAssistantDecision({
    requestId: `dryrun:${Date.now()}:${botId}`,
    userId,
    botId,
    botMarketGroupId: 'dry-run',
    symbol: input.symbol.toUpperCase(),
    intervalWindow: input.intervalWindow,
    mode: input.mode,
    mandate: assistantConfig?.mandate ?? null,
    forbiddenActions:
      assistantConfig?.safetyMode === 'STRICT' ? ['SHORT'] : undefined,
    subagents: subagents.map((slot) => ({
      slotIndex: slot.slotIndex,
      role: slot.role,
      enabled: slot.enabled,
      timeoutMs: slot.timeoutMs,
    })),
  });
};
