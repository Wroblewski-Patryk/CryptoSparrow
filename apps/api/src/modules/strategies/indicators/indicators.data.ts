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
];
