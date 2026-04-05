type TrailingPercentLevel = {
  armPercent: number;
  trailPercent: number;
};

const normalizeLevels = (levels?: TrailingPercentLevel[] | null) =>
  (levels ?? [])
    .filter(
      (level) =>
        Number.isFinite(level.armPercent) &&
        Number.isFinite(level.trailPercent) &&
        level.armPercent > 0 &&
        level.trailPercent > 0
    )
    .sort((left, right) => left.armPercent - right.armPercent);

const selectActiveLevel = (favorableMovePercent: number, levels: TrailingPercentLevel[]) => {
  let active: TrailingPercentLevel | null = null;
  for (const level of levels) {
    if (favorableMovePercent >= level.armPercent) active = level;
  }
  return active;
};

export const toProtectedPnlPercentFromStopPrice = (params: {
  side: "LONG" | "SHORT";
  entryPrice: number;
  leverage: number;
  stopPrice: number | null | undefined;
}) => {
  const { side, entryPrice, leverage, stopPrice } = params;
  if (stopPrice == null || !Number.isFinite(stopPrice) || stopPrice <= 0) return null;
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  const effectiveLeverage = Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
  const spotMove =
    side === "LONG" ? (stopPrice - entryPrice) / entryPrice : (entryPrice - stopPrice) / entryPrice;
  const leveragedMovePercent = spotMove * effectiveLeverage * 100;
  if (!Number.isFinite(leveragedMovePercent)) return null;
  return leveragedMovePercent;
};

export const pruneStickyFavorableMoveMap = (
  stickyFavorableMoveByPosition: Map<string, number>,
  activePositionIds: Set<string>
) => {
  for (const positionId of stickyFavorableMoveByPosition.keys()) {
    if (!activePositionIds.has(positionId)) {
      stickyFavorableMoveByPosition.delete(positionId);
    }
  }
};

export const resolveFallbackTtpProtectedPercent = (params: {
  positionId: string;
  livePnlPercent: number | null | undefined;
  trailingTakeProfitLevels?: TrailingPercentLevel[] | null;
  stickyFavorableMoveByPosition: Map<string, number>;
}) => {
  const levels = normalizeLevels(params.trailingTakeProfitLevels);
  if (levels.length === 0) return null;

  const favorableMovePercent =
    typeof params.livePnlPercent === "number" && Number.isFinite(params.livePnlPercent)
      ? params.livePnlPercent
      : null;
  const previousHigh = params.stickyFavorableMoveByPosition.get(params.positionId) ?? null;
  const stickyHigh =
    favorableMovePercent == null
      ? previousHigh
      : previousHigh == null
        ? favorableMovePercent
        : Math.max(previousHigh, favorableMovePercent);

  if (stickyHigh == null || !Number.isFinite(stickyHigh)) return null;
  params.stickyFavorableMoveByPosition.set(params.positionId, stickyHigh);

  const activeLevel = selectActiveLevel(stickyHigh, levels);
  if (!activeLevel) return null;

  const protectedPercent = stickyHigh - activeLevel.trailPercent;
  if (!Number.isFinite(protectedPercent) || protectedPercent <= 0) return null;
  return protectedPercent;
};
