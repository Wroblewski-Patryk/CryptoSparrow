import {
  PositionManagementInput,
  PositionManagementInputSchema,
  PositionManagementResult,
  PositionManagementState,
  PositionManagementStateSchema,
} from './positionManagement.types';

const round = (value: number) => Math.round(value * 100_000) / 100_000;

const isTakeProfitHit = (side: 'LONG' | 'SHORT', currentPrice: number, takeProfitPrice: number) => {
  return side === 'LONG' ? currentPrice >= takeProfitPrice : currentPrice <= takeProfitPrice;
};

const isStopLossHit = (side: 'LONG' | 'SHORT', currentPrice: number, stopLossPrice: number) => {
  return side === 'LONG' ? currentPrice <= stopLossPrice : currentPrice >= stopLossPrice;
};

const trailingStopTriggered = (
  side: 'LONG' | 'SHORT',
  type: 'percent' | 'absolute',
  value: number,
  currentPrice: number,
  anchorPrice: number
) => {
  const triggerPrice =
    type === 'percent'
      ? side === 'LONG'
        ? anchorPrice * (1 - value)
        : anchorPrice * (1 + value)
      : side === 'LONG'
      ? anchorPrice - value
      : anchorPrice + value;

  return side === 'LONG' ? currentPrice <= triggerPrice : currentPrice >= triggerPrice;
};

const updateTrailingAnchor = (side: 'LONG' | 'SHORT', currentPrice: number, currentAnchor: number) => {
  return side === 'LONG' ? Math.max(currentAnchor, currentPrice) : Math.min(currentAnchor, currentPrice);
};

const shouldDca = (
  side: 'LONG' | 'SHORT',
  currentPrice: number,
  referencePrice: number,
  stepPercent: number
) => {
  return side === 'LONG'
    ? currentPrice <= referencePrice * (1 - stepPercent)
    : currentPrice >= referencePrice * (1 + stepPercent);
};

export const evaluatePositionManagement = (
  input: PositionManagementInput,
  state: PositionManagementState
): PositionManagementResult => {
  const parsedInput = PositionManagementInputSchema.parse(input);
  const parsedState = PositionManagementStateSchema.parse(state);
  const nextState: PositionManagementState = { ...parsedState };

  if (
    typeof parsedInput.takeProfitPrice === 'number' &&
    isTakeProfitHit(parsedInput.side, parsedInput.currentPrice, parsedInput.takeProfitPrice)
  ) {
    return {
      shouldClose: true,
      closeReason: 'take_profit',
      dcaExecuted: false,
      dcaAddedQuantity: 0,
      nextState,
    };
  }

  if (
    typeof parsedInput.stopLossPrice === 'number' &&
    isStopLossHit(parsedInput.side, parsedInput.currentPrice, parsedInput.stopLossPrice)
  ) {
    return {
      shouldClose: true,
      closeReason: 'stop_loss',
      dcaExecuted: false,
      dcaAddedQuantity: 0,
      nextState,
    };
  }

  if (parsedInput.trailingStop?.enabled) {
    const anchor = updateTrailingAnchor(
      parsedInput.side,
      parsedInput.currentPrice,
      nextState.trailingAnchorPrice ?? nextState.averageEntryPrice
    );
    nextState.trailingAnchorPrice = anchor;

    if (
      trailingStopTriggered(
        parsedInput.side,
        parsedInput.trailingStop.type,
        parsedInput.trailingStop.value,
        parsedInput.currentPrice,
        anchor
      )
    ) {
      return {
        shouldClose: true,
        closeReason: 'trailing_stop',
        dcaExecuted: false,
        dcaAddedQuantity: 0,
        nextState,
      };
    }
  }

  if (parsedInput.dca?.enabled) {
    const canAdd = nextState.currentAdds < parsedInput.dca.maxAdds;
    const referencePrice = nextState.lastDcaPrice ?? nextState.averageEntryPrice;
    const trigger = shouldDca(
      parsedInput.side,
      parsedInput.currentPrice,
      referencePrice,
      parsedInput.dca.stepPercent
    );

    if (canAdd && trigger) {
      const addedQuantity = nextState.quantity * parsedInput.dca.addSizeFraction;
      const newQuantity = nextState.quantity + addedQuantity;
      const newAverage =
        (nextState.averageEntryPrice * nextState.quantity + parsedInput.currentPrice * addedQuantity) /
        newQuantity;

      nextState.quantity = round(newQuantity);
      nextState.averageEntryPrice = round(newAverage);
      nextState.currentAdds += 1;
      nextState.lastDcaPrice = parsedInput.currentPrice;

      return {
        shouldClose: false,
        dcaExecuted: true,
        dcaAddedQuantity: round(addedQuantity),
        nextState,
      };
    }
  }

  return {
    shouldClose: false,
    dcaExecuted: false,
    dcaAddedQuantity: 0,
    nextState,
  };
};
