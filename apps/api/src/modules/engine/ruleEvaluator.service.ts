import {
  IndicatorSnapshot,
  RuleGroup,
  RuleGroupSchema,
  RuleOperator,
  StrategyRule,
} from './ruleEvaluator.types';

const compare = (left: number, operator: RuleOperator, right: number): boolean => {
  if (operator === '>') return left > right;
  if (operator === '>=') return left >= right;
  if (operator === '<') return left < right;
  if (operator === '<=') return left <= right;
  if (operator === '==') return left === right;
  return left !== right;
};

const evaluateRule = (rule: StrategyRule, snapshot: IndicatorSnapshot): boolean => {
  const timeframeBucket = snapshot[rule.timeframe];
  if (!timeframeBucket) return false;

  const current = timeframeBucket[rule.indicator];
  if (typeof current !== 'number') return false;

  return compare(current, rule.operator, rule.value);
};

export const evaluateRuleGroup = (group: RuleGroup, snapshot: IndicatorSnapshot): boolean => {
  const parsed = RuleGroupSchema.parse(group);
  const outcomes = parsed.rules.map((rule) => evaluateRule(rule, snapshot));

  if (parsed.logic === 'AND') {
    return outcomes.every(Boolean);
  }

  return outcomes.some(Boolean);
};
