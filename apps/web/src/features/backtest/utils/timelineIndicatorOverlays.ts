import { BacktestTimelineIndicatorSeries } from "../types/backtest.type";
import { normalizeUppercaseToken } from "@/lib/text";

type OscillatorOverlayPanel = {
  key: string;
  title: string;
  series: BacktestTimelineIndicatorSeries[];
};

type TimelineOverlaySplit = {
  priceSeries: BacktestTimelineIndicatorSeries[];
  oscillatorPanels: OscillatorOverlayPanel[];
  patternSeries: BacktestTimelineIndicatorSeries[];
};

const patternNames = new Set([
  "BULLISH_ENGULFING",
  "BEARISH_ENGULFING",
  "HAMMER",
  "SHOOTING_STAR",
  "DOJI",
  "MORNING_STAR",
  "EVENING_STAR",
  "INSIDE_BAR",
  "OUTSIDE_BAR",
]);

const isBooleanPatternPoints = (series: BacktestTimelineIndicatorSeries): boolean => {
  const numeric = series.points
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
  if (numeric.length === 0) return false;
  return numeric.every((value) => value === 0 || value === 1);
};

export const isPatternSeries = (series: BacktestTimelineIndicatorSeries): boolean => {
  return patternNames.has(normalizeUppercaseToken(series.name)) && isBooleanPatternPoints(series);
};

const resolveOscillatorOverlayGroupKey = (series: BacktestTimelineIndicatorSeries): string => {
  const key = normalizeUppercaseToken(series.key);
  if (/_LINE_|_SIGNAL_|_HISTOGRAM_/.test(key)) return key.replace(/_(LINE|SIGNAL|HISTOGRAM)_/, "_OVERLAY_");
  if (/_K_|_D_/.test(key)) return key.replace(/_(K|D)_/, "_OVERLAY_");
  if (/_ADX_|_DI_PLUS_|_DI_MINUS_/.test(key)) return key.replace(/_(ADX|DI_PLUS|DI_MINUS)_/, "_OVERLAY_");
  return key;
};

const resolveOscillatorOverlayTitle = (series: BacktestTimelineIndicatorSeries): string => {
  const name = series.name.trim();
  if (name.includes(" ")) {
    const [first] = name.split(" ");
    return first;
  }
  return name;
};

export const splitTimelineIndicatorSeriesForRendering = (
  input: BacktestTimelineIndicatorSeries[],
): TimelineOverlaySplit => {
  const priceSeries = input.filter((series) => series.panel === "price");
  const oscillatorSeries = input.filter((series) => series.panel === "oscillator");
  const patternSeries = oscillatorSeries.filter(isPatternSeries);
  const nonPatternOscillatorSeries = oscillatorSeries.filter((series) => !isPatternSeries(series));

  const grouped = new Map<string, OscillatorOverlayPanel>();
  for (const series of nonPatternOscillatorSeries) {
    const groupKey = resolveOscillatorOverlayGroupKey(series);
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.series.push(series);
      continue;
    }
    grouped.set(groupKey, {
      key: groupKey,
      title: resolveOscillatorOverlayTitle(series),
      series: [series],
    });
  }

  return {
    priceSeries,
    oscillatorPanels: [...grouped.values()],
    patternSeries,
  };
};

export const getPatternMarkerBias = (
  name: string,
): "bullish" | "bearish" | "neutral" => {
  const normalized = normalizeUppercaseToken(name);
  if (normalized === "BULLISH_ENGULFING" || normalized === "HAMMER" || normalized === "MORNING_STAR") {
    return "bullish";
  }
  if (normalized === "BEARISH_ENGULFING" || normalized === "SHOOTING_STAR" || normalized === "EVENING_STAR") {
    return "bearish";
  }
  return "neutral";
};
