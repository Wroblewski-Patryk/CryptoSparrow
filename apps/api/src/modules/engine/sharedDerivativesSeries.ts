export type TimedNumericPoint = {
  timestamp: number;
  value: number;
};

export const normalizeTimedNumericPoints = (
  points: TimedNumericPoint[],
): TimedNumericPoint[] => {
  const deduped = new Map<number, number>();
  for (const point of points) {
    if (!Number.isFinite(point.timestamp) || !Number.isFinite(point.value)) continue;
    deduped.set(Math.floor(point.timestamp), point.value);
  }

  return [...deduped.entries()]
    .map(([timestamp, value]) => ({ timestamp, value }))
    .sort((left, right) => left.timestamp - right.timestamp);
};

export const alignTimedNumericPointsToCandles = (
  candles: Array<{ openTime: number; closeTime: number }>,
  points: TimedNumericPoint[],
): Array<number | null> => {
  if (candles.length === 0) return [];
  const normalizedPoints = normalizeTimedNumericPoints(points);
  if (normalizedPoints.length === 0) {
    return Array.from({ length: candles.length }, () => null);
  }

  const output: Array<number | null> = [];
  let pointIndex = 0;
  let latestValue: number | null = null;

  for (const candle of candles) {
    const candleTime = Number.isFinite(candle.closeTime)
      ? candle.closeTime
      : candle.openTime;
    while (
      pointIndex < normalizedPoints.length &&
      normalizedPoints[pointIndex].timestamp <= candleTime
    ) {
      latestValue = normalizedPoints[pointIndex].value;
      pointIndex += 1;
    }
    output.push(latestValue);
  }

  return output;
};
