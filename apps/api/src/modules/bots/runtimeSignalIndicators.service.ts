export {
  clampPeriod,
  computeEmaSeriesFromCloses,
  computeMomentumSeriesFromCloses,
  computeRsiSeriesFromCloses,
} from '../engine/sharedIndicatorSeries';

export const formatIndicatorValue = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(4)).toString();
};
