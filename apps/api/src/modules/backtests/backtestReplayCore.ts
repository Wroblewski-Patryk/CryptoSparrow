import { PositionSide } from '@prisma/client';
import { decideExecutionAction } from '../engine/sharedExecutionCore';

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

export type ReplayEventType = 'ENTRY' | 'EXIT' | 'DCA' | 'TP' | 'SL' | 'TRAILING' | 'LIQUIDATION';

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

export type ReplaySymbolSimulationResult = {
  trades: ReplayTradeDraft[];
  liquidations: number;
  events: ReplayEventDraft[];
  eventCounts: Record<ReplayEventType, number>;
};

type ReplayRuntimeConfig = {
  longThresholdPct: number;
  shortThresholdPct: number;
  exitBandPct: number;
};

type StrategyIndicatorCondition = '>' | '<' | '>=' | '<=' | '==' | '!=';

type StrategyIndicatorRule = {
  name: string;
  condition: StrategyIndicatorCondition;
  value: number;
  params: Record<string, unknown>;
};

type StrategySignalRules = {
  direction: 'both' | 'long' | 'short';
  longRules: StrategyIndicatorRule[];
  shortRules: StrategyIndicatorRule[];
};

type StrategyRiskConfig = {
  takeProfitPct: number;
  stopLossPct: number;
  trailingStopPct: number;
  dcaStepPct: number;
  maxDcaPerTrade: number;
};

const defaultConfig: ReplayRuntimeConfig = {
  longThresholdPct: 1,
  shortThresholdPct: -1,
  exitBandPct: 0.2,
};
const defaultRiskConfig: StrategyRiskConfig = {
  takeProfitPct: 0.012,
  stopLossPct: 0.01,
  trailingStopPct: 0.0075,
  dcaStepPct: 0.008,
  maxDcaPerTrade: 1,
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

const compare = (left: number, operator: StrategyIndicatorCondition, right: number) => {
  if (operator === '>') return left > right;
  if (operator === '>=') return left >= right;
  if (operator === '<') return left < right;
  if (operator === '<=') return left <= right;
  if (operator === '==') return left === right;
  return left !== right;
};

const asFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampPeriod = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(2, Math.floor(parsed));
};

const parseRule = (value: unknown): StrategyIndicatorRule | null => {
  if (!value || typeof value !== 'object') return null;
  const input = value as {
    name?: unknown;
    condition?: unknown;
    value?: unknown;
    params?: unknown;
  };

  if (typeof input.name !== 'string' || input.name.trim().length === 0) return null;
  const condition = input.condition;
  if (
    condition !== '>' &&
    condition !== '>=' &&
    condition !== '<' &&
    condition !== '<=' &&
    condition !== '==' &&
    condition !== '!='
  ) {
    return null;
  }

  const numericValue = asFiniteNumber(input.value);
  if (numericValue === null) return null;

  return {
    name: input.name.trim().toUpperCase(),
    condition,
    value: numericValue,
    params: input.params && typeof input.params === 'object' ? (input.params as Record<string, unknown>) : {},
  };
};

const parseStrategySignalRules = (strategyConfig?: Record<string, unknown> | null): StrategySignalRules | null => {
  if (!strategyConfig || typeof strategyConfig !== 'object') return null;

  const openBlock = (strategyConfig.open ?? strategyConfig.openConditions) as
    | {
        direction?: unknown;
        indicatorsLong?: unknown[];
        indicatorsShort?: unknown[];
      }
    | undefined;
  if (!openBlock || typeof openBlock !== 'object') return null;

  const direction =
    openBlock.direction === 'long' || openBlock.direction === 'short' || openBlock.direction === 'both'
      ? openBlock.direction
      : 'both';

  const longRules = (Array.isArray(openBlock.indicatorsLong) ? openBlock.indicatorsLong : [])
    .map(parseRule)
    .filter((rule): rule is StrategyIndicatorRule => Boolean(rule));
  const shortRules = (Array.isArray(openBlock.indicatorsShort) ? openBlock.indicatorsShort : [])
    .map(parseRule)
    .filter((rule): rule is StrategyIndicatorRule => Boolean(rule));

  if (longRules.length === 0 && shortRules.length === 0) return null;
  return {
    direction,
    longRules,
    shortRules,
  };
};

const asPercent = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.abs(parsed) / 100;
};

const parseStrategyRiskConfig = (strategyConfig?: Record<string, unknown> | null): StrategyRiskConfig => {
  if (!strategyConfig || typeof strategyConfig !== 'object') return defaultRiskConfig;

  const close = (strategyConfig.close as {
    tp?: unknown;
    sl?: unknown;
    tsl?: Array<{ percent?: unknown }>;
  } | undefined) ?? { };
  const additional = (strategyConfig.additional as {
    dcaTimes?: unknown;
    dcaLevels?: Array<{ percent?: unknown }>;
  } | undefined) ?? { };

  const takeProfitPct = asPercent(close.tp, defaultRiskConfig.takeProfitPct * 100);
  const stopLossPct = asPercent(close.sl, defaultRiskConfig.stopLossPct * 100);
  const trailingStopPct = asPercent(close.tsl?.[0]?.percent, defaultRiskConfig.trailingStopPct * 100);
  const dcaStepPct = asPercent(additional.dcaLevels?.[0]?.percent, defaultRiskConfig.dcaStepPct * 100);
  const maxDcaRaw = Number(additional.dcaTimes);
  const maxDcaPerTrade = Number.isFinite(maxDcaRaw) ? Math.max(0, Math.floor(maxDcaRaw)) : defaultRiskConfig.maxDcaPerTrade;

  return {
    takeProfitPct: Math.max(0.0001, takeProfitPct),
    stopLossPct: Math.max(0.0001, stopLossPct),
    trailingStopPct: Math.max(0.0001, trailingStopPct),
    dcaStepPct: Math.max(0.0001, dcaStepPct),
    maxDcaPerTrade,
  };
};

const computeEmaSeries = (candles: ReplayCandle[], period: number): Array<number | null> => {
  const alpha = 2 / (period + 1);
  let ema: number | null = null;
  const output: Array<number | null> = [];

  for (let index = 0; index < candles.length; index += 1) {
    const price = candles[index].close;
    if (ema === null) ema = price;
    else ema = alpha * price + (1 - alpha) * ema;
    output.push(index + 1 >= period ? ema : null);
  }

  return output;
};

const computeRsiSeries = (candles: ReplayCandle[], period: number): Array<number | null> => {
  const output: Array<number | null> = Array.from({ length: candles.length }, () => null);
  if (candles.length <= period) return output;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = candles[index].close - candles[index - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  output[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let index = period + 1; index < candles.length; index += 1) {
    const diff = candles[index].close - candles[index - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    output[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return output;
};

const computeMomentumSeries = (candles: ReplayCandle[], period: number): Array<number | null> => {
  const output: Array<number | null> = [];
  for (let index = 0; index < candles.length; index += 1) {
    if (index < period) {
      output.push(null);
      continue;
    }
    output.push(candles[index].close - candles[index - period].close);
  }
  return output;
};

const evaluateRuleAtIndex = (
  rule: StrategyIndicatorRule,
  candles: ReplayCandle[],
  index: number,
  cache: Map<string, Array<number | null>>,
) => {
  if (rule.name.includes('EMA')) {
    const fast = clampPeriod(rule.params.fast, 9);
    const slow = clampPeriod(rule.params.slow, 21);
    const fastKey = `EMA_FAST_${fast}`;
    const slowKey = `EMA_SLOW_${slow}`;
    const fastSeries = cache.get(fastKey) ?? computeEmaSeries(candles, fast);
    const slowSeries = cache.get(slowKey) ?? computeEmaSeries(candles, slow);
    cache.set(fastKey, fastSeries);
    cache.set(slowKey, slowSeries);
    const fastValue = fastSeries[index];
    const slowValue = slowSeries[index];
    if (typeof fastValue !== 'number' || typeof slowValue !== 'number') return false;
    return compare(fastValue, rule.condition, slowValue);
  }

  if (rule.name.includes('RSI')) {
    const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
    const key = `RSI_${period}`;
    const series = cache.get(key) ?? computeRsiSeries(candles, period);
    cache.set(key, series);
    const value = series[index];
    if (typeof value !== 'number') return false;
    return compare(value, rule.condition, rule.value);
  }

  if (rule.name.includes('MOMENTUM')) {
    const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
    const key = `MOMENTUM_${period}`;
    const series = cache.get(key) ?? computeMomentumSeries(candles, period);
    cache.set(key, series);
    const value = series[index];
    if (typeof value !== 'number') return false;
    return compare(value, rule.condition, rule.value);
  }

  return false;
};

const toStrategySignalDirection = (
  index: number,
  candles: ReplayCandle[],
  rules: StrategySignalRules,
  cache: Map<string, Array<number | null>>,
): 'LONG' | 'SHORT' | 'EXIT' | null => {
  const canLong = rules.direction !== 'short';
  const canShort = rules.direction !== 'long';
  const longMatched =
    canLong &&
    rules.longRules.length > 0 &&
    rules.longRules.every((rule) => evaluateRuleAtIndex(rule, candles, index, cache));
  const shortMatched =
    canShort &&
    rules.shortRules.length > 0 &&
    rules.shortRules.every((rule) => evaluateRuleAtIndex(rule, candles, index, cache));

  if (longMatched && !shortMatched) return 'LONG';
  if (shortMatched && !longMatched) return 'SHORT';
  if (!longMatched && !shortMatched) return 'EXIT';
  return null;
};

export const simulateTradesForSymbolReplay = (input: {
  symbol: string;
  candles: ReplayCandle[];
  marketType: ReplayMarketType;
  leverage: number;
  marginMode: ReplayMarginMode;
  config?: Partial<ReplayRuntimeConfig>;
  strategyConfig?: Record<string, unknown> | null;
}): ReplaySymbolSimulationResult => {
  const { symbol, candles, marketType, marginMode } = input;
  const initialEventCounts: Record<ReplayEventType, number> = {
    ENTRY: 0,
    EXIT: 0,
    DCA: 0,
    TP: 0,
    SL: 0,
    TRAILING: 0,
    LIQUIDATION: 0,
  };
  if (candles.length < 3) return { trades: [], liquidations: 0, events: [], eventCounts: initialEventCounts };

  const config: ReplayRuntimeConfig = {
    longThresholdPct: input.config?.longThresholdPct ?? defaultConfig.longThresholdPct,
    shortThresholdPct: input.config?.shortThresholdPct ?? defaultConfig.shortThresholdPct,
    exitBandPct: input.config?.exitBandPct ?? defaultConfig.exitBandPct,
  };
  const strategyRules = parseStrategySignalRules(input.strategyConfig);
  const riskConfig = parseStrategyRiskConfig(input.strategyConfig);
  const indicatorSeriesCache = new Map<string, Array<number | null>>();

  const effectiveLeverage = marketType === 'SPOT' ? 1 : Math.max(1, input.leverage);
  const trades: ReplayTradeDraft[] = [];
  const events: ReplayEventDraft[] = [];
  const eventCounts: Record<ReplayEventType, number> = { ...initialEventCounts };
  let liquidations = 0;
  let tradeSequence = 0;
  let openPosition:
    | {
        side: 'LONG' | 'SHORT';
        entryPrice: number;
        quantity: number;
        openedAt: Date;
        dcaCount: number;
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

  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const current = candles[index];
    const direction = strategyRules
      ? toStrategySignalDirection(index, candles, strategyRules, indicatorSeriesCache)
      : toSignalDirection(current, previous, config);
    if (!direction) continue;

    const decision = decideExecutionAction(
      direction,
      openPosition
        ? {
            side: openPosition.side,
            quantity: openPosition.quantity,
            managementMode: 'BOT_MANAGED',
          }
        : null
    );

    if (decision.kind === 'open') {
      tradeSequence += 1;
      openPosition = {
        side: decision.positionSide,
        entryPrice: current.close,
        quantity: 1,
        openedAt: new Date(current.openTime),
        dcaCount: 0,
        bestPrice: current.close,
      };
      pushEvent('ENTRY', decision.positionSide as PositionSide, new Date(current.openTime), current.close, null, index, tradeSequence);
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

    const adverseMoveRatioForDca =
      openPosition.side === 'LONG'
        ? (openPosition.entryPrice - current.close) / Math.max(openPosition.entryPrice, 1e-8)
        : (current.close - openPosition.entryPrice) / Math.max(openPosition.entryPrice, 1e-8);

    if (openPosition.dcaCount < riskConfig.maxDcaPerTrade && adverseMoveRatioForDca >= riskConfig.dcaStepPct) {
      const previousQty = openPosition.quantity;
      const addedQty = 1;
      openPosition.quantity = previousQty + addedQty;
      openPosition.entryPrice =
        (openPosition.entryPrice * previousQty + current.close * addedQty) / openPosition.quantity;
      openPosition.dcaCount += 1;
      pushEvent('DCA', openPosition.side as PositionSide, new Date(current.openTime), current.close, null, index, tradeSequence);
    }

    const favorableMoveRatio =
      openPosition.side === 'LONG'
        ? (current.close - openPosition.entryPrice) / Math.max(openPosition.entryPrice, 1e-8)
        : (openPosition.entryPrice - current.close) / Math.max(openPosition.entryPrice, 1e-8);
    const peakFavorableMoveRatio =
      openPosition.side === 'LONG'
        ? (openPosition.bestPrice - openPosition.entryPrice) / Math.max(openPosition.entryPrice, 1e-8)
        : (openPosition.entryPrice - openPosition.bestPrice) / Math.max(openPosition.entryPrice, 1e-8);

    const fee = (openPosition.entryPrice + current.close) * 0.0004 * effectiveLeverage;
    const rawPnl =
      openPosition.side === 'LONG'
        ? (current.close - openPosition.entryPrice) * openPosition.quantity * effectiveLeverage
        : (openPosition.entryPrice - current.close) * openPosition.quantity * effectiveLeverage;

    const adverseMoveRatio =
      openPosition.side === 'LONG'
        ? (openPosition.entryPrice - current.close) / Math.max(openPosition.entryPrice, 1e-8)
        : (current.close - openPosition.entryPrice) / Math.max(openPosition.entryPrice, 1e-8);

    const isolatedLiquidationThreshold = 1 / Math.max(1, effectiveLeverage);
    const isIsolatedLiquidated =
      marketType === 'FUTURES' &&
      marginMode === 'ISOLATED' &&
      adverseMoveRatio >= isolatedLiquidationThreshold;

    const isTakeProfit = favorableMoveRatio >= riskConfig.takeProfitPct;
    const isStopLoss = adverseMoveRatio >= riskConfig.stopLossPct;
    const trailingActive = peakFavorableMoveRatio >= riskConfig.takeProfitPct * 0.5;
    const isTrailingExit = trailingActive
      ? openPosition.side === 'LONG'
        ? current.close <= openPosition.bestPrice * (1 - riskConfig.trailingStopPct)
        : current.close >= openPosition.bestPrice * (1 + riskConfig.trailingStopPct)
      : false;

    const shouldSignalExit = decision.kind === 'close';

    if (!isIsolatedLiquidated && !isTakeProfit && !isStopLoss && !isTrailingExit && !shouldSignalExit) {
      continue;
    }

    if (isIsolatedLiquidated) {
      liquidations += 1;
    }

    const pnl = isIsolatedLiquidated
      ? -(openPosition.entryPrice * openPosition.quantity) / Math.max(1, effectiveLeverage)
      : rawPnl - fee;

    const closeType: ReplayEventType = isIsolatedLiquidated
      ? 'LIQUIDATION'
      : isTakeProfit
        ? 'TP'
        : isStopLoss
          ? 'SL'
          : isTrailingExit
            ? 'TRAILING'
            : 'EXIT';

    trades.push({
      symbol,
      side: openPosition.side as PositionSide,
      entryPrice: openPosition.entryPrice,
      exitPrice: current.close,
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
      current.close,
      pnl,
      index,
      tradeSequence
    );
    openPosition = null;
  }

  if (openPosition) {
    const last = candles[candles.length - 1];
    const fee = (openPosition.entryPrice + last.close) * 0.0004 * effectiveLeverage;
    const rawPnl =
      openPosition.side === 'LONG'
        ? (last.close - openPosition.entryPrice) * openPosition.quantity * effectiveLeverage
        : (openPosition.entryPrice - last.close) * openPosition.quantity * effectiveLeverage;
    trades.push({
      symbol,
      side: openPosition.side as PositionSide,
      entryPrice: openPosition.entryPrice,
      exitPrice: last.close,
      quantity: openPosition.quantity,
      openedAt: openPosition.openedAt,
      closedAt: new Date(last.closeTime),
      pnl: rawPnl - fee,
      fee,
      exitReason: 'FINAL_CANDLE',
      liquidated: false,
    });
    pushEvent(
      'EXIT',
      openPosition.side as PositionSide,
      new Date(last.closeTime),
      last.close,
      rawPnl - fee,
      candles.length - 1,
      tradeSequence
    );
  }

  return { trades, liquidations, events, eventCounts };
};
