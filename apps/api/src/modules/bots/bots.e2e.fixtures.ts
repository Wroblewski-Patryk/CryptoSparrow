export const DCA_BASIC_STRATEGY_CONFIG = {
  open: { indicatorsLong: [], indicatorsShort: [] },
  close: { mode: 'basic', tp: 2, sl: 1 },
  additional: {
    dcaEnabled: true,
    dcaMode: 'basic',
    dcaTimes: 2,
    dcaLevels: [{ percent: -15 }],
  },
};

export const DCA_ADVANCED_STRATEGY_CONFIG = {
  open: { indicatorsLong: [], indicatorsShort: [] },
  close: { mode: 'basic', tp: 2, sl: 1 },
  additional: {
    dcaEnabled: true,
    dcaMode: 'advanced',
    dcaTimes: 3,
    dcaLevels: [{ percent: -10 }, { percent: -20 }, { percent: -30 }],
  },
};

export const DCA_LEGACY_STRATEGY_CONFIG = {
  open: { indicatorsLong: [], indicatorsShort: [] },
  close: { mode: 'basic', tp: 2, sl: 1 },
};

export const DYNAMIC_STOP_STRATEGY_CONFIG = {
  open: { indicatorsLong: [], indicatorsShort: [] },
  close: {
    mode: 'advanced',
    tp: 2,
    sl: 1,
    ttp: [{ percent: 4, arm: 1 }],
    tsl: [{ percent: -2, arm: 5 }],
  },
  additional: { dcaEnabled: false },
};

type DcaTradeSeedInput = {
  userId: string;
  botId: string;
  basicPositionId: string;
  basicStrategyId: string;
  advancedPositionId: string;
  advancedStrategyId: string;
  legacyPositionId: string;
  legacyStrategyId: string;
};

export const buildDcaTradeSeed = (input: DcaTradeSeedInput): Prisma.TradeCreateManyInput[] => [
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.basicPositionId,
    strategyId: input.basicStrategyId,
    symbol: 'BTCUSDT',
    side: 'BUY',
    lifecycleAction: 'OPEN',
    price: 65000,
    quantity: 0.1,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date('2026-04-02T10:01:10.000Z'),
  },
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.basicPositionId,
    strategyId: input.basicStrategyId,
    symbol: 'BTCUSDT',
    side: 'BUY',
    lifecycleAction: 'DCA',
    price: 64500,
    quantity: 0.05,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date('2026-04-02T10:01:40.000Z'),
  },
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.basicPositionId,
    strategyId: input.basicStrategyId,
    symbol: 'BTCUSDT',
    side: 'BUY',
    lifecycleAction: 'DCA',
    price: 64000,
    quantity: 0.05,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date('2026-04-02T10:02:00.000Z'),
  },
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.advancedPositionId,
    strategyId: input.advancedStrategyId,
    symbol: 'ETHUSDT',
    side: 'SELL',
    lifecycleAction: 'OPEN',
    price: 2200,
    quantity: 2,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date('2026-04-02T10:02:10.000Z'),
  },
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.advancedPositionId,
    strategyId: input.advancedStrategyId,
    symbol: 'ETHUSDT',
    side: 'SELL',
    lifecycleAction: 'DCA',
    price: 2220,
    quantity: 1.5,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date('2026-04-02T10:02:40.000Z'),
  },
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.advancedPositionId,
    strategyId: input.advancedStrategyId,
    symbol: 'ETHUSDT',
    side: 'SELL',
    lifecycleAction: 'DCA',
    price: 2240,
    quantity: 1.5,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date('2026-04-02T10:03:00.000Z'),
  },
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.legacyPositionId,
    strategyId: input.legacyStrategyId,
    symbol: 'BNBUSDT',
    side: 'BUY',
    lifecycleAction: 'OPEN',
    price: 600,
    quantity: 10,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date('2026-04-02T10:03:10.000Z'),
  },
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.legacyPositionId,
    strategyId: input.legacyStrategyId,
    symbol: 'BNBUSDT',
    side: 'BUY',
    lifecycleAction: 'DCA',
    price: 595,
    quantity: 10,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date('2026-04-02T10:03:40.000Z'),
  },
];

type DynamicStopTradeSeedInput = {
  userId: string;
  botId: string;
  strategyId: string;
  preArmPositionId: string;
  postArmPositionId: string;
  fallbackPositionId: string;
  noSnapshotPositionId: string;
  preArmOpenedAt: Date;
  postArmOpenedAt: Date;
  fallbackOpenedAt: Date;
  noSnapshotOpenedAt: Date;
};

export const buildDynamicStopTradeSeed = (
  input: DynamicStopTradeSeedInput
): Prisma.TradeCreateManyInput[] => [
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.preArmPositionId,
    strategyId: input.strategyId,
    symbol: 'BTCUSDT',
    side: 'BUY',
    lifecycleAction: 'OPEN',
    price: 100,
    quantity: 1,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date(input.preArmOpenedAt.getTime() + 5_000),
  },
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.postArmPositionId,
    strategyId: input.strategyId,
    symbol: 'ETHUSDT',
    side: 'BUY',
    lifecycleAction: 'OPEN',
    price: 100,
    quantity: 1,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date(input.postArmOpenedAt.getTime() + 5_000),
  },
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.fallbackPositionId,
    strategyId: input.strategyId,
    symbol: 'BNBUSDT',
    side: 'BUY',
    lifecycleAction: 'OPEN',
    price: 100,
    quantity: 1,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date(input.fallbackOpenedAt.getTime() + 5_000),
  },
  {
    userId: input.userId,
    botId: input.botId,
    positionId: input.noSnapshotPositionId,
    strategyId: input.strategyId,
    symbol: 'XRPUSDT',
    side: 'BUY',
    lifecycleAction: 'OPEN',
    price: 100,
    quantity: 1,
    fee: 0,
    realizedPnl: 0,
    executedAt: new Date(input.noSnapshotOpenedAt.getTime() + 5_000),
  },
];

type DynamicStopSymbolStatsSeedInput = {
  userId: string;
  botId: string;
  sessionId: string;
  snapshotAt: Date;
};

export const buildDynamicStopSymbolStatsSeed = (
  input: DynamicStopSymbolStatsSeedInput
): Prisma.BotRuntimeSymbolStatCreateManyInput[] => [
  {
    userId: input.userId,
    botId: input.botId,
    sessionId: input.sessionId,
    symbol: 'BTCUSDT',
    totalSignals: 0,
    longEntries: 0,
    shortEntries: 0,
    exits: 0,
    dcaCount: 0,
    closedTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    realizedPnl: 0,
    grossProfit: 0,
    grossLoss: 0,
    feesPaid: 0,
    openPositionCount: 1,
    openPositionQty: 1,
    lastPrice: 102,
    snapshotAt: input.snapshotAt,
  },
  {
    userId: input.userId,
    botId: input.botId,
    sessionId: input.sessionId,
    symbol: 'ETHUSDT',
    totalSignals: 0,
    longEntries: 0,
    shortEntries: 0,
    exits: 0,
    dcaCount: 0,
    closedTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    realizedPnl: 0,
    grossProfit: 0,
    grossLoss: 0,
    feesPaid: 0,
    openPositionCount: 1,
    openPositionQty: 1,
    lastPrice: 108,
    snapshotAt: input.snapshotAt,
  },
  {
    userId: input.userId,
    botId: input.botId,
    sessionId: input.sessionId,
    symbol: 'BNBUSDT',
    totalSignals: 0,
    longEntries: 0,
    shortEntries: 0,
    exits: 0,
    dcaCount: 0,
    closedTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    realizedPnl: 0,
    grossProfit: 0,
    grossLoss: 0,
    feesPaid: 0,
    openPositionCount: 1,
    openPositionQty: 1,
    lastPrice: 103,
    snapshotAt: input.snapshotAt,
  },
  {
    userId: input.userId,
    botId: input.botId,
    sessionId: input.sessionId,
    symbol: 'XRPUSDT',
    totalSignals: 0,
    longEntries: 0,
    shortEntries: 0,
    exits: 0,
    dcaCount: 0,
    closedTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    realizedPnl: 0,
    grossProfit: 0,
    grossLoss: 0,
    feesPaid: 0,
    openPositionCount: 1,
    openPositionQty: 1,
    lastPrice: 106,
    snapshotAt: input.snapshotAt,
  },
];
import type { Prisma } from '@prisma/client';
