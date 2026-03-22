import { describe, expect, it } from 'vitest';
import { evaluatePositionManagement } from './positionManagement.service';

describe('position management', () => {
  it('closes position on take-profit hit', () => {
    const result = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 110,
        takeProfitPrice: 108,
      },
      {
        averageEntryPrice: 100,
        quantity: 1,
        currentAdds: 0,
      }
    );

    expect(result.shouldClose).toBe(true);
    expect(result.closeReason).toBe('take_profit');
  });

  it('closes position on stop-loss hit', () => {
    const result = evaluatePositionManagement(
      {
        side: 'SHORT',
        currentPrice: 106,
        stopLossPrice: 105,
      },
      {
        averageEntryPrice: 100,
        quantity: 1,
        currentAdds: 0,
      }
    );

    expect(result.shouldClose).toBe(true);
    expect(result.closeReason).toBe('stop_loss');
  });

  it('updates trailing anchor and closes when trailing threshold is crossed', () => {
    const first = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 110,
        trailingStop: {
          enabled: true,
          type: 'percent',
          value: 0.05,
        },
      },
      {
        averageEntryPrice: 100,
        quantity: 1,
        currentAdds: 0,
      }
    );

    const second = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 104,
        trailingStop: {
          enabled: true,
          type: 'percent',
          value: 0.05,
        },
      },
      first.nextState
    );

    expect(first.shouldClose).toBe(false);
    expect(first.nextState.trailingAnchorPrice).toBe(110);
    expect(second.shouldClose).toBe(true);
    expect(second.closeReason).toBe('trailing_stop');
  });

  it('executes DCA and recalculates quantity and average entry', () => {
    const result = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 94,
        dca: {
          enabled: true,
          maxAdds: 2,
          stepPercent: 0.05,
          addSizeFraction: 0.5,
        },
      },
      {
        averageEntryPrice: 100,
        quantity: 2,
        currentAdds: 0,
      }
    );

    expect(result.shouldClose).toBe(false);
    expect(result.dcaExecuted).toBe(true);
    expect(result.dcaAddedQuantity).toBe(1);
    expect(result.nextState.quantity).toBe(3);
    expect(result.nextState.averageEntryPrice).toBe(98);
    expect(result.nextState.currentAdds).toBe(1);
    expect(result.nextState.lastDcaPrice).toBe(94);
  });
});
