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

const computeEmaSeries = (candles: SignalCandle[], period: number): Array<number | null> => {
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

const computeRsiSeries = (candles: SignalCandle[], period: number): Array<number | null> => {
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

const computeMomentumSeries = (candles: SignalCandle[], period: number): Array<number | null> => {
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
  candles: SignalCandle[],
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

export const evaluateStrategySignalAtIndex = (
  rules: StrategySignalRules,
  candles: SignalCandle[],
  index: number,
  cache: Map<string, Array<number | null>>,
): StrategySignalDirection | null => {
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
  if (!longMatched && !shortMatched) return rules.noMatchAction === 'EXIT' ? 'EXIT' : null;
  return null;
};
