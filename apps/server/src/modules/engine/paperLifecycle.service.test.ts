import { describe, expect, it } from 'vitest';
import { PaperLifecycleState, processPaperLifecycleTick } from './paperLifecycle.service';

const emptyState = (): PaperLifecycleState => ({
  position: null,
  orderState: {},
});

describe('paper lifecycle', () => {
  it('opens position immediately for market order', () => {
    const result = processPaperLifecycleTick(emptyState(), {
      markPrice: 100,
      entryOrder: {
        type: 'MARKET',
        side: 'BUY',
        quantity: 1,
      },
      management: {},
    });

    expect(result.openedPosition).toBe(true);
    expect(result.closedPosition).toBe(false);
    expect(result.nextState.position?.side).toBe('LONG');
    expect(result.nextState.position?.averageEntryPrice).toBe(100);
  });

  it('keeps stop-limit pending until stop is armed and limit is met', () => {
    const first = processPaperLifecycleTick(emptyState(), {
      markPrice: 101,
      entryOrder: {
        type: 'STOP_LIMIT',
        side: 'BUY',
        quantity: 1,
        stopPrice: 102,
        limitPrice: 100,
      },
      management: {},
    });
    expect(first.openedPosition).toBe(false);

    const second = processPaperLifecycleTick(first.nextState, {
      markPrice: 102,
      entryOrder: {
        type: 'STOP_LIMIT',
        side: 'BUY',
        quantity: 1,
        stopPrice: 102,
        limitPrice: 100,
      },
      management: {},
    });
    expect(second.openedPosition).toBe(false);

    const third = processPaperLifecycleTick(second.nextState, {
      markPrice: 100,
      entryOrder: {
        type: 'STOP_LIMIT',
        side: 'BUY',
        quantity: 1,
        stopPrice: 102,
        limitPrice: 100,
      },
      management: {},
    });

    expect(third.openedPosition).toBe(true);
    expect(third.nextState.position?.averageEntryPrice).toBe(100);
  });

  it('applies DCA update and later closes with take-profit using simulator result', () => {
    const opened = processPaperLifecycleTick(emptyState(), {
      markPrice: 100,
      entryOrder: {
        type: 'MARKET',
        side: 'BUY',
        quantity: 2,
      },
      management: {
        takeProfitPrice: 104,
        dca: {
          enabled: true,
          maxAdds: 1,
          stepPercent: 0.05,
          addSizeFraction: 0.5,
        },
      },
    });

    const dcaTick = processPaperLifecycleTick(opened.nextState, {
      markPrice: 94,
      entryOrder: {
        type: 'MARKET',
        side: 'BUY',
        quantity: 2,
      },
      management: {
        takeProfitPrice: 104,
        dca: {
          enabled: true,
          maxAdds: 1,
          stepPercent: 0.05,
          addSizeFraction: 0.5,
        },
      },
    });

    expect(dcaTick.closedPosition).toBe(false);
    expect(dcaTick.nextState.position?.quantity).toBe(3);
    expect(dcaTick.nextState.position?.averageEntryPrice).toBe(98);

    const closeTick = processPaperLifecycleTick(dcaTick.nextState, {
      markPrice: 104,
      entryOrder: {
        type: 'MARKET',
        side: 'BUY',
        quantity: 2,
      },
      management: {
        takeProfitPrice: 104,
      },
      feeRate: 0.001,
      slippageRate: 0,
      fundingRate: 0,
    });

    expect(closeTick.closedPosition).toBe(true);
    expect(closeTick.closeReason).toBe('take_profit');
    expect(closeTick.nextState.position).toBeNull();
    expect(closeTick.tradeResult?.netPnl).toBeCloseTo(17.394, 4);
  });
});
