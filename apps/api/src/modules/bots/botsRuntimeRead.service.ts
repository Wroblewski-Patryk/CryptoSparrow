import { Exchange, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { runtimePositionAutomationService } from '../engine/runtimePositionAutomation.service';
import { runtimePositionStateStore } from '../engine/runtimePositionState.store';
import { resolveRuntimeReferenceBalance } from '../engine/runtimeCapitalContext.service';
import { runtimeSignalLoop } from '../engine/runtimeSignalLoop.service';
import { orchestrateRuntimeSignal } from '../engine/executionOrchestrator.service';
import { getRuntimeTicker } from '../engine/runtimeTickerStore';
import {
  CloseBotRuntimePositionDto,
  ListBotRuntimeSymbolStatsQueryDto,
  ListBotRuntimePositionsQueryDto,
  ListBotRuntimeTradesQueryDto,
  ListBotRuntimeSessionsQueryDto,
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
import { clampPeriod, formatIndicatorValue } from './runtimeSignalIndicators.service';
import {
  parseSignalConditionLines,
  SignalConditionLine,
} from './runtimeSignalConditionLines.service';
import {
  normalizeSymbols,
  resolveEffectiveSymbolGroupSymbols,
  resolveUniverseSymbols,
} from './runtimeSymbolUniverse.service';
import { resolveEffectiveSymbolGroupSymbolsWithCatalog } from './runtimeSymbolCatalogResolver.service';
import { asRecord, humanizeMergeReason, toFiniteNumber } from './runtimeSignalStatsFormatting.service';
import { buildCloseReasonLookup, RuntimeTradeActionReason } from './runtimeTradeActionReason.service';
import { buildLifecycleActionByTradeId, toPositionMetaById } from './runtimeTradeLifecycle.service';
import { getRuntimeSessionSummaryMetrics, listRuntimeSessionsWithSummary } from './runtimeSessionsRead.service';
import { fetchFallbackKlineCloses, fetchFallbackTickerPrices } from './runtimeMarketDataFallback.service';
import { getOwnedBot, getOwnedBotRuntimeSession, resolveSessionWindowEnd } from './botOwnership.service';
import {
  buildConfiguredStrategyBySymbol,
  buildLatestTradeAtBySymbol,
  buildOpenPositionSymbolMetrics,
} from './runtimeSymbolStatsEnrichment.service';
import { composeRuntimeSymbolStatsReadModel } from './runtimeSymbolStatsReadModel.service';
import {
  getRuntimeSymbolLiveRows,
  getRuntimeSymbolStatsBaseData,
  listMarketCandleCloses,
  listRuntimeFallbackSymbolsFromEvents,
  listStrategiesByIds,
} from './botsRuntimeRead.repository';

type RuntimeTakeoverStatus = 'OWNED_AND_MANAGED' | 'UNOWNED' | 'AMBIGUOUS' | 'MANUAL_ONLY';

const resolveRuntimeTakeoverStatus = (input: {
  origin: string;
  managementMode: 'BOT_MANAGED' | 'MANUAL_MANAGED';
  syncState: string;
  botId: string | null;
}): RuntimeTakeoverStatus | null => {
  if (input.origin !== 'EXCHANGE_SYNC') return null;
  if (input.managementMode === 'MANUAL_MANAGED') return 'MANUAL_ONLY';
  if (input.botId) return 'OWNED_AND_MANAGED';
  return input.syncState === 'DRIFT' ? 'AMBIGUOUS' : 'UNOWNED';
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
  const windowEnd = resolveSessionWindowEnd(session);

  const {
    items,
    summary,
    configuredMarketGroups,
    configuredBotStrategies,
    configuredMarketGroupStrategyLinks,
    botContext,
  } = await getRuntimeSymbolStatsBaseData({
    userId,
    botId,
    sessionId,
    normalizedSymbol,
    limit: query.limit,
  });
  const botExchange = botContext?.exchange ?? 'BINANCE';
  const botMarketType = botContext?.marketType ?? 'FUTURES';

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
    const fallbackEventRows = await listRuntimeFallbackSymbolsFromEvents({
      userId,
      botId,
      sessionId,
      limit: Math.max(50, query.limit * 10),
    });
    symbols = normalizeSymbols(
      fallbackEventRows
        .map((row) => row.symbol)
        .filter((symbol): symbol is string => typeof symbol === 'string' && symbol.trim().length > 0)
    ).slice(0, query.limit);
  }
  const [openPositions, latestTradeBySymbolRows, latestSignalEvents] = symbols.length
    ? await getRuntimeSymbolLiveRows({
        userId,
        botId,
        sessionId,
        symbols,
        windowStart: session.startedAt,
        windowEnd,
      })
    : [[], [], []];

  const lastPriceBySymbol = new Map(items.map((item) => [item.symbol, item.lastPrice]));
  for (const symbol of symbols) {
    const ticker = getRuntimeTicker(symbol, {
      exchange: botExchange,
      marketType: botMarketType,
    });
    if (ticker && Number.isFinite(ticker.lastPrice)) {
      lastPriceBySymbol.set(symbol, ticker.lastPrice);
    }
  }
  const latestTradeAtBySymbol = buildLatestTradeAtBySymbol(latestTradeBySymbolRows);
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
    const signalStrategies = await listStrategiesByIds({
      userId,
      strategyIds: missingStrategyIds,
    });
    for (const strategy of signalStrategies) {
      strategiesById.set(strategy.id, {
        name: strategy.name,
        interval: strategy.interval,
        config: asRecord(strategy.config) ?? null,
      });
    }
  }

  const configuredBotStrategySymbolsResolved = await Promise.all(
    configuredBotStrategies.map(async (configuredBotStrategy) => ({
      strategyId: configuredBotStrategy.strategyId?.trim() ?? '',
      symbols: await resolveEffectiveSymbolGroupSymbolsWithCatalog(
        configuredBotStrategy.symbolGroup,
        catalogSymbolsCache
      ),
    }))
  );
  const configuredLinkSymbolsResolved = await Promise.all(
    configuredMarketGroupStrategyLinks.map(async (configuredLink) => ({
      strategyId: configuredLink.strategyId?.trim() ?? '',
      symbols: await resolveEffectiveSymbolGroupSymbolsWithCatalog(
        configuredLink.botMarketGroup.symbolGroup,
        catalogSymbolsCache
      ),
    }))
  );
  const configuredStrategyBySymbol = buildConfiguredStrategyBySymbol({
    configuredBotStrategies: configuredBotStrategySymbolsResolved,
    configuredMarketGroupStrategyLinks: configuredLinkSymbolsResolved,
    symbols,
    strategiesById,
  });

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

        const candles = await listMarketCandleCloses({
          marketType: botMarketType,
          symbol,
          interval,
          limit: 300,
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
  const { openPositionCountBySymbol, openPositionQtyBySymbol, unrealizedPnlBySymbol } =
    buildOpenPositionSymbolMetrics({
      openPositions,
      lastPriceBySymbol,
    });
  const statBySymbol = new Map(items.map((item) => [item.symbol, item]));
  const readModel = composeRuntimeSymbolStatsReadModel({
    userId,
    botId,
    sessionId,
    sessionStartedAt: session.startedAt,
    sessionCreatedAt: session.createdAt,
    sessionUpdatedAt: session.updatedAt,
    symbols,
    statBySymbol,
    aggregateSummary: {
      totalSignals: summary._sum.totalSignals,
      longEntries: summary._sum.longEntries,
      shortEntries: summary._sum.shortEntries,
      exits: summary._sum.exits,
      dcaCount: summary._sum.dcaCount,
      closedTrades: summary._sum.closedTrades,
      winningTrades: summary._sum.winningTrades,
      losingTrades: summary._sum.losingTrades,
      realizedPnl: summary._sum.realizedPnl,
      grossProfit: summary._sum.grossProfit,
      grossLoss: summary._sum.grossLoss,
      feesPaid: summary._sum.feesPaid,
    },
    openPositionCountBySymbol,
    openPositionQtyBySymbol,
    unrealizedPnlBySymbol,
    lastPriceBySymbol,
    latestTradeAtBySymbol,
    latestSignalBySymbol,
    configuredStrategyBySymbol,
    strategiesById,
    candleClosesBySeries,
  });

  return {
    sessionId,
    items: readModel.items,
    summary: readModel.summary,
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
  const botContext = await prisma.bot.findFirst({
    where: { id: botId, userId },
    select: {
      mode: true,
      walletId: true,
    },
  });
  if (!botContext) return null;
  const botScopedTradeWhere =
    botContext.mode === 'LIVE' && botContext.walletId
      ? { botId, walletId: botContext.walletId }
      : { botId };

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
              ...botScopedTradeWhere,
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
    ...botScopedTradeWhere,
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
          ...botScopedTradeWhere,
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

const resolveExternalPositionOwnerBySymbol = async (
  userId: string
): Promise<Map<string, string>> => {
  const bots = await prisma.bot.findMany({
    where: {
      userId,
      mode: { in: ['PAPER', 'LIVE'] },
    },
    select: {
      id: true,
      isActive: true,
      createdAt: true,
      botMarketGroups: {
        where: {
          isEnabled: true,
          lifecycleStatus: { in: ['ACTIVE', 'PAUSED'] },
        },
        select: {
          executionOrder: true,
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
        },
      },
    },
  });

  const ownerBySymbol = new Map<
    string,
    {
      botId: string;
      isActive: boolean;
      executionOrder: number;
      createdAtMs: number;
    }
  >();

  for (const bot of bots) {
    for (const group of bot.botMarketGroups) {
      const symbols = resolveEffectiveSymbolGroupSymbols({
        symbols: group.symbolGroup.symbols,
        marketUniverse: group.symbolGroup.marketUniverse,
      });
      if (symbols.length === 0) continue;

      const executionOrder = Number.isFinite(group.executionOrder)
        ? group.executionOrder
        : Number.MAX_SAFE_INTEGER;
      const createdAtMs = bot.createdAt.getTime();
      for (const symbol of symbols) {
        const existing = ownerBySymbol.get(symbol);
        if (!existing) {
          ownerBySymbol.set(symbol, {
            botId: bot.id,
            isActive: bot.isActive,
            executionOrder,
            createdAtMs,
          });
          continue;
        }

        const preferCandidate =
          (bot.isActive ? 1 : 0) > (existing.isActive ? 1 : 0) ||
          ((bot.isActive ? 1 : 0) === (existing.isActive ? 1 : 0) &&
            (executionOrder < existing.executionOrder ||
              (executionOrder === existing.executionOrder &&
                (createdAtMs < existing.createdAtMs ||
                  (createdAtMs === existing.createdAtMs && bot.id.localeCompare(existing.botId) < 0)))));

        if (preferCandidate) {
          ownerBySymbol.set(symbol, {
            botId: bot.id,
            isActive: bot.isActive,
            executionOrder,
            createdAtMs,
          });
        }
      }
    }
  }

  return new Map(
    [...ownerBySymbol.entries()].map(([symbol, owner]) => [symbol, owner.botId])
  );
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
  const botContext = await prisma.bot.findFirst({
    where: { id: botId, userId },
    select: {
      mode: true,
      exchange: true,
      marketType: true,
      walletId: true,
      paperStartBalance: true,
    },
  });
  if (!botContext) return null;
  const botScopedPositionWhere: Prisma.PositionWhereInput =
    botContext.mode === 'LIVE' && botContext.walletId
      ? { walletId: botContext.walletId }
      : { botId };
  const botScopedOrderWhere =
    botContext.mode === 'LIVE' && botContext.walletId
      ? { botId, walletId: botContext.walletId }
      : { botId };
  const botScopedTradeWhere =
    botContext.mode === 'LIVE' && botContext.walletId
      ? { botId, walletId: botContext.walletId }
      : { botId };
  const externalOwnerBySymbol = await resolveExternalPositionOwnerBySymbol(userId);
  const ownedExternalSymbols = [...externalOwnerBySymbol.entries()]
    .filter(([, ownerBotId]) => ownerBotId === botId)
    .map(([symbol]) => symbol);
  const externalOwnedWhere: Prisma.PositionWhereInput[] =
    ownedExternalSymbols.length > 0
      ? [
          {
            botId: null,
            origin: 'EXCHANGE_SYNC',
            symbol: { in: ownedExternalSymbols },
            ...(botContext.mode === 'LIVE' && botContext.walletId
              ? {
                  OR: [{ walletId: botContext.walletId }, { walletId: null }],
                }
              : {}),
          },
        ]
      : [];
  const botExchange = botContext.exchange ?? 'BINANCE';
  const botMarketType = botContext.marketType ?? 'FUTURES';
  const resolveRuntimeCapitalSummary = async (usedMargin: number) => {
    try {
      const referenceBalanceRaw = await resolveRuntimeReferenceBalance({
        userId,
        botId,
        walletId: botContext.walletId,
        mode: botContext.mode,
        exchange: botExchange,
        marketType: botMarketType,
        paperStartBalance: botContext.paperStartBalance,
        nowMs: Date.now(),
      });
      if (!Number.isFinite(referenceBalanceRaw)) {
        return { referenceBalance: null, freeCash: null };
      }
      const referenceBalance = Math.max(0, referenceBalanceRaw);
      const freeCash = Math.max(0, referenceBalance - Math.max(0, usedMargin));
      return { referenceBalance, freeCash };
    } catch {
      return { referenceBalance: null, freeCash: null };
    }
  };

  const positions = await prisma.position.findMany({
    where: {
      userId,
      managementMode: 'BOT_MANAGED',
      ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
      openedAt: {
        lte: windowEnd,
      },
      AND: [
        { OR: [botScopedPositionWhere, ...externalOwnedWhere] },
        { OR: [{ closedAt: null }, { closedAt: { gte: session.startedAt } }] },
      ],
    },
    orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
    take: query.limit,
    select: {
      id: true,
      origin: true,
      managementMode: true,
      syncState: true,
      botId: true,
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
        ...botScopedOrderWhere,
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
        ...(await resolveRuntimeCapitalSummary(0)),
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
        ...botScopedTradeWhere,
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
        ...botScopedOrderWhere,
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

  const lastPriceBySymbol = new Map(lastSymbolPrices.map((row) => [row.symbol, row.lastPrice]));
  for (const symbol of symbols) {
    const ticker = getRuntimeTicker(symbol, {
      exchange: botExchange,
      marketType: botMarketType,
    });
    if (ticker && Number.isFinite(ticker.lastPrice)) {
      lastPriceBySymbol.set(symbol, ticker.lastPrice);
    }
  }
  const missingPriceSymbols = symbols.filter((symbol) => {
    const current = lastPriceBySymbol.get(symbol);
    return !Number.isFinite(current) || (current as number) <= 0;
  });
  if (missingPriceSymbols.length > 0) {
    if (botExchange === 'BINANCE') {
      const fallbackPrices = await fetchFallbackTickerPrices({
        marketType: botMarketType === 'SPOT' ? 'SPOT' : 'FUTURES',
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
      origin: position.origin,
      managementMode: position.managementMode,
      syncState: position.syncState,
      takeoverStatus: resolveRuntimeTakeoverStatus({
        origin: position.origin,
        managementMode: position.managementMode,
        syncState: position.syncState,
        botId: position.botId,
      }),
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
  const usedMargin = openItems.reduce((sum, position) => {
    const leverage = Math.max(1, position.leverage || 1);
    return sum + position.entryNotional / leverage;
  }, 0);
  const capitalSummary = await resolveRuntimeCapitalSummary(usedMargin);

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
      ...capitalSummary,
    },
    openOrders,
    openItems,
    historyItems,
  };
};

export const closeBotRuntimeSessionPosition = async (
  userId: string,
  botId: string,
  sessionId: string,
  positionId: string,
  payload: CloseBotRuntimePositionDto
): Promise<Awaited<ReturnType<typeof orchestrateRuntimeSignal>> | null> => {
  const session = await getOwnedBotRuntimeSession(userId, botId, sessionId);
  if (!session) return null;
  if (!payload.riskAck) {
    throw new Error('POSITION_CLOSE_RISK_ACK_REQUIRED');
  }

  const botContext = await prisma.bot.findFirst({
    where: { id: botId, userId },
    select: {
      mode: true,
      exchange: true,
      marketType: true,
      walletId: true,
    },
  });
  if (!botContext) return null;

  const position = await prisma.position.findFirst({
    where: {
      id: positionId,
      userId,
      status: 'OPEN',
      managementMode: 'BOT_MANAGED',
    },
    select: {
      id: true,
      botId: true,
      walletId: true,
      strategyId: true,
      symbol: true,
      quantity: true,
      entryPrice: true,
      origin: true,
    },
  });
  if (!position) return null;

  if (botContext.walletId && position.walletId && position.walletId !== botContext.walletId) {
    return null;
  }

  const directlyOwnedByBot = position.botId === botId;
  let externallyOwnedByBot = false;
  if (!directlyOwnedByBot && !position.botId && position.origin === 'EXCHANGE_SYNC') {
    const externalOwnerBySymbol = await resolveExternalPositionOwnerBySymbol(userId);
    externallyOwnedByBot = externalOwnerBySymbol.get(position.symbol) === botId;
  }
  if (!directlyOwnedByBot && !externallyOwnedByBot) return null;

  const botExchange = botContext.exchange ?? 'BINANCE';
  const botMarketType = botContext.marketType ?? 'FUTURES';
  const liveTicker = getRuntimeTicker(position.symbol, {
    exchange: botExchange,
    marketType: botMarketType,
  });
  const fallbackMarkPrice = Number.isFinite(position.entryPrice) && position.entryPrice > 0 ? position.entryPrice : 1;
  const markPrice =
    liveTicker && Number.isFinite(liveTicker.lastPrice) && liveTicker.lastPrice > 0
      ? liveTicker.lastPrice
      : fallbackMarkPrice;

  return orchestrateRuntimeSignal({
    userId,
    botId,
    walletId: botContext.walletId ?? undefined,
    runtimeSessionId: session.id,
    strategyId: position.strategyId ?? undefined,
    symbol: position.symbol,
    direction: 'EXIT',
    quantity: Math.max(0, position.quantity),
    markPrice,
    mode: botContext.mode,
    reason: 'manual_dashboard_close_position',
  });
};
