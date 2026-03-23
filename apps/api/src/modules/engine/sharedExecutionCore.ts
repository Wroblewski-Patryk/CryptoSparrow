export type ExecutionSignalDirection = 'LONG' | 'SHORT' | 'EXIT';
export type ExecutionOrderSide = 'BUY' | 'SELL';
export type ExecutionPositionSide = 'LONG' | 'SHORT';
export type ExecutionManagementMode = 'BOT_MANAGED' | 'MANUAL_MANAGED';

export type ExistingExecutionPosition = {
  side: ExecutionPositionSide;
  quantity: number;
  managementMode: ExecutionManagementMode;
};

export type ExecutionDecision =
  | {
      kind: 'ignore';
      reason:
        | 'no_open_position'
        | 'no_flip_with_open_position'
        | 'already_open_same_side'
        | 'manual_managed_symbol';
    }
  | {
      kind: 'open';
      orderSide: ExecutionOrderSide;
      positionSide: ExecutionPositionSide;
    }
  | {
      kind: 'close';
      orderSide: ExecutionOrderSide;
    };

export const directionToOrderSide = (
  direction: Exclude<ExecutionSignalDirection, 'EXIT'>
): ExecutionOrderSide => (direction === 'LONG' ? 'BUY' : 'SELL');

export const orderSideToPositionSide = (orderSide: ExecutionOrderSide): ExecutionPositionSide =>
  orderSide === 'BUY' ? 'LONG' : 'SHORT';

export const directionToPositionSide = (
  direction: Exclude<ExecutionSignalDirection, 'EXIT'>
): ExecutionPositionSide => (direction === 'LONG' ? 'LONG' : 'SHORT');

export const positionSideToCloseOrderSide = (
  side: ExecutionPositionSide
): ExecutionOrderSide => (side === 'LONG' ? 'SELL' : 'BUY');

export const decideExecutionAction = (
  direction: ExecutionSignalDirection,
  openPosition: ExistingExecutionPosition | null
): ExecutionDecision => {
  if (direction === 'EXIT') {
    if (!openPosition) return { kind: 'ignore', reason: 'no_open_position' };
    if (openPosition.managementMode === 'MANUAL_MANAGED') {
      return { kind: 'ignore', reason: 'manual_managed_symbol' };
    }
    return {
      kind: 'close',
      orderSide: positionSideToCloseOrderSide(openPosition.side),
    };
  }

  if (openPosition) {
    if (openPosition.managementMode === 'MANUAL_MANAGED') {
      return { kind: 'ignore', reason: 'manual_managed_symbol' };
    }
    if (openPosition.side !== directionToPositionSide(direction)) {
      return { kind: 'ignore', reason: 'no_flip_with_open_position' };
    }
    return { kind: 'ignore', reason: 'already_open_same_side' };
  }

  return {
    kind: 'open',
    orderSide: directionToOrderSide(direction),
    positionSide: directionToPositionSide(direction),
  };
};
