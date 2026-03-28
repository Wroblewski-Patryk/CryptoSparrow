import { PositionSide } from '@prisma/client';
import { decideExecutionAction } from '../engine/sharedExecutionCore';
import {
  evaluateStrategySignalAtIndex,
  parseStrategySignalRules,
} from '../engine/strategySignalEvaluator';
import { computeRiskBasedOrderQuantity, normalizeWalletRiskPercent } from '../engine/positionSizing';
import { BacktestFillModelConfig, createHistoricalBacktestFillModel } from './backtestFillModel';

export type ReplayMarketType = 'SPOT' | 'FUTURES';
export type ReplayMarginMode = 'CROSSED' | 'ISOLATED' | 'NONE';

export type ReplayCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ReplayTradeDraft = {
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

export type ReplayEventType =
  | 'ENTRY'
  | 'EXIT'
  | 'DCA'
  | 'TP'
  | 'TTP'
  | 'SL'
  | 'TRAILING'
  | 'LIQUIDATION';

export type ReplayEventDraft = {
  symbol: string;
  type: ReplayEventType;
  side: PositionSide;
  timestamp: Date;
  price: number;
  pnl: number | null;
  tradeSequence: number;
  candleIndex: number;
};

export type ReplayParityDecisionTrace = {
  symbol: string;
  timestamp: Date;
  candleIndex: number;
  signal: 'LONG' | 'SHORT' | 'EXIT';
  side: PositionSide | null;
  trigger: 'STRATEGY' | 'THRESHOLD' | 'FINAL_CANDLE';
  mismatchReason:
    | 'no_open_position'
    | 'no_flip_with_open_position'
    | 'already_open_same_side'
    | 'manual_managed_symbol'
    | null;
};

export type ReplaySymbolSimulationResult = {
  trades: ReplayTradeDraft[];
  liquidations: number;
  events: ReplayEventDraft[];
  eventCounts: Record<ReplayEventType, number>;
  decisionTrace: ReplayParityDecisionTrace[];
};

type ReplayRuntimeConfig = {
  longThresholdPct: number;
  shortThresholdPct: number;
  exitBandPct: number;
};

type StrategyRiskConfig = {
  takeProfitPct: number;
  trailingTakeProfitLevels: Array<{ arm: number; percent: number }>;
  stopLossPct: number;
  trailingStopLevels: Array<{ arm: number; percent: number }>;
  maxDcaPerTrade: number;
  dcaLevels: number[];
  dcaMultipliers: number[];
};

const defaultConfig: ReplayRuntimeConfig = {
  longThresholdPct: 1,
  shortThresholdPct: -1,
  exitBandPct: 0.2,
};
const defaultRiskConfig: StrategyRiskConfig = {
  takeProfitPct: 0.012,
  trailingTakeProfitLevels: [],
  stopLossPct: 0.01,
  trailingStopLevels: [{ arm: 0.006, percent: 0.0075 }],
  maxDcaPerTrade: 1,
  dcaLevels: [-0.008],
  dcaMultipliers: [1],
};

const toSignalDirection = (
  current: ReplayCandle,
  previous: ReplayCandle,
  config: ReplayRuntimeConfig
): 'LONG' | 'SHORT' | 'EXIT' | null => {
  const base = previous.close > 0 ? previous.close : 1;
  const changePct = ((current.close - previous.close) / base) * 100;
  if (changePct >= config.longThresholdPct) return 'LONG';
  if (changePct <= config.shortThresholdPct) return 'SHORT';
  if (Math.abs(changePct) <= config.exitBandPct) return 'EXIT';
  return null;
};

const asPercent = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.abs(parsed) / 100;
};

const asSignedPercent = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed / 100;
};

const parseStrategyRiskConfig = (strategyConfig?: Record<string, unknown> | null): StrategyRiskConfig => {
  if (!strategyConfig || typeof strategyConfig !== 'object') return defaultRiskConfig;

  const close = (strategyConfig.close as {
    tp?: unknown;
    ttp?: Array<{ percent?: unknown; arm?: unknown }>;
    sl?: unknown;
    tsl?: Array<{ percent?: unknown }>;
  } | undefined) ?? { };
  const additional = (strategyConfig.additional as {
    dcaEnabled?: unknown;
    dcaTimes?: unknown;
    dcaLevels?: Array<{ percent?: unknown; multiplier?: unknown }>;
  } | undefined) ?? { };

  const takeProfitPct = asPercent(close.tp, defaultRiskConfig.takeProfitPct * 100);
  const stopLossPct = asPercent(close.sl, defaultRiskConfig.stopLossPct * 100);
  const trailingTakeProfitLevels = (Array.isArray(close.ttp) ? close.ttp : [])
    .map((level) => ({
      arm: asPercent(level?.arm, Number.NaN),
      percent: asPercent(level?.percent, Number.NaN),
    }))
    .filter((level) => Number.isFinite(level.arm) && Number.isFinite(level.percent) && level.arm > 0 && level.percent > 0)
    .sort((left, right) => left.arm - right.arm);
  const parsedTrailingStopLevels = (Array.isArray(close.tsl) ? close.tsl : [])
    .map((level) => ({
      arm: asPercent((level as { arm?: unknown })?.arm, 0),
      percent: asPercent((level as { percent?: unknown })?.percent, Number.NaN),
    }))
    .filter((level) => Number.isFinite(level.percent) && level.percent > 0)
    .sort((left, right) => left.arm - right.arm);
  const trailingStopLevels =
    parsedTrailingStopLevels.length > 0 ? parsedTrailingStopLevels : defaultRiskConfig.trailingStopLevels;
  const maxDcaRaw = Number(additional.dcaTimes);
  const dcaEnabled = Boolean(additional.dcaEnabled ?? true);
  const maxDcaPerTrade = dcaEnabled
    ? Number.isFinite(maxDcaRaw)
      ? Math.max(0, Math.floor(maxDcaRaw))
      : defaultRiskConfig.maxDcaPerTrade
    : 0;
  const rawDcaLevels = Array.isArray(additional.dcaLevels) ? additional.dcaLevels : [];
  const configuredLevels = rawDcaLevels
    .map((level) => asSignedPercent(level?.percent, Number.NaN))
    .filter((value) => Number.isFinite(value) && value !== 0);
  const configuredMultipliers = rawDcaLevels
    .map((level) => Number(level?.multiplier))
    .filter((value) => Number.isFinite(value) && value > 0);
  const fallbackLevels = Array.from({ length: Math.max(1, maxDcaPerTrade) }, () => defaultRiskConfig.dcaLevels[0]);
  const dcaLevels =
    maxDcaPerTrade === 0
      ? []
      : configuredLevels.length > 0
      ? configuredLevels.slice(0, Math.max(1, maxDcaPerTrade))
      : fallbackLevels.slice(0, Math.max(1, maxDcaPerTrade));
  const dcaMultipliers =
    dcaLevels.length === 0
      ? []
      : configuredMultipliers.length > 0
      ? configuredMultipliers.slice(0, dcaLevels.length)
      : Array.from({ length: dcaLevels.length }, () => defaultRiskConfig.dcaMultipliers[0]);

  return {
    takeProfitPct: Math.max(0.0001, takeProfitPct),
    trailingTakeProfitLevels,
    stopLossPct: Math.max(0.0001, stopLossPct),
    trailingStopLevels,
    maxDcaPerTrade,
    dcaLevels,
    dcaMultipliers,
  };
};


export const simulateTradesForSymbolReplay = (input: {
  symbol: string;
  candles: ReplayCandle[];
  marketType: ReplayMarketType;
  leverage: number;
  marginMode: ReplayMarginMode;
  config?: Partial<ReplayRuntimeConfig>;
  strategyConfig?: Record<string, unknown> | null;
  fillModelConfig?: BacktestFillModelConfig;
  positionSizing?: {
    mode: 'fixed' | 'wallet_risk';
    fixedQuantity?: number;
    walletRiskPercent?: number;
    referenceBalance?: number;
  };
}): ReplaySymbolSimulationResult => {
  const { symbol, candles, marketType, marginMode } = input;
  const initialEventCounts: Record<ReplayEventType, number> = {
    ENTRY: 0,
    EXIT: 0,
    DCA: 0,
    TP: 0,
    TTP: 0,
    SL: 0,
    TRAILING: 0,
    LIQUIDATION: 0,
  };
  if (candles.length < 3) {
    return { trades: [], liquidations: 0, events: [], eventCounts: initialEventCounts, decisionTrace: [] };
  }

  const config: ReplayRuntimeConfig = {
    longThresholdPct: input.config?.longThresholdPct ?? defaultConfig.longThresholdPct,
    shortThresholdPct: input.config?.shortThresholdPct ?? defaultConfig.shortThresholdPct,
    exitBandPct: input.config?.exitBandPct ?? defaultConfig.exitBandPct,
  };
  const strategyRules = parseStrategySignalRules(input.strategyConfig);
  const strategyModeEnabled = Boolean(input.strategyConfig && typeof input.strategyConfig === 'object');
  const riskConfig = parseStrategyRiskConfig(input.strategyConfig);
  const indicatorSeriesCache = new Map<string, Array<number | null>>();
  const fillModel = createHistoricalBacktestFillModel(input.fillModelConfig);
  const positionSizingMode = input.positionSizing?.mode ?? 'fixed';
  const fixedQuantity = Math.max(0.000001, Number(input.positionSizing?.fixedQuantity ?? 1));
  const sizingWalletRisk = normalizeWalletRiskPercent(input.positionSizing?.walletRiskPercent ?? 1, 1);
  const sizingReferenceBalance = Math.max(0, Number(input.positionSizing?.referenceBalance ?? 0));
  const trackedBalanceEnabled = Number.isFinite(sizingReferenceBalance) && sizingReferenceBalance > 0;

  const effectiveLeverage = marketType === 'SPOT' ? 1 : Math.max(1, input.leverage);
  const trades: ReplayTradeDraft[] = [];
  const events: ReplayEventDraft[] = [];
  const eventCounts: Record<ReplayEventType, number> = { ...initialEventCounts };
  const decisionTrace: ReplayParityDecisionTrace[] = [];
  let accountBalance = trackedBalanceEnabled ? sizingReferenceBalance : Number.POSITIVE_INFINITY;
  let liquidations = 0;
  let tradeSequence = 0;
  let openPosition:
    | {
        side: 'LONG' | 'SHORT';
        entryPrice: number;
        quantity: number;
        openedAt: Date;
        dcaCount: number;
        lastDcaPrice: number;
        bestPrice: number;
      }
    | null = null;

  const pushEvent = (
    type: ReplayEventType,
    side: PositionSide,
    timestamp: Date,
    price: number,
    pnl: number | null,
    candleIndex: number,
    sequence: number,
  ) => {
    events.push({
      symbol,
      type,
      side,
      timestamp,
      price,
      pnl,
      candleIndex,
      tradeSequence: sequence,
    });
    eventCounts[type] += 1;
  };

  const settleToAccount = (proposedPnl: number) => {
    if (!Number.isFinite(accountBalance)) return proposedPnl;
    const bounded = Math.max(-accountBalance, proposedPnl);
    accountBalance = Math.max(0, accountBalance + bounded);
    return bounded;
  };

  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const current = candles[index];
    const direction = strategyModeEnabled
      ? strategyRules
        ? evaluateStrategySignalAtIndex(strategyRules, candles, index, indicatorSeriesCache)
        : null
      : toSignalDirection(current, previous, config);
    const decision: ReturnType<typeof decideExecutionAction> | null = direction
      ? decideExecutionAction(
          direction,
          openPosition
            ? {
                side: openPosition.side,
                quantity: openPosition.quantity,
                managementMode: 'BOT_MANAGED',
              }
            : null
        )
      : null;

    if (direction && decision) {
      const traceSide: PositionSide | null =
        decision.kind === 'open'
          ? (decision.positionSide as PositionSide)
          : openPosition
            ? (openPosition.side as PositionSide)
            : direction === 'LONG' || direction === 'SHORT'
              ? (direction as PositionSide)
              : null;
      decisionTrace.push({
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
      if (accountBalance <= 0) {
        continue;
      }
      tradeSequence += 1;
      const effectiveEntryPrice = fillModel.entryPrice(current.close, decision.positionSide as PositionSide);
      const initialQuantity =
        positionSizingMode === 'wallet_risk'
          ? computeRiskBasedOrderQuantity({
              price: effectiveEntryPrice,
              walletRiskPercent: sizingWalletRisk,
              referenceBalance: Number.isFinite(accountBalance) ? accountBalance : sizingReferenceBalance,
              leverage: effectiveLeverage,
              minQuantity: fixedQuantity,
            })
          : fixedQuantity;
      openPosition = {
        side: decision.positionSide,
        entryPrice: effectiveEntryPrice,
        quantity: initialQuantity,
        openedAt: new Date(current.openTime),
        dcaCount: 0,
        lastDcaPrice: effectiveEntryPrice,
        bestPrice: effectiveEntryPrice,
      };
      pushEvent('ENTRY', decision.positionSide as PositionSide, new Date(current.openTime), effectiveEntryPrice, null, index, tradeSequence);
      continue;
    }

    if (!openPosition) {
      continue;
    }

    if (openPosition.side === 'LONG') {
      openPosition.bestPrice = Math.max(openPosition.bestPrice, current.high);
    } else {
      openPosition.bestPrice = Math.min(openPosition.bestPrice, current.low);
    }

    const dcaTriggerPrice = openPosition.side === 'LONG' ? current.low : current.high;
    while (openPosition.dcaCount < riskConfig.maxDcaPerTrade) {
      const dcaReference = Math.max(openPosition.lastDcaPrice, 1e-8);
      const rawMoveFromReference =
        openPosition.side === 'LONG'
          ? (dcaTriggerPrice - dcaReference) / dcaReference
          : (dcaReference - dcaTriggerPrice) / dcaReference;
      const leveragedMoveFromReference = rawMoveFromReference * effectiveLeverage;
      const triggerLevel = riskConfig.dcaLevels[openPosition.dcaCount] ?? riskConfig.dcaLevels[riskConfig.dcaLevels.length - 1] ?? -0.01;
      const triggerReached =
        triggerLevel >= 0
          ? leveragedMoveFromReference >= triggerLevel
          : leveragedMoveFromReference <= triggerLevel;
      if (!triggerReached) break;

      const previousQty = openPosition.quantity;
      const dcaMultiplier =
        riskConfig.dcaMultipliers[openPosition.dcaCount] ??
        riskConfig.dcaMultipliers[riskConfig.dcaMultipliers.length - 1] ??
        1;
      const addedQty = Math.max(0.000001, previousQty * dcaMultiplier);
      const dcaEntryPrice = fillModel.entryPrice(dcaTriggerPrice, openPosition.side as PositionSide);
      openPosition.quantity = previousQty + addedQty;
      openPosition.entryPrice =
        (openPosition.entryPrice * previousQty + dcaEntryPrice * addedQty) / openPosition.quantity;
      openPosition.dcaCount += 1;
      openPosition.lastDcaPrice = dcaEntryPrice;
      pushEvent(
        'DCA',
        openPosition.side as PositionSide,
        new Date(current.openTime),
        dcaEntryPrice,
        null,
        index,
        tradeSequence
      );
    }

    const favorableMoveRatio =
      openPosition.side === 'LONG'
        ? (current.close - openPosition.entryPrice) / Math.max(openPosition.entryPrice, 1e-8)
        : (openPosition.entryPrice - current.close) / Math.max(openPosition.entryPrice, 1e-8);
    const peakFavorableMoveRatio =
      openPosition.side === 'LONG'
        ? (openPosition.bestPrice - openPosition.entryPrice) / Math.max(openPosition.entryPrice, 1e-8)
        : (openPosition.entryPrice - openPosition.bestPrice) / Math.max(openPosition.entryPrice, 1e-8);

    const effectiveExitPrice = fillModel.exitPrice(current.close, openPosition.side as PositionSide);
    const settlement = fillModel.settle({
      side: openPosition.side as PositionSide,
      entryPrice: openPosition.entryPrice,
      exitPrice: effectiveExitPrice,
      quantity: openPosition.quantity,
      leverage: effectiveLeverage,
    });
    const fee = settlement.fees;
    const rawPnl = settlement.grossPnl;

    const adverseMoveRatio =
      openPosition.side === 'LONG'
        ? (openPosition.entryPrice - current.low) / Math.max(openPosition.entryPrice, 1e-8)
        : (current.high - openPosition.entryPrice) / Math.max(openPosition.entryPrice, 1e-8);
    const leveragedFavorableMoveRatio = favorableMoveRatio * effectiveLeverage;
    const leveragedPeakFavorableMoveRatio = peakFavorableMoveRatio * effectiveLeverage;
    const leveragedAdverseMoveRatio = adverseMoveRatio * effectiveLeverage;
    const dcaSequenceCompleted = openPosition.dcaCount >= riskConfig.maxDcaPerTrade;

    const isolatedLiquidationThreshold = 1 / Math.max(1, effectiveLeverage);
    const isIsolatedLiquidated =
      marketType === 'FUTURES' &&
      marginMode === 'ISOLATED' &&
      adverseMoveRatio >= isolatedLiquidationThreshold;

    const isTakeProfit = leveragedFavorableMoveRatio >= riskConfig.takeProfitPct;
    const activeTtpLevel = [...riskConfig.trailingTakeProfitLevels]
      .sort((left, right) => left.arm - right.arm)
      .filter((level) => leveragedPeakFavorableMoveRatio >= level.arm)
      .at(-1);
    const isTrailingTakeProfit = activeTtpLevel
      ? openPosition.side === 'LONG'
        ? current.close <= openPosition.bestPrice * (1 - activeTtpLevel.percent)
        : current.close >= openPosition.bestPrice * (1 + activeTtpLevel.percent)
      : false;
    const isStopLoss = dcaSequenceCompleted && leveragedAdverseMoveRatio >= riskConfig.stopLossPct;
    const activeTslLevel = dcaSequenceCompleted
      ? [...riskConfig.trailingStopLevels]
          .sort((left, right) => left.arm - right.arm)
          .filter((level) => leveragedPeakFavorableMoveRatio >= level.arm)
          .at(-1)
      : null;
    const isTrailingExit = activeTslLevel
      ? openPosition.side === 'LONG'
        ? current.close <= openPosition.bestPrice * (1 - activeTslLevel.percent)
        : current.close >= openPosition.bestPrice * (1 + activeTslLevel.percent)
      : false;

    const shouldSignalExit = decision?.kind === 'close';

    if (
      !isIsolatedLiquidated &&
      !isTakeProfit &&
      !isTrailingTakeProfit &&
      !isStopLoss &&
      !isTrailingExit &&
      !shouldSignalExit
    ) {
      continue;
    }

    if (isIsolatedLiquidated) {
      liquidations += 1;
    }

    const pnlBeforeAccountBounds = isIsolatedLiquidated
      ? -(openPosition.entryPrice * openPosition.quantity) / Math.max(1, effectiveLeverage)
      : rawPnl - fee;
    const pnl = settleToAccount(pnlBeforeAccountBounds);

    const closeType: ReplayEventType = isIsolatedLiquidated
      ? 'LIQUIDATION'
      : isTakeProfit
        ? 'TP'
        : isTrailingTakeProfit
          ? 'TTP'
        : isStopLoss
          ? 'SL'
          : isTrailingExit
            ? 'TRAILING'
            : 'EXIT';

    trades.push({
      symbol,
      side: openPosition.side as PositionSide,
      entryPrice: openPosition.entryPrice,
      exitPrice: effectiveExitPrice,
      quantity: openPosition.quantity,
      openedAt: openPosition.openedAt,
      closedAt: new Date(current.closeTime),
      pnl,
      fee,
      exitReason: isIsolatedLiquidated ? 'LIQUIDATION' : 'SIGNAL_EXIT',
      liquidated: isIsolatedLiquidated,
    });
    pushEvent(
      closeType,
      openPosition.side as PositionSide,
      new Date(current.closeTime),
      effectiveExitPrice,
      pnl,
      index,
      tradeSequence
    );
    openPosition = null;
  }

  if (openPosition) {
    const last = candles[candles.length - 1];
    const effectiveExitPrice = fillModel.exitPrice(last.close, openPosition.side as PositionSide);
    const settlement = fillModel.settle({
      side: openPosition.side as PositionSide,
      entryPrice: openPosition.entryPrice,
      exitPrice: effectiveExitPrice,
      quantity: openPosition.quantity,
      leverage: effectiveLeverage,
    });
    const fee = settlement.fees;
    const rawPnl = settlement.grossPnl;
    const finalPnl = settleToAccount(rawPnl - fee);
    trades.push({
      symbol,
      side: openPosition.side as PositionSide,
      entryPrice: openPosition.entryPrice,
      exitPrice: effectiveExitPrice,
      quantity: openPosition.quantity,
      openedAt: openPosition.openedAt,
      closedAt: new Date(last.closeTime),
      pnl: finalPnl,
      fee,
      exitReason: 'FINAL_CANDLE',
      liquidated: false,
    });
    pushEvent(
      'EXIT',
      openPosition.side as PositionSide,
      new Date(last.closeTime),
      effectiveExitPrice,
      finalPnl,
      candles.length - 1,
      tradeSequence
    );
    decisionTrace.push({
      symbol,
      timestamp: new Date(last.closeTime),
      candleIndex: candles.length - 1,
      signal: 'EXIT',
      side: openPosition.side as PositionSide,
      trigger: 'FINAL_CANDLE',
      mismatchReason: null,
    });
  }

  return { trades, liquidations, events, eventCounts, decisionTrace };
};
