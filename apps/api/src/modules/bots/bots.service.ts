import { prisma } from '../../prisma/client';
import { orchestrateAssistantDecision } from '../engine/assistantOrchestrator.service';
import { runtimePositionAutomationService } from '../engine/runtimePositionAutomation.service';
import { getRuntimeTicker } from '../engine/runtimeTickerStore';
import { parseStrategySignalRules } from '../engine/strategySignalEvaluator';
import {
  AssistantDryRunDto,
  CreateBotDto,
  CreateBotMarketGroupDto,
  ListBotsQueryDto,
  ListBotRuntimeSymbolStatsQueryDto,
  ListBotRuntimePositionsQueryDto,
  ListBotRuntimeTradesQueryDto,
  ReorderMarketGroupStrategiesDto,
  AttachMarketGroupStrategyDto,
  ListBotRuntimeSessionsQueryDto,
  UpsertBotAssistantConfigDto,
  UpsertBotSubagentConfigDto,
  UpdateBotDto,
  UpdateBotMarketGroupDto,
  UpdateMarketGroupStrategyDto,
} from './bots.types';

type BotConsentState = {
  mode: 'PAPER' | 'LIVE';
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
  mode: 'PAPER' | 'LIVE';
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

const getOwnedBotRuntimeSession = async (userId: string, botId: string, sessionId: string) =>
  prisma.botRuntimeSession.findFirst({
    where: {
      id: sessionId,
      userId,
      botId,
    },
  });

const resolveSessionWindowEnd = (session: {
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  finishedAt: Date | null;
  lastHeartbeatAt: Date | null;
  startedAt: Date;
}) => {
  if (session.finishedAt) return session.finishedAt;
  if (session.status === 'RUNNING') return new Date();
  return session.lastHeartbeatAt ?? session.startedAt;
};

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

const getOwnedMarketUniverse = async (userId: string, marketUniverseId: string) =>
  prisma.marketUniverse.findFirst({
    where: { id: marketUniverseId, userId },
    select: {
      id: true,
      name: true,
      marketType: true,
      whitelist: true,
      blacklist: true,
    },
  });

const normalizeSymbols = (symbols: string[]) =>
  [...new Set(symbols.map((item) => item.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

const computePriceFromLeveragedMovePercent = (
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  movePercent: number,
  leverage: number
) => {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  if (!Number.isFinite(movePercent)) return null;
  const effectiveLeverage = Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
  const delta = movePercent / effectiveLeverage;
  const raw =
    side === 'LONG' ? entryPrice * (1 + delta) : entryPrice * (1 - delta);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatSignalRule = (rule: {
  name: string;
  condition: string;
  value: number;
  params: Record<string, unknown>;
}) => {
  const indicator = rule.name.toUpperCase();
  if (indicator.includes('RSI')) {
    const period = toFiniteNumber(rule.params.period ?? rule.params.length) ?? 14;
    return `RSI(${Math.trunc(period)}) ${rule.condition} ${rule.value}`;
  }
  if (indicator.includes('MOMENTUM')) {
    const period = toFiniteNumber(rule.params.period ?? rule.params.length) ?? 14;
    return `MOMENTUM(${Math.trunc(period)}) ${rule.condition} ${rule.value}`;
  }
  if (indicator.includes('EMA')) {
    const fast = toFiniteNumber(rule.params.fast) ?? 9;
    const slow = toFiniteNumber(rule.params.slow) ?? 21;
    return `EMA(${Math.trunc(fast)}/${Math.trunc(slow)}) ${rule.condition}`;
  }
  return `${indicator} ${rule.condition} ${rule.value}`;
};

const buildSignalConditionSummary = (
  strategyConfig: Record<string, unknown> | null | undefined,
  direction: 'LONG' | 'SHORT' | 'EXIT' | null
) => {
  if (!strategyConfig) return null;
  const rules = parseStrategySignalRules(strategyConfig);
  if (!rules) return null;
  if (direction === 'EXIT') {
    return rules.noMatchAction === 'EXIT'
      ? 'No-match action: EXIT'
      : 'No-match action: HOLD';
  }
  const source = direction === 'SHORT' ? rules.shortRules : rules.longRules;
  if (source.length === 0) return null;
  return source.map(formatSignalRule).join(' • ');
};

const humanizeMergeReason = (reason: string | null) => {
  if (reason === 'weighted_winner') return 'Weighted winner';
  if (reason === 'exit_priority') return 'Exit priority';
  if (reason === 'weak_consensus') return 'Weak consensus';
  if (reason === 'tie') return 'Tie';
  if (reason === 'no_votes') return 'No votes';
  return reason;
};

const resolveCreateMarketGroupToSymbolGroup = async (userId: string, marketGroupId: string) => {
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
        select: { marketType: true },
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
        select: { marketType: true },
      },
    },
  });
};

const getOwnedStrategy = async (userId: string, strategyId: string) =>
  prisma.strategy.findFirst({
    where: { id: strategyId, userId },
    select: {
      id: true,
      config: true,
    },
  });

const deriveMaxOpenPositionsFromStrategy = (config: unknown) => {
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

const findDuplicateActiveBotByStrategyAndSymbolGroup = async (params: {
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

const assertNoDuplicateActiveBotByStrategyAndSymbolGroup = async (params: {
  userId: string;
  strategyId: string;
  symbolGroupId: string;
  excludeBotId?: string;
}) => {
  const duplicate = await findDuplicateActiveBotByStrategyAndSymbolGroup(params);
  if (duplicate?.bot) {
    throw new Error('ACTIVE_BOT_STRATEGY_MARKET_GROUP_DUPLICATE');
  }
};

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

  const symbolGroup = await resolveCreateMarketGroupToSymbolGroup(userId, marketGroupId);
  if (!symbolGroup) throw new Error('SYMBOL_GROUP_NOT_FOUND');
  const derivedMarketType = symbolGroup.marketUniverse.marketType;
  const derivedMaxOpenPositions = deriveMaxOpenPositionsFromStrategy(strategy.config);

  if (botData.isActive) {
    await assertNoDuplicateActiveBotByStrategyAndSymbolGroup({
      userId,
      strategyId,
      symbolGroupId: symbolGroup.id,
    });
  }

  const createdBotId = await prisma.$transaction(async (tx) => {
    const createdBot = await tx.bot.create({
      data: {
        userId,
        ...botData,
        marketType: derivedMarketType,
        positionMode: 'ONE_WAY',
        maxOpenPositions: derivedMaxOpenPositions,
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
        symbolGroupId: symbolGroup.id,
        lifecycleStatus: 'ACTIVE',
        executionOrder: 100,
        maxOpenPositions: derivedMaxOpenPositions,
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
  const marketGroupIdUpdateRequested = Object.prototype.hasOwnProperty.call(data, 'marketGroupId');
  const requestedMarketGroupId = marketGroupIdUpdateRequested ? (data.marketGroupId ?? null) : undefined;
  const nextIsActive = data.isActive ?? existing.isActive;

  if (nextIsActive) {
    const targetStrategyId = requestedStrategyId !== undefined ? requestedStrategyId : (existing.strategyId ?? null);
    if (targetStrategyId) {
      let targetSymbolGroupId: string | null = null;

      if (requestedMarketGroupId) {
        const resolvedGroup = await resolveCreateMarketGroupToSymbolGroup(userId, requestedMarketGroupId);
        if (!resolvedGroup) throw new Error('SYMBOL_GROUP_NOT_FOUND');
        targetSymbolGroupId = resolvedGroup.id;
      } else {
        const primaryGroup = await prisma.botMarketGroup.findFirst({
          where: {
            userId,
            botId: existing.id,
            isEnabled: true,
          },
          orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            symbolGroupId: true,
          },
        });
        targetSymbolGroupId = primaryGroup?.symbolGroupId ?? null;
      }

      if (targetSymbolGroupId) {
        await assertNoDuplicateActiveBotByStrategyAndSymbolGroup({
          userId,
          strategyId: targetStrategyId,
          symbolGroupId: targetSymbolGroupId,
          excludeBotId: existing.id,
        });
      }
    }
  }

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

export const listBotRuntimeSessions = async (
  userId: string,
  botId: string,
  query: ListBotRuntimeSessionsQueryDto
) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  const sessions = await prisma.botRuntimeSession.findMany({
    where: {
      userId,
      botId,
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    take: query.limit,
  });

  if (sessions.length === 0) return [];
  const sessionIds = sessions.map((session) => session.id);

  const [eventCounts, symbolCounts, symbolSums] = await Promise.all([
    prisma.botRuntimeEvent.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _count: { _all: true },
    }),
    prisma.botRuntimeSymbolStat.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _count: { _all: true },
    }),
    prisma.botRuntimeSymbolStat.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _sum: {
        totalSignals: true,
        dcaCount: true,
        closedTrades: true,
        realizedPnl: true,
      },
    }),
  ]);

  const eventCountMap = new Map(eventCounts.map((entry) => [entry.sessionId, entry._count._all]));
  const symbolCountMap = new Map(symbolCounts.map((entry) => [entry.sessionId, entry._count._all]));
  const symbolSumMap = new Map(
    symbolSums.map((entry) => [
      entry.sessionId,
      {
        totalSignals: entry._sum.totalSignals ?? 0,
        dcaCount: entry._sum.dcaCount ?? 0,
        closedTrades: entry._sum.closedTrades ?? 0,
        realizedPnl: entry._sum.realizedPnl ?? 0,
      },
    ])
  );

  return sessions.map((session) => {
    const summary = symbolSumMap.get(session.id) ?? {
      totalSignals: 0,
      dcaCount: 0,
      closedTrades: 0,
      realizedPnl: 0,
    };
    const windowEnd = resolveSessionWindowEnd(session);
    const durationMs = Math.max(0, windowEnd.getTime() - session.startedAt.getTime());

    return {
      id: session.id,
      botId: session.botId,
      mode: session.mode,
      status: session.status,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
      stopReason: session.stopReason,
      errorMessage: session.errorMessage,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      durationMs,
      eventsCount: eventCountMap.get(session.id) ?? 0,
      symbolsTracked: symbolCountMap.get(session.id) ?? 0,
      summary,
    };
  });
};

export const getBotRuntimeSession = async (userId: string, botId: string, sessionId: string) => {
  const session = await getOwnedBotRuntimeSession(userId, botId, sessionId);
  if (!session) return null;

  const [eventCount, symbolsTracked, symbolStatsAggregate] = await Promise.all([
    prisma.botRuntimeEvent.count({
      where: { sessionId: session.id },
    }),
    prisma.botRuntimeSymbolStat.count({
      where: { sessionId: session.id },
    }),
    prisma.botRuntimeSymbolStat.aggregate({
      where: { sessionId: session.id },
      _sum: {
        totalSignals: true,
        longEntries: true,
        shortEntries: true,
        exits: true,
        dcaCount: true,
        closedTrades: true,
        winningTrades: true,
        losingTrades: true,
        realizedPnl: true,
        grossProfit: true,
        grossLoss: true,
        feesPaid: true,
        openPositionCount: true,
        openPositionQty: true,
      },
    }),
  ]);

  const windowEnd = resolveSessionWindowEnd(session);
  const durationMs = Math.max(0, windowEnd.getTime() - session.startedAt.getTime());

  return {
    id: session.id,
    botId: session.botId,
    mode: session.mode,
    status: session.status,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    lastHeartbeatAt: session.lastHeartbeatAt,
    stopReason: session.stopReason,
    errorMessage: session.errorMessage,
    metadata: session.metadata,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    durationMs,
    eventsCount: eventCount,
    symbolsTracked,
    summary: {
      totalSignals: symbolStatsAggregate._sum.totalSignals ?? 0,
      longEntries: symbolStatsAggregate._sum.longEntries ?? 0,
      shortEntries: symbolStatsAggregate._sum.shortEntries ?? 0,
      exits: symbolStatsAggregate._sum.exits ?? 0,
      dcaCount: symbolStatsAggregate._sum.dcaCount ?? 0,
      closedTrades: symbolStatsAggregate._sum.closedTrades ?? 0,
      winningTrades: symbolStatsAggregate._sum.winningTrades ?? 0,
      losingTrades: symbolStatsAggregate._sum.losingTrades ?? 0,
      realizedPnl: symbolStatsAggregate._sum.realizedPnl ?? 0,
      grossProfit: symbolStatsAggregate._sum.grossProfit ?? 0,
      grossLoss: symbolStatsAggregate._sum.grossLoss ?? 0,
      feesPaid: symbolStatsAggregate._sum.feesPaid ?? 0,
      openPositionCount: symbolStatsAggregate._sum.openPositionCount ?? 0,
      openPositionQty: symbolStatsAggregate._sum.openPositionQty ?? 0,
    },
  };
};

export const listBotRuntimeSessionSymbolStats = async (
  userId: string,
  botId: string,
  sessionId: string,
  query: ListBotRuntimeSymbolStatsQueryDto
) => {
  const session = await getOwnedBotRuntimeSession(userId, botId, sessionId);
  if (!session) return null;

  const normalizedSymbol = query.symbol?.trim().toUpperCase();
  const where = {
    userId,
    botId,
    sessionId,
    ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
  };
  const windowEnd = resolveSessionWindowEnd(session);

  const [items, summary, configuredMarketGroups, configuredBotStrategies] = await Promise.all([
    prisma.botRuntimeSymbolStat.findMany({
      where,
      orderBy: [{ realizedPnl: 'desc' }, { updatedAt: 'desc' }],
      take: query.limit,
    }),
    prisma.botRuntimeSymbolStat.aggregate({
      where,
      _sum: {
        totalSignals: true,
        longEntries: true,
        shortEntries: true,
        exits: true,
        dcaCount: true,
        closedTrades: true,
        winningTrades: true,
        losingTrades: true,
        realizedPnl: true,
        grossProfit: true,
        grossLoss: true,
        feesPaid: true,
      },
    }),
    prisma.botMarketGroup.findMany({
      where: {
        userId,
        botId,
        isEnabled: true,
        lifecycleStatus: {
          in: ['ACTIVE', 'PAUSED'],
        },
      },
      select: {
        symbolGroup: {
          select: {
            symbols: true,
          },
        },
      },
      orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.botStrategy.findMany({
      where: {
        botId,
        isEnabled: true,
        bot: {
          userId,
        },
      },
      select: {
        symbolGroup: {
          select: {
            symbols: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    }),
  ]);

  const configuredSymbols = normalizeSymbols(
    [
      ...configuredMarketGroups.flatMap((group) => group.symbolGroup.symbols ?? []),
      ...configuredBotStrategies.flatMap((strategy) => strategy.symbolGroup.symbols ?? []),
    ]
  );
  const symbols = (
    normalizedSymbol
      ? [normalizedSymbol]
      : normalizeSymbols([...configuredSymbols, ...items.map((item) => item.symbol)])
  ).slice(0, query.limit);
  const [openPositions, latestTradeBySymbolRows, latestSignalEvents] = symbols.length
    ? await Promise.all([
        prisma.position.findMany({
          where: {
            userId,
            botId,
            status: 'OPEN',
            managementMode: 'BOT_MANAGED',
            symbol: { in: symbols },
            openedAt: {
              gte: session.startedAt,
              lte: windowEnd,
            },
          },
          select: {
            symbol: true,
            side: true,
            entryPrice: true,
            quantity: true,
          },
        }),
        prisma.trade.groupBy({
          by: ['symbol'],
          where: {
            userId,
            botId,
            symbol: { in: symbols },
            executedAt: {
              gte: session.startedAt,
              lte: windowEnd,
            },
          },
          _max: {
            executedAt: true,
          },
        }),
        prisma.botRuntimeEvent.findMany({
          where: {
            sessionId,
            eventType: 'SIGNAL_DECISION',
            symbol: { in: symbols },
          },
          orderBy: [{ eventAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            symbol: true,
            signalDirection: true,
            eventAt: true,
            message: true,
            strategyId: true,
            payload: true,
          },
        }),
      ])
    : [[], [], []];

  const lastPriceBySymbol = new Map(items.map((item) => [item.symbol, item.lastPrice]));
  for (const symbol of symbols) {
    const ticker = getRuntimeTicker(symbol);
    if (ticker && Number.isFinite(ticker.lastPrice)) {
      lastPriceBySymbol.set(symbol, ticker.lastPrice);
    }
  }
  const latestTradeAtBySymbol = new Map(
    latestTradeBySymbolRows.map((row) => [row.symbol, row._max.executedAt ?? null])
  );
  const latestSignalBySymbol = new Map<
    string,
    {
      signalDirection: 'LONG' | 'SHORT' | 'EXIT' | null;
      eventAt: Date | null;
      message: string | null;
      mergeReason: string | null;
      strategyId: string | null;
      scoreLong: number | null;
      scoreShort: number | null;
    }
  >();
  const latestSignalStrategyIds = new Set<string>();
  for (const event of latestSignalEvents) {
    if (!event.symbol || latestSignalBySymbol.has(event.symbol)) continue;
    const payload = asRecord(event.payload);
    const merge = asRecord(payload?.merge);
    const scores = asRecord(merge?.scores);
    const winner = asRecord(merge?.winner);
    const mergeReasonRaw =
      typeof merge?.reason === 'string' && merge.reason.trim().length > 0
        ? merge.reason.trim()
        : null;
    const winnerStrategyId =
      typeof winner?.strategyId === 'string' && winner.strategyId.trim().length > 0
        ? winner.strategyId.trim()
        : null;
    const strategyId =
      (typeof event.strategyId === 'string' && event.strategyId.trim().length > 0
        ? event.strategyId.trim()
        : null) ??
      winnerStrategyId;
    if (strategyId) latestSignalStrategyIds.add(strategyId);
    latestSignalBySymbol.set(event.symbol, {
      signalDirection:
        event.signalDirection === 'LONG' ||
        event.signalDirection === 'SHORT' ||
        event.signalDirection === 'EXIT'
          ? event.signalDirection
          : null,
      eventAt: event.eventAt ?? null,
      message: event.message ?? null,
      mergeReason: humanizeMergeReason(mergeReasonRaw),
      strategyId,
      scoreLong: toFiniteNumber(scores?.longScore),
      scoreShort: toFiniteNumber(scores?.shortScore),
    });
  }
  const strategiesById =
    latestSignalStrategyIds.size > 0
      ? new Map(
          (
            await prisma.strategy.findMany({
              where: {
                userId,
                id: { in: [...latestSignalStrategyIds] },
              },
              select: {
                id: true,
                name: true,
                config: true,
              },
            })
          ).map((strategy) => [
            strategy.id,
            {
              name: strategy.name,
              config: asRecord(strategy.config) ?? null,
            },
          ])
        )
      : new Map<string, { name: string; config: Record<string, unknown> | null }>();
  const openPositionCountBySymbol = new Map<string, number>();
  const openPositionQtyBySymbol = new Map<string, number>();
  const unrealizedPnlBySymbol = new Map<string, number>();

  for (const position of openPositions) {
    const lastPrice = lastPriceBySymbol.get(position.symbol);
    if (typeof lastPrice === 'number' && Number.isFinite(lastPrice)) {
      const sideMultiplier = position.side === 'LONG' ? 1 : -1;
      const pnl = (lastPrice - position.entryPrice) * position.quantity * sideMultiplier;
      unrealizedPnlBySymbol.set(
        position.symbol,
        (unrealizedPnlBySymbol.get(position.symbol) ?? 0) + pnl
      );
    }
    openPositionCountBySymbol.set(
      position.symbol,
      (openPositionCountBySymbol.get(position.symbol) ?? 0) + 1
    );
    openPositionQtyBySymbol.set(
      position.symbol,
      (openPositionQtyBySymbol.get(position.symbol) ?? 0) + position.quantity
    );
  }

  const statBySymbol = new Map(items.map((item) => [item.symbol, item]));
  const itemsWithLivePnl = symbols.map((symbol) => {
    const stat = statBySymbol.get(symbol) ?? null;
    const openCount = openPositionCountBySymbol.get(symbol);
    const openQty = openPositionQtyBySymbol.get(symbol);
    const unrealizedPnl = unrealizedPnlBySymbol.get(symbol) ?? 0;
    const latestSignal = latestSignalBySymbol.get(symbol);
    const lastPrice = lastPriceBySymbol.get(symbol) ?? null;
    const signalStrategy =
      latestSignal?.strategyId != null ? strategiesById.get(latestSignal.strategyId) ?? null : null;
    const signalConditionSummary = buildSignalConditionSummary(
      signalStrategy?.config ?? null,
      latestSignal?.signalDirection ?? null
    );
    const signalScoreSummary =
      latestSignal?.scoreLong != null || latestSignal?.scoreShort != null
        ? {
            longScore: latestSignal?.scoreLong ?? 0,
            shortScore: latestSignal?.scoreShort ?? 0,
          }
        : null;

    return {
      id: stat?.id ?? `virtual-${sessionId}-${symbol}`,
      userId,
      botId,
      sessionId,
      symbol,
      totalSignals: stat?.totalSignals ?? 0,
      longEntries: stat?.longEntries ?? 0,
      shortEntries: stat?.shortEntries ?? 0,
      exits: stat?.exits ?? 0,
      dcaCount: stat?.dcaCount ?? 0,
      closedTrades: stat?.closedTrades ?? 0,
      winningTrades: stat?.winningTrades ?? 0,
      losingTrades: stat?.losingTrades ?? 0,
      realizedPnl: stat?.realizedPnl ?? 0,
      grossProfit: stat?.grossProfit ?? 0,
      grossLoss: stat?.grossLoss ?? 0,
      feesPaid: stat?.feesPaid ?? 0,
      openPositionCount: openCount ?? stat?.openPositionCount ?? 0,
      openPositionQty: openQty ?? stat?.openPositionQty ?? 0,
      unrealizedPnl,
      lastPrice,
      lastSignalAt: stat?.lastSignalAt ?? null,
      lastTradeAt: stat?.lastTradeAt ?? latestTradeAtBySymbol.get(symbol) ?? null,
      lastSignalDirection: latestSignal?.signalDirection ?? null,
      lastSignalDecisionAt: latestSignal?.eventAt ?? stat?.lastSignalAt ?? null,
      lastSignalMessage: latestSignal?.message ?? null,
      lastSignalReason: latestSignal?.mergeReason ?? null,
      lastSignalStrategyId: latestSignal?.strategyId ?? null,
      lastSignalStrategyName: signalStrategy?.name ?? null,
      lastSignalConditionSummary: signalConditionSummary,
      lastSignalScoreSummary: signalScoreSummary,
      snapshotAt: stat?.snapshotAt ?? session.startedAt,
      createdAt: stat?.createdAt ?? session.createdAt,
      updatedAt: stat?.updatedAt ?? session.updatedAt,
    };
  });

  const summaryUnrealizedPnl = itemsWithLivePnl.reduce(
    (acc, item) => acc + (Number.isFinite(item.unrealizedPnl) ? item.unrealizedPnl : 0),
    0
  );
  const summaryOpenPositionCount = itemsWithLivePnl.reduce((acc, item) => acc + item.openPositionCount, 0);
  const summaryOpenPositionQty = itemsWithLivePnl.reduce((acc, item) => acc + item.openPositionQty, 0);
  const summaryRealizedPnl = summary._sum.realizedPnl ?? 0;

  return {
    sessionId,
    items: itemsWithLivePnl,
    summary: {
      totalSignals: summary._sum.totalSignals ?? 0,
      longEntries: summary._sum.longEntries ?? 0,
      shortEntries: summary._sum.shortEntries ?? 0,
      exits: summary._sum.exits ?? 0,
      dcaCount: summary._sum.dcaCount ?? 0,
      closedTrades: summary._sum.closedTrades ?? 0,
      winningTrades: summary._sum.winningTrades ?? 0,
      losingTrades: summary._sum.losingTrades ?? 0,
      realizedPnl: summaryRealizedPnl,
      unrealizedPnl: summaryUnrealizedPnl,
      totalPnl: summaryRealizedPnl + summaryUnrealizedPnl,
      grossProfit: summary._sum.grossProfit ?? 0,
      grossLoss: summary._sum.grossLoss ?? 0,
      feesPaid: summary._sum.feesPaid ?? 0,
      openPositionCount: summaryOpenPositionCount,
      openPositionQty: summaryOpenPositionQty,
    },
  };
};

export const listBotRuntimeSessionTrades = async (
  userId: string,
  botId: string,
  sessionId: string,
  query: ListBotRuntimeTradesQueryDto
) => {
  const session = await getOwnedBotRuntimeSession(userId, botId, sessionId);
  if (!session) return null;

  const normalizedSymbol = query.symbol?.trim().toUpperCase();
  const windowEnd = resolveSessionWindowEnd(session);
  const where = {
    userId,
    botId,
    executedAt: {
      gte: session.startedAt,
      lte: windowEnd,
    },
    ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.trade.count({
      where,
    }),
    prisma.trade.findMany({
      where,
      orderBy: [{ executedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.limit,
      select: {
        id: true,
        symbol: true,
        side: true,
        price: true,
        quantity: true,
        fee: true,
        realizedPnl: true,
        executedAt: true,
        orderId: true,
        positionId: true,
        strategyId: true,
        origin: true,
        managementMode: true,
      },
    }),
  ]);

  return {
    sessionId,
    total,
    window: {
      startedAt: session.startedAt,
      finishedAt: windowEnd,
    },
    items: items.map((trade) => ({
      ...trade,
      notional: trade.price * trade.quantity,
    })),
  };
};

export const listBotRuntimeSessionPositions = async (
  userId: string,
  botId: string,
  sessionId: string,
  query: ListBotRuntimePositionsQueryDto
) => {
  const session = await getOwnedBotRuntimeSession(userId, botId, sessionId);
  if (!session) return null;

  const normalizedSymbol = query.symbol?.trim().toUpperCase();
  const windowEnd = resolveSessionWindowEnd(session);

  const positions = await prisma.position.findMany({
    where: {
      userId,
      botId,
      managementMode: 'BOT_MANAGED',
      ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
      openedAt: {
        lte: windowEnd,
      },
      OR: [{ closedAt: null }, { closedAt: { gte: session.startedAt } }],
    },
    orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
    take: query.limit,
    select: {
      id: true,
      symbol: true,
      side: true,
      status: true,
      entryPrice: true,
      quantity: true,
      leverage: true,
      stopLoss: true,
      takeProfit: true,
      openedAt: true,
      closedAt: true,
      realizedPnl: true,
      unrealizedPnl: true,
    },
  });

  if (positions.length === 0) {
    const openOrders = await prisma.order.findMany({
      where: {
        userId,
        botId,
        managementMode: 'BOT_MANAGED',
        status: {
          in: ['PENDING', 'OPEN', 'PARTIALLY_FILLED'],
        },
        ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
        createdAt: {
          gte: session.startedAt,
          lte: windowEnd,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
      take: query.limit,
      select: {
        id: true,
        symbol: true,
        side: true,
        type: true,
        status: true,
        quantity: true,
        filledQuantity: true,
        price: true,
        stopPrice: true,
        submittedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      sessionId,
      total: 0,
      openCount: 0,
      closedCount: 0,
      openOrdersCount: openOrders.length,
      window: {
        startedAt: session.startedAt,
        finishedAt: windowEnd,
      },
      summary: {
        realizedPnl: 0,
        unrealizedPnl: 0,
        feesPaid: 0,
      },
      openOrders: openOrders,
      openItems: [],
      historyItems: [],
    };
  }

  const positionIds = positions.map((position) => position.id);
  const symbols = [...new Set(positions.map((position) => position.symbol))];

  const [trades, lastSymbolPrices, openOrders] = await Promise.all([
    prisma.trade.findMany({
      where: {
        userId,
        botId,
        positionId: { in: positionIds },
      },
      orderBy: [{ executedAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        positionId: true,
        side: true,
        price: true,
        quantity: true,
        fee: true,
        realizedPnl: true,
        executedAt: true,
      },
    }),
    prisma.botRuntimeSymbolStat.findMany({
      where: {
        sessionId,
        symbol: { in: symbols },
      },
      select: {
        symbol: true,
        lastPrice: true,
      },
    }),
    prisma.order.findMany({
      where: {
        userId,
        botId,
        managementMode: 'BOT_MANAGED',
        status: {
          in: ['PENDING', 'OPEN', 'PARTIALLY_FILLED'],
        },
        ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
        createdAt: {
          gte: session.startedAt,
          lte: windowEnd,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
      take: query.limit,
      select: {
        id: true,
        symbol: true,
        side: true,
        type: true,
        status: true,
        quantity: true,
        filledQuantity: true,
        price: true,
        stopPrice: true,
        submittedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const tradesByPosition = new Map<string, typeof trades>();
  for (const trade of trades) {
    if (!trade.positionId) continue;
    const bucket = tradesByPosition.get(trade.positionId) ?? [];
    bucket.push(trade);
    tradesByPosition.set(trade.positionId, bucket);
  }

  const lastPriceBySymbol = new Map(
    lastSymbolPrices.map((row) => [row.symbol, row.lastPrice])
  );
  for (const symbol of symbols) {
    const ticker = getRuntimeTicker(symbol);
    if (ticker && Number.isFinite(ticker.lastPrice)) {
      lastPriceBySymbol.set(symbol, ticker.lastPrice);
    }
  }

  const mappedPositions = positions.map((position) => {
    const positionTrades = tradesByPosition.get(position.id) ?? [];
    const entrySide = position.side === 'LONG' ? 'BUY' : 'SELL';
    const entryLegs = positionTrades.filter((trade) => trade.side === entrySide);
    const exitLegs = positionTrades.filter((trade) => trade.side !== entrySide);

    const feesPaid = positionTrades.reduce((acc, trade) => acc + (trade.fee ?? 0), 0);
    const tradeRealizedPnl = positionTrades.reduce((acc, trade) => acc + (trade.realizedPnl ?? 0), 0);
    const entryTrade = entryLegs[0] ?? positionTrades[0] ?? null;
    const exitTrade = exitLegs.at(-1) ?? (position.status === 'CLOSED' ? positionTrades.at(-1) ?? null : null);
    const dcaCount = Math.max(0, entryLegs.length - 1);

    const marketPrice = lastPriceBySymbol.get(position.symbol);
    const runtimeState = runtimePositionAutomationService.getPositionStateSnapshot(position.id);
    const stateEntryPrice =
      runtimeState && Number.isFinite(runtimeState.averageEntryPrice) && runtimeState.averageEntryPrice > 0
        ? runtimeState.averageEntryPrice
        : position.entryPrice;
    const ttpTriggerPercent =
      runtimeState &&
      Number.isFinite(runtimeState.trailingTakeProfitHighPercent) &&
      Number.isFinite(runtimeState.trailingTakeProfitStepPercent)
        ? (runtimeState.trailingTakeProfitHighPercent as number) -
          (runtimeState.trailingTakeProfitStepPercent as number)
        : null;
    const tslTriggerPercent =
      runtimeState && Number.isFinite(runtimeState.trailingLossLimitPercent)
        ? (runtimeState.trailingLossLimitPercent as number)
        : null;
    const dynamicTtpStopLoss =
      ttpTriggerPercent != null
        ? computePriceFromLeveragedMovePercent(
            position.side,
            stateEntryPrice,
            ttpTriggerPercent,
            position.leverage
          )
        : null;
    const dynamicTslStopLoss =
      tslTriggerPercent != null
        ? computePriceFromLeveragedMovePercent(
            position.side,
            stateEntryPrice,
            tslTriggerPercent,
            position.leverage
          )
        : null;
    const liveUnrealizedPnl =
      typeof marketPrice === 'number' && Number.isFinite(marketPrice)
        ? (marketPrice - position.entryPrice) * position.quantity * (position.side === 'LONG' ? 1 : -1)
        : null;

    const holdUntil = position.closedAt ?? windowEnd;
    const holdMs = Math.max(0, holdUntil.getTime() - position.openedAt.getTime());

    return {
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      status: position.status,
      quantity: position.quantity,
      leverage: position.leverage,
      entryPrice: position.entryPrice,
      entryNotional: position.entryPrice * position.quantity,
      exitPrice: exitTrade?.price ?? null,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      openedAt: position.openedAt,
      closedAt: position.closedAt,
      holdMs,
      dcaCount,
      feesPaid,
      realizedPnl: position.realizedPnl ?? tradeRealizedPnl ?? 0,
      unrealizedPnl: liveUnrealizedPnl ?? position.unrealizedPnl ?? null,
      markPrice: typeof marketPrice === 'number' && Number.isFinite(marketPrice) ? marketPrice : null,
      dynamicTtpStopLoss,
      dynamicTslStopLoss,
      firstTradeAt: entryTrade?.executedAt ?? null,
      lastTradeAt: positionTrades.at(-1)?.executedAt ?? null,
      tradesCount: positionTrades.length,
    };
  });

  const openItems = mappedPositions
    .filter((position) => position.status === 'OPEN')
    .sort((left, right) => right.openedAt.getTime() - left.openedAt.getTime());
  const historyItems = mappedPositions
    .filter((position) => position.status === 'CLOSED')
    .sort((left, right) => (right.closedAt?.getTime() ?? 0) - (left.closedAt?.getTime() ?? 0));

  return {
    sessionId,
    total: mappedPositions.length,
    openCount: openItems.length,
    closedCount: historyItems.length,
    openOrdersCount: openOrders.length,
    window: {
      startedAt: session.startedAt,
      finishedAt: windowEnd,
    },
    summary: {
      realizedPnl: mappedPositions.reduce((acc, position) => acc + (position.realizedPnl ?? 0), 0),
      unrealizedPnl: openItems.reduce((acc, position) => acc + (position.unrealizedPnl ?? 0), 0),
      feesPaid: mappedPositions.reduce((acc, position) => acc + position.feesPaid, 0),
    },
    openOrders,
    openItems,
    historyItems,
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
