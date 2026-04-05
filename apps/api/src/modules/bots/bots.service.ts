import { Exchange } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { runtimePositionAutomationService } from '../engine/runtimePositionAutomation.service';
import { runtimePositionStateStore } from '../engine/runtimePositionState.store';
import { runtimeSignalLoop } from '../engine/runtimeSignalLoop.service';
import { runtimeTelemetryService } from '../engine/runtimeTelemetry.service';
import { getRuntimeTicker } from '../engine/runtimeTickerStore';
import {
  CreateBotDto,
  ListBotsQueryDto,
  ListBotRuntimeSymbolStatsQueryDto,
  ListBotRuntimePositionsQueryDto,
  ListBotRuntimeTradesQueryDto,
  ListBotRuntimeSessionsQueryDto,
  UpdateBotDto,
} from './bots.types';
import {
  cleanupStaleRuntimePositionSerializationState,
  resolveDcaExecutedLevels,
  resolveRuntimePositionDynamicStops,
  TrailingStopDisplayLevel,
  TrailingTakeProfitDisplayLevel,
} from './runtimePositionSerialization.service';
import {
  resolveDcaPlannedLevelsFromStrategyConfig,
  resolveTrailingStopLevelsFromStrategyConfig,
  resolveTrailingTakeProfitLevelsFromStrategyConfig,
} from './runtimeStrategyConfigParser.service';
import {
  resolveBotAdvancedCloseMode,
  resolveBotDcaPlanBySymbol,
  resolveBotTrailingStopLevelsBySymbol,
  resolveBotTrailingTakeProfitLevelsBySymbol,
} from './runtimeStrategyDisplayBySymbol.service';
import { buildSignalConditionSummary } from './runtimeSignalConditionSummary.service';
import {
  clampPeriod,
  formatIndicatorValue,
} from './runtimeSignalIndicators.service';
import {
  buildSignalConditionLines,
  buildSignalIndicatorSummary,
  parseSignalConditionLines,
  SignalConditionLine,
} from './runtimeSignalConditionLines.service';
import {
  normalizeSymbols,
  resolveEffectiveSymbolGroupSymbols,
  resolveUniverseSymbols,
} from './runtimeSymbolUniverse.service';
import { resolveEffectiveSymbolGroupSymbolsWithCatalog } from './runtimeSymbolCatalogResolver.service';
import {
  asRecord,
  humanizeMergeReason,
  toFiniteNumber,
} from './runtimeSignalStatsFormatting.service';
import {
  buildCloseReasonLookup,
  RuntimeTradeActionReason,
} from './runtimeTradeActionReason.service';
import {
  buildLifecycleActionByTradeId,
  toPositionMetaById,
} from './runtimeTradeLifecycle.service';
import {
  getRuntimeSessionSummaryMetrics,
  listRuntimeSessionsWithSummary,
} from './runtimeSessionsRead.service';
import {
  fetchFallbackKlineCloses,
  fetchFallbackTickerPrices,
} from './runtimeMarketDataFallback.service';
import {
  assertNoDuplicateActiveBotByStrategyAndSymbolGroup,
  deriveMaxOpenPositionsFromStrategy,
  getOwnedStrategy,
  resolveCreateMarketGroupToSymbolGroup,
} from './botWriteValidation.service';
import { resolveCompatibleBotApiKey } from './botApiKeyResolver.service';
import {
  getOwnedBot,
  getOwnedBotRuntimeSession,
  resolveSessionWindowEnd,
} from './botOwnership.service';
import {
  BotConsentState,
  normalizeConsentTextVersion,
  validateLiveConsentState,
  writeLiveConsentAudit,
} from './botLiveConsent.service';
import { upsertBotStrategy } from './botLegacyStrategyLink.service';
import { assertBotActivationExchangeCapability } from './botActivationPolicy.service';
import { mapBotResponse } from './botResponseMapper.service';
import {
  getBotWithStrategyProjectionById,
  getOwnedBotWithStrategyProjection,
  listOwnedBotsWithStrategyProjection,
} from './botReadProjection.service';
export {
  deleteBotSubagentConfig,
  getBotAssistantConfig,
  runAssistantDryRun,
  upsertBotAssistantConfig,
  upsertBotSubagentConfig,
} from './botAssistant.service';

export const listBots = async (userId: string, query: ListBotsQueryDto = {}) => {
  const bots = await listOwnedBotsWithStrategyProjection({
    userId,
    marketType: query.marketType,
  });

  return bots.map((bot) => mapBotResponse(bot));
};

export const getBot = async (userId: string, id: string) => {
  const bot = await getOwnedBotWithStrategyProjection({
    userId,
    botId: id,
  });

  return bot ? mapBotResponse(bot) : null;
};

export const createBot = async (userId: string, data: CreateBotDto) => {
  validateLiveConsentState(data);

  const { strategyId, marketGroupId, apiKeyId, ...botData } = data;
  const strategy = await getOwnedStrategy(userId, strategyId);
  if (!strategy) throw new Error('BOT_STRATEGY_NOT_FOUND');

  const symbolGroup = await resolveCreateMarketGroupToSymbolGroup(userId, marketGroupId);
  if (!symbolGroup) throw new Error('SYMBOL_GROUP_NOT_FOUND');
  const derivedMarketType = symbolGroup.marketUniverse.marketType;
  const derivedExchange = symbolGroup.marketUniverse.exchange;
  const derivedMaxOpenPositions = deriveMaxOpenPositionsFromStrategy(strategy.config);
  if (botData.isActive) {
    assertBotActivationExchangeCapability({
      exchange: derivedExchange,
      mode: botData.mode,
    });
  }
  const resolvedApiKeyId = await resolveCompatibleBotApiKey({
    userId,
    exchange: derivedExchange,
    requestedApiKeyId: apiKeyId,
    requireForActivation: botData.mode === 'LIVE' && botData.isActive,
  });

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
        apiKeyId: resolvedApiKeyId,
        exchange: derivedExchange,
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

  const withStrategy = await getBotWithStrategyProjectionById(createdBotId);

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
  const apiKeyIdUpdateRequested = Object.prototype.hasOwnProperty.call(data, 'apiKeyId');
  const requestedApiKeyId = apiKeyIdUpdateRequested ? (data.apiKeyId ?? null) : undefined;
  const nextIsActive = data.isActive ?? existing.isActive;
  const nextMode = nextState.mode;
  let targetExchange = existing.exchange as Exchange;
  let targetMarketType = existing.marketType as 'FUTURES' | 'SPOT';

  if (requestedMarketGroupId) {
    const resolvedGroup = await resolveCreateMarketGroupToSymbolGroup(userId, requestedMarketGroupId);
    if (!resolvedGroup) throw new Error('SYMBOL_GROUP_NOT_FOUND');
    targetExchange = resolvedGroup.marketUniverse.exchange;
    targetMarketType = resolvedGroup.marketUniverse.marketType;
  }

  if (nextIsActive) {
    assertBotActivationExchangeCapability({
      exchange: targetExchange,
      mode: nextMode,
    });
  }

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

  const shouldRequireLiveApiKey = nextMode === 'LIVE' && nextIsActive;
  let resolvedApiKeyId = existing.apiKeyId ?? null;
  if (shouldRequireLiveApiKey || apiKeyIdUpdateRequested) {
    const desiredApiKeyId =
      requestedApiKeyId !== undefined ? requestedApiKeyId : (existing.apiKeyId ?? null);
    resolvedApiKeyId = await resolveCompatibleBotApiKey({
      userId,
      exchange: targetExchange,
      requestedApiKeyId: desiredApiKeyId,
      requireForActivation: shouldRequireLiveApiKey,
    });
  }

  const {
    strategyId: _ignoredStrategyId,
    marketGroupId: _ignoredMarketGroupId,
    apiKeyId: _ignoredApiKeyId,
    ...botData
  } = data;
  const updated = await prisma.bot.update({
    where: { id: existing.id },
    data: {
      ...botData,
      exchange: targetExchange,
      marketType: targetMarketType,
      apiKeyId: resolvedApiKeyId,
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

  if (existing.isActive && !updated.isActive) {
    await runtimeTelemetryService.closeRuntimeSession({
      botId: updated.id,
      status: 'CANCELED',
      stopReason: 'bot_deactivated',
    });
  }

  const withStrategy = await getBotWithStrategyProjectionById(updated.id);

  return withStrategy ? mapBotResponse(withStrategy) : mapBotResponse(updated);
};

export const deleteBot = async (userId: string, id: string) => {
  const existing = await getBot(userId, id);
  if (!existing) return false;

  if (existing.isActive) {
    await runtimeTelemetryService.closeRuntimeSession({
      botId: existing.id,
      status: 'CANCELED',
      stopReason: 'bot_deleted',
    });
  }

  await prisma.$transaction([
    prisma.position.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.order.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.trade.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.signal.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.log.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.orderFill.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.botRuntimeEvent.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botRuntimeSymbolStat.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botRuntimeSession.deleteMany({
      where: { botId: existing.id },
    }),
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

export {
  attachMarketGroupStrategy,
  createBotMarketGroup,
  deleteBotMarketGroup,
  detachMarketGroupStrategy,
  getBotMarketGroup,
  listBotMarketGroups,
  listMarketGroupStrategyLinks,
  reorderMarketGroupStrategies,
  updateBotMarketGroup,
  updateMarketGroupStrategy,
} from './botMarketGroups.service';

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
  return listRuntimeSessionsWithSummary({
    userId,
    botId,
    status: query.status,
    limit: query.limit,
  });
};

export const getBotRuntimeSession = async (userId: string, botId: string, sessionId: string) => {
  const session = await getOwnedBotRuntimeSession(userId, botId, sessionId);
  if (!session) return null;
  const runtimeSessionMetrics = await getRuntimeSessionSummaryMetrics(session.id);

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
    eventsCount: runtimeSessionMetrics.eventsCount,
    symbolsTracked: runtimeSessionMetrics.symbolsTracked,
    summary: runtimeSessionMetrics.summary,
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

  const [
    items,
    summary,
    configuredMarketGroups,
    configuredBotStrategies,
    configuredMarketGroupStrategyLinks,
    botMarketTypeRow,
  ] = await Promise.all([
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
            marketUniverse: {
              select: {
                exchange: true,
                marketType: true,
                baseCurrency: true,
                filterRules: true,
                whitelist: true,
                blacklist: true,
              },
            },
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
        strategyId: true,
        symbolGroup: {
          select: {
            symbols: true,
            marketUniverse: {
              select: {
                whitelist: true,
                blacklist: true,
              },
            },
          },
        },
        strategy: {
          select: {
            id: true,
            name: true,
            interval: true,
            config: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.marketGroupStrategyLink.findMany({
      where: {
        userId,
        botId,
        isEnabled: true,
        botMarketGroup: {
          lifecycleStatus: {
            in: ['ACTIVE', 'PAUSED'],
          },
          isEnabled: true,
        },
      },
      select: {
        strategyId: true,
        strategy: {
          select: {
            id: true,
            name: true,
            interval: true,
            config: true,
          },
        },
        botMarketGroup: {
          select: {
            symbolGroup: {
              select: {
                symbols: true,
                marketUniverse: {
                  select: {
                    exchange: true,
                    marketType: true,
                    baseCurrency: true,
                    filterRules: true,
                    whitelist: true,
                    blacklist: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.bot.findFirst({
      where: {
        id: botId,
        userId,
      },
      select: {
        marketType: true,
      },
    }),
  ]);
  const botMarketType = botMarketTypeRow?.marketType ?? 'FUTURES';

  const catalogSymbolsCache = new Map<string, string[]>();
  const [configuredMarketGroupSymbols, configuredBotStrategySymbols] = await Promise.all([
    Promise.all(
      configuredMarketGroups.map((group) =>
        resolveEffectiveSymbolGroupSymbolsWithCatalog(group.symbolGroup, catalogSymbolsCache)
      )
    ),
    Promise.all(
      configuredBotStrategies.map((strategy) =>
        resolveEffectiveSymbolGroupSymbolsWithCatalog(strategy.symbolGroup, catalogSymbolsCache)
      )
    ),
  ]);
  const configuredSymbols = normalizeSymbols(
    [...configuredMarketGroupSymbols.flat(), ...configuredBotStrategySymbols.flat()]
  );
  let symbols = (
    normalizedSymbol
      ? [normalizedSymbol]
      : normalizeSymbols([...configuredSymbols, ...items.map((item) => item.symbol)])
  ).slice(0, query.limit);
  if (!normalizedSymbol && symbols.length === 0) {
    const fallbackEventRows = await prisma.botRuntimeEvent.findMany({
      where: {
        userId,
        botId,
        sessionId,
        symbol: { not: null },
      },
      select: { symbol: true },
      orderBy: [{ eventAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.max(50, query.limit * 10),
    });
    symbols = normalizeSymbols(
      fallbackEventRows
        .map((row) => row.symbol)
        .filter((symbol): symbol is string => typeof symbol === 'string' && symbol.trim().length > 0)
    ).slice(0, query.limit);
  }
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
      analysisByStrategy: Record<
        string,
        { conditionLines: SignalConditionLine[] | null; indicatorSummary: string | null }
      >;
    }
  >();
  const strategiesById = new Map<
    string,
    { name: string; interval: string; config: Record<string, unknown> | null }
  >();
  for (const configuredBotStrategy of configuredBotStrategies) {
    const strategy = configuredBotStrategy.strategy;
    if (!strategy) continue;
    strategiesById.set(strategy.id, {
      name: strategy.name,
      interval: strategy.interval,
      config: asRecord(strategy.config) ?? null,
    });
  }
  for (const configuredLink of configuredMarketGroupStrategyLinks) {
    const strategy = configuredLink.strategy;
    if (!strategy) continue;
    strategiesById.set(strategy.id, {
      name: strategy.name,
      interval: strategy.interval,
      config: asRecord(strategy.config) ?? null,
    });
  }
  const latestSignalStrategyIds = new Set<string>();
  for (const event of latestSignalEvents) {
    if (!event.symbol || latestSignalBySymbol.has(event.symbol)) continue;
    const payload = asRecord(event.payload);
    const merge = asRecord(payload?.merge);
    const scores = asRecord(merge?.scores);
    const winner = asRecord(merge?.winner);
    const analysis = asRecord(payload?.analysis);
    const byStrategy = asRecord(analysis?.byStrategy);
    const parsedAnalysisByStrategy: Record<
      string,
      { conditionLines: SignalConditionLine[] | null; indicatorSummary: string | null }
    > = {};
    if (byStrategy) {
      for (const [strategyKey, rawStats] of Object.entries(byStrategy)) {
        if (typeof strategyKey !== 'string' || strategyKey.trim().length === 0) continue;
        const strategyStats = asRecord(rawStats);
        if (!strategyStats) continue;
        parsedAnalysisByStrategy[strategyKey.trim()] = {
          conditionLines: parseSignalConditionLines(strategyStats.conditionLines),
          indicatorSummary:
            typeof strategyStats.indicatorSummary === 'string' && strategyStats.indicatorSummary.trim().length > 0
              ? strategyStats.indicatorSummary.trim()
              : null,
        };
      }
    }
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
      analysisByStrategy: parsedAnalysisByStrategy,
    });
  }
  const missingStrategyIds = [...latestSignalStrategyIds].filter((strategyId) => !strategiesById.has(strategyId));
  if (missingStrategyIds.length > 0) {
    const signalStrategies = await prisma.strategy.findMany({
      where: {
        userId,
        id: { in: missingStrategyIds },
      },
      select: {
        id: true,
        name: true,
        interval: true,
        config: true,
      },
    });
    for (const strategy of signalStrategies) {
      strategiesById.set(strategy.id, {
        name: strategy.name,
        interval: strategy.interval,
        config: asRecord(strategy.config) ?? null,
      });
    }
  }

  const configuredStrategyBySymbol = new Map<string, string>();
  const configuredBotStrategySymbolsResolved = await Promise.all(
    configuredBotStrategies.map(async (configuredBotStrategy) => ({
      strategyId: configuredBotStrategy.strategyId?.trim() ?? '',
      symbols: await resolveEffectiveSymbolGroupSymbolsWithCatalog(
        configuredBotStrategy.symbolGroup,
        catalogSymbolsCache
      ),
    }))
  );
  for (const configuredBotStrategy of configuredBotStrategySymbolsResolved) {
    const strategyId = configuredBotStrategy.strategyId?.trim();
    if (!strategyId) continue;
    const assignedSymbols = configuredBotStrategy.symbols;
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : symbols;
    for (const symbol of targetSymbols) {
      if (!configuredStrategyBySymbol.has(symbol)) {
        configuredStrategyBySymbol.set(symbol, strategyId);
      }
    }
  }
  const configuredLinkSymbolsResolved = await Promise.all(
    configuredMarketGroupStrategyLinks.map(async (configuredLink) => ({
      strategyId: configuredLink.strategyId?.trim() ?? '',
      symbols: await resolveEffectiveSymbolGroupSymbolsWithCatalog(
        configuredLink.botMarketGroup.symbolGroup,
        catalogSymbolsCache
      ),
    }))
  );
  for (const configuredLink of configuredLinkSymbolsResolved) {
    const strategyId = configuredLink.strategyId?.trim();
    if (!strategyId) continue;
    const assignedSymbols = configuredLink.symbols;
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : symbols;
    for (const symbol of targetSymbols) {
      if (!configuredStrategyBySymbol.has(symbol)) {
        configuredStrategyBySymbol.set(symbol, strategyId);
      }
    }
  }
  if (configuredStrategyBySymbol.size === 0 && strategiesById.size > 0) {
    const [fallbackStrategyId] = [...strategiesById.keys()];
    for (const symbol of symbols) {
      if (!configuredStrategyBySymbol.has(symbol)) {
        configuredStrategyBySymbol.set(symbol, fallbackStrategyId);
      }
    }
  }

  const strategySeriesKeys = new Map<string, { symbol: string; interval: string }>();
  for (const symbol of symbols) {
    const latestSignal = latestSignalBySymbol.get(symbol);
    const strategyId = latestSignal?.strategyId ?? configuredStrategyBySymbol.get(symbol) ?? null;
    if (!strategyId) continue;
    const strategy = strategiesById.get(strategyId);
    if (!strategy?.interval) continue;
    const interval = strategy.interval.trim().toLowerCase();
    if (!interval) continue;
    const key = `${symbol}|${interval}`;
    strategySeriesKeys.set(key, { symbol, interval });
  }

  const candleClosesBySeries = new Map<string, number[]>();
  if (strategySeriesKeys.size > 0) {
    const entries = [...strategySeriesKeys.values()];
    const seriesRows = await Promise.all(
      entries.map(async ({ symbol, interval }) => {
        const inMemoryCloses = runtimeSignalLoop.getRecentCloses({
          marketType: botMarketType,
          symbol,
          interval,
          limit: 300,
        });
        if (inMemoryCloses.length > 0) {
          return {
            key: `${symbol}|${interval}`,
            closes: inMemoryCloses,
          };
        }

        const candles = await prisma.marketCandleCache.findMany({
          where: {
            marketType: botMarketType,
            symbol,
            timeframe: interval,
          },
          orderBy: [{ openTime: 'desc' }],
          take: 300,
          select: {
            close: true,
          },
        });
        return {
          key: `${symbol}|${interval}`,
          closes:
            candles
            .map((item) => item.close)
            .filter((value): value is number => Number.isFinite(value))
            .reverse(),
        };
      })
    );
    for (const row of seriesRows) {
      if (row.closes.length > 0) {
        candleClosesBySeries.set(row.key, row.closes);
        continue;
      }
      const [symbol, interval] = row.key.split('|');
      const fallbackCloses = await fetchFallbackKlineCloses({
        marketType: botMarketType,
        symbol,
        interval,
        limit: 300,
      });
      candleClosesBySeries.set(row.key, fallbackCloses);
    }
  }
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
    const fallbackStrategyId = configuredStrategyBySymbol.get(symbol) ?? null;
    const signalStrategyId = latestSignal?.strategyId ?? fallbackStrategyId;
    const signalStrategy = signalStrategyId != null ? strategiesById.get(signalStrategyId) ?? null : null;
    const signalSeriesKey =
      signalStrategy?.interval != null ? `${symbol}|${signalStrategy.interval.trim().toLowerCase()}` : null;
    const signalCloses = signalSeriesKey ? candleClosesBySeries.get(signalSeriesKey) ?? [] : [];
    // Live checks should expose only runtime-decided signals (accepted decisions),
    // not directional preview inferred from latest candles.
    const effectiveSignalDirection = latestSignal?.signalDirection ?? null;
    const signalConditionSummary = buildSignalConditionSummary(
      signalStrategy?.config ?? null,
      effectiveSignalDirection
    );
    const signalAnalysis =
      signalStrategyId != null ? latestSignal?.analysisByStrategy?.[signalStrategyId] ?? null : null;
    const signalIndicatorSummary = buildSignalIndicatorSummary({
      strategyConfig: signalStrategy?.config ?? null,
      direction: effectiveSignalDirection,
      closes: signalCloses,
    });
    const signalConditionLines = buildSignalConditionLines({
      strategyConfig: signalStrategy?.config ?? null,
      direction: effectiveSignalDirection,
      closes: signalCloses,
    });
    const useComputedSignalValues =
      effectiveSignalDirection != null &&
      signalCloses.length > 0 &&
      signalAnalysis == null;
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
      lastSignalDirection: effectiveSignalDirection,
      lastSignalDecisionAt: latestSignal?.eventAt ?? stat?.lastSignalAt ?? null,
      lastSignalMessage: latestSignal?.message ?? null,
      lastSignalReason: latestSignal?.mergeReason ?? null,
      lastSignalStrategyId: latestSignal?.strategyId ?? null,
      lastSignalStrategyName: signalStrategy?.name ?? null,
      lastSignalConditionSummary: signalConditionSummary,
      lastSignalIndicatorSummary: useComputedSignalValues
        ? signalIndicatorSummary
        : signalAnalysis?.indicatorSummary ?? signalIndicatorSummary,
      lastSignalConditionLines: useComputedSignalValues
        ? signalConditionLines
        : signalAnalysis?.conditionLines ?? signalConditionLines,
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
  const normalizedSide = query.side?.trim().toUpperCase() as 'BUY' | 'SELL' | undefined;
  const normalizedAction = query.action?.trim().toUpperCase() as
    | 'OPEN'
    | 'DCA'
    | 'CLOSE'
    | 'UNKNOWN'
    | undefined;
  const isLegacyLimitOnly =
    query.limit != null &&
    query.page == null &&
    query.pageSize == null &&
    query.sortBy == null &&
    query.sortDir == null &&
    query.side == null &&
    query.action == null &&
    query.from == null &&
    query.to == null;
  const page = isLegacyLimitOnly ? 1 : Math.max(1, query.page ?? 1);
  const pageSize = Math.min(
    200,
    Math.max(1, isLegacyLimitOnly ? query.limit : (query.pageSize ?? query.limit ?? 50))
  );
  const sortBy = query.sortBy ?? 'executedAt';
  const sortDir = query.sortDir ?? 'desc';
  const windowEnd = resolveSessionWindowEnd(session);
  const rangeStart = query.from ? new Date(Math.max(query.from.getTime(), session.startedAt.getTime())) : session.startedAt;
  const rangeEnd = query.to ? new Date(Math.min(query.to.getTime(), windowEnd.getTime())) : windowEnd;
  if (rangeStart.getTime() > rangeEnd.getTime()) {
    return {
      sessionId,
      total: 0,
      meta: {
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        hasPrev: page > 1,
        hasNext: false,
      },
      window: {
        startedAt: session.startedAt,
        finishedAt: windowEnd,
      },
      items: [],
    };
  }
  const windowClause = {
    executedAt: {
      gte: rangeStart,
      lte: rangeEnd,
    },
  };

  const carryOverPositionIds =
    session.status === 'RUNNING' && !query.from && !query.to
      ? (
          await prisma.position.findMany({
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
            select: {
              id: true,
            },
          })
        ).map((position) => position.id)
      : [];

  const where = {
    userId,
    botId,
    ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
    ...(normalizedSide ? { side: normalizedSide } : {}),
    OR:
      carryOverPositionIds.length > 0
        ? [windowClause, { positionId: { in: carryOverPositionIds } }]
        : [windowClause],
  };

  const rows = await prisma.trade.findMany({
    where,
    select: {
      id: true,
      symbol: true,
      side: true,
      lifecycleAction: true,
      price: true,
      quantity: true,
      fee: true,
      feeSource: true,
      feePending: true,
      feeCurrency: true,
      realizedPnl: true,
      executedAt: true,
      createdAt: true,
      orderId: true,
      positionId: true,
      strategyId: true,
      origin: true,
      managementMode: true,
    },
  });
  const closeEventRows = await prisma.botRuntimeEvent.findMany({
    where: {
      userId,
      botId,
      sessionId,
      eventType: 'POSITION_CLOSED',
      eventAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
      ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
    },
    select: {
      eventAt: true,
      payload: true,
    },
    orderBy: [{ eventAt: 'desc' }],
  });

  const { closeReasonByOrderId, closeReasonByPositionId } = buildCloseReasonLookup(closeEventRows);

  const positionIds = [
    ...new Set(rows.map((trade) => trade.positionId).filter((value): value is string => Boolean(value))),
  ];

  let positionMetaById = new Map<string, { side: 'LONG' | 'SHORT'; leverage: number; entryPrice: number }>();
  const lifecycleActionByTradeId = new Map<string, 'OPEN' | 'DCA' | 'CLOSE' | 'UNKNOWN'>();

  if (positionIds.length > 0) {
    const [positionMetaRows, allPositionTrades] = await Promise.all([
      prisma.position.findMany({
        where: {
          id: { in: positionIds },
          userId,
        },
        select: {
          id: true,
          side: true,
          leverage: true,
          entryPrice: true,
        },
      }),
      prisma.trade.findMany({
        where: {
          userId,
          botId,
          positionId: {
            in: positionIds,
          },
        },
        orderBy: [{ executedAt: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          positionId: true,
          side: true,
        },
      }),
    ]);

    positionMetaById = toPositionMetaById(positionMetaRows);
    const lifecycleMap = buildLifecycleActionByTradeId({
      positionMetaById,
      positionTrades: allPositionTrades,
    });
    for (const [tradeId, lifecycleAction] of lifecycleMap.entries()) {
      lifecycleActionByTradeId.set(tradeId, lifecycleAction);
    }
  }

  const enrichedRows = rows
    .map((trade) => {
      const notional = trade.price * trade.quantity;
      const positionMeta = positionMetaById.get(trade.positionId ?? '');
      const leverage = positionMeta?.leverage ?? 1;
      const effectiveLeverage = Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
      const inferredLifecycleAction =
        trade.lifecycleAction && trade.lifecycleAction !== 'UNKNOWN'
          ? trade.lifecycleAction
          : lifecycleActionByTradeId.get(trade.id) ?? 'UNKNOWN';
      const actionReason: RuntimeTradeActionReason =
        inferredLifecycleAction === 'OPEN'
          ? 'SIGNAL_ENTRY'
          : inferredLifecycleAction === 'DCA'
            ? 'DCA_LEVEL'
            : inferredLifecycleAction === 'CLOSE'
            ? closeReasonByOrderId.get(trade.orderId ?? '')?.reason ??
                closeReasonByPositionId.get(trade.positionId ?? '')?.reason ??
                (trade.managementMode === 'MANUAL_MANAGED' ? 'MANUAL' : 'UNKNOWN')
              : 'UNKNOWN';
      const marginNotional =
        inferredLifecycleAction === 'CLOSE' && positionMeta
          ? positionMeta.entryPrice * trade.quantity
          : notional;

      return {
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        price: trade.price,
        quantity: trade.quantity,
        fee: trade.fee ?? 0,
        feeSource: trade.feeSource,
        feePending: trade.feePending,
        feeCurrency: trade.feeCurrency ?? null,
        realizedPnl: trade.realizedPnl ?? 0,
        executedAt: trade.executedAt,
        createdAt: trade.createdAt,
        orderId: trade.orderId,
        positionId: trade.positionId,
        strategyId: trade.strategyId,
        origin: trade.origin,
        managementMode: trade.managementMode,
        lifecycleAction: inferredLifecycleAction,
        actionReason,
        notional,
        margin: marginNotional / effectiveLeverage,
      };
    })
    .filter((trade) => (normalizedAction ? trade.lifecycleAction === normalizedAction : true));

  const primaryCompare = (
    left: (typeof enrichedRows)[number],
    right: (typeof enrichedRows)[number]
  ) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const compareNumbers = (a: number, b: number) => (a === b ? 0 : a > b ? 1 : -1) * dir;
    const compareStrings = (a: string, b: string) => a.localeCompare(b) * dir;
    switch (sortBy) {
      case 'symbol':
        return compareStrings(left.symbol, right.symbol);
      case 'side':
        return compareStrings(left.side, right.side);
      case 'lifecycleAction':
        return compareStrings(left.lifecycleAction, right.lifecycleAction);
      case 'margin':
        return compareNumbers(left.margin, right.margin);
      case 'fee':
        return compareNumbers(left.fee, right.fee);
      case 'realizedPnl':
        return compareNumbers(left.realizedPnl, right.realizedPnl);
      case 'executedAt':
      default:
        return compareNumbers(left.executedAt.getTime(), right.executedAt.getTime());
    }
  };

  const sortedRows = [...enrichedRows].sort((left, right) => {
    const first = primaryCompare(left, right);
    if (first !== 0) return first;
    const byExecuted = right.executedAt.getTime() - left.executedAt.getTime();
    if (byExecuted !== 0) return byExecuted;
    const byCreated = right.createdAt.getTime() - left.createdAt.getTime();
    if (byCreated !== 0) return byCreated;
    return right.id.localeCompare(left.id);
  });

  const total = sortedRows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const pagedRows = sortedRows.slice(offset, offset + pageSize);

  return {
    sessionId,
    total,
    meta: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      hasPrev: safePage > 1 && totalPages > 0,
      hasNext: safePage < totalPages,
    },
    window: {
      startedAt: session.startedAt,
      finishedAt: windowEnd,
    },
    items: pagedRows.map((trade) => {
      const { createdAt: _createdAt, ...rest } = trade;
      return rest;
    }),
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
  const showDynamicStopColumns = await resolveBotAdvancedCloseMode(userId, botId);

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
      strategyId: true,
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
      showDynamicStopColumns,
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
  const strategyIds = [
    ...new Set(
      positions
        .map((position) => position.strategyId)
        .filter((strategyId): strategyId is string => typeof strategyId === 'string' && strategyId.length > 0)
    ),
  ];
  const [dcaPlanBySymbol, trailingStopLevelsBySymbol, trailingTakeProfitLevelsBySymbol, persistedRuntimeStatesByPositionId] = await Promise.all([
    resolveBotDcaPlanBySymbol(userId, botId, symbols),
    resolveBotTrailingStopLevelsBySymbol(userId, botId, symbols),
    resolveBotTrailingTakeProfitLevelsBySymbol(userId, botId, symbols),
    runtimePositionStateStore.getPositionRuntimeStates(positionIds),
  ]);

  const [trades, lastSymbolPrices, openOrders, strategyConfigs] = await Promise.all([
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
    strategyIds.length > 0
      ? prisma.strategy.findMany({
          where: {
            id: { in: strategyIds },
            userId,
          },
          select: {
            id: true,
            config: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const dcaPlanByStrategyId = new Map<string, number[]>();
  const trailingStopLevelsByStrategyId = new Map<string, TrailingStopDisplayLevel[]>();
  const trailingTakeProfitLevelsByStrategyId = new Map<string, TrailingTakeProfitDisplayLevel[]>();
  for (const strategy of strategyConfigs) {
    dcaPlanByStrategyId.set(strategy.id, resolveDcaPlannedLevelsFromStrategyConfig(strategy.config));
    trailingStopLevelsByStrategyId.set(
      strategy.id,
      resolveTrailingStopLevelsFromStrategyConfig(strategy.config)
    );
    trailingTakeProfitLevelsByStrategyId.set(
      strategy.id,
      resolveTrailingTakeProfitLevelsFromStrategyConfig(strategy.config)
    );
  }

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
  const missingPriceSymbols = symbols.filter((symbol) => {
    const current = lastPriceBySymbol.get(symbol);
    return !Number.isFinite(current) || (current as number) <= 0;
  });
  if (missingPriceSymbols.length > 0) {
    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId },
      select: { exchange: true, marketType: true },
    });
    if (bot?.exchange === 'BINANCE') {
      const fallbackPrices = await fetchFallbackTickerPrices({
        marketType: bot.marketType === 'SPOT' ? 'SPOT' : 'FUTURES',
        symbols: missingPriceSymbols,
      });
      for (const [symbol, price] of fallbackPrices) {
        if (Number.isFinite(price) && price > 0) {
          lastPriceBySymbol.set(symbol, price);
        }
      }
    }
  }

  const nowTs = Date.now();
  cleanupStaleRuntimePositionSerializationState(nowTs);

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
    const dcaPlannedLevels =
      (position.strategyId ? dcaPlanByStrategyId.get(position.strategyId) : null) ??
      dcaPlanBySymbol.get(position.symbol) ??
      [];
    const trailingStopLevels =
      (position.strategyId ? trailingStopLevelsByStrategyId.get(position.strategyId) : null) ??
      trailingStopLevelsBySymbol.get(position.symbol) ??
      [];
    const trailingTakeProfitLevels =
      (position.strategyId
        ? trailingTakeProfitLevelsByStrategyId.get(position.strategyId)
        : null) ??
      trailingTakeProfitLevelsBySymbol.get(position.symbol) ??
      [];
    const dcaExecutedLevels = resolveDcaExecutedLevels(dcaCount, dcaPlannedLevels);

    const marketPrice = lastPriceBySymbol.get(position.symbol);
    const runtimeState =
      runtimePositionAutomationService.getPositionStateSnapshot(position.id) ??
      persistedRuntimeStatesByPositionId.get(position.id) ??
      null;
    const stateEntryPrice =
      runtimeState && Number.isFinite(runtimeState.averageEntryPrice) && runtimeState.averageEntryPrice > 0
        ? runtimeState.averageEntryPrice
        : position.entryPrice;
    const {
      dynamicTtpStopLoss,
      dynamicTslStopLoss,
      liveUnrealizedPnl,
    } = resolveRuntimePositionDynamicStops({
      positionId: position.id,
      positionStatus: position.status,
      positionSide: position.side,
      entryPrice: position.entryPrice,
      quantity: position.quantity,
      leverage: position.leverage,
      unrealizedPnl: position.unrealizedPnl ?? null,
      marketPrice,
      stateEntryPrice,
      runtimeState,
      trailingStopLevels,
      trailingTakeProfitLevels,
      nowTs,
    });

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
      dcaPlannedLevels,
      dcaExecutedLevels,
      trailingStopLevels,
      trailingTakeProfitLevels,
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
    showDynamicStopColumns,
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
