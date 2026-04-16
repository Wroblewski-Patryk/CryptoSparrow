import { StrategyFormState } from "../types/StrategyForm.type";
import { Locale } from "@/i18n/translations";

export type StrategyPreset = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  form: StrategyFormState;
};

type LocalizedText = { en: string; pl: string; pt?: string };
type LocalizedTags = { en: string[]; pl: string[]; pt?: string[] };
export type StrategyPresetPresentation = {
  name: string;
  description: string;
  tags: string[];
};

const baseForm: StrategyFormState = {
  name: "",
  description: "",
  interval: "5m",
  leverage: 5,
  walletRisk: 1,
  openConditions: {
    direction: "both",
    indicatorsLong: [],
    indicatorsShort: [],
  },
  closeConditions: {
    mode: "basic",
    tp: 3,
    sl: 2,
    ttp: [],
    tsl: [],
  },
  additional: {
    dcaEnabled: false,
    dcaMode: "basic",
    dcaTimes: 1,
    dcaMultiplier: 2,
    dcaLevels: [],
    maxPositions: 2,
    maxOrders: 2,
    positionLifetime: 2,
    positionUnit: "d",
    orderLifetime: 6,
    orderUnit: "h",
    marginMode: "CROSSED",
  },
};

export const strategyPresets: StrategyPreset[] = [
  {
    id: "scalp-rsi-stochastic",
    name: "Scalp (RSI + Stochastic)",
    description: "Very short-term setup for micro pullback entries on fast charts.",
    tags: ["scalp", "rsi", "stochastic", "fast"],
    form: {
      ...baseForm,
      name: "Scalp RSI Stochastic",
      description: "Scalp archetype for high-frequency pullback entries.",
      interval: "1m",
      leverage: 4,
      walletRisk: 0.6,
      openConditions: {
        direction: "both",
        indicatorsLong: [
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "RSI",
            params: { period: 7 },
            condition: "<",
            value: 40,
            weight: 1,
          },
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "STOCHASTIC",
            params: { period: 9, smoothK: 3, smoothD: 3 },
            condition: "<",
            value: 20,
            weight: 1,
          },
        ],
        indicatorsShort: [
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "RSI",
            params: { period: 7 },
            condition: ">",
            value: 60,
            weight: 1,
          },
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "STOCHASTIC",
            params: { period: 9, smoothK: 3, smoothD: 3 },
            condition: ">",
            value: 80,
            weight: 1,
          },
        ],
      },
      closeConditions: {
        mode: "basic",
        tp: 1.2,
        sl: 0.8,
        ttp: [],
        tsl: [],
      },
      additional: {
        ...baseForm.additional,
        maxPositions: 1,
        maxOrders: 1,
      },
    },
  },
  {
    id: "day-trend-ema-adx",
    name: "Day Trend (EMA + ADX)",
    description: "Intraday trend-follow setup with trend strength filter.",
    tags: ["day-trend", "ema", "adx", "intraday"],
    form: {
      ...baseForm,
      name: "Day Trend EMA ADX",
      description: "Day trend archetype using EMA direction and ADX strength.",
      interval: "15m",
      leverage: 6,
      walletRisk: 1,
      openConditions: {
        direction: "both",
        indicatorsLong: [
          {
            group: "TREND",
            name: "EMA",
            params: { fast: 9, slow: 21 },
            condition: ">",
            value: 1,
            weight: 1,
          },
          {
            group: "TREND",
            name: "ADX",
            params: { period: 14 },
            condition: ">",
            value: 20,
            weight: 1,
          },
        ],
        indicatorsShort: [
          {
            group: "TREND",
            name: "EMA",
            params: { fast: 9, slow: 21 },
            condition: "<",
            value: 1,
            weight: 1,
          },
          {
            group: "TREND",
            name: "ADX",
            params: { period: 14 },
            condition: ">",
            value: 20,
            weight: 1,
          },
        ],
      },
      closeConditions: {
        mode: "basic",
        tp: 4,
        sl: 2,
        ttp: [],
        tsl: [],
      },
    },
  },
  {
    id: "swing-macd-rsi",
    name: "Swing (MACD + RSI)",
    description: "Multi-session setup for larger directional moves.",
    tags: ["swing", "macd", "rsi", "higher-timeframe"],
    form: {
      ...baseForm,
      name: "Swing MACD RSI",
      description: "Swing archetype for medium-term directional trends.",
      interval: "4h",
      leverage: 4,
      walletRisk: 1.5,
      openConditions: {
        direction: "both",
        indicatorsLong: [
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "MACD",
            params: { fast: 12, slow: 26, signal: 9 },
            condition: ">",
            value: 0,
            weight: 1,
          },
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "RSI",
            params: { period: 14 },
            condition: ">",
            value: 52,
            weight: 1,
          },
        ],
        indicatorsShort: [
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "MACD",
            params: { fast: 12, slow: 26, signal: 9 },
            condition: "<",
            value: 0,
            weight: 1,
          },
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "RSI",
            params: { period: 14 },
            condition: "<",
            value: 48,
            weight: 1,
          },
        ],
      },
      closeConditions: {
        mode: "advanced",
        tp: 0,
        sl: 0,
        ttp: [{ percent: 3.5, arm: 1.5 }],
        tsl: [{ percent: -2, arm: 1.2 }],
      },
    },
  },
  {
    id: "mean-reversion-rsi-bb",
    name: "Mean Reversion (RSI + BB)",
    description: "Counter-trend setup using RSI extremes and Bollinger context.",
    tags: ["mean-reversion", "rsi", "bollinger", "counter-trend"],
    form: {
      ...baseForm,
      name: "Mean Reversion RSI BB",
      description: "Mean reversion archetype with RSI and Bollinger filters.",
      interval: "15m",
      leverage: 4,
      walletRisk: 0.8,
      openConditions: {
        direction: "both",
        indicatorsLong: [
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "RSI",
            params: { period: 14 },
            condition: "<",
            value: 30,
            weight: 1,
          },
          {
            group: "VOLATILITY",
            name: "BOLLINGER_BANDS",
            params: { period: 20, stdDev: 2 },
            condition: "<",
            value: 0.2,
            weight: 1,
          },
        ],
        indicatorsShort: [
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "RSI",
            params: { period: 14 },
            condition: ">",
            value: 70,
            weight: 1,
          },
          {
            group: "VOLATILITY",
            name: "BOLLINGER_BANDS",
            params: { period: 20, stdDev: 2 },
            condition: ">",
            value: 0.8,
            weight: 1,
          },
        ],
      },
      closeConditions: {
        mode: "basic",
        tp: 2.5,
        sl: 1.5,
        ttp: [],
        tsl: [],
      },
      additional: {
        ...baseForm.additional,
        maxPositions: 1,
        maxOrders: 1,
      },
    },
  },
  {
    id: "breakout-roc-adx",
    name: "Breakout (ROC + ADX)",
    description: "Breakout continuation preset for expansion phases.",
    tags: ["breakout", "roc", "adx", "expansion"],
    form: {
      ...baseForm,
      name: "Breakout ROC ADX",
      description: "Breakout archetype with momentum acceleration and trend confirmation.",
      interval: "15m",
      leverage: 8,
      walletRisk: 1,
      openConditions: {
        direction: "both",
        indicatorsLong: [
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "ROC",
            params: { period: 6 },
            condition: ">",
            value: 1,
            weight: 1,
          },
          {
            group: "TREND",
            name: "ADX",
            params: { period: 14 },
            condition: ">",
            value: 18,
            weight: 1,
          },
        ],
        indicatorsShort: [
          {
            group: "MOMENTUM_OSCILLATOR",
            name: "ROC",
            params: { period: 6 },
            condition: "<",
            value: -1,
            weight: 1,
          },
          {
            group: "TREND",
            name: "ADX",
            params: { period: 14 },
            condition: ">",
            value: 18,
            weight: 1,
          },
        ],
      },
      closeConditions: {
        mode: "advanced",
        tp: 0,
        sl: 0,
        ttp: [{ percent: 2.5, arm: 1 }],
        tsl: [{ percent: -1.5, arm: 1 }],
      },
      additional: {
        ...baseForm.additional,
        dcaEnabled: true,
        dcaMode: "basic",
        dcaTimes: 2,
        dcaMultiplier: 1.5,
      },
    },
  },
  {
    id: "perp-bias-derivatives",
    name: "Perp Bias (Funding + OI + OB)",
    description: "Futures-only directional bias preset using derivatives filters.",
    tags: ["perp-bias", "funding", "open-interest", "orderbook"],
    form: {
      ...baseForm,
      name: "Perp Bias Derivatives",
      description: "Perp-bias archetype with funding, open interest and order-book confirmation.",
      interval: "5m",
      leverage: 8,
      walletRisk: 0.8,
      openConditions: {
        direction: "both",
        indicatorsLong: [
          {
            group: "DERIVATIVES",
            name: "FUNDING_RATE",
            params: {},
            condition: "<",
            value: 0,
            weight: 1,
          },
          {
            group: "DERIVATIVES",
            name: "OPEN_INTEREST_DELTA",
            params: {},
            condition: ">",
            value: 0,
            weight: 1,
          },
          {
            group: "DERIVATIVES",
            name: "ORDER_BOOK_IMBALANCE",
            params: {},
            condition: ">",
            value: 0.1,
            weight: 1,
          },
        ],
        indicatorsShort: [
          {
            group: "DERIVATIVES",
            name: "FUNDING_RATE_ZSCORE",
            params: { zScorePeriod: 20 },
            condition: ">",
            value: 1,
            weight: 1,
          },
          {
            group: "DERIVATIVES",
            name: "OPEN_INTEREST_ZSCORE",
            params: { zScorePeriod: 20 },
            condition: ">",
            value: 0.5,
            weight: 1,
          },
          {
            group: "DERIVATIVES",
            name: "ORDER_BOOK_IMBALANCE",
            params: {},
            condition: "<",
            value: -0.1,
            weight: 1,
          },
        ],
      },
      closeConditions: {
        mode: "basic",
        tp: 2.5,
        sl: 1.2,
        ttp: [],
        tsl: [],
      },
      additional: {
        ...baseForm.additional,
        dcaEnabled: false,
        dcaTimes: 0,
      },
    },
  },
];

const localizedPresetCopy: Record<
  StrategyPreset["id"],
  { name: LocalizedText; description: LocalizedText; tags: LocalizedTags }
> = {
  "scalp-rsi-stochastic": {
    name: { en: "Scalp (RSI + Stochastic)", pl: "Scalp (RSI + Stochastic)" },
    description: {
      en: "Very short-term setup for micro pullback entries on fast charts.",
      pl: "Bardzo krotkoterminowy setup pod mikro cofniecia na szybkich wykresach.",
    },
    tags: {
      en: ["scalp", "rsi", "stochastic", "fast"],
      pl: ["scalp", "rsi", "stochastic", "szybki"],
    },
  },
  "day-trend-ema-adx": {
    name: { en: "Day Trend (EMA + ADX)", pl: "Day Trend (EMA + ADX)" },
    description: {
      en: "Intraday trend-follow setup with trend strength filter.",
      pl: "Intraday trend-follow z filtrem sily trendu.",
    },
    tags: {
      en: ["day-trend", "ema", "adx", "intraday"],
      pl: ["day-trend", "ema", "adx", "intraday"],
    },
  },
  "swing-macd-rsi": {
    name: { en: "Swing (MACD + RSI)", pl: "Swing (MACD + RSI)" },
    description: {
      en: "Multi-session setup for larger directional moves.",
      pl: "Wielosesyjny setup pod wieksze ruchy kierunkowe.",
    },
    tags: {
      en: ["swing", "macd", "rsi", "higher-timeframe"],
      pl: ["swing", "macd", "rsi", "wyzszy-interwal"],
    },
  },
  "mean-reversion-rsi-bb": {
    name: { en: "Mean Reversion (RSI + BB)", pl: "Mean Reversion (RSI + BB)" },
    description: {
      en: "Counter-trend setup using RSI extremes and Bollinger context.",
      pl: "Counter-trend z ekstremami RSI i kontekstem Wsteg Bollingera.",
    },
    tags: {
      en: ["mean-reversion", "rsi", "bollinger", "counter-trend"],
      pl: ["mean-reversion", "rsi", "bollinger", "counter-trend"],
    },
  },
  "breakout-roc-adx": {
    name: { en: "Breakout (ROC + ADX)", pl: "Breakout (ROC + ADX)" },
    description: {
      en: "Breakout continuation preset for expansion phases.",
      pl: "Preset breakout continuation pod fazy ekspansji.",
    },
    tags: {
      en: ["breakout", "roc", "adx", "expansion"],
      pl: ["breakout", "roc", "adx", "ekspansja"],
    },
  },
  "perp-bias-derivatives": {
    name: { en: "Perp Bias (Funding + OI + OB)", pl: "Perp Bias (Funding + OI + OB)" },
    description: {
      en: "Futures-only directional bias preset using derivatives filters.",
      pl: "Preset futures-only z filtrem derywatow i biasem kierunkowym.",
    },
    tags: {
      en: ["perp-bias", "funding", "open-interest", "orderbook"],
      pl: ["perp-bias", "funding", "open-interest", "orderbook"],
    },
  },
};

export const getStrategyPresetPresentation = (
  preset: StrategyPreset,
  locale: Locale,
): StrategyPresetPresentation => {
  const localized = localizedPresetCopy[preset.id];
  if (!localized) {
    return {
      name: preset.name,
      description: preset.description,
      tags: preset.tags,
    };
  }

  return {
    name: localized.name[locale] ?? localized.name.en,
    description: localized.description[locale] ?? localized.description.en,
    tags: localized.tags[locale] ?? localized.tags.en,
  };
};
