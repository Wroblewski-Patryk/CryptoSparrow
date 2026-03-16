import { evaluateOrderExecution } from './orderTypes.service';
import { OrderEvaluationInput, OrderEvaluationState } from './orderTypes.types';
import { evaluatePositionManagement } from './positionManagement.service';
import { PositionManagementInput } from './positionManagement.types';
import { simulateTrade } from './simulator.service';
import { SimulatorResult } from './simulator.types';

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
};

export type PaperLifecycleInput = {
  markPrice: number;
  entryOrder: Omit<OrderEvaluationInput, 'markPrice'>;
  management: Omit<PositionManagementInput, 'side' | 'currentPrice'>;
  feeRate?: number;
  slippageRate?: number;
  fundingRate?: number;
};

export type PaperLifecycleTickResult = {
  nextState: PaperLifecycleState;
  openedPosition: boolean;
  closedPosition: boolean;
  closeReason?: 'take_profit' | 'stop_loss' | 'trailing_stop';
  tradeResult?: SimulatorResult;
};

const toPositionSide = (orderSide: 'BUY' | 'SELL'): 'LONG' | 'SHORT' =>
  orderSide === 'BUY' ? 'LONG' : 'SHORT';

const validateLifecycleInput = (input: PaperLifecycleInput) => {
  if (!Number.isFinite(input.markPrice) || input.markPrice <= 0) {
    throw new Error('Paper lifecycle requires a positive markPrice');
  }

  if (!Number.isFinite(input.entryOrder.quantity) || input.entryOrder.quantity <= 0) {
    throw new Error('Paper lifecycle requires a positive entry order quantity');
  }
};

export const processPaperLifecycleTick = (
  state: PaperLifecycleState,
  input: PaperLifecycleInput
): PaperLifecycleTickResult => {
  validateLifecycleInput(input);

  if (!state.position) {
    const entryEval = evaluateOrderExecution(
      {
        ...input.entryOrder,
        markPrice: input.markPrice,
      },
      state.orderState
    );

    if (!entryEval.shouldExecute) {
      return {
        nextState: { position: null, orderState: entryEval.nextState },
        openedPosition: false,
        closedPosition: false,
      };
    }

    const side = toPositionSide(input.entryOrder.side);
    return {
      nextState: {
        orderState: {},
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
    },
    openedPosition: false,
    closedPosition: true,
    closeReason: managementEval.closeReason,
    tradeResult,
  };
};
