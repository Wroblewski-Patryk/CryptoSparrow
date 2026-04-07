import {
  clampPeriod,
  computeEmaSeriesFromCloses,
  computeMomentumSeriesFromCloses,
  computeRsiSeriesFromCloses,
} from './sharedIndicatorSeries';

export type StrategySignalDirection = 'LONG' | 'SHORT' | 'EXIT';

type StrategyIndicatorCondition = '>' | '<' | '>=' | '<=' | '==' | '!=';

type StrategyIndicatorRule = {
  name: string;
  condition: StrategyIndicatorCondition;
  value: number;
  params: Record<string, unknown>;
};

export type StrategySignalRules = {
  direction: 'both' | 'long' | 'short';
  longRules: StrategyIndicatorRule[];
  shortRules: StrategyIndicatorRule[];
  noMatchAction: 'HOLD' | 'EXIT';
};

export type SignalCandle = {
  close: number;
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

export const parseStrategySignalRules = (
  strategyConfig?: Record<string, unknown> | null,
): StrategySignalRules | null => {
  if (!strategyConfig || typeof strategyConfig !== 'object') return null;

  const openBlock = (strategyConfig.open ?? strategyConfig.openConditions) as
    | {
        direction?: unknown;
        noMatchAction?: unknown;
        exitOnNoSignal?: unknown;
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

  const noMatchAction =
    openBlock.noMatchAction === 'EXIT' || openBlock.exitOnNoSignal === true
      ? 'EXIT'
      : 'HOLD';

  return {
    direction,
    longRules,
    shortRules,
    noMatchAction,
  };
};

const evaluateRuleAtIndex = (
  rule: StrategyIndicatorRule,
  closes: number[],
  index: number,
  cache: Map<string, Array<number | null>>,
) => {
  if (rule.name.includes('EMA')) {
    const fast = clampPeriod(rule.params.fast, 9);
    const slow = clampPeriod(rule.params.slow, 21);
    const fastKey = `EMA_FAST_${fast}`;
    const slowKey = `EMA_SLOW_${slow}`;
    const fastSeries = cache.get(fastKey) ?? computeEmaSeriesFromCloses(closes, fast);
    const slowSeries = cache.get(slowKey) ?? computeEmaSeriesFromCloses(closes, slow);
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
    const series = cache.get(key) ?? computeRsiSeriesFromCloses(closes, period);
    cache.set(key, series);
    const value = series[index];
    if (typeof value !== 'number') return false;
    return compare(value, rule.condition, rule.value);
  }

  if (rule.name.includes('MOMENTUM')) {
    const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
    const key = `MOMENTUM_${period}`;
    const series = cache.get(key) ?? computeMomentumSeriesFromCloses(closes, period);
    cache.set(key, series);
    const value = series[index];
    if (typeof value !== 'number') return false;
    return compare(value, rule.condition, rule.value);
  }

  return false;
};

export const evaluateStrategySignalAtIndex = (
  rules: StrategySignalRules,
  candles: SignalCandle[],
  index: number,
  cache: Map<string, Array<number | null>>,
): StrategySignalDirection | null => {
  const closes = candles.map((candle) => candle.close);
  const canLong = rules.direction !== 'short';
  const canShort = rules.direction !== 'long';
  const longMatched =
    canLong &&
    rules.longRules.length > 0 &&
    rules.longRules.every((rule) => evaluateRuleAtIndex(rule, closes, index, cache));
  const shortMatched =
    canShort &&
    rules.shortRules.length > 0 &&
    rules.shortRules.every((rule) => evaluateRuleAtIndex(rule, closes, index, cache));

  if (longMatched && !shortMatched) return 'LONG';
  if (shortMatched && !longMatched) return 'SHORT';
  if (!longMatched && !shortMatched) return rules.noMatchAction === 'EXIT' ? 'EXIT' : null;
  return null;
};
