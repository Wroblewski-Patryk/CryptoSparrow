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
  triggerPercent: number,
  leverage: number,
) => {
  const rawMove =
    side === 'LONG'
      ? (currentPrice - referencePrice) / Math.max(referencePrice, 1e-8)
      : (referencePrice - currentPrice) / Math.max(referencePrice, 1e-8);
  const leveragedMove = rawMove * Math.max(1, leverage);
  if (triggerPercent >= 0) {
    return leveragedMove >= triggerPercent;
  }
  return leveragedMove <= triggerPercent;
};

const normalizeTrailingTakeProfitLevels = (
  levels: Array<{ armPercent: number; trailPercent: number }>,
) => {
  if (!Array.isArray(levels) || levels.length === 0) return [];
  return [...levels]
    .filter(
      (level) =>
        Number.isFinite(level.armPercent) &&
        Number.isFinite(level.trailPercent) &&
        level.armPercent > 0 &&
        level.trailPercent > 0,
    )
    .sort((left, right) => left.armPercent - right.armPercent);
};

const selectDynamicTrailingTakeProfit = (
  favorableMove: number,
  levels: Array<{ armPercent: number; trailPercent: number }>,
) => {
  if (!Array.isArray(levels) || levels.length === 0) return null;
  let selected = levels[0];
  for (const level of levels) {
    if (favorableMove >= level.armPercent) {
      selected = level;
      continue;
    }
    break;
  }
  return selected;
};

const selectActiveTrailingStop = (
  favorableMove: number,
  levels: Array<{ armPercent: number; type: 'percent' | 'absolute'; value: number }>
) => {
  if (!Array.isArray(levels) || levels.length === 0) return null;
  const sorted = [...levels]
    .filter(
      (level) =>
        Number.isFinite(level.armPercent) &&
        Number.isFinite(level.value) &&
        level.value > 0 &&
        (level.type === 'percent' || level.type === 'absolute')
    )
    .sort((left, right) => left.armPercent - right.armPercent);
  let active: { armPercent: number; type: 'percent' | 'absolute'; value: number } | null = null;
  for (const level of sorted) {
    if (favorableMove >= level.armPercent) active = level;
  }
  return active;
};

export const evaluatePositionManagement = (
  input: PositionManagementInput,
  state: PositionManagementState
): PositionManagementResult => {
  const parsedInput = PositionManagementInputSchema.parse(input);
  const parsedState = PositionManagementStateSchema.parse(state);
  const nextState: PositionManagementState = { ...parsedState };
  let dcaExecuted = false;
  let dcaAddedQuantity = 0;
  const effectiveLeverage = Math.max(1, parsedInput.leverage);
  const dcaEnabled = Boolean(parsedInput.dca?.enabled);
  const dcaLevels =
    dcaEnabled && Array.isArray(parsedInput.dca?.levelPercents) && parsedInput.dca.levelPercents.length > 0
      ? parsedInput.dca.levelPercents
      : dcaEnabled
        ? Array.from({ length: parsedInput.dca?.maxAdds ?? 0 }, () => -(parsedInput.dca?.stepPercent ?? 0.01))
        : [];
  const dcaAddFractions =
    dcaEnabled && Array.isArray(parsedInput.dca?.addSizeFractions) && parsedInput.dca.addSizeFractions.length > 0
      ? parsedInput.dca.addSizeFractions
      : dcaEnabled
        ? Array.from({ length: parsedInput.dca?.maxAdds ?? 0 }, () => parsedInput.dca?.addSizeFraction ?? 0.5)
        : [];
  const dcaLevelsRequired = dcaLevels.length;

  // Legacy parity order: DCA -> TP -> TTP -> SL -> TSL.
  if (dcaEnabled && nextState.currentAdds < dcaLevelsRequired) {
    // DCA levels are evaluated against current average entry.
    // This keeps repeated levels (e.g. -30, -30, -30) meaningful after each add.
    const referencePrice = nextState.averageEntryPrice;
    const nextLevelPercent = dcaLevels[nextState.currentAdds] ?? -(parsedInput.dca?.stepPercent ?? 0.01);
    const trigger = shouldDca(
      parsedInput.side,
      parsedInput.currentPrice,
      referencePrice,
      nextLevelPercent,
      effectiveLeverage
    );

    if (trigger) {
      const nextAddSizeFraction =
        dcaAddFractions[nextState.currentAdds] ?? parsedInput.dca?.addSizeFraction ?? 0.5;
      const addedQuantity = nextState.quantity * nextAddSizeFraction;
      const newQuantity = nextState.quantity + addedQuantity;
      const newAverage =
        (nextState.averageEntryPrice * nextState.quantity + parsedInput.currentPrice * addedQuantity) /
        newQuantity;

      nextState.quantity = round(newQuantity);
      nextState.averageEntryPrice = round(newAverage);
      nextState.currentAdds += 1;
      nextState.lastDcaPrice = parsedInput.currentPrice;
      dcaExecuted = true;
      dcaAddedQuantity = round(addedQuantity);
    }
  }

  const dcaSequenceCompleted = !dcaEnabled || dcaLevelsRequired === 0 || nextState.currentAdds >= dcaLevelsRequired;
  const dcaProtectionSatisfied = dcaSequenceCompleted || parsedInput.dcaFundsExhausted === true;

  if (
    typeof parsedInput.takeProfitPrice === 'number' &&
    isTakeProfitHit(parsedInput.side, parsedInput.currentPrice, parsedInput.takeProfitPrice)
  ) {
    return {
      shouldClose: true,
      closeReason: 'take_profit',
      dcaExecuted,
      dcaAddedQuantity,
      nextState,
    };
  }

  if (
    parsedInput.trailingStop?.enabled ||
    parsedInput.trailingTakeProfit?.enabled ||
    (Array.isArray(parsedInput.trailingTakeProfitLevels) && parsedInput.trailingTakeProfitLevels.length > 0) ||
    (Array.isArray(parsedInput.trailingStopLevels) && parsedInput.trailingStopLevels.length > 0)
  ) {
    const anchor = updateTrailingAnchor(
      parsedInput.side,
      parsedInput.currentPrice,
      nextState.trailingAnchorPrice ?? nextState.averageEntryPrice
    );
    nextState.trailingAnchorPrice = anchor;
  }

  const anchor = nextState.trailingAnchorPrice ?? nextState.averageEntryPrice;
  const favorableMove =
    parsedInput.side === 'LONG'
      ? ((parsedInput.currentPrice - nextState.averageEntryPrice) / Math.max(nextState.averageEntryPrice, 1e-8)) * effectiveLeverage
      : ((nextState.averageEntryPrice - parsedInput.currentPrice) / Math.max(nextState.averageEntryPrice, 1e-8)) * effectiveLeverage;
  const trailingTakeProfitLevels = normalizeTrailingTakeProfitLevels(
    parsedInput.trailingTakeProfitLevels ??
      (parsedInput.trailingTakeProfit?.enabled
        ? [
            {
              armPercent: parsedInput.trailingTakeProfit.armPercent,
              trailPercent: parsedInput.trailingTakeProfit.trailPercent,
            },
          ]
        : []),
  );
  const ttpConfigured = trailingTakeProfitLevels.length > 0;
  const dynamicTtpLevel = ttpConfigured
    ? selectDynamicTrailingTakeProfit(favorableMove, trailingTakeProfitLevels)
    : null;

  if (ttpConfigured) {
    if (
      dynamicTtpLevel &&
      typeof nextState.trailingTakeProfitHighPercent !== 'number' &&
      favorableMove >= dynamicTtpLevel.armPercent
    ) {
      nextState.trailingTakeProfitHighPercent = favorableMove;
      nextState.trailingTakeProfitStepPercent = dynamicTtpLevel.trailPercent;
    }

    const trackedHigh = nextState.trailingTakeProfitHighPercent;
    const trackedStep = nextState.trailingTakeProfitStepPercent;
    if (
      dynamicTtpLevel &&
      typeof trackedHigh === 'number' &&
      typeof trackedStep === 'number' &&
      favorableMove - dynamicTtpLevel.trailPercent > trackedHigh - trackedStep
    ) {
      nextState.trailingTakeProfitHighPercent = favorableMove;
      nextState.trailingTakeProfitStepPercent = dynamicTtpLevel.trailPercent;
    }

    const finalTrackedHigh = nextState.trailingTakeProfitHighPercent;
    const finalTrackedStep = nextState.trailingTakeProfitStepPercent;
    if (
      typeof finalTrackedHigh === 'number' &&
      typeof finalTrackedStep === 'number' &&
      favorableMove <= finalTrackedHigh - finalTrackedStep
    ) {
      return {
        shouldClose: true,
        closeReason: 'trailing_take_profit',
        dcaExecuted,
        dcaAddedQuantity,
        nextState,
      };
    }
  } else {
    nextState.trailingTakeProfitHighPercent = undefined;
    nextState.trailingTakeProfitStepPercent = undefined;
  }

  const ttpTrackingActive =
    typeof nextState.trailingTakeProfitHighPercent === 'number' &&
    typeof nextState.trailingTakeProfitStepPercent === 'number';
  if (ttpTrackingActive && typeof nextState.trailingLossLimitPercent === 'number') {
    nextState.trailingLossLimitPercent = undefined;
  }

  if (
    dcaProtectionSatisfied &&
    typeof parsedInput.stopLossPrice === 'number' &&
    isStopLossHit(parsedInput.side, parsedInput.currentPrice, parsedInput.stopLossPrice)
  ) {
    return {
      shouldClose: true,
      closeReason: 'stop_loss',
      dcaExecuted,
      dcaAddedQuantity,
      nextState,
    };
  }

  if (dcaProtectionSatisfied && !ttpTrackingActive) {
    if (parsedInput.trailingLoss?.enabled) {
      const start = parsedInput.trailingLoss.startPercent;
      const step = parsedInput.trailingLoss.stepPercent;
      const currentLimit = nextState.trailingLossLimitPercent;

      if (typeof currentLimit !== 'number') {
        if (favorableMove <= start) {
          nextState.trailingLossLimitPercent = start - step;
        }
      } else {
        if (favorableMove > currentLimit + step) {
          nextState.trailingLossLimitPercent = favorableMove - step;
        }
        if (favorableMove < (nextState.trailingLossLimitPercent ?? currentLimit)) {
          return {
            shouldClose: true,
            closeReason: 'trailing_stop',
            dcaExecuted,
            dcaAddedQuantity,
            nextState,
          };
        }
      }
    }

    const activeTslLevel =
      selectActiveTrailingStop(
        favorableMove,
        parsedInput.trailingStopLevels ?? []
      ) ??
      (parsedInput.trailingStop?.enabled &&
      favorableMove >= (parsedInput.trailingStop.armPercent ?? 0)
        ? parsedInput.trailingStop
        : null);

    if (
      activeTslLevel &&
      trailingStopTriggered(
        parsedInput.side,
        activeTslLevel.type,
        activeTslLevel.value,
        parsedInput.currentPrice,
        anchor
      )
    ) {
      return {
        shouldClose: true,
        closeReason: 'trailing_stop',
        dcaExecuted,
        dcaAddedQuantity,
        nextState,
      };
    }
  }

  return {
    shouldClose: false,
    dcaExecuted,
    dcaAddedQuantity,
    nextState,
  };
};
