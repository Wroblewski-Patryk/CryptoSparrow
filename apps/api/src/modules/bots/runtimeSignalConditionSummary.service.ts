import { parseStrategySignalRules } from '../engine/strategySignalEvaluator';

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatSignalRule = (rule: {
  name: string;
  condition: string;
  value: number;
  params: Record<string, unknown>;
}) => {
  const indicator = rule.name.toUpperCase();
  if (indicator.includes('RSI')) {
    const period = toFiniteNumber(rule.params.period ?? rule.params.length) ?? 14;
    return `RSI(${Math.trunc(period)}) ${rule.condition} ${rule.value}`;
  }
  if (indicator.includes('MOMENTUM')) {
    const period = toFiniteNumber(rule.params.period ?? rule.params.length) ?? 14;
    return `MOMENTUM(${Math.trunc(period)}) ${rule.condition} ${rule.value}`;
  }
  if (indicator.includes('EMA')) {
    const fast = toFiniteNumber(rule.params.fast) ?? 9;
    const slow = toFiniteNumber(rule.params.slow) ?? 21;
    return `EMA(${Math.trunc(fast)}/${Math.trunc(slow)}) ${rule.condition}`;
  }
  return `${indicator} ${rule.condition} ${rule.value}`;
};

export const buildSignalConditionSummary = (
  strategyConfig: Record<string, unknown> | null | undefined,
  direction: 'LONG' | 'SHORT' | 'EXIT' | null
) => {
  if (!strategyConfig) return null;
  const rules = parseStrategySignalRules(strategyConfig);
  if (!rules) return null;

  if (direction === 'EXIT') {
    return rules.noMatchAction === 'EXIT'
      ? 'No-match action: EXIT'
      : 'No-match action: HOLD';
  }

  if (direction === 'LONG' || direction === 'SHORT') {
    const source = direction === 'SHORT' ? rules.shortRules : rules.longRules;
    if (source.length === 0) return null;
    return source.map(formatSignalRule).join(' | ');
  }

  const longSummary =
    rules.longRules.length > 0 ? `LONG: ${rules.longRules.map(formatSignalRule).join(' & ')}` : null;
  const shortSummary =
    rules.shortRules.length > 0 ? `SHORT: ${rules.shortRules.map(formatSignalRule).join(' & ')}` : null;
  if (!longSummary && !shortSummary) return null;
  return [longSummary, shortSummary].filter((item): item is string => item != null).join(' | ');
};
