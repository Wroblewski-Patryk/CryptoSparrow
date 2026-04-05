import { parseStrategySignalRules } from '../engine/strategySignalEvaluator';
import {
  clampPeriod,
  computeEmaSeriesFromCloses,
  computeMomentumSeriesFromCloses,
  computeRsiSeriesFromCloses,
  formatIndicatorValue,
} from './runtimeSignalIndicators.service';

export type SignalConditionLine = {
  scope: 'LONG' | 'SHORT';
  left: string;
  value: string;
  operator: string;
  right: string;
};

export const parseSignalConditionLines = (value: unknown): SignalConditionLine[] | null => {
  if (!Array.isArray(value)) return null;
  const lines = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const scope = row.scope === 'LONG' || row.scope === 'SHORT' ? row.scope : null;
      const left = typeof row.left === 'string' ? row.left.trim() : '';
      const lineValue = typeof row.value === 'string' ? row.value.trim() : '';
      const operator = typeof row.operator === 'string' ? row.operator.trim() : '';
      const right = typeof row.right === 'string' ? row.right.trim() : '';
      if (!scope || !left || !operator || !right) return null;
      return {
        scope,
        left,
        value: lineValue.length > 0 ? lineValue : 'X',
        operator,
        right,
      } satisfies SignalConditionLine;
    })
    .filter((item): item is SignalConditionLine => Boolean(item));
  return lines.length > 0 ? lines : null;
};

export const buildSignalConditionLines = (params: {
  strategyConfig: Record<string, unknown> | null | undefined;
  direction: 'LONG' | 'SHORT' | 'EXIT' | null;
  closes: number[];
}): SignalConditionLine[] | null => {
  if (!params.strategyConfig) return null;
  if (params.direction === 'EXIT') return null;
  const rules = parseStrategySignalRules(params.strategyConfig);
  if (!rules) return null;

  const latestIndex = params.closes.length > 0 ? params.closes.length - 1 : -1;
  const emaCache = new Map<number, Array<number | null>>();
  const rsiCache = new Map<number, Array<number | null>>();
  const momentumCache = new Map<number, Array<number | null>>();

  const ensureEma = (period: number) => {
    if (!emaCache.has(period)) {
      emaCache.set(period, computeEmaSeriesFromCloses(params.closes, period));
    }
    return emaCache.get(period)!;
  };
  const ensureRsi = (period: number) => {
    if (!rsiCache.has(period)) {
      rsiCache.set(period, computeRsiSeriesFromCloses(params.closes, period));
    }
    return rsiCache.get(period)!;
  };
  const ensureMomentum = (period: number) => {
    if (!momentumCache.has(period)) {
      momentumCache.set(period, computeMomentumSeriesFromCloses(params.closes, period));
    }
    return momentumCache.get(period)!;
  };

  const formatFixedTarget = (value: number) => Number(value.toFixed(6)).toString();
  const formatLive = (value: number | null | undefined) => formatIndicatorValue(value) ?? 'X';
  const buildLinesForScope = (
    scope: 'LONG' | 'SHORT',
    selectedRules: Array<{ name: string; condition: string; value: number; params: Record<string, unknown> }>
  ): SignalConditionLine[] => {
    const output: SignalConditionLine[] = [];
    for (const rule of selectedRules) {
      const indicator = rule.name.toUpperCase();
      if (indicator.includes('EMA')) {
        const fast = clampPeriod(rule.params.fast, 9);
        const slow = clampPeriod(rule.params.slow, 21);
        const fastValue = ensureEma(fast)[latestIndex];
        const slowValue = ensureEma(slow)[latestIndex];
        output.push({
          scope,
          left: `EMA(${fast})`,
          value: formatLive(fastValue),
          operator: rule.condition,
          right: `EMA(${slow})=${formatLive(slowValue)}`,
        });
        continue;
      }

      if (indicator.includes('RSI')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureRsi(period)[latestIndex];
        output.push({
          scope,
          left: `RSI(${period})`,
          value: formatLive(value),
          operator: rule.condition,
          right: formatFixedTarget(rule.value),
        });
        continue;
      }

      if (indicator.includes('MOMENTUM')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureMomentum(period)[latestIndex];
        output.push({
          scope,
          left: `MOMENTUM(${period})`,
          value: formatLive(value),
          operator: rule.condition,
          right: formatFixedTarget(rule.value),
        });
        continue;
      }

      output.push({
        scope,
        left: indicator,
        value: '-',
        operator: rule.condition,
        right: formatFixedTarget(rule.value),
      });
    }
    return output;
  };

  if (params.direction === 'LONG') {
    const lines = buildLinesForScope('LONG', rules.longRules);
    return lines.length > 0 ? lines : null;
  }
  if (params.direction === 'SHORT') {
    const lines = buildLinesForScope('SHORT', rules.shortRules);
    return lines.length > 0 ? lines : null;
  }
  const neutralLines = [
    ...buildLinesForScope('LONG', rules.longRules),
    ...buildLinesForScope('SHORT', rules.shortRules),
  ];
  return neutralLines.length > 0 ? neutralLines : null;
};

export const buildSignalIndicatorSummary = (params: {
  strategyConfig: Record<string, unknown> | null | undefined;
  direction: 'LONG' | 'SHORT' | 'EXIT' | null;
  closes: number[];
}) => {
  if (!params.strategyConfig) return null;
  if (params.direction === 'EXIT') return null;

  const rules = parseStrategySignalRules(params.strategyConfig);
  if (!rules) return null;
  const selectedRules =
    params.direction === 'LONG'
      ? rules.longRules
      : params.direction === 'SHORT'
        ? rules.shortRules
        : [...rules.longRules, ...rules.shortRules];
  if (selectedRules.length === 0) return null;

  const parts: string[] = [];
  const latestIndex = params.closes.length > 0 ? params.closes.length - 1 : -1;
  const emaCache = new Map<number, Array<number | null>>();
  const seenEmaSeries = new Set<string>();
  const seenRsiPeriods = new Set<number>();
  const seenMomentumPeriods = new Set<number>();

  const ensureEmaSeries = (period: number) => {
    if (!emaCache.has(period)) {
      emaCache.set(period, computeEmaSeriesFromCloses(params.closes, period));
    }
    return emaCache.get(period)!;
  };

  for (const rule of selectedRules) {
    const indicator = rule.name.toUpperCase();

    if (indicator.includes('RSI')) {
      const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
      if (seenRsiPeriods.has(period)) continue;
      const series = computeRsiSeriesFromCloses(params.closes, period);
      const value = formatIndicatorValue(series[latestIndex]) ?? 'X';
      parts.push(`RSI(${period})=${value}`);
      seenRsiPeriods.add(period);
      continue;
    }

    if (indicator.includes('MOMENTUM')) {
      const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
      if (seenMomentumPeriods.has(period)) continue;
      const series = computeMomentumSeriesFromCloses(params.closes, period);
      const value = formatIndicatorValue(series[latestIndex]) ?? 'X';
      parts.push(`MOMENTUM(${period})=${value}`);
      seenMomentumPeriods.add(period);
      continue;
    }

    if (indicator.includes('EMA')) {
      const fast = clampPeriod(rule.params.fast, 9);
      const slow = clampPeriod(rule.params.slow, 21);
      const fastSeriesKey = `EMA_FAST_${fast}`;
      const slowSeriesKey = `EMA_SLOW_${slow}`;
      if (!seenEmaSeries.has(fastSeriesKey)) {
        const fastValue = formatIndicatorValue(ensureEmaSeries(fast)[latestIndex]) ?? 'X';
        parts.push(`EMA(${fast})=${fastValue}`);
        seenEmaSeries.add(fastSeriesKey);
      }
      if (!seenEmaSeries.has(slowSeriesKey)) {
        const slowValue = formatIndicatorValue(ensureEmaSeries(slow)[latestIndex]) ?? 'X';
        parts.push(`EMA(${slow})=${slowValue}`);
        seenEmaSeries.add(slowSeriesKey);
      }
      continue;
    }
  }

  return parts.length > 0 ? parts.join(' | ') : null;
};
