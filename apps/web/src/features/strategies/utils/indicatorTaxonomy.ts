export type IndicatorGroupKey =
  | "TREND"
  | "MOMENTUM_OSCILLATOR"
  | "VOLATILITY"
  | "VOLUME"
  | "PRICE_ACTION"
  | "CANDLE_PATTERNS"
  | "DERIVATIVES";

const indicatorGroupOrder: IndicatorGroupKey[] = [
  "TREND",
  "MOMENTUM_OSCILLATOR",
  "VOLATILITY",
  "VOLUME",
  "PRICE_ACTION",
  "CANDLE_PATTERNS",
  "DERIVATIVES",
];

const groupLabels: Record<IndicatorGroupKey, { en: string; pl: string }> = {
  TREND: {
    en: "Trend",
    pl: "Trend",
  },
  MOMENTUM_OSCILLATOR: {
    en: "Momentum / Oscillators",
    pl: "Momentum / Oscylatory",
  },
  VOLATILITY: {
    en: "Volatility",
    pl: "Zmiennosc",
  },
  VOLUME: {
    en: "Volume",
    pl: "Wolumen",
  },
  PRICE_ACTION: {
    en: "Price Action",
    pl: "Price Action",
  },
  CANDLE_PATTERNS: {
    en: "Candle Patterns",
    pl: "Formacje swiecowe",
  },
  DERIVATIVES: {
    en: "Derivatives",
    pl: "Derywaty",
  },
};

const trendIndicators = new Set(["EMA", "SMA", "WMA", "MACD", "ADX"]);
const momentumIndicators = new Set([
  "RSI",
  "STOCHRSI",
  "STOCHASTIC",
  "ROC",
  "CCI",
  "MOMENTUM",
]);
const volatilityIndicators = new Set(["BOLLINGER_BANDS", "ATR", "DONCHIAN_CHANNELS"]);
const volumeIndicators = new Set(["OBV", "MFI", "VWAP"]);
const priceActionIndicators = new Set(["INSIDE_RANGE", "OUTSIDE_RANGE", "CHANNEL_BREAKOUT"]);
const candlePatternIndicators = new Set([
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

const resolveGroupByIndicatorName = (name: string): IndicatorGroupKey | null => {
  if (name.startsWith("FUNDING_RATE") || name.startsWith("OPEN_INTEREST") || name.startsWith("ORDER_BOOK")) {
    return "DERIVATIVES";
  }
  if (candlePatternIndicators.has(name)) return "CANDLE_PATTERNS";
  if (trendIndicators.has(name)) return "TREND";
  if (momentumIndicators.has(name)) return "MOMENTUM_OSCILLATOR";
  if (volatilityIndicators.has(name)) return "VOLATILITY";
  if (volumeIndicators.has(name)) return "VOLUME";
  if (priceActionIndicators.has(name)) return "PRICE_ACTION";
  return null;
};

const resolveGroupByLegacyName = (group: string): IndicatorGroupKey | null => {
  const normalized = group.trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized.includes("derivative")
    || normalized.includes("derywat")
    || normalized.includes("futures")
  ) return "DERIVATIVES";
  if (
    normalized.includes("candle")
    || normalized.includes("formacje")
    || normalized.includes("swiec")
    || normalized.includes("świec")
  ) return "CANDLE_PATTERNS";
  if (normalized.includes("momentum") || normalized.includes("oscillator") || normalized.includes("oscylator")) {
    return "MOMENTUM_OSCILLATOR";
  }
  if (normalized.includes("volatility") || normalized.includes("zmiennosc")) return "VOLATILITY";
  if (normalized.includes("volume") || normalized.includes("wolumen")) return "VOLUME";
  if (normalized.includes("price action")) return "PRICE_ACTION";
  if (normalized.includes("trend")) return "TREND";
  if (normalized.includes("analiza")) return "TREND";
  return null;
};

export const resolveIndicatorGroupKey = (input: { indicatorName: string; group?: string }): IndicatorGroupKey => {
  return (
    resolveGroupByIndicatorName(input.indicatorName)
    ?? (input.group ? resolveGroupByLegacyName(input.group) : null)
    ?? "TREND"
  );
};

export const getIndicatorGroupLabel = (group: IndicatorGroupKey, locale: "en" | "pl"): string => {
  return groupLabels[group][locale];
};

export const sortIndicatorGroups = (groups: IndicatorGroupKey[]): IndicatorGroupKey[] => {
  return [...groups].sort((left, right) => {
    const leftIndex = indicatorGroupOrder.indexOf(left);
    const rightIndex = indicatorGroupOrder.indexOf(right);
    return leftIndex - rightIndex;
  });
};
