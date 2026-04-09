import { buildSignalConditionSummary } from './runtimeSignalConditionSummary.service';
import {
  buildSignalConditionLines,
  buildSignalIndicatorSummary,
  SignalConditionLine,
} from './runtimeSignalConditionLines.service';

type RuntimeSymbolStatRow = {
  id: string;
  symbol: string;
  totalSignals: number;
  longEntries: number;
  shortEntries: number;
  exits: number;
  dcaCount: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  realizedPnl: number;
  grossProfit: number;
  grossLoss: number;
  feesPaid: number;
  openPositionCount: number;
  openPositionQty: number;
  lastPrice: number | null;
  lastSignalAt: Date | null;
  lastTradeAt: Date | null;
  snapshotAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type RuntimeSymbolSignal = {
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
};

type RuntimeStrategyProjection = {
  name: string;
  interval: string;
  config: Record<string, unknown> | null;
};

type RuntimeSymbolAggregateSummary = {
  totalSignals: number | null;
  longEntries: number | null;
  shortEntries: number | null;
  exits: number | null;
  dcaCount: number | null;
  closedTrades: number | null;
  winningTrades: number | null;
  losingTrades: number | null;
  realizedPnl: number | null;
  grossProfit: number | null;
  grossLoss: number | null;
  feesPaid: number | null;
};

export const composeRuntimeSymbolStatsReadModel = (params: {
  userId: string;
  botId: string;
  sessionId: string;
  sessionStartedAt: Date;
  sessionCreatedAt: Date;
  sessionUpdatedAt: Date;
  symbols: string[];
  statBySymbol: Map<string, RuntimeSymbolStatRow>;
  aggregateSummary: RuntimeSymbolAggregateSummary;
  openPositionCountBySymbol: Map<string, number>;
  openPositionQtyBySymbol: Map<string, number>;
  unrealizedPnlBySymbol: Map<string, number>;
  lastPriceBySymbol: Map<string, number | null>;
  latestTradeAtBySymbol: Map<string, Date | null>;
  latestSignalBySymbol: Map<string, RuntimeSymbolSignal>;
  configuredStrategyBySymbol: Map<string, string>;
  strategiesById: Map<string, RuntimeStrategyProjection>;
  candleClosesBySeries: Map<string, number[]>;
}) => {
  const items = params.symbols.map((symbol) => {
    const stat = params.statBySymbol.get(symbol) ?? null;
    const openCount = params.openPositionCountBySymbol.get(symbol);
    const openQty = params.openPositionQtyBySymbol.get(symbol);
    const unrealizedPnl = params.unrealizedPnlBySymbol.get(symbol) ?? 0;
    const latestSignal = params.latestSignalBySymbol.get(symbol);
    const lastPrice = params.lastPriceBySymbol.get(symbol) ?? null;
    const fallbackStrategyId = params.configuredStrategyBySymbol.get(symbol) ?? null;
    const signalStrategyId = latestSignal?.strategyId ?? fallbackStrategyId;
    const signalStrategy =
      signalStrategyId != null ? params.strategiesById.get(signalStrategyId) ?? null : null;
    const signalSeriesKey =
      signalStrategy?.interval != null ? `${symbol}|${signalStrategy.interval.trim().toLowerCase()}` : null;
    const signalCloses = signalSeriesKey ? params.candleClosesBySeries.get(signalSeriesKey) ?? [] : [];
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
      id: stat?.id ?? `virtual-${params.sessionId}-${symbol}`,
      userId: params.userId,
      botId: params.botId,
      sessionId: params.sessionId,
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
      lastTradeAt: stat?.lastTradeAt ?? params.latestTradeAtBySymbol.get(symbol) ?? null,
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
      snapshotAt: stat?.snapshotAt ?? params.sessionStartedAt,
      createdAt: stat?.createdAt ?? params.sessionCreatedAt,
      updatedAt: stat?.updatedAt ?? params.sessionUpdatedAt,
    };
  });

  const summaryUnrealizedPnl = items.reduce(
    (acc, item) => acc + (Number.isFinite(item.unrealizedPnl) ? item.unrealizedPnl : 0),
    0
  );
  const summaryOpenPositionCount = items.reduce((acc, item) => acc + item.openPositionCount, 0);
  const summaryOpenPositionQty = items.reduce((acc, item) => acc + item.openPositionQty, 0);
  const summaryRealizedPnl = params.aggregateSummary.realizedPnl ?? 0;

  return {
    items,
    summary: {
      totalSignals: params.aggregateSummary.totalSignals ?? 0,
      longEntries: params.aggregateSummary.longEntries ?? 0,
      shortEntries: params.aggregateSummary.shortEntries ?? 0,
      exits: params.aggregateSummary.exits ?? 0,
      dcaCount: params.aggregateSummary.dcaCount ?? 0,
      closedTrades: params.aggregateSummary.closedTrades ?? 0,
      winningTrades: params.aggregateSummary.winningTrades ?? 0,
      losingTrades: params.aggregateSummary.losingTrades ?? 0,
      realizedPnl: summaryRealizedPnl,
      unrealizedPnl: summaryUnrealizedPnl,
      totalPnl: summaryRealizedPnl + summaryUnrealizedPnl,
      grossProfit: params.aggregateSummary.grossProfit ?? 0,
      grossLoss: params.aggregateSummary.grossLoss ?? 0,
      feesPaid: params.aggregateSummary.feesPaid ?? 0,
      openPositionCount: summaryOpenPositionCount,
      openPositionQty: summaryOpenPositionQty,
    },
  };
};
