import { z } from 'zod';

export const RuleLogicSchema = z.enum(['AND', 'OR']);
export const RuleOperatorSchema = z.enum(['>', '>=', '<', '<=', '==', '!=']);

export const StrategyRuleSchema = z.object({
  indicator: z.string().trim().min(1),
  timeframe: z.string().trim().min(1),
  operator: RuleOperatorSchema,
  value: z.number(),
});

export const RuleGroupSchema = z.object({
  logic: RuleLogicSchema,
  rules: z.array(StrategyRuleSchema),
});

export type RuleOperator = z.infer<typeof RuleOperatorSchema>;
export type StrategyRule = z.infer<typeof StrategyRuleSchema>;
export type RuleGroup = z.infer<typeof RuleGroupSchema>;

export type IndicatorSnapshot = Record<string, Record<string, number | null | undefined>>;
