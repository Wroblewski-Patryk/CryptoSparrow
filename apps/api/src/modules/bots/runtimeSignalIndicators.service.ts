export {
  computeAdxSeriesFromCandles,
  computeAtrSeriesFromCandles,
  computeBollingerSeriesFromCloses,
  computeCciSeriesFromCandles,
  computeDonchianSeriesFromCandles,
  clampPeriod,
  computeEmaSeriesFromCloses,
  computeMacdSeriesFromCloses,
  computeMomentumSeriesFromCloses,
  computeRocSeriesFromCloses,
  computeRsiSeriesFromCloses,
  computeSmaSeriesFromCloses,
  computeStochasticSeriesFromCandles,
  computeStochRsiSeriesFromCloses,
} from '../engine/sharedIndicatorSeries';
export { computeCandlePatternSeries, resolveCandlePatternName } from '../engine/sharedCandlePatternSeries';

export const formatIndicatorValue = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(4)).toString();
};
