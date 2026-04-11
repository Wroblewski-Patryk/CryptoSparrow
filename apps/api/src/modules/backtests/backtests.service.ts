import { Exchange, PositionSide, Prisma } from '@prisma/client';
import { getMarketCatalog } from '../markets/markets.service';
import { decideExecutionAction } from '../engine/sharedExecutionCore';
import { evaluatePositionManagement } from '../engine/positionManagement.service';
import { PositionManagementInput } from '../engine/positionManagement.types';
import {
  evaluateStrategySignalAtIndex,
  parseStrategySignalRules,
  type StrategySignalDerivativesSeries,
} from '../engine/strategySignalEvaluator';
import {
  computeAdxSeriesFromCandles,
  computeAtrSeriesFromCandles,
  computeBollingerSeriesFromCloses,
  computeCciSeriesFromCandles,
  computeDonchianSeriesFromCandles,
  computeEmaSeriesFromCloses,
  computeMacdSeriesFromCloses,
  computeMomentumSeriesFromCloses,
  computeRollingZScoreSeriesFromNullableValues,
  computeRocSeriesFromCloses,
  computeRsiSeriesFromCloses,
  computeSmaSeriesFromNullableValues,
  computeSmaSeriesFromCloses,
  computeStochasticSeriesFromCandles,
  computeStochRsiSeriesFromCloses,
} from '../engine/sharedIndicatorSeries';
import { alignTimedNumericPointsToCandles } from '../engine/sharedDerivativesSeries';
import {
  CandlePatternParams,
  CandlePatternName,
  computeCandlePatternSeries,
  resolveCandlePatternName,
} from '../engine/sharedCandlePatternSeries';
import {
  computeRiskBasedOrderQuantity,
  normalizeWalletRiskPercent,
} from '../engine/positionSizing';
import {
  type ReplayEventDraft,
  type ReplayParityDecisionTrace,
  type ReplayEventType,
  type StrategyRiskConfig,
  buildReplayPositionManagementInput,
  closeReasonToEventType,
  parseStrategyRiskConfig,
} from './backtestReplayCore';
import {
  BacktestFillModelConfig,
  createHistoricalBacktestFillModel,
} from './backtestFillModel';
import {
  CreateBacktestRunDto,
  GetBacktestTimelineQuery,
  ListBacktestRunsQuery,
  ListBacktestTradesQuery,
} from './backtests.types';
import {
  IndicatorSpec,
  parseStrategyIndicators,
  resolveIndicatorWarmupCandles,
} from './backtestIndicatorSpecs';
import {
  getDefaultCandlesForTimeframe,
  getTimeframeIntervalMs,
} from './backtestTimeframe';
import {
  type BacktestFundingRatePoint as FundingRatePoint,
  fetchKlines,
  type BacktestKlineCandle as KlineCandle,
  type BacktestMarketType as MarketType,
  type BacktestOpenInterestPoint as OpenInterestPoint,
  type BacktestOrderBookPoint as OrderBookPoint,
  type BacktestSupplementalSeries as SupplementalSeries,
  fetchSupplementalSeries,
} from './backtestDataGateway';
import { createBacktestRunJob } from './backtestRunJob';
import { BacktestRunQueue } from './backtestRunQueue';
import {
  countLosingBacktestTrades,
  countWinningBacktestTrades,
  createBacktestRun,
  createBacktestTrades,
  deleteOwnedBacktestRunCascade,
  findBacktestRunById,
  findOwnedBacktestReport,
  findOwnedBacktestRun,
  findOwnedBacktestRunId,
  findOwnedBacktestRunTimelineSeed,
  findOwnedMarketUniverseById,
  findOwnedStrategyForBacktest,
  findOwnedStrategySignalConfig,
  listOwnedBacktestRuns,
  listOwnedBacktestTrades,
  updateBacktestRunById,
  upsertBacktestReportForRun,
} from './backtests.repository';

type MarginMode = 'CROSSED' | 'ISOLATED';

type TradeDraft = {
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  openedAt: Date;
  closedAt: Date;
  pnl: number;
  fee: number;
  exitReason: 'SIGNAL_EXIT' | 'FINAL_CANDLE' | 'LIQUIDATION';
  liquidated: boolean;
};

type SymbolSimulationResult = {
  trades: TradeDraft[];
  liquidations: number;
  events: ReplayEventDraft[];
  eventCounts: Record<ReplayEventType, number>;
  decisionTrace: ReplayParityDecisionTrace[];
};

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const uniqueSorted = (values: string[]) =>
  [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

const inferBaseCurrencyFromSymbol = (symbol: string): string =>
  (symbol.match(/(USDT|USDC|BUSD|FDUSD|BTC|ETH|EUR|USD)$/)?.[1] ?? 'USDT').toUpperCase();

const computeSourceWindowMs = (timeframe: string, maxCandles: number) => {
  const intervalMs = getTimeframeIntervalMs(timeframe);
  const requestedWindowMs = intervalMs * Math.max(1, maxCandles);
  const bufferedWindowMs = Math.ceil(requestedWindowMs * 1.15);
  return Math.max(TWO_WEEKS_MS, bufferedWindowMs);
};

const computeAdaptiveMaxCandles = (timeframe: string, symbolCount: number, requested?: number) => {
  const base = requested && Number.isFinite(requested) ? requested : getDefaultCandlesForTimeframe(timeframe);
  const safeBase = clamp(Math.floor(base), 100, 10_000);

  if (symbolCount <= 25) return safeBase;
  if (symbolCount <= 100) return clamp(Math.floor(safeBase * 0.65), 100, safeBase);
  if (symbolCount <= 250) return clamp(Math.floor(safeBase * 0.45), 80, safeBase);
  return clamp(Math.floor(safeBase * 0.3), 60, safeBase);
};

const maxDrawdownFromPnlSeries = (pnls: number[]) => {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const pnl of pnls) {
    equity += pnl;
    if (equity > peak) peak = equity;
    const drawdown = peak > 0 ? (peak - equity) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown;
};

const isMissingRunUpdateError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

const safeUpdateRun = async (runId: string, data: Prisma.BacktestRunUpdateInput) => {
  try {
    await updateBacktestRunById(runId, data);
    return true;
  } catch (error) {
    if (isMissingRunUpdateError(error)) return false;
    throw error;
  }
};

const buildDerivativesSeriesForCandles = (
  candles: KlineCandle[],
  supplemental?: SupplementalSeries,
): StrategySignalDerivativesSeries => {
  if (!supplemental) return {};
  return {
    fundingRate: alignTimedNumericPointsToCandles(
      candles,
      supplemental.fundingRates.map((point) => ({
        timestamp: point.timestamp,
        value: point.fundingRate,
      })),
    ),
    openInterest: alignTimedNumericPointsToCandles(
      candles,
      supplemental.openInterest.map((point) => ({
        timestamp: point.timestamp,
        value: point.openInterest,
      })),
    ),
    orderBookImbalance: alignTimedNumericPointsToCandles(
      candles,
      supplemental.orderBook.map((point) => ({
        timestamp: point.timestamp,
        value: point.imbalance,
      })),
    ),
    orderBookSpreadBps: alignTimedNumericPointsToCandles(
      candles,
      supplemental.orderBook.map((point) => ({
        timestamp: point.timestamp,
        value: point.spreadBps,
      })),
    ),
    orderBookDepthRatio: alignTimedNumericPointsToCandles(
      candles,
      supplemental.orderBook.map((point) => ({
        timestamp: point.timestamp,
        value: point.depthRatio,
      })),
    ),
  };
};

type InterleavedPortfolioSimulationResult = {
  perSymbol: Record<string, SymbolSimulationResult>;
  finalBalance: number;
};

const simulateInterleavedPortfolio = (input: {
  symbols: string[];
  candlesBySymbol: Map<string, KlineCandle[]>;
  supplementalBySymbol?: Map<string, SupplementalSeries>;
  analysisStartIndexBySymbol?: Map<string, number>;
  marketType: MarketType;
  leverage: number;
  marginMode: MarginMode | 'NONE';
  strategyConfig?: Record<string, unknown> | null;
  fillModelConfig?: BacktestFillModelConfig;
  walletRiskPercent: number;
  initialBalance: number;
}): InterleavedPortfolioSimulationResult => {
  const effectiveLeverage = input.marketType === 'SPOT' ? 1 : Math.max(1, input.leverage);
  const rules = parseStrategySignalRules(input.strategyConfig);
  const strategyModeEnabled = Boolean(input.strategyConfig && typeof input.strategyConfig === 'object');
  const riskConfig = parseStrategyRiskConfig(input.strategyConfig);
  const fillModel = createHistoricalBacktestFillModel(input.fillModelConfig);

  const perSymbol: Record<string, SymbolSimulationResult> = Object.fromEntries(
    input.symbols.map((symbol) => [
      symbol,
      {
        trades: [],
        liquidations: 0,
        events: [],
        eventCounts: {
          ENTRY: 0,
          EXIT: 0,
          DCA: 0,
          TP: 0,
          TTP: 0,
          SL: 0,
          TRAILING: 0,
          LIQUIDATION: 0,
        },
        decisionTrace: [],
      } satisfies SymbolSimulationResult,
    ]),
  );

  const indicatorCacheBySymbol = new Map<string, Map<string, Array<number | null>>>();
  const derivativesSeriesBySymbol = new Map<string, StrategySignalDerivativesSeries>();
  for (const symbol of input.symbols) {
    const candles = input.candlesBySymbol.get(symbol) ?? [];
    const supplemental = input.supplementalBySymbol?.get(symbol);
    derivativesSeriesBySymbol.set(symbol, buildDerivativesSeriesForCandles(candles, supplemental));
  }
  const tradeSequenceBySymbol = new Map<string, number>(input.symbols.map((symbol) => [symbol, 0]));
  const resolveStartIndex = (symbol: string) => {
    const candles = input.candlesBySymbol.get(symbol) ?? [];
    if (candles.length <= 1) return 1;
    const configuredStart = input.analysisStartIndexBySymbol?.get(symbol);
    if (typeof configuredStart !== 'number' || !Number.isFinite(configuredStart)) return 1;
    return clamp(Math.floor(configuredStart), 1, candles.length - 1);
  };
  const cursorBySymbol = new Map<string, number>(input.symbols.map((symbol) => [symbol, resolveStartIndex(symbol)]));
  const openPositions = new Map<string, {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    quantity: number;
    openedAt: Date;
    dcaCount: number;
    lastDcaPrice: number;
    bestPrice: number;
    marginUsed: number;
    trailingLossLimit?: number;
    trailingTakeProfitHigh?: number;
    trailingTakeProfitStep?: number;
  }>();

  let cashBalance = Math.max(0, input.initialBalance);
  const calcReservedMargin = () =>
    [...openPositions.values()].reduce((sum, position) => sum + position.marginUsed, 0);
  const calcReferenceBalance = () => Math.max(0, cashBalance + calcReservedMargin());

  const pickNextSymbol = () => {
    let selected: { symbol: string; openTime: number } | null = null;
    for (const symbol of input.symbols) {
      const candles = input.candlesBySymbol.get(symbol) ?? [];
      const cursor = cursorBySymbol.get(symbol) ?? resolveStartIndex(symbol);
      if (cursor >= candles.length) continue;
      const openTime = candles[cursor].openTime;
      if (!selected || openTime < selected.openTime || (openTime === selected.openTime && symbol.localeCompare(selected.symbol) < 0)) {
        selected = { symbol, openTime };
      }
    }
    return selected?.symbol ?? null;
  };

  const pushEvent = (
    symbol: string,
    type: ReplayEventType,
    side: PositionSide,
    timestamp: Date,
    price: number,
    pnl: number | null,
    candleIndex: number,
    tradeSequence: number,
  ) => {
    const bucket = perSymbol[symbol];
    bucket.events.push({
      symbol,
      type,
      side,
      timestamp,
      price,
      pnl,
      candleIndex,
      tradeSequence,
    });
    bucket.eventCounts[type] += 1;
  };

  while (true) {
    const symbol = pickNextSymbol();
    if (!symbol) break;
    const candles = input.candlesBySymbol.get(symbol) ?? [];
    const index = cursorBySymbol.get(symbol) ?? resolveStartIndex(symbol);
    const current = candles[index];
    const previous = candles[index - 1];
    const bucket = perSymbol[symbol];
    const indicatorCache = indicatorCacheBySymbol.get(symbol) ?? new Map<string, Array<number | null>>();
    indicatorCacheBySymbol.set(symbol, indicatorCache);
    const derivativesSeries = derivativesSeriesBySymbol.get(symbol);
    const direction = strategyModeEnabled
      ? rules
        ? evaluateStrategySignalAtIndex(rules, candles, index, indicatorCache, {
            derivatives: derivativesSeries,
          })
        : null
      : (() => {
        const base = previous.close > 0 ? previous.close : 1;
        const changePct = ((current.close - previous.close) / base) * 100;
        if (changePct >= 1) return 'LONG';
        if (changePct <= -1) return 'SHORT';
        if (Math.abs(changePct) <= 0.2) return 'EXIT';
        return null;
      })();
    const open = openPositions.get(symbol);
    const decision = direction
      ? decideExecutionAction(
        direction,
        open
          ? { side: open.side, quantity: open.quantity, managementMode: 'BOT_MANAGED' }
          : null,
      )
      : null;

    if (direction && decision) {
      const traceSide: PositionSide | null =
        decision.kind === 'open'
          ? (decision.positionSide as PositionSide)
          : open
            ? (open.side as PositionSide)
            : direction === 'LONG' || direction === 'SHORT'
              ? (direction as PositionSide)
              : null;
      bucket.decisionTrace.push({
        symbol,
        timestamp: new Date(current.openTime),
        candleIndex: index,
        signal: direction,
        side: traceSide,
        trigger: strategyModeEnabled ? 'STRATEGY' : 'THRESHOLD',
        mismatchReason: decision.kind === 'ignore' ? decision.reason : null,
      });
    }

    if (decision?.kind === 'open') {
      const entryPrice = fillModel.entryPrice(current.close, decision.positionSide as PositionSide);
      const quantity = computeRiskBasedOrderQuantity({
        price: entryPrice,
        walletRiskPercent: input.walletRiskPercent,
        referenceBalance: calcReferenceBalance(),
        leverage: effectiveLeverage,
        minQuantity: 0.000001,
      });
      const marginRequired = (entryPrice * quantity) / Math.max(1, effectiveLeverage);
      if (marginRequired <= cashBalance && quantity > 0) {
        cashBalance -= marginRequired;
        const sequence = (tradeSequenceBySymbol.get(symbol) ?? 0) + 1;
        tradeSequenceBySymbol.set(symbol, sequence);
        openPositions.set(symbol, {
          side: decision.positionSide,
          entryPrice,
          quantity,
          openedAt: new Date(current.openTime),
          dcaCount: 0,
          lastDcaPrice: entryPrice,
          bestPrice: entryPrice,
          marginUsed: marginRequired,
        });
        pushEvent(symbol, 'ENTRY', decision.positionSide as PositionSide, new Date(current.openTime), entryPrice, null, index, sequence);
      }
      cursorBySymbol.set(symbol, index + 1);
      continue;
    }

    if (!open) {
      cursorBySymbol.set(symbol, index + 1);
      continue;
    }

    const position = open;
    if (position.side === 'LONG') position.bestPrice = Math.max(position.bestPrice, current.high);
    else position.bestPrice = Math.min(position.bestPrice, current.low);

    const baseState = {
      averageEntryPrice: position.entryPrice,
      quantity: position.quantity,
      currentAdds: position.dcaCount,
      trailingAnchorPrice: position.bestPrice,
      trailingLossLimitPercent: position.trailingLossLimit,
      trailingTakeProfitHighPercent: position.trailingTakeProfitHigh,
      trailingTakeProfitStepPercent: position.trailingTakeProfitStep,
      lastDcaPrice: position.lastDcaPrice,
    };

    const dcaProbeInput: PositionManagementInput = {
      ...buildReplayPositionManagementInput({
        side: position.side,
        currentPrice: position.side === 'LONG' ? current.low : current.high,
        entryPrice: position.entryPrice,
        leverage: effectiveLeverage,
        riskConfig,
      }),
      takeProfitPrice: undefined,
      stopLossPrice: undefined,
      trailingTakeProfit: undefined,
      trailingTakeProfitLevels: undefined,
      trailingStop: undefined,
      trailingStopLevels: undefined,
      trailingLoss: undefined,
    };
    const dcaProbeResult = evaluatePositionManagement(dcaProbeInput, baseState);
    const hasPendingDcaLevels = position.dcaCount < riskConfig.maxDcaPerTrade;
    const nextDcaMultiplier =
      riskConfig.dcaMultipliers[position.dcaCount] ??
      riskConfig.dcaMultipliers[riskConfig.dcaMultipliers.length - 1] ??
      1;
    const estimatedNextDcaAddedQty = Math.max(0, position.quantity * Math.max(0, nextDcaMultiplier));
    const estimatedNextDcaMargin = (current.close * estimatedNextDcaAddedQty) / Math.max(1, effectiveLeverage);
    const dcaFundsExhausted =
      hasPendingDcaLevels && estimatedNextDcaAddedQty > 0
        ? estimatedNextDcaMargin > cashBalance
        : false;
    const lockTrailingByPendingDca = hasPendingDcaLevels && !dcaFundsExhausted;

    if (dcaProbeResult.dcaExecuted) {
      const addedQty = Math.max(0, dcaProbeResult.nextState.quantity - position.quantity);
      const addMargin = (current.close * addedQty) / Math.max(1, effectiveLeverage);
      if (addMargin > cashBalance) {
        // Legacy parity: no DCA add when wallet cannot cover extra margin.
        const managementWithoutDca: PositionManagementInput = {
          ...dcaProbeInput,
          dca: undefined,
        };
        const noDcaProbe = evaluatePositionManagement(managementWithoutDca, baseState);
        position.trailingLossLimit = noDcaProbe.nextState.trailingLossLimitPercent;
        position.trailingTakeProfitHigh = noDcaProbe.nextState.trailingTakeProfitHighPercent;
        position.trailingTakeProfitStep = noDcaProbe.nextState.trailingTakeProfitStepPercent;
        position.bestPrice = noDcaProbe.nextState.trailingAnchorPrice ?? position.bestPrice;
      } else {
        cashBalance -= addMargin;
        position.marginUsed += addMargin;
        position.quantity = dcaProbeResult.nextState.quantity;
        position.entryPrice = dcaProbeResult.nextState.averageEntryPrice;
        position.dcaCount = dcaProbeResult.nextState.currentAdds;
        position.lastDcaPrice = current.close;
        pushEvent(
          symbol,
          'DCA',
          position.side as PositionSide,
          new Date(current.openTime),
          current.close,
          null,
          index,
          tradeSequenceBySymbol.get(symbol) ?? 1,
        );
      }
    }

    const managementInput = {
      ...buildReplayPositionManagementInput({
        side: position.side,
        currentPrice: current.close,
        entryPrice: position.entryPrice,
        leverage: effectiveLeverage,
        riskConfig,
      }),
      dca: undefined,
      dcaFundsExhausted,
    } satisfies PositionManagementInput;
    let managementResult = evaluatePositionManagement(managementInput, {
      averageEntryPrice: position.entryPrice,
      quantity: position.quantity,
      currentAdds: position.dcaCount,
      // Keep trailing memory from runtime state; DCA probe runs with trailing
      // disabled and cannot be allowed to wipe active trailing tracking.
      trailingAnchorPrice: position.bestPrice,
      trailingLossLimitPercent: position.trailingLossLimit,
      trailingTakeProfitHighPercent: position.trailingTakeProfitHigh,
      trailingTakeProfitStepPercent: position.trailingTakeProfitStep,
      lastDcaPrice: position.lastDcaPrice,
    });

    position.trailingLossLimit = managementResult.nextState.trailingLossLimitPercent;
    position.trailingTakeProfitHigh = managementResult.nextState.trailingTakeProfitHighPercent;
    position.trailingTakeProfitStep = managementResult.nextState.trailingTakeProfitStepPercent;
    position.bestPrice = managementResult.nextState.trailingAnchorPrice ?? position.bestPrice;

    if (
      lockTrailingByPendingDca &&
      managementResult.shouldClose &&
      ['trailing_stop', 'stop_loss'].includes(
        managementResult.closeReason ?? '',
      )
    ) {
      managementResult = {
        ...managementResult,
        shouldClose: false,
        closeReason: undefined,
      };
    }

    const exitMarkPrice = current.close;

    const adverseMove =
      position.side === 'LONG'
        ? (position.entryPrice - current.low) / Math.max(position.entryPrice, 1e-8)
        : (current.high - position.entryPrice) / Math.max(position.entryPrice, 1e-8);

    const isolatedThreshold = 1 / Math.max(1, effectiveLeverage);
    const isIsolatedLiquidated =
      input.marketType === 'FUTURES' &&
      input.marginMode === 'ISOLATED' &&
      adverseMove >= isolatedThreshold;
    if (
      !isIsolatedLiquidated &&
      !managementResult.shouldClose
    ) {
      cursorBySymbol.set(symbol, index + 1);
      continue;
    }

    const clampedExitMarkPrice =
      position.side === 'LONG'
        ? clamp(exitMarkPrice, current.low, current.high)
        : clamp(exitMarkPrice, current.low, current.high);
    const exitPrice = fillModel.exitPrice(clampedExitMarkPrice, position.side as PositionSide);
    const settlement = fillModel.settle({
      side: position.side as PositionSide,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      leverage: effectiveLeverage,
    });
    const rawPnl = settlement.grossPnl - settlement.fees;
    let pnl = isIsolatedLiquidated ? -position.marginUsed : rawPnl;
    if (input.marginMode === 'ISOLATED') {
      pnl = Math.max(-position.marginUsed, pnl);
    }
    let nextCash = cashBalance + position.marginUsed + pnl;
    if (nextCash < 0) {
      pnl = -(cashBalance + position.marginUsed);
      nextCash = 0;
    }
    cashBalance = nextCash;

    const closeType: ReplayEventType = isIsolatedLiquidated
      ? 'LIQUIDATION'
      : managementResult.shouldClose
        ? closeReasonToEventType(managementResult.closeReason)
        : 'EXIT';
    if (isIsolatedLiquidated) {
      bucket.liquidations += 1;
    }
    bucket.trades.push({
      symbol,
      side: position.side as PositionSide,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      openedAt: position.openedAt,
      closedAt: new Date(current.closeTime),
      pnl,
      fee: settlement.fees,
      exitReason: isIsolatedLiquidated ? 'LIQUIDATION' : 'SIGNAL_EXIT',
      liquidated: isIsolatedLiquidated,
    });
    pushEvent(
      symbol,
      closeType,
      position.side as PositionSide,
      new Date(current.closeTime),
      exitPrice,
      pnl,
      index,
      tradeSequenceBySymbol.get(symbol) ?? 1,
    );
    openPositions.delete(symbol);
    cursorBySymbol.set(symbol, index + 1);
  }

  for (const [symbol, position] of openPositions.entries()) {
    const candles = input.candlesBySymbol.get(symbol) ?? [];
    if (candles.length === 0) continue;
    const last = candles[candles.length - 1];
    const exitPrice = fillModel.exitPrice(last.close, position.side as PositionSide);
    const settlement = fillModel.settle({
      side: position.side as PositionSide,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      leverage: effectiveLeverage,
    });
    let pnl = settlement.grossPnl - settlement.fees;
    if (input.marginMode === 'ISOLATED') {
      pnl = Math.max(-position.marginUsed, pnl);
    }
    let nextCash = cashBalance + position.marginUsed + pnl;
    if (nextCash < 0) {
      pnl = -(cashBalance + position.marginUsed);
      nextCash = 0;
    }
    cashBalance = nextCash;
    const bucket = perSymbol[symbol];
    bucket.trades.push({
      symbol,
      side: position.side as PositionSide,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      openedAt: position.openedAt,
      closedAt: new Date(last.closeTime),
      pnl,
      fee: settlement.fees,
      exitReason: 'FINAL_CANDLE',
      liquidated: false,
    });
    pushEvent(
      symbol,
      'EXIT',
      position.side as PositionSide,
      new Date(last.closeTime),
      exitPrice,
      pnl,
      candles.length - 1,
      tradeSequenceBySymbol.get(symbol) ?? 1,
    );
    bucket.decisionTrace.push({
      symbol,
      timestamp: new Date(last.closeTime),
      candleIndex: candles.length - 1,
      signal: 'EXIT',
      side: position.side as PositionSide,
      trigger: 'FINAL_CANDLE',
      mismatchReason: null,
    });
  }

  return {
    perSymbol,
    finalBalance: cashBalance + calcReservedMargin(),
  };
};

const buildIndicatorSeries = (
  candles: KlineCandle[],
  specs: IndicatorSpec[],
  supplemental?: SupplementalSeries,
) => {
  const closes = candles.map((candle) => candle.close);
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const fundingRawSeries = supplemental
    ? alignTimedNumericPointsToCandles(
        candles,
        supplemental.fundingRates.map((point) => ({
          timestamp: point.timestamp,
          value: point.fundingRate,
        })),
      )
    : Array.from({ length: closes.length }, () => null);
  const openInterestRawSeries = supplemental
    ? alignTimedNumericPointsToCandles(
        candles,
        supplemental.openInterest.map((point) => ({
          timestamp: point.timestamp,
          value: point.openInterest,
        })),
      )
    : Array.from({ length: closes.length }, () => null);
  const orderBookImbalanceSeries = supplemental
    ? alignTimedNumericPointsToCandles(
        candles,
        supplemental.orderBook.map((point) => ({
          timestamp: point.timestamp,
          value: point.imbalance,
        })),
      )
    : Array.from({ length: closes.length }, () => null);
  const orderBookSpreadSeries = supplemental
    ? alignTimedNumericPointsToCandles(
        candles,
        supplemental.orderBook.map((point) => ({
          timestamp: point.timestamp,
          value: point.spreadBps,
        })),
      )
    : Array.from({ length: closes.length }, () => null);
  const orderBookDepthRatioSeries = supplemental
    ? alignTimedNumericPointsToCandles(
        candles,
        supplemental.orderBook.map((point) => ({
          timestamp: point.timestamp,
          value: point.depthRatio,
        })),
      )
    : Array.from({ length: closes.length }, () => null);
  const macdCache = new Map<
    string,
    {
      line: Array<number | null>;
      signal: Array<number | null>;
      histogram: Array<number | null>;
    }
  >();
  const stochRsiCache = new Map<
    string,
    {
      k: Array<number | null>;
      d: Array<number | null>;
    }
  >();
  const bollingerCache = new Map<
    string,
    {
      upper: Array<number | null>;
      middle: Array<number | null>;
      lower: Array<number | null>;
      bandwidth: Array<number | null>;
      percentB: Array<number | null>;
    }
  >();
  const stochasticCache = new Map<
    string,
    {
      k: Array<number | null>;
      d: Array<number | null>;
    }
  >();
  const adxCache = new Map<
    string,
    {
      adx: Array<number | null>;
      plusDi: Array<number | null>;
      minusDi: Array<number | null>;
    }
  >();
  const donchianCache = new Map<
    string,
    {
      upper: Array<number | null>;
      middle: Array<number | null>;
      lower: Array<number | null>;
    }
  >();
  const patternCache = new Map<string, Array<number | null>>();
  return specs.map((spec) => {
    const values = (() => {
      if (spec.source === 'EMA') {
        const period = spec.params.period ?? spec.period;
        return computeEmaSeriesFromCloses(closes, period);
      }

      if (spec.source === 'SMA') {
        const period = spec.params.period ?? spec.period;
        return computeSmaSeriesFromCloses(closes, period);
      }

      if (spec.source === 'RSI') {
        const period = spec.params.period ?? spec.period;
        return computeRsiSeriesFromCloses(closes, period);
      }

      if (spec.source === 'ROC') {
        const period = spec.params.period ?? spec.period;
        return computeRocSeriesFromCloses(closes, period);
      }

      if (spec.source === 'ATR') {
        const period = spec.params.period ?? spec.period;
        return computeAtrSeriesFromCandles(highs, lows, closes, period);
      }

      if (spec.source === 'CCI') {
        const period = spec.params.period ?? spec.period;
        return computeCciSeriesFromCandles(highs, lows, closes, period);
      }

      if (spec.source === 'DONCHIAN') {
        const period = spec.params.period ?? 20;
        const key = `${period}`;
        if (!donchianCache.has(key)) {
          donchianCache.set(key, computeDonchianSeriesFromCandles(highs, lows, period));
        }
        const donchian = donchianCache.get(key)!;
        if (spec.channel === 'UPPER') return donchian.upper;
        if (spec.channel === 'LOWER') return donchian.lower;
        return donchian.middle;
      }

      if (spec.source === 'PATTERN') {
        const pattern = spec.patternName ?? resolveCandlePatternName(spec.name);
        if (!pattern) return Array.from({ length: closes.length }, () => 0);
        const patternParams: CandlePatternParams = {
          ...(typeof spec.params.dojiBodyToRangeMax === 'number'
            ? { dojiBodyToRangeMax: spec.params.dojiBodyToRangeMax }
            : {}),
        };
        const key = `${pattern}_${JSON.stringify(patternParams)}`;
        if (!patternCache.has(key)) {
          const patternCandles = candles.map((candle) => ({
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));
          const values = computeCandlePatternSeries(patternCandles, pattern, patternParams).map((value) => (value ? 1 : 0));
          patternCache.set(key, values);
        }
        return patternCache.get(key)!;
      }

      if (spec.source === 'FUNDING') {
        if (spec.channel === 'ZSCORE') {
          const period = spec.params.zScorePeriod ?? spec.params.period ?? spec.period;
          return computeRollingZScoreSeriesFromNullableValues(fundingRawSeries, period);
        }
        return fundingRawSeries;
      }

      if (spec.source === 'OPEN_INTEREST') {
        if (spec.channel === 'ZSCORE') {
          const period = spec.params.zScorePeriod ?? spec.params.period ?? spec.period;
          return computeRollingZScoreSeriesFromNullableValues(openInterestRawSeries, period);
        }
        if (spec.channel === 'MA') {
          const period = spec.params.period ?? spec.period;
          return computeSmaSeriesFromNullableValues(openInterestRawSeries, period);
        }
        if (spec.channel === 'DELTA') {
          return openInterestRawSeries.map((value, index) => {
            if (index === 0 || typeof value !== 'number') return null;
            const previous = openInterestRawSeries[index - 1];
            if (typeof previous !== 'number') return null;
            return value - previous;
          });
        }
        return openInterestRawSeries;
      }

      if (spec.source === 'ORDER_BOOK') {
        if (spec.channel === 'SPREAD_BPS') return orderBookSpreadSeries;
        if (spec.channel === 'DEPTH_RATIO') return orderBookDepthRatioSeries;
        return orderBookImbalanceSeries;
      }

      if (spec.source === 'ADX') {
        const period = spec.params.period ?? 14;
        const key = `${period}`;
        if (!adxCache.has(key)) {
          adxCache.set(key, computeAdxSeriesFromCandles(highs, lows, closes, period));
        }
        const adx = adxCache.get(key)!;
        if (spec.channel === 'DI_PLUS') return adx.plusDi;
        if (spec.channel === 'DI_MINUS') return adx.minusDi;
        return adx.adx;
      }

      if (spec.source === 'STOCHASTIC') {
        const period = spec.params.period ?? 14;
        const smoothK = spec.params.smoothK ?? 3;
        const smoothD = spec.params.smoothD ?? 3;
        const key = `${period}_${smoothK}_${smoothD}`;
        if (!stochasticCache.has(key)) {
          stochasticCache.set(
            key,
            computeStochasticSeriesFromCandles(highs, lows, closes, period, smoothK, smoothD),
          );
        }
        const stochastic = stochasticCache.get(key)!;
        return spec.channel === 'D' ? stochastic.d : stochastic.k;
      }

      if (spec.source === 'MACD') {
        const fast = spec.params.fast ?? 12;
        const slow = spec.params.slow ?? 26;
        const signal = spec.params.signal ?? 9;
        const key = `${fast}_${slow}_${signal}`;
        if (!macdCache.has(key)) {
          macdCache.set(key, computeMacdSeriesFromCloses(closes, fast, slow, signal));
        }
        const macd = macdCache.get(key)!;
        if (spec.channel === 'SIGNAL') return macd.signal;
        if (spec.channel === 'HISTOGRAM') return macd.histogram;
        return macd.line;
      }

      if (spec.source === 'STOCHRSI') {
        const period = spec.params.period ?? 14;
        const stochPeriod = spec.params.stochPeriod ?? period;
        const smoothK = spec.params.smoothK ?? 3;
        const smoothD = spec.params.smoothD ?? 3;
        const key = `${period}_${stochPeriod}_${smoothK}_${smoothD}`;
        if (!stochRsiCache.has(key)) {
          stochRsiCache.set(key, computeStochRsiSeriesFromCloses(closes, period, stochPeriod, smoothK, smoothD));
        }
        const stochRsi = stochRsiCache.get(key)!;
        return spec.channel === 'D' ? stochRsi.d : stochRsi.k;
      }

      if (spec.source === 'BOLLINGER') {
        const period = spec.params.period ?? 20;
        const stdDev = spec.params.stdDev ?? 2;
        const key = `${period}_${stdDev}`;
        if (!bollingerCache.has(key)) {
          bollingerCache.set(key, computeBollingerSeriesFromCloses(closes, period, stdDev));
        }
        const bollinger = bollingerCache.get(key)!;
        if (spec.channel === 'UPPER') return bollinger.upper;
        if (spec.channel === 'MIDDLE') return bollinger.middle;
        if (spec.channel === 'LOWER') return bollinger.lower;
        if (spec.channel === 'BANDWIDTH') return bollinger.bandwidth;
        return bollinger.percentB;
      }

      const period = spec.params.period ?? spec.period;
      return computeMomentumSeriesFromCloses(closes, period);
    })();
    return {
      key: spec.key,
      name: spec.name,
      period: spec.period,
      panel: spec.panel,
      values,
    };
  });
};

export const parseStrategyIndicatorsForTests = (strategyConfig: unknown) =>
  parseStrategyIndicators(strategyConfig);

export const buildIndicatorSeriesForTests = (
  candles: Array<{
    openTime: number;
    closeTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>,
  specs: Array<{
    key: string;
    name: string;
    period: number;
    panel: 'price' | 'oscillator';
    source:
      | 'EMA'
      | 'SMA'
      | 'RSI'
      | 'MOMENTUM'
      | 'MACD'
      | 'ROC'
      | 'STOCHRSI'
      | 'STOCHASTIC'
      | 'BOLLINGER'
      | 'ATR'
      | 'CCI'
      | 'DONCHIAN'
      | 'ADX'
      | 'PATTERN'
      | 'FUNDING'
      | 'OPEN_INTEREST'
      | 'ORDER_BOOK';
    params: Record<string, number>;
    patternName?: CandlePatternName;
    channel?:
      | 'LINE'
      | 'SIGNAL'
      | 'HISTOGRAM'
      | 'K'
      | 'D'
      | 'UPPER'
      | 'MIDDLE'
      | 'LOWER'
      | 'BANDWIDTH'
      | 'PERCENT_B'
      | 'ADX'
      | 'DI_PLUS'
      | 'DI_MINUS'
      | 'RAW'
      | 'ZSCORE'
      | 'DELTA'
      | 'MA'
      | 'IMBALANCE'
      | 'SPREAD_BPS'
      | 'DEPTH_RATIO';
  }>,
  supplemental?: {
    fundingRates: Array<{ timestamp: number; fundingRate: number }>;
    openInterest: Array<{ timestamp: number; openInterest: number }>;
    orderBook?: Array<{ timestamp: number; imbalance: number; spreadBps: number; depthRatio: number }>;
  },
) =>
  buildIndicatorSeries(
    candles as KlineCandle[],
    specs as IndicatorSpec[],
    (supplemental
      ? {
          fundingRates: supplemental.fundingRates,
          openInterest: supplemental.openInterest,
          orderBook: supplemental.orderBook ?? [],
        }
      : undefined) as SupplementalSeries | undefined,
  );

const runBacktestAsync = createBacktestRunJob({
  findBacktestRunById,
  safeUpdateRun,
  uniqueSorted,
  computeAdaptiveMaxCandles,
  resolveIndicatorWarmupCandles,
  normalizeWalletRiskPercent,
  parseStrategySignalRules,
  findOwnedStrategySignalConfig,
  fetchKlines,
  fetchSupplementalSeries,
  simulateInterleavedPortfolio,
  createBacktestTrades,
  countWinningBacktestTrades,
  countLosingBacktestTrades,
  upsertBacktestReportForRun,
  computeSourceWindowMs,
  maxDrawdownFromPnlSeries,
});
const backtestRunQueue = new BacktestRunQueue(runBacktestAsync);

type ResolvedRunContext = {
  symbols: string[];
  exchange: Exchange;
  marketType: MarketType;
  baseCurrency: string;
  marketUniverseId: string | null;
};

const resolveSymbolsForRun = async (userId: string, data: CreateBacktestRunDto): Promise<ResolvedRunContext | null> => {
  if (!data.marketUniverseId) {
    const symbols = uniqueSorted([data.symbol ?? 'BTCUSDT']);
    return {
      symbols,
      exchange: 'BINANCE',
      marketType: 'FUTURES' as MarketType,
      baseCurrency: inferBaseCurrencyFromSymbol(symbols[0] ?? 'BTCUSDT'),
      marketUniverseId: null,
    };
  }

  const universe = await findOwnedMarketUniverseById(userId, data.marketUniverseId);

  if (!universe) return null;

  const catalog = await getMarketCatalog(universe.baseCurrency, universe.marketType, universe.exchange);
  const rules = ((universe.filterRules ?? {}) as { minQuoteVolumeEnabled?: boolean; minQuoteVolume24h?: number }) ?? {};
  const minVolume = typeof rules.minQuoteVolume24h === 'number' ? rules.minQuoteVolume24h : 0;
  const minVolumeEnabled = Boolean(rules.minQuoteVolumeEnabled);

  const availableByRules = catalog.markets
    .filter((market) => (minVolumeEnabled ? market.quoteVolume24h >= minVolume : true))
    .map((market) => market.symbol);

  const availableSet = new Set(availableByRules);
  const include = universe.whitelist.length > 0
    ? universe.whitelist.filter((symbol) => availableSet.has(symbol))
    : availableByRules;
  const blacklist = new Set(universe.blacklist);

  const resolved = uniqueSorted(include).filter((symbol) => !blacklist.has(symbol));
  if (resolved.length === 0 && data.symbol) {
    resolved.push(data.symbol.trim().toUpperCase());
  }

  return {
    symbols: uniqueSorted(resolved),
    exchange: universe.exchange,
    marketType: universe.marketType as MarketType,
    baseCurrency: universe.baseCurrency,
    marketUniverseId: universe.id,
  };
};

export const listRuns = async (userId: string, query: ListBacktestRunsQuery) => {
  return listOwnedBacktestRuns(userId, query);
};

export const getRun = async (userId: string, id: string) => {
  return findOwnedBacktestRun(userId, id);
};

export const deleteRun = async (userId: string, id: string) => {
  const existing = await findOwnedBacktestRunId(userId, id);
  if (!existing) return false;

  await deleteOwnedBacktestRunCascade(userId, existing.id);

  return true;
};

export const createRun = async (userId: string, data: CreateBacktestRunDto) => {
  let strategyDefaults: { leverage: number; marginMode: MarginMode } | null = null;
  if (data.strategyId) {
    const strategy = await findOwnedStrategyForBacktest(userId, data.strategyId);
    if (!strategy) return null;

    const config = (strategy.config ?? {}) as { additional?: { marginMode?: unknown } };
    strategyDefaults = {
      leverage: strategy.leverage,
      marginMode: config.additional?.marginMode === 'ISOLATED' ? 'ISOLATED' : 'CROSSED',
    };
  }

  const resolved = await resolveSymbolsForRun(userId, data);
  if (!resolved || resolved.symbols.length === 0) return null;

  const maxCandles = computeAdaptiveMaxCandles(
    data.timeframe,
    resolved.symbols.length,
    typeof data.seedConfig === 'object' && data.seedConfig && 'maxCandles' in data.seedConfig
      ? Number((data.seedConfig as { maxCandles?: number }).maxCandles)
      : undefined,
  );

  const created = await createBacktestRun({
    userId,
    name: data.name,
    symbol: resolved.symbols[0],
    timeframe: data.timeframe,
    strategyId: data.strategyId,
    seedConfig: {
      ...(typeof data.seedConfig === 'object' && data.seedConfig ? data.seedConfig : {}),
      initialBalance:
        typeof data.seedConfig === 'object' &&
        data.seedConfig &&
        typeof (data.seedConfig as { initialBalance?: unknown }).initialBalance === 'number'
          ? (data.seedConfig as { initialBalance: number }).initialBalance
          : 10_000,
      symbols: resolved.symbols,
      exchange: resolved.exchange,
      marketType: resolved.marketType,
      baseCurrency: resolved.baseCurrency,
      marketUniverseId: resolved.marketUniverseId,
      leverage: resolved.marketType === 'SPOT' ? 1 : (strategyDefaults?.leverage ?? 1),
      marginMode: resolved.marketType === 'SPOT' ? 'NONE' : (strategyDefaults?.marginMode ?? 'CROSSED'),
      maxCandles,
      executionMode: 'interleaved_multi_market_portfolio_clock',
    },
    notes: data.notes,
    status: 'PENDING',
  });

  backtestRunQueue.enqueue(created.id);

  return created;
};

export const listRunTrades = async (
  userId: string,
  runId: string,
  query: ListBacktestTradesQuery,
) => {
  const run = await findOwnedBacktestRunId(userId, runId);
  if (!run) return null;

  return listOwnedBacktestTrades(userId, runId, query);
};

export const getRunReport = async (userId: string, runId: string) => {
  const run = await findOwnedBacktestRunId(userId, runId);
  if (!run) return undefined;

  const report = await findOwnedBacktestReport(userId, runId);

  return report ?? null;
};

export const getRunTimeline = async (
  userId: string,
  runId: string,
  query: GetBacktestTimelineQuery,
) => {
  const run = await findOwnedBacktestRunTimelineSeed(userId, runId);
  if (!run) return null;

  const seed = ((run.seedConfig ?? {}) as Record<string, unknown>) ?? {};
  const runSymbols = Array.isArray(seed.symbols)
    ? uniqueSorted((seed.symbols as string[]).map((item) => item.trim().toUpperCase()))
    : [];
  const marketType = (seed.marketType === 'SPOT' ? 'SPOT' : 'FUTURES') as MarketType;
  const maxCandles = typeof seed.maxCandles === 'number'
    ? clamp(Math.floor(seed.maxCandles), 100, 10_000)
    : computeAdaptiveMaxCandles(run.timeframe, 1, undefined);

  const symbol = query.symbol.trim().toUpperCase();
  if (runSymbols.length > 0 && !runSymbols.includes(symbol)) {
    return null;
  }
  const strategy = run.strategyId
    ? await findOwnedStrategySignalConfig(userId, run.strategyId)
    : null;
  const strategyConfig = (strategy?.config as Record<string, unknown> | undefined) ?? null;
  const indicatorSpecs = parseStrategyIndicators(strategyConfig);
  const indicatorWarmupCandles = indicatorSpecs.reduce((maxPeriod, spec) => Math.max(maxPeriod, spec.period), 0);

  const replaySymbols = runSymbols.length > 0 ? runSymbols : [symbol];
  const liveProgress = (seed.liveProgress ?? {}) as {
    currentCandleTime?: string | null;
  };
  const timelineEndTimeMsRaw =
    typeof liveProgress.currentCandleTime === 'string'
      ? Date.parse(liveProgress.currentCandleTime)
      : Number.NaN;
  const timelineEndTimeMs = Number.isFinite(timelineEndTimeMsRaw)
    ? timelineEndTimeMsRaw
    : run.finishedAt
      ? run.finishedAt.getTime()
      : undefined;
  const candlesBySymbol = new Map<string, KlineCandle[]>();
  const supplementalBySymbol = new Map<string, SupplementalSeries>();
  for (const replaySymbol of replaySymbols) {
    candlesBySymbol.set(
      replaySymbol,
      await fetchKlines(
        replaySymbol,
        run.timeframe,
        marketType,
        maxCandles + indicatorWarmupCandles,
        timelineEndTimeMs,
      ),
    );
    supplementalBySymbol.set(
      replaySymbol,
      await fetchSupplementalSeries(
        replaySymbol,
        run.timeframe,
        marketType,
        maxCandles + indicatorWarmupCandles,
        timelineEndTimeMs,
      ),
    );
  }
  const visibleStartBySymbol = new Map<string, number>();
  for (const replaySymbol of replaySymbols) {
    const symbolCandles = candlesBySymbol.get(replaySymbol) ?? [];
    visibleStartBySymbol.set(replaySymbol, Math.max(0, symbolCandles.length - maxCandles));
  }
  const fullCandles = candlesBySymbol.get(symbol) ?? [];
  const visibleStart = visibleStartBySymbol.get(symbol) ?? 0;
  const candles = fullCandles.slice(visibleStart);
  const supplemental = supplementalBySymbol.get(symbol) ?? { fundingRates: [], openInterest: [], orderBook: [] };
  const total = candles.length;
  const requestedCursor = clamp(query.cursor, 0, total);
  const start =
    requestedCursor >= total && total > 0
      ? Math.max(0, total - query.chunkSize)
      : requestedCursor;
  const end = clamp(start + query.chunkSize, 0, total);
  const chunk = candles.slice(start, end);

  const strategyWalletRisk = normalizeWalletRiskPercent(strategy?.walletRisk ?? 1, 1);
  const indicatorSeries = query.includeIndicators
    ? buildIndicatorSeries(fullCandles, indicatorSpecs, supplemental).map((series) => ({
      key: series.key,
      name: series.name,
      period: series.period,
      panel: series.panel,
      points: series.values
        .slice(visibleStart + start, visibleStart + end)
        .map((value, index) => ({
          candleIndex: start + index,
          value,
        })),
    }))
    : [];

  const leverageCandidate = Number((seed as { leverage?: unknown }).leverage);
  const leverage = Number.isFinite(leverageCandidate) ? leverageCandidate : 1;
  const marginMode = seed.marginMode === 'ISOLATED' ? 'ISOLATED' : (seed.marginMode === 'CROSSED' ? 'CROSSED' : 'NONE');
  const replay = simulateInterleavedPortfolio({
    symbols: replaySymbols,
    candlesBySymbol,
    supplementalBySymbol,
    analysisStartIndexBySymbol: new Map(
      replaySymbols.map((replaySymbol) => {
        const symbolVisibleStart = visibleStartBySymbol.get(replaySymbol) ?? 0;
        return [replaySymbol, Math.max(1, symbolVisibleStart)];
      }),
    ),
    marketType,
    leverage: marketType === 'SPOT' ? 1 : leverage,
    marginMode,
    strategyConfig,
    fillModelConfig: {
      feeRate:
        typeof (seed as { feeRate?: unknown }).feeRate === 'number'
          ? Number((seed as { feeRate?: unknown }).feeRate)
          : undefined,
      slippageRate:
        typeof (seed as { slippageRate?: unknown }).slippageRate === 'number'
          ? Number((seed as { slippageRate?: unknown }).slippageRate)
          : undefined,
      fundingRate:
        typeof (seed as { fundingRate?: unknown }).fundingRate === 'number'
          ? Number((seed as { fundingRate?: unknown }).fundingRate)
          : undefined,
    },
    walletRiskPercent: strategyWalletRisk,
    initialBalance:
      typeof (seed as { initialBalance?: unknown }).initialBalance === 'number'
        ? Number((seed as { initialBalance?: number }).initialBalance)
        : 10_000,
  });
  const symbolReplay = replay.perSymbol[symbol] ?? {
    trades: [],
    liquidations: 0,
    events: [],
    eventCounts: {
      ENTRY: 0,
      EXIT: 0,
      DCA: 0,
      TP: 0,
      TTP: 0,
      SL: 0,
      TRAILING: 0,
      LIQUIDATION: 0,
    } as Record<ReplayEventType, number>,
    decisionTrace: [],
  };

  const chunkGlobalStart = visibleStart + start;
  const chunkGlobalEnd = visibleStart + end;
  const events = (query.includeEvents
    ? symbolReplay.events.filter(
      (event) => event.candleIndex >= chunkGlobalStart && event.candleIndex < chunkGlobalEnd,
    )
    : []
  ).map((event) => {
      const eventId = `${runId}_${symbol}_${event.tradeSequence}_${event.type}_${event.candleIndex}`;
      const isCloseLike = event.type !== 'ENTRY' && event.type !== 'DCA';
      return {
        id: eventId,
        tradeId: `${runId}_${symbol}_${event.tradeSequence}`,
        type: event.type,
        side: event.side,
        timestamp: event.timestamp.toISOString(),
        price: event.price,
        pnl: event.pnl,
        candleIndex: event.candleIndex - visibleStart,
        reason: isCloseLike ? event.type : null,
      };
    });

  const liveProgressPlayback = (seed.liveProgress ?? {}) as {
    currentSymbol?: string | null;
    currentCandleIndex?: number;
    totalCandlesForSymbol?: number;
  };
  const shouldExposePlaybackCursor = run.status === 'PENDING' || run.status === 'RUNNING';
  const playbackCursorRelative =
    typeof liveProgressPlayback.currentCandleIndex === 'number'
      ? liveProgressPlayback.currentCandleIndex - visibleStart
      : null;

  return {
    runId,
    symbol,
    timeframe: run.timeframe,
    marketType,
    status: run.status,
    cursor: start,
    previousCursor: start > 0 ? Math.max(0, start - query.chunkSize) : null,
    nextCursor: end < total ? end : null,
    totalCandles: total,
    candles: query.includeCandles
      ? chunk.map((candle, index) => ({
        candleIndex: start + index,
        openTime: new Date(candle.openTime).toISOString(),
        closeTime: new Date(candle.closeTime).toISOString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      }))
      : [],
    events,
    indicatorSeries: query.includeIndicators ? indicatorSeries : [],
    parityDiagnostics: {
      strategyRulesActive: Boolean(
        parseStrategySignalRules(strategyConfig),
      ),
      eventCounts: symbolReplay.eventCounts,
      mismatchCount: symbolReplay.decisionTrace.filter((entry) => entry.mismatchReason !== null).length,
      mismatchSamples: symbolReplay.decisionTrace
        .filter(
          (entry) =>
            entry.mismatchReason !== null &&
            entry.candleIndex >= chunkGlobalStart &&
            entry.candleIndex < chunkGlobalEnd,
        )
        .slice(0, 50)
        .map((entry) => ({
          timestamp: entry.timestamp.toISOString(),
          side: entry.side,
          trigger: entry.trigger,
          mismatchReason: entry.mismatchReason,
        })),
      fundingPoints: supplemental.fundingRates.length,
      openInterestPoints: supplemental.openInterest.length,
      orderBookPoints: supplemental.orderBook.length,
    },
    positionStats: {
      closedOnFinalCandleCount: symbolReplay.trades.filter((trade) => trade.exitReason === 'FINAL_CANDLE').length,
      liquidationsCount: symbolReplay.trades.filter((trade) => trade.exitReason === 'LIQUIDATION' || trade.liquidated).length,
      tradeCount: symbolReplay.trades.length,
    },
    marketInputs: {
      fundingRates: supplemental.fundingRates
        .map((point) => {
          const candleIndex = candles.findIndex((candle) => candle.openTime >= point.timestamp);
          if (candleIndex < start || candleIndex >= end || candleIndex < 0) return null;
          return {
            candleIndex,
            timestamp: new Date(point.timestamp).toISOString(),
            value: point.fundingRate,
          };
        })
        .filter((point): point is { candleIndex: number; timestamp: string; value: number } => Boolean(point)),
      openInterest: supplemental.openInterest
        .map((point) => {
          const candleIndex = candles.findIndex((candle) => candle.openTime >= point.timestamp);
          if (candleIndex < start || candleIndex >= end || candleIndex < 0) return null;
          return {
            candleIndex,
            timestamp: new Date(point.timestamp).toISOString(),
            value: point.openInterest,
          };
        })
        .filter((point): point is { candleIndex: number; timestamp: string; value: number } => Boolean(point)),
      orderBook: supplemental.orderBook
        .map((point) => {
          const candleIndex = candles.findIndex((candle) => candle.openTime >= point.timestamp);
          if (candleIndex < start || candleIndex >= end || candleIndex < 0) return null;
          return {
            candleIndex,
            timestamp: new Date(point.timestamp).toISOString(),
            imbalance: point.imbalance,
            spreadBps: point.spreadBps,
            depthRatio: point.depthRatio,
          };
        })
        .filter((point): point is {
          candleIndex: number;
          timestamp: string;
          imbalance: number;
          spreadBps: number;
          depthRatio: number;
        } => Boolean(point)),
    },
        supportedEventTypes: ['ENTRY', 'EXIT', 'DCA', 'TP', 'TTP', 'SL', 'TRAILING', 'LIQUIDATION'],
    unsupportedEventTypes: [],
    playbackCursor:
      shouldExposePlaybackCursor &&
      liveProgressPlayback.currentSymbol === symbol &&
      typeof playbackCursorRelative === 'number' &&
      playbackCursorRelative >= 0
        ? playbackCursorRelative
        : null,
  };
};
