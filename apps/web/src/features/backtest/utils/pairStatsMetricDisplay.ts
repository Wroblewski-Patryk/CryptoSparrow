type BuildPairStatsMetricDisplayInput = {
  visibleValue: number;
  totalValue: number;
  formatValue: (value: number) => string;
  differenceTolerance?: number;
};

type PairStatsMetricDisplay = {
  primary: string;
  chartWindow: string | null;
  hasChartWindowDelta: boolean;
};

const coerceFinite = (value: number, fallback: number) => {
  return Number.isFinite(value) ? value : fallback;
};

export const buildPairStatsMetricDisplay = ({
  visibleValue,
  totalValue,
  formatValue,
  differenceTolerance = 0,
}: BuildPairStatsMetricDisplayInput): PairStatsMetricDisplay => {
  const safeTotal = coerceFinite(totalValue, 0);
  const safeVisible = coerceFinite(visibleValue, safeTotal);
  const hasChartWindowDelta = Math.abs(safeVisible - safeTotal) > Math.max(0, differenceTolerance);

  return {
    primary: formatValue(safeTotal),
    chartWindow: hasChartWindowDelta ? formatValue(safeVisible) : null,
    hasChartWindowDelta,
  };
};

