import { StrategyFormState } from "../types/StrategyForm.type";

export type StrategyPreset = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  form: StrategyFormState;
};

const baseForm: StrategyFormState = {
  name: "New strategy",
  description: "Preset strategy template",
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
    id: "trend-rsi",
    name: "Trend Follow (RSI)",
    description: "Preset pod trend z filtrem RSI dla long/short.",
    tags: ["trend", "rsi", "mvp"],
    form: {
      ...baseForm,
      name: "Trend Follow RSI",
      description: "RSI momentum preset for trend continuation.",
      leverage: 8,
      openConditions: {
        direction: "both",
        indicatorsLong: [
          {
            group: "Analiza techniczna",
            name: "RSI",
            params: { period: 14 },
            condition: ">",
            value: 55,
            weight: 1,
          },
        ],
        indicatorsShort: [
          {
            group: "Analiza techniczna",
            name: "RSI",
            params: { period: 14 },
            condition: "<",
            value: 45,
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
    id: "mean-reversion-bb",
    name: "Mean Reversion (BB)",
    description: "Kontr-trend z Bollinger Bands i mniejsza dzwignia.",
    tags: ["mean-reversion", "bollinger", "safe"],
    form: {
      ...baseForm,
      name: "Mean Reversion BB",
      description: "Bollinger mean reversion with conservative leverage.",
      leverage: 4,
      walletRisk: 0.8,
      openConditions: {
        direction: "both",
        indicatorsLong: [
          {
            group: "Analiza techniczna",
            name: "BollingerBands",
            params: { period: 20, stdDev: 2 },
            condition: "<",
            value: -1,
            weight: 1,
          },
        ],
        indicatorsShort: [
          {
            group: "Analiza techniczna",
            name: "BollingerBands",
            params: { period: 20, stdDev: 2 },
            condition: ">",
            value: 1,
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
    id: "breakout-candle",
    name: "Breakout (Candle)",
    description: "Preset breakout oparty o sygnal swiecowy i dynamiczne wyjscie.",
    tags: ["breakout", "candle", "volatility"],
    form: {
      ...baseForm,
      name: "Breakout Candle",
      description: "Breakout setup using candle pattern trigger.",
      interval: "15m",
      leverage: 10,
      openConditions: {
        direction: "long",
        indicatorsLong: [
          {
            group: "Candle Pattern",
            name: "BullCandle",
            params: {},
            condition: ">",
            value: 0,
            weight: 1,
          },
        ],
        indicatorsShort: [],
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
];
