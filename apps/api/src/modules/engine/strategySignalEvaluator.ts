import {
  computeAtrSeriesFromCandles,
  computeBollingerSeriesFromCloses,
  clampPeriod,
  computeEmaSeriesFromCloses,
  computeMacdSeriesFromCloses,
  computeMomentumSeriesFromCloses,
  computeRocSeriesFromCloses,
  computeRsiSeriesFromCloses,
  computeSmaSeriesFromCloses,
  computeStochRsiSeriesFromCloses,
} from './sharedIndicatorSeries';

export type StrategySignalDirection = 'LONG' | 'SHORT' | 'EXIT';

export type StrategyIndicatorCondition =
  | '>'
  | '>='
  | '<'
  | '<='
  | '=='
  | '!='
  | 'CROSS_ABOVE'
  | 'CROSS_BELOW'
  | 'IN_RANGE'
  | 'OUT_OF_RANGE';

export type StrategyRuleOperand =
  | {
      kind: 'constant';
      value: number;
    }
  | {
      kind: 'series';
      indicator: string;
      params: Record<string, unknown>;
    }
  | {
      kind: 'band';
      low: number;
      high: number;
    };

export type StrategyIndicatorRule = {
  name: string;
  condition: StrategyIndicatorCondition;
  value: number;
  params: Record<string, unknown>;
  operand: StrategyRuleOperand;
};

export type StrategySignalRules = {
  direction: 'both' | 'long' | 'short';
  longRules: StrategyIndicatorRule[];
  shortRules: StrategyIndicatorRule[];
  noMatchAction: 'HOLD' | 'EXIT';
};

export type SignalCandle = {
  close: number;
  high?: number;
  low?: number;
};

const isComparatorCondition = (
  operator: StrategyIndicatorCondition,
): operator is '>' | '>=' | '<' | '<=' | '==' | '!=' =>
  operator === '>' ||
  operator === '>=' ||
  operator === '<' ||
  operator === '<=' ||
  operator === '==' ||
  operator === '!=';

const compare = (left: number, operator: '>' | '>=' | '<' | '<=' | '==' | '!=', right: number) => {
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

const isStrategyCondition = (value: unknown): value is StrategyIndicatorCondition =>
  value === '>' ||
  value === '>=' ||
  value === '<' ||
  value === '<=' ||
  value === '==' ||
  value === '!=' ||
  value === 'CROSS_ABOVE' ||
  value === 'CROSS_BELOW' ||
  value === 'IN_RANGE' ||
  value === 'OUT_OF_RANGE';

const parseBandOperand = (value: unknown): StrategyRuleOperand | null => {
  if (Array.isArray(value) && value.length >= 2) {
    const low = asFiniteNumber(value[0]);
    const high = asFiniteNumber(value[1]);
    if (low === null || high === null) return null;
    return {
      kind: 'band',
      low: Math.min(low, high),
      high: Math.max(low, high),
    };
  }

  if (!value || typeof value !== 'object') return null;
  const payload = value as {
    low?: unknown;
    high?: unknown;
    min?: unknown;
    max?: unknown;
  };

  const low = asFiniteNumber(payload.low ?? payload.min);
  const high = asFiniteNumber(payload.high ?? payload.max);
  if (low === null || high === null) return null;

  return {
    kind: 'band',
    low: Math.min(low, high),
    high: Math.max(low, high),
  };
};

const parseSeriesOperand = (value: unknown): StrategyRuleOperand | null => {
  if (!value || typeof value !== 'object') return null;
  const payload = value as {
    indicator?: unknown;
    name?: unknown;
    params?: unknown;
    kind?: unknown;
    type?: unknown;
  };

  const rawIndicator = payload.indicator ?? payload.name;
  if (typeof rawIndicator !== 'string' || rawIndicator.trim().length === 0) return null;

  return {
    kind: 'series',
    indicator: rawIndicator.trim().toUpperCase(),
    params: payload.params && typeof payload.params === 'object' ? (payload.params as Record<string, unknown>) : {},
  };
};

const parseOperand = (value: unknown): StrategyRuleOperand | null => {
  if (!value || typeof value !== 'object') return null;
  const payload = value as {
    kind?: unknown;
    type?: unknown;
    value?: unknown;
    indicator?: unknown;
    name?: unknown;
    params?: unknown;
    low?: unknown;
    high?: unknown;
    min?: unknown;
    max?: unknown;
  };

  const kindRaw = typeof payload.kind === 'string' ? payload.kind : payload.type;
  if (kindRaw === 'constant') {
    const numeric = asFiniteNumber(payload.value);
    if (numeric === null) return null;
    return { kind: 'constant', value: numeric };
  }

  if (kindRaw === 'series') {
    return parseSeriesOperand(payload);
  }

  if (kindRaw === 'band') {
    return parseBandOperand(payload);
  }

  return parseSeriesOperand(payload) ?? parseBandOperand(payload);
};

const normalizeOperand = (input: {
  ruleName: string;
  condition: StrategyIndicatorCondition;
  params: Record<string, unknown>;
  rawValue: unknown;
  rawOperand: unknown;
}): StrategyRuleOperand | null => {
  const explicitOperand = parseOperand(input.rawOperand);

  if (input.condition === 'IN_RANGE' || input.condition === 'OUT_OF_RANGE') {
    if (explicitOperand?.kind === 'band') return explicitOperand;
    const band = parseBandOperand(input.rawValue);
    if (band) return band;
    return null;
  }

  if (explicitOperand) {
    if (explicitOperand.kind === 'band') return null;
    return explicitOperand;
  }

  if (input.rawValue && typeof input.rawValue === 'object') {
    const series = parseSeriesOperand(input.rawValue);
    if (series) return series;
  }

  if (input.ruleName.includes('EMA')) {
    const slow = clampPeriod(input.params.slow, 21);
    return {
      kind: 'series',
      indicator: 'EMA',
      params: { period: slow },
    };
  }

  const numericValue = asFiniteNumber(input.rawValue);
  if (numericValue !== null) {
    return {
      kind: 'constant',
      value: numericValue,
    };
  }

  return null;
};

const parseRule = (value: unknown): StrategyIndicatorRule | null => {
  if (!value || typeof value !== 'object') return null;
  const input = value as {
    name?: unknown;
    condition?: unknown;
    value?: unknown;
    params?: unknown;
    operand?: unknown;
  };

  if (typeof input.name !== 'string' || input.name.trim().length === 0) return null;
  if (!isStrategyCondition(input.condition)) return null;

  const params = input.params && typeof input.params === 'object' ? (input.params as Record<string, unknown>) : {};
  const operand = normalizeOperand({
    ruleName: input.name.trim().toUpperCase(),
    condition: input.condition,
    params,
    rawValue: input.value,
    rawOperand: input.operand,
  });
  if (!operand) return null;

  const normalizedValue =
    operand.kind === 'constant' ? operand.value : operand.kind === 'band' ? operand.high : 0;

  return {
    name: input.name.trim().toUpperCase(),
    condition: input.condition,
    value: normalizedValue,
    params,
    operand,
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

const resolveSeries = (params: {
  indicatorName: string;
  indicatorParams: Record<string, unknown>;
  closes: number[];
  highs: number[];
  lows: number[];
  cache: Map<string, Array<number | null>>;
}): Array<number | null> | null => {
  const name = params.indicatorName.toUpperCase();

  if (name.includes('EMA')) {
    const period = clampPeriod(
      params.indicatorParams.period ?? params.indicatorParams.length ?? params.indicatorParams.fast ?? params.indicatorParams.slow,
      9,
    );
    const key = `EMA_${period}`;
    const series = params.cache.get(key) ?? computeEmaSeriesFromCloses(params.closes, period);
    params.cache.set(key, series);
    return series;
  }

  if (name.includes('MACD')) {
    const fast = clampPeriod(params.indicatorParams.fast, 12);
    const slow = clampPeriod(params.indicatorParams.slow, 26);
    const signal = clampPeriod(params.indicatorParams.signal, 9);
    const baseKey = `MACD_${fast}_${slow}_${signal}`;
    const lineKey = `${baseKey}_LINE`;
    const signalKey = `${baseKey}_SIGNAL`;
    const histogramKey = `${baseKey}_HISTOGRAM`;

    if (!params.cache.has(lineKey) || !params.cache.has(signalKey) || !params.cache.has(histogramKey)) {
      const macd = computeMacdSeriesFromCloses(params.closes, fast, slow, signal);
      params.cache.set(lineKey, macd.line);
      params.cache.set(signalKey, macd.signal);
      params.cache.set(histogramKey, macd.histogram);
    }

    if (name.includes('MACD_SIGNAL')) {
      return params.cache.get(signalKey) ?? null;
    }

    if (name.includes('MACD_HIST')) {
      return params.cache.get(histogramKey) ?? null;
    }

    return params.cache.get(lineKey) ?? null;
  }

  if (name.includes('SMA')) {
    const period = clampPeriod(
      params.indicatorParams.period ?? params.indicatorParams.length ?? params.indicatorParams.fast ?? params.indicatorParams.slow,
      14,
    );
    const key = `SMA_${period}`;
    const series = params.cache.get(key) ?? computeSmaSeriesFromCloses(params.closes, period);
    params.cache.set(key, series);
    return series;
  }

  if (name.includes('STOCHRSI')) {
    const period = clampPeriod(params.indicatorParams.period ?? params.indicatorParams.rsiPeriod, 14);
    const stochPeriod = clampPeriod(params.indicatorParams.stochPeriod ?? period, 14);
    const smoothK = clampPeriod(params.indicatorParams.smoothK, 3);
    const smoothD = clampPeriod(params.indicatorParams.smoothD, 3);
    const baseKey = `STOCHRSI_${period}_${stochPeriod}_${smoothK}_${smoothD}`;
    const kKey = `${baseKey}_K`;
    const dKey = `${baseKey}_D`;

    if (!params.cache.has(kKey) || !params.cache.has(dKey)) {
      const stochRsi = computeStochRsiSeriesFromCloses(
        params.closes,
        period,
        stochPeriod,
        smoothK,
        smoothD,
      );
      params.cache.set(kKey, stochRsi.k);
      params.cache.set(dKey, stochRsi.d);
    }

    if (name.includes('STOCHRSI_D') || name.includes('STOCHRSI_SIGNAL')) {
      return params.cache.get(dKey) ?? null;
    }

    return params.cache.get(kKey) ?? null;
  }

  if (name.includes('RSI')) {
    const period = clampPeriod(params.indicatorParams.period ?? params.indicatorParams.length, 14);
    const key = `RSI_${period}`;
    const series = params.cache.get(key) ?? computeRsiSeriesFromCloses(params.closes, period);
    params.cache.set(key, series);
    return series;
  }

  if (name.includes('ROC')) {
    const period = clampPeriod(params.indicatorParams.period ?? params.indicatorParams.length, 14);
    const key = `ROC_${period}`;
    const series = params.cache.get(key) ?? computeRocSeriesFromCloses(params.closes, period);
    params.cache.set(key, series);
    return series;
  }

  if (name.includes('ATR')) {
    const period = clampPeriod(params.indicatorParams.period ?? params.indicatorParams.length, 14);
    const key = `ATR_${period}`;
    const series = params.cache.get(key) ?? computeAtrSeriesFromCandles(params.highs, params.lows, params.closes, period);
    params.cache.set(key, series);
    return series;
  }

  if (name.includes('BOLLINGER')) {
    const period = clampPeriod(params.indicatorParams.period ?? params.indicatorParams.length, 20);
    const stdDev = asFiniteNumber(params.indicatorParams.stdDev ?? params.indicatorParams.deviation) ?? 2;
    const baseKey = `BOLLINGER_${period}_${stdDev}`;
    const upperKey = `${baseKey}_UPPER`;
    const middleKey = `${baseKey}_MIDDLE`;
    const lowerKey = `${baseKey}_LOWER`;
    const bandwidthKey = `${baseKey}_BANDWIDTH`;
    const percentBKey = `${baseKey}_PERCENT_B`;

    if (
      !params.cache.has(upperKey) ||
      !params.cache.has(middleKey) ||
      !params.cache.has(lowerKey) ||
      !params.cache.has(bandwidthKey) ||
      !params.cache.has(percentBKey)
    ) {
      const bollinger = computeBollingerSeriesFromCloses(params.closes, period, stdDev);
      params.cache.set(upperKey, bollinger.upper);
      params.cache.set(middleKey, bollinger.middle);
      params.cache.set(lowerKey, bollinger.lower);
      params.cache.set(bandwidthKey, bollinger.bandwidth);
      params.cache.set(percentBKey, bollinger.percentB);
    }

    if (name.includes('BOLLINGER_UPPER')) return params.cache.get(upperKey) ?? null;
    if (name.includes('BOLLINGER_MIDDLE')) return params.cache.get(middleKey) ?? null;
    if (name.includes('BOLLINGER_LOWER')) return params.cache.get(lowerKey) ?? null;
    if (name.includes('BOLLINGER_BANDWIDTH')) return params.cache.get(bandwidthKey) ?? null;
    if (name.includes('BOLLINGER_PERCENT_B')) return params.cache.get(percentBKey) ?? null;

    return params.cache.get(percentBKey) ?? null;
  }

  if (name.includes('MOMENTUM')) {
    const period = clampPeriod(params.indicatorParams.period ?? params.indicatorParams.length, 14);
    const key = `MOMENTUM_${period}`;
    const series = params.cache.get(key) ?? computeMomentumSeriesFromCloses(params.closes, period);
    params.cache.set(key, series);
    return series;
  }

  return null;
};

const resolveRightSeries = (
  operand: StrategyRuleOperand,
  closes: number[],
  highs: number[],
  lows: number[],
  cache: Map<string, Array<number | null>>,
) => {
  if (operand.kind !== 'series') return null;
  return resolveSeries({
    indicatorName: operand.indicator,
    indicatorParams: operand.params,
    closes,
    highs,
    lows,
    cache,
  });
};

const evaluateRuleAtIndex = (
  rule: StrategyIndicatorRule,
  closes: number[],
  highs: number[],
  lows: number[],
  index: number,
  cache: Map<string, Array<number | null>>,
) => {
  const leftSeries = resolveSeries({
    indicatorName: rule.name,
    indicatorParams: rule.params,
    closes,
    highs,
    lows,
    cache,
  });
  if (!leftSeries) return false;

  const leftValue = leftSeries[index];
  if (typeof leftValue !== 'number') return false;

  if (rule.condition === 'IN_RANGE' || rule.condition === 'OUT_OF_RANGE') {
    if (rule.operand.kind !== 'band') return false;
    const inRange = leftValue >= rule.operand.low && leftValue <= rule.operand.high;
    return rule.condition === 'IN_RANGE' ? inRange : !inRange;
  }

  if (rule.condition === 'CROSS_ABOVE' || rule.condition === 'CROSS_BELOW') {
    if (index <= 0) return false;
    const previousLeft = leftSeries[index - 1];
    if (typeof previousLeft !== 'number') return false;

    if (rule.operand.kind === 'band') return false;

    const rightSeries = resolveRightSeries(rule.operand, closes, highs, lows, cache);
    const currentRight =
      rule.operand.kind === 'constant'
        ? rule.operand.value
        : rightSeries
          ? rightSeries[index]
          : null;
    const previousRight =
      rule.operand.kind === 'constant'
        ? rule.operand.value
        : rightSeries
          ? rightSeries[index - 1]
          : null;

    if (typeof currentRight !== 'number' || typeof previousRight !== 'number') return false;

    return rule.condition === 'CROSS_ABOVE'
      ? previousLeft <= previousRight && leftValue > currentRight
      : previousLeft >= previousRight && leftValue < currentRight;
  }

  if (!isComparatorCondition(rule.condition)) return false;

  if (rule.operand.kind === 'band') return false;

  const rightSeries = resolveRightSeries(rule.operand, closes, highs, lows, cache);
  const rightValue =
    rule.operand.kind === 'constant'
      ? rule.operand.value
      : rightSeries
        ? rightSeries[index]
        : null;

  if (typeof rightValue !== 'number') return false;
  return compare(leftValue, rule.condition, rightValue);
};

export const evaluateStrategySignalAtIndex = (
  rules: StrategySignalRules,
  candles: SignalCandle[],
  index: number,
  cache: Map<string, Array<number | null>>,
): StrategySignalDirection | null => {
  const closes = candles.map((candle) => candle.close);
  const highs = candles.map((candle) =>
    typeof candle.high === 'number' && Number.isFinite(candle.high) ? candle.high : candle.close
  );
  const lows = candles.map((candle) =>
    typeof candle.low === 'number' && Number.isFinite(candle.low) ? candle.low : candle.close
  );
  const canLong = rules.direction !== 'short';
  const canShort = rules.direction !== 'long';
  const longMatched =
    canLong &&
    rules.longRules.length > 0 &&
    rules.longRules.every((rule) => evaluateRuleAtIndex(rule, closes, highs, lows, index, cache));
  const shortMatched =
    canShort &&
    rules.shortRules.length > 0 &&
    rules.shortRules.every((rule) => evaluateRuleAtIndex(rule, closes, highs, lows, index, cache));

  if (longMatched && !shortMatched) return 'LONG';
  if (shortMatched && !longMatched) return 'SHORT';
  if (!longMatched && !shortMatched) return rules.noMatchAction === 'EXIT' ? 'EXIT' : null;
  return null;
};
