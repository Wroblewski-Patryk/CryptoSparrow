import { describe, expect, it } from 'vitest';
import { evaluateOrderExecution } from './orderTypes.service';

describe('order type evaluator', () => {
  it('executes market order immediately', () => {
    const result = evaluateOrderExecution({
      type: 'MARKET',
      side: 'BUY',
      quantity: 1,
      markPrice: 100,
    });

    expect(result.shouldExecute).toBe(true);
    expect(result.reason).toBe('market_immediate');
  });

  it('evaluates limit order by side', () => {
    const buyPending = evaluateOrderExecution({
      type: 'LIMIT',
      side: 'BUY',
      quantity: 1,
      markPrice: 101,
      limitPrice: 100,
    });
    const buyHit = evaluateOrderExecution({
      type: 'LIMIT',
      side: 'BUY',
      quantity: 1,
      markPrice: 99,
      limitPrice: 100,
    });

    expect(buyPending.shouldExecute).toBe(false);
    expect(buyHit.shouldExecute).toBe(true);
  });

  it('evaluates stop and take-profit order conditions', () => {
    const stopBuy = evaluateOrderExecution({
      type: 'STOP',
      side: 'BUY',
      quantity: 1,
      markPrice: 105,
      stopPrice: 104,
    });
    const takeProfitSell = evaluateOrderExecution({
      type: 'TAKE_PROFIT',
      side: 'SELL',
      quantity: 1,
      markPrice: 106,
      stopPrice: 105,
    });

    expect(stopBuy.shouldExecute).toBe(true);
    expect(takeProfitSell.shouldExecute).toBe(true);
  });

  it('requires both stop and limit for stop-limit with state carry-over', () => {
    const first = evaluateOrderExecution(
      {
        type: 'STOP_LIMIT',
        side: 'BUY',
        quantity: 1,
        markPrice: 105,
        stopPrice: 104,
        limitPrice: 103,
      },
      {}
    );
    const second = evaluateOrderExecution(
      {
        type: 'STOP_LIMIT',
        side: 'BUY',
        quantity: 1,
        markPrice: 102,
        stopPrice: 104,
        limitPrice: 103,
      },
      first.nextState
    );

    expect(first.shouldExecute).toBe(false);
    expect(first.nextState.stopTriggered).toBe(true);
    expect(second.shouldExecute).toBe(true);
  });

  it('updates trailing anchor and triggers when rebound threshold is crossed', () => {
    const first = evaluateOrderExecution(
      {
        type: 'TRAILING',
        side: 'BUY',
        quantity: 1,
        markPrice: 100,
        trailingOffsetPercent: 0.01,
      },
      {}
    );
    const second = evaluateOrderExecution(
      {
        type: 'TRAILING',
        side: 'BUY',
        quantity: 1,
        markPrice: 98,
        trailingOffsetPercent: 0.01,
      },
      first.nextState
    );
    const third = evaluateOrderExecution(
      {
        type: 'TRAILING',
        side: 'BUY',
        quantity: 1,
        markPrice: 99.2,
        trailingOffsetPercent: 0.01,
      },
      second.nextState
    );

    expect(first.shouldExecute).toBe(false);
    expect(second.nextState.trailingAnchorPrice).toBe(98);
    expect(third.shouldExecute).toBe(true);
  });
});
