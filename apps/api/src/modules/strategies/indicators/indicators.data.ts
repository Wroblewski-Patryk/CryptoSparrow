export const indicators = [
  {
    name: "EMA",
    group: "Analiza techniczna",
    type: "trend",
    params: [
      {
        name: "fast",
        default: 9,
        min: 2,
        max: 255,
      },
      {
        name: "slow",
        default: 21,
        min: 2,
        max: 255,
      },
    ],
  },
  {
    name: "SMA",
    group: "Analiza techniczna",
    type: "trend",
    params: [
      {
        name: "period",
        default: 14,
        min: 2,
        max: 255,
      },
    ],
  },
  {
    name: "RSI",
    group: "Analiza techniczna",
    type: "oscillator",
    params: [
      {
        name: "period",
        default: 14,
        min: 2,
        max: 255,
      },
    ],
  },
  {
    name: "MOMENTUM",
    group: "Analiza techniczna",
    type: "momentum",
    params: [
      {
        name: "period",
        default: 14,
        min: 2,
        max: 255,
      },
    ],
  },
  {
    name: "MACD",
    group: "Analiza techniczna",
    type: "trend",
    params: [
      {
        name: "fast",
        default: 12,
        min: 2,
        max: 255,
      },
      {
        name: "slow",
        default: 26,
        min: 2,
        max: 255,
      },
      {
        name: "signal",
        default: 9,
        min: 2,
        max: 255,
      },
    ],
  },
  {
    name: "ROC",
    group: "Analiza techniczna",
    type: "momentum",
    params: [
      {
        name: "period",
        default: 14,
        min: 2,
        max: 255,
      },
    ],
  },
  {
    name: "STOCHRSI",
    group: "Analiza techniczna",
    type: "oscillator",
    params: [
      {
        name: "period",
        default: 14,
        min: 2,
        max: 255,
      },
      {
        name: "stochPeriod",
        default: 14,
        min: 2,
        max: 255,
      },
      {
        name: "smoothK",
        default: 3,
        min: 2,
        max: 50,
      },
      {
        name: "smoothD",
        default: 3,
        min: 2,
        max: 50,
      },
    ],
  },
  {
    name: "BOLLINGER_BANDS",
    group: "Analiza techniczna",
    type: "volatility",
    params: [
      {
        name: "period",
        default: 20,
        min: 2,
        max: 255,
      },
      {
        name: "stdDev",
        default: 2,
        min: 1,
        max: 10,
      },
    ],
  },
  {
    name: "ATR",
    group: "Analiza techniczna",
    type: "volatility",
    params: [
      {
        name: "period",
        default: 14,
        min: 2,
        max: 255,
      },
    ],
  },
  {
    name: "CCI",
    group: "Analiza techniczna",
    type: "oscillator",
    params: [
      {
        name: "period",
        default: 20,
        min: 2,
        max: 255,
      },
    ],
  },
  {
    name: "ADX",
    group: "Analiza techniczna",
    type: "trend",
    params: [
      {
        name: "period",
        default: 14,
        min: 2,
        max: 255,
      },
    ],
  },
  {
    name: "STOCHASTIC",
    group: "Analiza techniczna",
    type: "oscillator",
    params: [
      {
        name: "period",
        default: 14,
        min: 2,
        max: 255,
      },
      {
        name: "smoothK",
        default: 3,
        min: 2,
        max: 50,
      },
      {
        name: "smoothD",
        default: 3,
        min: 2,
        max: 50,
      },
    ],
  },
  {
    name: "DONCHIAN_CHANNELS",
    group: "Analiza techniczna",
    type: "volatility",
    params: [
      {
        name: "period",
        default: 20,
        min: 2,
        max: 255,
      },
    ],
  },
  {
    name: "BULLISH_ENGULFING",
    group: "Formacje świecowe",
    type: "pattern",
    params: [],
  },
  {
    name: "BEARISH_ENGULFING",
    group: "Formacje świecowe",
    type: "pattern",
    params: [],
  },
  {
    name: "HAMMER",
    group: "Formacje świecowe",
    type: "pattern",
    params: [],
  },
  {
    name: "SHOOTING_STAR",
    group: "Formacje świecowe",
    type: "pattern",
    params: [],
  },
  {
    name: "DOJI",
    group: "Formacje świecowe",
    type: "pattern",
    params: [
      {
        name: "dojiBodyToRangeMax",
        default: 0.1,
        min: 0.01,
        max: 0.5,
      },
    ],
  },
  {
    name: "MORNING_STAR",
    group: "Formacje świecowe",
    type: "pattern",
    params: [],
  },
  {
    name: "EVENING_STAR",
    group: "Formacje świecowe",
    type: "pattern",
    params: [],
  },
];
