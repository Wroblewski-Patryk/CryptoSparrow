import { PositionManagementState } from '../engine/positionManagement.types';

export type TrailingStopDisplayLevel = {
  armPercent: number;
  trailPercent: number;
};

export type TrailingTakeProfitDisplayLevel = {
  armPercent: number;
  trailPercent: number;
};

const FAVORABLE_MOVE_FALLBACK_TTL_MS = 6 * 60 * 60 * 1000;
const favorableMoveFallbackHighByPositionId = new Map<
  string,
  { highPercent: number; lastSeenAt: number }
>();

const computePriceFromLeveragedMovePercent = (
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  movePercent: number,
  leverage: number
) => {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  if (!Number.isFinite(movePercent)) return null;
  const effectiveLeverage = Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
  const delta = movePercent / effectiveLeverage;
  const raw =
    side === 'LONG' ? entryPrice * (1 + delta) : entryPrice * (1 - delta);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw;
};

export const cleanupStaleRuntimePositionSerializationState = (nowTs: number) => {
  for (const [positionId, state] of favorableMoveFallbackHighByPositionId.entries()) {
    if (nowTs - state.lastSeenAt > FAVORABLE_MOVE_FALLBACK_TTL_MS) {
      favorableMoveFallbackHighByPositionId.delete(positionId);
    }
  }
};

const resolveStickyFavorableMovePercent = (params: {
  positionId: string;
  favorableMovePercent: number | null;
  isOpen: boolean;
  nowTs: number;
}) => {
  const { positionId, favorableMovePercent, isOpen, nowTs } = params;
  const existing = favorableMoveFallbackHighByPositionId.get(positionId);
  const hasCurrent =
    favorableMovePercent != null &&
    Number.isFinite(favorableMovePercent);

  const nextHigh =
    hasCurrent && existing
      ? Math.max(existing.highPercent, favorableMovePercent as number)
      : hasCurrent
        ? (favorableMovePercent as number)
        : existing?.highPercent ?? null;

  if (isOpen && nextHigh != null && Number.isFinite(nextHigh)) {
    favorableMoveFallbackHighByPositionId.set(positionId, {
      highPercent: nextHigh,
      lastSeenAt: nowTs,
    });
  } else if (!isOpen && existing) {
    favorableMoveFallbackHighByPositionId.delete(positionId);
  } else if (existing) {
    existing.lastSeenAt = nowTs;
  }

  return nextHigh;
};

const selectActiveTrailingStopDisplayLevel = (
  favorableMovePercent: number | null,
  levels: TrailingStopDisplayLevel[]
) => {
  if (favorableMovePercent == null || !Number.isFinite(favorableMovePercent)) return null;
  let active: TrailingStopDisplayLevel | null = null;
  for (const level of levels) {
    if (favorableMovePercent >= level.armPercent) active = level;
  }
  return active;
};

const selectActiveTrailingTakeProfitDisplayLevel = (
  favorableMovePercent: number | null,
  levels: TrailingTakeProfitDisplayLevel[]
) => {
  if (favorableMovePercent == null || !Number.isFinite(favorableMovePercent)) return null;
  let active: TrailingTakeProfitDisplayLevel | null = null;
  for (const level of levels) {
    if (favorableMovePercent > level.armPercent) active = level;
  }
  return active;
};

export const resolveDcaExecutedLevels = (
  dcaCount: number,
  dcaPlannedLevels: number[]
) => {
  if (dcaCount <= dcaPlannedLevels.length) {
    return dcaPlannedLevels.slice(0, dcaCount);
  }

  if (dcaPlannedLevels.length === 0) return [];
  return [
    ...dcaPlannedLevels,
    ...Array.from(
      { length: dcaCount - dcaPlannedLevels.length },
      () => dcaPlannedLevels[dcaPlannedLevels.length - 1]
    ),
  ];
};

type ResolveRuntimePositionDynamicStopsParams = {
  positionId: string;
  positionStatus: string;
  positionSide: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  leverage: number;
  unrealizedPnl: number | null | undefined;
  marketPrice: number | null | undefined;
  stateEntryPrice: number;
  runtimeState: PositionManagementState | null;
  trailingStopLevels: TrailingStopDisplayLevel[];
  trailingTakeProfitLevels: TrailingTakeProfitDisplayLevel[];
  nowTs: number;
};

export const resolveRuntimePositionDynamicStops = (
  params: ResolveRuntimePositionDynamicStopsParams
) => {
  const {
    positionId,
    positionStatus,
    positionSide,
    entryPrice,
    quantity,
    leverage,
    unrealizedPnl,
    marketPrice,
    stateEntryPrice,
    runtimeState,
    trailingStopLevels,
    trailingTakeProfitLevels,
    nowTs,
  } = params;

  const effectiveLeverage =
    Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
  const ttpTriggerPercentFromState =
    runtimeState &&
    Number.isFinite(runtimeState.trailingTakeProfitHighPercent) &&
    Number.isFinite(runtimeState.trailingTakeProfitStepPercent)
      ? (runtimeState.trailingTakeProfitHighPercent as number) -
        (runtimeState.trailingTakeProfitStepPercent as number)
      : null;
  const hasRuntimeTtpState = ttpTriggerPercentFromState != null;
  const hasRuntimeTslState =
    runtimeState && Number.isFinite(runtimeState.trailingLossLimitPercent);
  const liveUnrealizedPnlFromPrice =
    typeof marketPrice === 'number' && Number.isFinite(marketPrice)
      ? (marketPrice - entryPrice) * quantity * (positionSide === 'LONG' ? 1 : -1)
      : null;
  const marginUsed = entryPrice > 0 ? (entryPrice * quantity) / effectiveLeverage : null;
  const favorableMovePercentFromLivePrice =
    typeof marketPrice === 'number' && Number.isFinite(marketPrice) && stateEntryPrice > 0
      ? positionSide === 'LONG'
        ? ((marketPrice - stateEntryPrice) / stateEntryPrice) * effectiveLeverage
        : ((stateEntryPrice - marketPrice) / stateEntryPrice) * effectiveLeverage
      : typeof liveUnrealizedPnlFromPrice === 'number' &&
          Number.isFinite(liveUnrealizedPnlFromPrice) &&
          marginUsed != null &&
          Number.isFinite(marginUsed) &&
          marginUsed > 0
        ? liveUnrealizedPnlFromPrice / marginUsed
        : typeof unrealizedPnl === 'number' &&
            Number.isFinite(unrealizedPnl) &&
            marginUsed != null &&
            Number.isFinite(marginUsed) &&
            marginUsed > 0
          ? unrealizedPnl / marginUsed
          : null;
  const favorableMovePercentFromRuntimeState =
    runtimeState && Number.isFinite(runtimeState.trailingTakeProfitHighPercent)
      ? (runtimeState.trailingTakeProfitHighPercent as number)
      : null;
  const favorableMovePercentForStickyHigh =
    favorableMovePercentFromRuntimeState != null &&
    Number.isFinite(favorableMovePercentFromRuntimeState)
      ? favorableMovePercentFromLivePrice != null &&
          Number.isFinite(favorableMovePercentFromLivePrice)
        ? Math.max(favorableMovePercentFromRuntimeState, favorableMovePercentFromLivePrice)
        : favorableMovePercentFromRuntimeState
      : favorableMovePercentFromLivePrice;
  const stickyFavorableMovePercent = resolveStickyFavorableMovePercent({
    positionId,
    favorableMovePercent: favorableMovePercentForStickyHigh,
    isOpen: positionStatus === 'OPEN',
    nowTs,
  });
  const fallbackTtpLevel =
    !hasRuntimeTtpState
      ? selectActiveTrailingTakeProfitDisplayLevel(
          stickyFavorableMovePercent,
          trailingTakeProfitLevels
        )
      : null;
  const ttpTriggerPercentFromStrategyFallback =
    fallbackTtpLevel &&
    stickyFavorableMovePercent != null &&
    Number.isFinite(stickyFavorableMovePercent)
      ? stickyFavorableMovePercent - fallbackTtpLevel.trailPercent
      : null;
  const ttpTriggerPercent =
    ttpTriggerPercentFromState != null && ttpTriggerPercentFromState > 0
      ? ttpTriggerPercentFromState
      : ttpTriggerPercentFromStrategyFallback != null &&
          Number.isFinite(ttpTriggerPercentFromStrategyFallback) &&
          ttpTriggerPercentFromStrategyFallback > 0
        ? ttpTriggerPercentFromStrategyFallback
        : null;
  const fallbackTslLevel =
    !hasRuntimeTslState && !hasRuntimeTtpState
      ? selectActiveTrailingStopDisplayLevel(
          stickyFavorableMovePercent,
          trailingStopLevels
        )
      : null;
  const tslTriggerPercentFromStrategyFallback =
    fallbackTslLevel &&
    stickyFavorableMovePercent != null &&
    Number.isFinite(stickyFavorableMovePercent)
      ? stickyFavorableMovePercent - fallbackTslLevel.trailPercent
      : null;
  const tslTriggerPercent =
    hasRuntimeTslState
      ? (runtimeState.trailingLossLimitPercent as number)
      : tslTriggerPercentFromStrategyFallback != null &&
          Number.isFinite(tslTriggerPercentFromStrategyFallback)
        ? tslTriggerPercentFromStrategyFallback
        : null;
  const dynamicTtpStopLoss =
    ttpTriggerPercent != null
      ? computePriceFromLeveragedMovePercent(
          positionSide,
          stateEntryPrice,
          ttpTriggerPercent,
          leverage
        )
      : null;
  const dynamicTslStopLoss =
    tslTriggerPercent != null
      ? computePriceFromLeveragedMovePercent(
          positionSide,
          stateEntryPrice,
          tslTriggerPercent,
          effectiveLeverage
        )
      : null;
  const liveUnrealizedPnl =
    typeof liveUnrealizedPnlFromPrice === 'number' && Number.isFinite(liveUnrealizedPnlFromPrice)
      ? liveUnrealizedPnlFromPrice
      : null;

  return {
    dynamicTtpStopLoss,
    dynamicTslStopLoss,
    liveUnrealizedPnl,
  };
};
