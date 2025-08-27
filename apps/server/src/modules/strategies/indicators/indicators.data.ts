export const indicators = [
  {
    name: "RSI",
    group: "Analiza techniczna",
    type: "oscillator",
    params: [
      {
        name: "period",
        default: 14,
        min: 2,
        max: 255
      }
    ]
  },
  {
    name: "BollingerBands",
    group: "Analiza techniczna",
    type: "volatility",
    params: [
      {
        name: "period",
        default: 20,
        min: 2,
        max: 255
      },
      {
        name: "stdDev",
        default: 2,
        min: 1,
        max: 10
      }
    ]
  }
  // ... kolejne wskaźniki
  , {
    name: 'BullCandle',
    group: 'Candle Pattern',
    type: 'some type',
    params: [],
  }
];