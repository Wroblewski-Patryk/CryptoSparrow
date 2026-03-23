import { evaluateOrderExecution } from './orderTypes.service';
import { OrderEvaluationInput, OrderEvaluationState } from './orderTypes.types';
import { evaluatePositionManagement } from './positionManagement.service';
import { PositionManagementInput } from './positionManagement.types';
import { simulateTrade } from './simulator.service';
import { SimulatorResult } from './simulator.types';
import { orderSideToPositionSide } from './sharedExecutionCore';

export type PaperPositionState = {
  side: 'LONG' | 'SHORT';
  averageEntryPrice: number;
  quantity: number;
  currentAdds: number;
  trailingAnchorPrice?: number;
  lastDcaPrice?: number;
};

export type PaperLifecycleState = {
  position: PaperPositionState | null;
  orderState: OrderEvaluationState;
  pendingEntry?: {
    side: 'LONG' | 'SHORT';
    targetQuantity: number;
    filledQuantity: number;
    averageEntryPrice: number;
    remainingLatencyTicks: number;
  } | null;
};

export type PaperLifecycleInput = {
  markPrice: number;
  entryOrder: Omit<OrderEvaluationInput, 'markPrice'>;
  management: Omit<PositionManagementInput, 'side' | 'currentPrice'>;
  entryLatencyTicks?: number;
  maxEntryFillFractionPerTick?: number;
  feeRate?: number;
  slippageRate?: number;
  fundingRate?: number;
};

export type PaperLifecycleTickResult = {
  nextState: PaperLifecycleState;
  openedPosition: boolean;
  closedPosition: boolean;
  partialEntryFill?: {
    filledQuantity: number;
    targetQuantity: number;
    remainingQuantity: number;
  };
  closeReason?: 'take_profit' | 'stop_loss' | 'trailing_stop';
  tradeResult?: SimulatorResult;
};

const validateLifecycleInput = (input: PaperLifecycleInput) => {
  if (!Number.isFinite(input.markPrice) || input.markPrice <= 0) {
    throw new Error('Paper lifecycle requires a positive markPrice');
  }

  if (!Number.isFinite(input.entryOrder.quantity) || input.entryOrder.quantity <= 0) {
    throw new Error('Paper lifecycle requires a positive entry order quantity');
  }
};

const clampFillFraction = (value: number | undefined) => {
  if (value == null) return 1;
  if (!Number.isFinite(value)) return 1;
  if (value <= 0) return 1;
  if (value > 1) return 1;
  return value;
};

const normalizeLatencyTicks = (value: number | undefined) => {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const nextAverageEntryPrice = (
  currentAverage: number,
  currentQuantity: number,
  newFillPrice: number,
  newFillQuantity: number
) => {
  const totalQuantity = currentQuantity + newFillQuantity;
  if (totalQuantity <= 0) return currentAverage;
  return (currentAverage * currentQuantity + newFillPrice * newFillQuantity) / totalQuantity;
};

export const processPaperLifecycleTick = (
  state: PaperLifecycleState,
  input: PaperLifecycleInput
): PaperLifecycleTickResult => {
  validateLifecycleInput(input);
  const pendingEntry = state.pendingEntry ?? null;
  const fillFraction = clampFillFraction(input.maxEntryFillFractionPerTick);

  if (!state.position) {
    if (pendingEntry) {
      if (pendingEntry.remainingLatencyTicks > 0) {
        return {
          nextState: {
            position: null,
            orderState: state.orderState,
            pendingEntry: {
              ...pendingEntry,
              remainingLatencyTicks: pendingEntry.remainingLatencyTicks - 1,
            },
          },
          openedPosition: false,
          closedPosition: false,
        };
      }

      const fillQuantity = Math.min(
        pendingEntry.targetQuantity - pendingEntry.filledQuantity,
        pendingEntry.targetQuantity * fillFraction
      );
      const filledQuantity = pendingEntry.filledQuantity + fillQuantity;
      const averageEntryPrice = nextAverageEntryPrice(
        pendingEntry.averageEntryPrice,
        pendingEntry.filledQuantity,
        input.markPrice,
        fillQuantity
      );

      if (filledQuantity >= pendingEntry.targetQuantity) {
        return {
          nextState: {
            orderState: {},
            pendingEntry: null,
            position: {
              side: pendingEntry.side,
              averageEntryPrice,
              quantity: pendingEntry.targetQuantity,
              currentAdds: 0,
            },
          },
          openedPosition: true,
          closedPosition: false,
        };
      }

      return {
        nextState: {
          position: null,
          orderState: state.orderState,
          pendingEntry: {
            ...pendingEntry,
            filledQuantity,
            averageEntryPrice,
          },
        },
        openedPosition: false,
        closedPosition: false,
        partialEntryFill: {
          filledQuantity,
          targetQuantity: pendingEntry.targetQuantity,
          remainingQuantity: pendingEntry.targetQuantity - filledQuantity,
        },
      };
    }

    const entryEval = evaluateOrderExecution(
      {
        ...input.entryOrder,
        markPrice: input.markPrice,
      },
      state.orderState
    );

    if (!entryEval.shouldExecute) {
      return {
        nextState: { position: null, orderState: entryEval.nextState, pendingEntry: null },
        openedPosition: false,
        closedPosition: false,
      };
    }

    const side = orderSideToPositionSide(input.entryOrder.side);
    const latencyTicks = normalizeLatencyTicks(input.entryLatencyTicks);
    const initialFillQuantity = Math.min(input.entryOrder.quantity, input.entryOrder.quantity * fillFraction);
    const pending = {
      side,
      targetQuantity: input.entryOrder.quantity,
      filledQuantity: initialFillQuantity,
      averageEntryPrice: input.markPrice,
      remainingLatencyTicks: latencyTicks,
    };

    if (pending.filledQuantity < pending.targetQuantity || pending.remainingLatencyTicks > 0) {
      return {
        nextState: {
          orderState: entryEval.nextState,
          position: null,
          pendingEntry: pending,
        },
        openedPosition: false,
        closedPosition: false,
        partialEntryFill: {
          filledQuantity: pending.filledQuantity,
          targetQuantity: pending.targetQuantity,
          remainingQuantity: pending.targetQuantity - pending.filledQuantity,
        },
      };
    }

    return {
      nextState: {
        orderState: {},
        pendingEntry: null,
        position: {
          side,
          averageEntryPrice: input.markPrice,
          quantity: input.entryOrder.quantity,
          currentAdds: 0,
        },
      },
      openedPosition: true,
      closedPosition: false,
    };
  }

  const managementEval = evaluatePositionManagement(
    {
      ...input.management,
      side: state.position.side,
      currentPrice: input.markPrice,
    },
    {
      averageEntryPrice: state.position.averageEntryPrice,
      quantity: state.position.quantity,
      currentAdds: state.position.currentAdds,
      trailingAnchorPrice: state.position.trailingAnchorPrice,
      lastDcaPrice: state.position.lastDcaPrice,
    }
  );

  if (!managementEval.shouldClose) {
    return {
      nextState: {
        orderState: state.orderState,
        pendingEntry: null,
        position: {
          side: state.position.side,
          averageEntryPrice: managementEval.nextState.averageEntryPrice,
          quantity: managementEval.nextState.quantity,
          currentAdds: managementEval.nextState.currentAdds,
          trailingAnchorPrice: managementEval.nextState.trailingAnchorPrice,
          lastDcaPrice: managementEval.nextState.lastDcaPrice,
        },
      },
      openedPosition: false,
      closedPosition: false,
    };
  }

  const tradeResult = simulateTrade({
    side: state.position.side,
    entryPrice: state.position.averageEntryPrice,
    exitPrice: input.markPrice,
    quantity: state.position.quantity,
    feeRate: input.feeRate ?? 0,
    slippageRate: input.slippageRate ?? 0,
    fundingRate: input.fundingRate ?? 0,
  });

  return {
    nextState: {
      position: null,
      orderState: state.orderState,
      pendingEntry: null,
    },
    openedPosition: false,
    closedPosition: true,
    closeReason: managementEval.closeReason,
    tradeResult,
  };
};
