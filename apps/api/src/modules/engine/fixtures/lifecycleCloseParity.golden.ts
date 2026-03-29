export type LifecycleCloseReason = 'take_profit' | 'trailing_take_profit' | 'stop_loss' | 'trailing_stop';

export type LifecycleParityGoldenFixture = {
  id: string;
  description: string;
  symbol: string;
  leverage: number;
  candles: number[];
  strategyConfig: Record<string, unknown>;
  expectedCloseReasons: LifecycleCloseReason[];
};

const alwaysLongOpenBlock = {
  direction: 'long',
  indicatorsLong: [{ name: 'MOMENTUM', params: { period: 1 }, condition: '>', value: -999 }],
  indicatorsShort: [],
};

export const lifecycleParityGoldenFixtures: LifecycleParityGoldenFixture[] = [
  {
    id: 'basic-tp',
    description: 'Basic mode closes by take-profit when threshold is reached.',
    symbol: 'BTCUSDT',
    leverage: 5,
    candles: [100, 101, 102, 103],
    strategyConfig: {
      openConditions: alwaysLongOpenBlock,
      close: {
        mode: 'basic',
        tp: 1,
        sl: 99,
        ttp: [],
        tsl: [],
      },
      additional: {
        dcaEnabled: false,
        dcaTimes: 0,
      },
    },
    expectedCloseReasons: ['take_profit'],
  },
  {
    id: 'basic-sl',
    description: 'Basic mode closes by stop-loss when adverse move reaches threshold.',
    symbol: 'ETHUSDT',
    leverage: 5,
    candles: [100, 101, 102, 99],
    strategyConfig: {
      openConditions: alwaysLongOpenBlock,
      close: {
        mode: 'basic',
        tp: 99,
        sl: 1,
        ttp: [],
        tsl: [],
      },
      additional: {
        dcaEnabled: false,
        dcaTimes: 0,
      },
    },
    expectedCloseReasons: ['stop_loss'],
  },
  {
    id: 'advanced-ttp',
    description: 'Advanced mode closes by trailing take-profit after arm + retrace.',
    symbol: 'SOLUSDT',
    leverage: 5,
    candles: [100, 101, 102, 106, 104],
    strategyConfig: {
      openConditions: alwaysLongOpenBlock,
      close: {
        mode: 'advanced',
        tp: 99,
        sl: 99,
        ttp: [{ percent: 2, arm: 0.5 }],
        tsl: [],
      },
      additional: {
        dcaEnabled: false,
        dcaTimes: 0,
      },
    },
    expectedCloseReasons: ['trailing_take_profit'],
  },
  {
    id: 'advanced-tsl',
    description: 'Advanced mode closes by trailing stop after arm and pullback.',
    symbol: 'BNBUSDT',
    leverage: 5,
    candles: [100, 101, 102, 106, 103],
    strategyConfig: {
      openConditions: alwaysLongOpenBlock,
      close: {
        mode: 'advanced',
        tp: 99,
        sl: 99,
        ttp: [],
        tsl: [{ arm: 0.5, percent: 1 }],
      },
      additional: {
        dcaEnabled: false,
        dcaTimes: 0,
      },
    },
    expectedCloseReasons: ['trailing_stop'],
  },
];
