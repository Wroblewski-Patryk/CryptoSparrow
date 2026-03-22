import {
  OrderEvaluationInput,
  OrderEvaluationInputSchema,
  OrderEvaluationResult,
  OrderEvaluationState,
} from './orderTypes.types';

const needsLimit = (type: OrderEvaluationInput['type']) => type === 'LIMIT' || type === 'STOP_LIMIT';
const needsStop = (type: OrderEvaluationInput['type']) =>
  type === 'STOP' || type === 'STOP_LIMIT' || type === 'TAKE_PROFIT';

const isLimitSatisfied = (side: 'BUY' | 'SELL', markPrice: number, limitPrice: number) => {
  return side === 'BUY' ? markPrice <= limitPrice : markPrice >= limitPrice;
};

const isStopSatisfied = (side: 'BUY' | 'SELL', markPrice: number, stopPrice: number) => {
  return side === 'BUY' ? markPrice >= stopPrice : markPrice <= stopPrice;
};

const isTakeProfitSatisfied = (side: 'BUY' | 'SELL', markPrice: number, stopPrice: number) => {
  return side === 'BUY' ? markPrice <= stopPrice : markPrice >= stopPrice;
};

export const evaluateOrderExecution = (
  input: OrderEvaluationInput,
  state: OrderEvaluationState = {}
): OrderEvaluationResult => {
  const parsed = OrderEvaluationInputSchema.parse(input);
  const nextState: OrderEvaluationState = { ...state };

  if (needsLimit(parsed.type) && typeof parsed.limitPrice !== 'number') {
    throw new Error('limitPrice is required for this order type');
  }
  if (needsStop(parsed.type) && typeof parsed.stopPrice !== 'number') {
    throw new Error('stopPrice is required for this order type');
  }
  if (parsed.type === 'TRAILING' && typeof parsed.trailingOffsetPercent !== 'number') {
    throw new Error('trailingOffsetPercent is required for trailing order');
  }

  if (parsed.type === 'MARKET') {
    return { shouldExecute: true, reason: 'market_immediate', nextState };
  }

  if (parsed.type === 'LIMIT') {
    const ok = isLimitSatisfied(parsed.side, parsed.markPrice, parsed.limitPrice as number);
    return {
      shouldExecute: ok,
      reason: ok ? 'limit_condition_met' : 'limit_condition_pending',
      nextState,
    };
  }

  if (parsed.type === 'STOP') {
    const ok = isStopSatisfied(parsed.side, parsed.markPrice, parsed.stopPrice as number);
    return {
      shouldExecute: ok,
      reason: ok ? 'stop_condition_met' : 'stop_condition_pending',
      nextState,
    };
  }

  if (parsed.type === 'TAKE_PROFIT') {
    const ok = isTakeProfitSatisfied(parsed.side, parsed.markPrice, parsed.stopPrice as number);
    return {
      shouldExecute: ok,
      reason: ok ? 'take_profit_condition_met' : 'take_profit_condition_pending',
      nextState,
    };
  }

  if (parsed.type === 'STOP_LIMIT') {
    const stopSatisfied = state.stopTriggered
      ? true
      : isStopSatisfied(parsed.side, parsed.markPrice, parsed.stopPrice as number);
    if (stopSatisfied) nextState.stopTriggered = true;

    const limitSatisfied = isLimitSatisfied(parsed.side, parsed.markPrice, parsed.limitPrice as number);
    const ok = stopSatisfied && limitSatisfied;
    return {
      shouldExecute: ok,
      reason: ok ? 'stop_limit_conditions_met' : 'stop_limit_conditions_pending',
      nextState,
    };
  }

  // TRAILING
  const offset = parsed.trailingOffsetPercent as number;
  const anchor =
    typeof state.trailingAnchorPrice === 'number' ? state.trailingAnchorPrice : parsed.markPrice;

  if (parsed.side === 'BUY') {
    const updatedAnchor = Math.min(anchor, parsed.markPrice);
    nextState.trailingAnchorPrice = updatedAnchor;
    const triggerPrice = updatedAnchor * (1 + offset);
    const ok = parsed.markPrice >= triggerPrice;
    return {
      shouldExecute: ok,
      reason: ok ? 'trailing_condition_met' : 'trailing_condition_pending',
      nextState,
    };
  }

  const updatedAnchor = Math.max(anchor, parsed.markPrice);
  nextState.trailingAnchorPrice = updatedAnchor;
  const triggerPrice = updatedAnchor * (1 - offset);
  const ok = parsed.markPrice <= triggerPrice;
  return {
    shouldExecute: ok,
    reason: ok ? 'trailing_condition_met' : 'trailing_condition_pending',
    nextState,
  };
};
