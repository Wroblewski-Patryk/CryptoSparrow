import { normalizeUppercaseToken } from "@/lib/text";

const indicatorLabels: Record<string, { en: string; pl: string }> = {
  EMA: { en: "EMA(Exponential Moving Average)", pl: "EMA(wykladnicza srednia kroczaca)" },
  SMA: { en: "SMA(Simple Moving Average)", pl: "SMA(prosta srednia kroczaca)" },
  RSI: { en: "RSI(Relative Strength Index)", pl: "RSI(wzgledna sila)" },
  MOMENTUM: { en: "Momentum", pl: "Momentum" },
  MACD: { en: "MACD(Moving Average Convergence Divergence)", pl: "MACD(zbieznosc i rozbieznosc srednich)" },
  ROC: { en: "ROC(Rate of Change)", pl: "ROC(tempo zmiany)" },
  STOCHRSI: { en: "StochRSI(Stochastic RSI)", pl: "StochRSI(stochastyczny RSI)" },
  BOLLINGER_BANDS: { en: "Bollinger Bands", pl: "Wstegi Bollingera" },
  ATR: { en: "ATR(Average True Range)", pl: "ATR(sredni rzeczywisty zakres)" },
  CCI: { en: "CCI(Commodity Channel Index)", pl: "CCI(indeks kanalu towarowego)" },
  ADX: { en: "ADX(Average Directional Index)", pl: "ADX(sredni indeks kierunkowy)" },
  STOCHASTIC: { en: "Stochastic Oscillator", pl: "Oscylator stochastyczny" },
  DONCHIAN_CHANNELS: { en: "Donchian Channels", pl: "Kanaly Donchiana" },
  FUNDING_RATE: { en: "Funding Rate", pl: "Stopa finansowania" },
  FUNDING_RATE_ZSCORE: { en: "Funding Rate Z-Score", pl: "Z-score stopy finansowania" },
  OPEN_INTEREST: { en: "Open Interest", pl: "Open Interest" },
  OPEN_INTEREST_DELTA: { en: "Open Interest Delta", pl: "Delta Open Interest" },
  OPEN_INTEREST_MA: { en: "Open Interest Moving Average", pl: "Srednia Open Interest" },
  OPEN_INTEREST_ZSCORE: { en: "Open Interest Z-Score", pl: "Z-score Open Interest" },
  ORDER_BOOK_IMBALANCE: { en: "Order Book Imbalance", pl: "Nierownowaga order booka" },
  ORDER_BOOK_SPREAD_BPS: { en: "Order Book Spread (bps)", pl: "Spread order booka (bps)" },
  ORDER_BOOK_DEPTH_RATIO: { en: "Order Book Depth Ratio", pl: "Wspolczynnik glebokosci order booka" },
  BULLISH_ENGULFING: { en: "Bullish Engulfing", pl: "Objecie hossy" },
  BEARISH_ENGULFING: { en: "Bearish Engulfing", pl: "Objecie bessy" },
  HAMMER: { en: "Hammer", pl: "Mlot" },
  SHOOTING_STAR: { en: "Shooting Star", pl: "Spadajaca gwiazda" },
  DOJI: { en: "Doji", pl: "Doji" },
  MORNING_STAR: { en: "Morning Star", pl: "Gwiazda poranna" },
  EVENING_STAR: { en: "Evening Star", pl: "Gwiazda wieczorna" },
  INSIDE_BAR: { en: "Inside Bar", pl: "Inside Bar" },
  OUTSIDE_BAR: { en: "Outside Bar", pl: "Outside Bar" },
};

const paramLabels: Record<string, { en: string; pl: string }> = {
  fast: { en: "Fast period", pl: "Szybki okres" },
  slow: { en: "Slow period", pl: "Wolny okres" },
  period: { en: "Period", pl: "Okres" },
  signal: { en: "Signal period", pl: "Okres sygnalu" },
  stochPeriod: { en: "Stochastic period", pl: "Okres stochastyczny" },
  smoothK: { en: "K smoothing", pl: "Wygladzenie K" },
  smoothD: { en: "D smoothing", pl: "Wygladzenie D" },
  stdDev: { en: "Standard deviation", pl: "Odchylenie standardowe" },
  zScorePeriod: { en: "Z-score period", pl: "Okres Z-score" },
  dojiBodyToRangeMax: { en: "Doji body/range max", pl: "Max korpus/zakres Doji" },
};

const acronyms = new Set(["EMA", "SMA", "RSI", "MACD", "ROC", "ATR", "CCI", "ADX", "DCA", "BPS", "DOJI", "OI"]);

const toStartCase = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const upper = normalizeUppercaseToken(token);
      if (acronyms.has(upper)) return upper;
      return `${token[0]?.toUpperCase() ?? ""}${token.slice(1).toLowerCase()}`;
    })
    .join(" ");

export const getIndicatorDisplayName = (name: string, locale: "en" | "pl"): string => {
  const normalized = normalizeUppercaseToken(name);
  const direct = indicatorLabels[normalized];
  if (direct) return direct[locale];
  return toStartCase(name);
};

export const getIndicatorParamLabel = (name: string, locale: "en" | "pl"): string => {
  const direct = paramLabels[name];
  if (direct) return direct[locale];
  return toStartCase(name);
};
