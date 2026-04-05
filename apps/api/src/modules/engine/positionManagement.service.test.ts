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

  it('closes on trailing take-profit after arm level and pullback', () => {
    const armed = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 106,
        trailingTakeProfit: {
          enabled: true,
          armPercent: 0.05,
          trailPercent: 0.02,
        },
      },
      {
        averageEntryPrice: 100,
        quantity: 1,
        currentAdds: 0,
      }
    );

    const closed = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 103.8,
        trailingTakeProfit: {
          enabled: true,
          armPercent: 0.05,
          trailPercent: 0.02,
        },
      },
      armed.nextState
    );

    expect(armed.shouldClose).toBe(false);
    expect(closed.shouldClose).toBe(true);
    expect(closed.closeReason).toBe('trailing_take_profit');
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

  it('evaluates next DCA level against updated average entry (not last dca price)', () => {
    const first = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 90,
        leverage: 1,
        dca: {
          enabled: true,
          maxAdds: 2,
          levelPercents: [-0.1, -0.1],
          addSizeFractions: [1, 1],
          stepPercent: 0.1,
          addSizeFraction: 1,
        },
      },
      {
        averageEntryPrice: 100,
        quantity: 1,
        currentAdds: 0,
      }
    );

    // After first add at 90 with multiplier 1x:
    // average entry becomes 95. Next -10% threshold from average is 85.5.
    // Price 84 should trigger second DCA by average-entry logic.
    const second = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 84,
        leverage: 1,
        dca: {
          enabled: true,
          maxAdds: 2,
          levelPercents: [-0.1, -0.1],
          addSizeFractions: [1, 1],
          stepPercent: 0.1,
          addSizeFraction: 1,
        },
      },
      first.nextState
    );

    expect(first.dcaExecuted).toBe(true);
    expect(first.nextState.averageEntryPrice).toBe(95);
    expect(second.dcaExecuted).toBe(true);
    expect(second.nextState.currentAdds).toBe(2);
  });

  it('applies DCA before TP in the same cycle (legacy order contract)', () => {
    const result = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 110,
        takeProfitPrice: 108,
        dca: {
          enabled: true,
          maxAdds: 1,
          levelPercents: [0.05],
          addSizeFractions: [0.5],
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

    expect(result.dcaExecuted).toBe(true);
    expect(result.dcaAddedQuantity).toBe(1);
    expect(result.nextState.currentAdds).toBe(1);
    expect(result.shouldClose).toBe(true);
    expect(result.closeReason).toBe('take_profit');
  });

  it('triggers trailing take-profit regardless of pending DCA levels', () => {
    const armed = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 120,
        leverage: 10,
        trailingTakeProfit: {
          enabled: true,
          armPercent: 0.05,
          trailPercent: 0.1,
        },
        dca: {
          enabled: true,
          maxAdds: 2,
          levelPercents: [-0.2, -0.2],
          addSizeFractions: [1, 1],
          stepPercent: 0.2,
          addSizeFraction: 1,
        },
      },
      {
        averageEntryPrice: 100,
        quantity: 1,
        currentAdds: 0,
      }
    );

    const closed = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 115,
        leverage: 10,
        trailingTakeProfit: {
          enabled: true,
          armPercent: 0.05,
          trailPercent: 0.1,
        },
        dca: {
          enabled: true,
          maxAdds: 2,
          levelPercents: [-0.2, -0.2],
          addSizeFractions: [1, 1],
          stepPercent: 0.2,
          addSizeFraction: 1,
        },
      },
      armed.nextState
    );

    expect(armed.shouldClose).toBe(false);
    expect(closed.shouldClose).toBe(true);
    expect(closed.closeReason).toBe('trailing_take_profit');
  });

  it('keeps trailing stop blocked until DCA sequence is completed (or funds exhausted)', () => {
    const armed = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 90,
        leverage: 10,
        trailingLoss: {
          enabled: true,
          startPercent: -0.25,
          stepPercent: 0.1,
        },
        dca: {
          enabled: true,
          maxAdds: 2,
          levelPercents: [-0.2, -0.2],
          addSizeFractions: [1, 1],
          stepPercent: 0.2,
          addSizeFraction: 1,
        },
      },
      {
        averageEntryPrice: 100,
        quantity: 1,
        currentAdds: 0,
      }
    );

    const closed = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 92,
        leverage: 10,
        trailingLoss: {
          enabled: true,
          startPercent: -0.25,
          stepPercent: 0.1,
        },
        dca: {
          enabled: true,
          maxAdds: 2,
          levelPercents: [-0.2, -0.2],
          addSizeFractions: [1, 1],
          stepPercent: 0.2,
          addSizeFraction: 1,
        },
      },
      armed.nextState
    );

    expect(closed.shouldClose).toBe(false);
    expect(closed.closeReason).toBeUndefined();
  });

  it('applies legacy trailing-loss on profit percent after DCA completion', () => {
    const activated = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 90,
        leverage: 10,
        trailingLoss: {
          enabled: true,
          startPercent: -0.25,
          stepPercent: 0.1,
        },
      },
      {
        averageEntryPrice: 100,
        quantity: 1,
        currentAdds: 1,
      }
    );

    const movedUp = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 96,
        leverage: 10,
        trailingLoss: {
          enabled: true,
          startPercent: -0.25,
          stepPercent: 0.1,
        },
      },
      activated.nextState
    );

    const closed = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 92,
        leverage: 10,
        trailingLoss: {
          enabled: true,
          startPercent: -0.25,
          stepPercent: 0.1,
        },
      },
      movedUp.nextState
    );

    expect(activated.nextState.trailingLossLimitPercent).toBeDefined();
    expect(closed.shouldClose).toBe(true);
    expect(closed.closeReason).toBe('trailing_stop');
  });

  it('clears trailing-loss tracker when TTP becomes active (legacy TTP/TSL exclusivity)', () => {
    const result = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 106,
        trailingTakeProfitLevels: [
          {
            armPercent: 0.05,
            trailPercent: 0.02,
          },
        ],
      },
      {
        averageEntryPrice: 100,
        quantity: 1,
        currentAdds: 0,
        trailingAnchorPrice: 106,
        trailingLossLimitPercent: -0.1,
      }
    );

    expect(result.shouldClose).toBe(false);
    expect(result.nextState.trailingLossLimitPercent).toBeUndefined();
  });

  it('keeps TTP armed once triggered and closes when favorable move drops below protected floor', () => {
    const armed = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 112,
        leverage: 1,
        trailingTakeProfitLevels: [
          {
            armPercent: 0.1,
            trailPercent: 0.05,
          },
        ],
      },
      {
        averageEntryPrice: 100,
        quantity: 1,
        currentAdds: 0,
      },
    );

    const droppedBelowTunnel = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 104,
        leverage: 1,
        trailingTakeProfitLevels: [
          {
            armPercent: 0.1,
            trailPercent: 0.05,
          },
        ],
      },
      armed.nextState,
    );

    expect(armed.shouldClose).toBe(false);
    expect(droppedBelowTunnel.shouldClose).toBe(true);
    expect(droppedBelowTunnel.closeReason).toBe('trailing_take_profit');
    expect(droppedBelowTunnel.nextState.trailingTakeProfitHighPercent).toBeCloseTo(0.12, 5);
    expect(droppedBelowTunnel.nextState.trailingTakeProfitStepPercent).toBeCloseTo(0.05, 5);
  });

  it('keeps TTP tunnel monotonic when switching to higher threshold with wider step', () => {
    const levels = [
      { armPercent: 0.1, trailPercent: 0.05 },
      { armPercent: 0.2, trailPercent: 0.1 },
    ];

    const at19 = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 119,
        leverage: 1,
        trailingTakeProfitLevels: levels,
      },
      {
        averageEntryPrice: 100,
        quantity: 1,
        currentAdds: 0,
      },
    );

    const at23 = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 123,
        leverage: 1,
        trailingTakeProfitLevels: levels,
      },
      at19.nextState,
    );

    const at25 = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 125,
        leverage: 1,
        trailingTakeProfitLevels: levels,
      },
      at23.nextState,
    );

    const closeAt14 = evaluatePositionManagement(
      {
        side: 'LONG',
        currentPrice: 114,
        leverage: 1,
        trailingTakeProfitLevels: levels,
      },
      at25.nextState,
    );

    expect(at23.shouldClose).toBe(false);
    expect(at23.nextState.trailingTakeProfitHighPercent).toBeCloseTo(0.19, 5);
    expect(at23.nextState.trailingTakeProfitStepPercent).toBeCloseTo(0.05, 5);
    expect(at25.nextState.trailingTakeProfitHighPercent).toBeCloseTo(0.25, 5);
    expect(at25.nextState.trailingTakeProfitStepPercent).toBeCloseTo(0.1, 5);
    expect(closeAt14.shouldClose).toBe(true);
    expect(closeAt14.closeReason).toBe('trailing_take_profit');
  });
});
