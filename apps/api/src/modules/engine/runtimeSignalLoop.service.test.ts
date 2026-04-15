import { describe, expect, it, vi } from 'vitest';
import {
  RuntimeSignalLoop,
  deriveRuntimeGroupMaxOpenPositions,
  supportsRuntimeSignalLoopExchange,
} from './runtimeSignalLoop.service';
import { MarketStreamEvent } from '../market-stream/binanceStream.types';
import { metricsStore } from '../../observability/metrics';

vi.mock('./runtimeCapitalContext.service', () => ({
  resolveRuntimeReferenceBalance: vi.fn(async () => 10_000),
  resolveRuntimeDcaFundsExhausted: vi.fn(() => false),
}));

const strategyLong = {
  strategyId: 'strategy-1',
  strategyInterval: '1m',
  strategyLeverage: 5,
  walletRisk: 10,
  strategyConfig: {
    open: {
      indicatorsLong: [
        { name: 'EMA', params: { fast: 3, slow: 5 }, condition: '>' },
        { name: 'RSI', params: { period: 3 }, condition: '>', value: 50 },
      ],
      indicatorsShort: [],
    },
  },
  priority: 10,
  weight: 1,
};

const strategyExit = {
  strategyId: 'strategy-exit',
  strategyInterval: '1m',
  strategyLeverage: 3,
  walletRisk: 5,
  strategyConfig: {
    open: {
      noMatchAction: 'EXIT',
      indicatorsLong: [{ name: 'RSI', params: { period: 3 }, condition: '>', value: 150 }],
      indicatorsShort: [{ name: 'RSI', params: { period: 3 }, condition: '<', value: -1 }],
    },
  },
  priority: 5,
  weight: 1,
};

const strategyShortMomentum = {
  strategyId: 'strategy-short-momentum',
  strategyInterval: '1m',
  strategyLeverage: 3,
  walletRisk: 5,
  strategyConfig: {
    open: {
      indicatorsLong: [],
      indicatorsShort: [{ name: 'MOMENTUM', params: { period: 2 }, condition: '<', value: 0 }],
    },
  },
  priority: 10,
  weight: 1,
};

const strategyFundingLong = {
  strategyId: 'strategy-funding-long',
  strategyInterval: '1m',
  strategyLeverage: 3,
  walletRisk: 5,
  strategyConfig: {
    open: {
      indicatorsLong: [{ name: 'FUNDING_RATE', params: {}, condition: '<', value: 0 }],
      indicatorsShort: [],
    },
  },
  priority: 10,
  weight: 1,
};

const strategyOpenInterestShort = {
  strategyId: 'strategy-open-interest-short',
  strategyInterval: '1m',
  strategyLeverage: 3,
  walletRisk: 5,
  strategyConfig: {
    open: {
      indicatorsLong: [],
      indicatorsShort: [{ name: 'OPEN_INTEREST_ZSCORE', params: { zScorePeriod: 3 }, condition: '>', value: 1 }],
    },
  },
  priority: 10,
  weight: 1,
};

const strategyOrderBookLong = {
  strategyId: 'strategy-orderbook-long',
  strategyInterval: '1m',
  strategyLeverage: 3,
  walletRisk: 5,
  strategyConfig: {
    open: {
      indicatorsLong: [{ name: 'ORDER_BOOK_IMBALANCE', params: {}, condition: '>', value: 0.2 }],
      indicatorsShort: [],
    },
  },
  priority: 10,
  weight: 1,
};

const createDeps = () => {
  let handler: ((event: MarketStreamEvent) => void | Promise<void>) | null = null;

  const deps: any = {
    subscribe: vi.fn(async (inputHandler: (event: MarketStreamEvent) => void | Promise<void>) => {
      handler = inputHandler;
      return async () => undefined;
    }),
    listActiveBots: vi.fn(async () => []),
    listRuntimeManagedExternalPositions: vi.fn(async () => []),
    countOpenPositionsForBotAndSymbols: vi.fn(async () => 0),
    createSignal: vi.fn(async () => undefined),
    analyzePreTradeFn: vi.fn(async () => ({
      allowed: true,
      reasons: [],
      metrics: {
        userOpenPositions: 0,
        botOpenPositions: 0,
        hasOpenPositionOnSymbol: false,
      },
    })),
    orchestrateFn: vi.fn(async () => ({ status: 'opened', orderId: 'o1', positionId: 'p1' })),
    processPositionAutomation: vi.fn(async () => undefined),
    nowMs: vi.fn(() => 1_000),
  };

  return {
    deps,
    emit: async (event: MarketStreamEvent) => {
      if (!handler) throw new Error('handler missing');
      await handler(event);
    },
  };
};

const withStrategyBot = (
  deps: any,
  options?: {
    mode?: 'PAPER' | 'LIVE';
    maxOpenPositions?: number;
    strategies?: any[];
    marketType?: 'FUTURES' | 'SPOT';
    exchange?: 'BINANCE' | 'BYBIT' | 'OKX' | 'KRAKEN' | 'COINBASE';
  }
) => {
  deps.listActiveBots = vi.fn(async () => [
    {
      id: 'bot-1',
      userId: 'user-1',
      mode: options?.mode ?? ('PAPER' as const),
      exchange: options?.exchange ?? ('BINANCE' as const),
      paperStartBalance: 1000,
      marketType: options?.marketType ?? ('FUTURES' as const),
      marketGroups: [
        {
          id: 'group-1',
          symbolGroupId: 'symbol-group-1',
          executionOrder: 1,
          maxOpenPositions: options?.maxOpenPositions ?? 1,
          symbols: ['BTCUSDT'],
          strategies: options?.strategies ?? [strategyLong],
        },
      ],
    },
  ]);
};

const emitFinalCandleSeries = async (
  emit: (event: MarketStreamEvent) => Promise<void>,
  options?: {
    symbol?: string;
    exchange?: 'BINANCE';
    marketType?: 'FUTURES' | 'SPOT';
    interval?: string;
    points?: number;
  }
) => {
  const symbol = options?.symbol ?? 'BTCUSDT';
  const exchange = options?.exchange ?? 'BINANCE';
  const marketType = options?.marketType ?? 'FUTURES';
  const interval = options?.interval ?? '1m';
  const points = options?.points ?? 8;
  for (let index = 0; index < points; index += 1) {
    await emit({
      type: 'candle',
      exchange,
      marketType,
      symbol,
      interval,
      eventTime: 10_000 + index * 60_000,
      openTime: index * 60_000,
      closeTime: index * 60_000 + 59_000,
      open: 100 + index,
      high: 101 + index,
      low: 99 + index,
      close: 100 + index,
      volume: 1000,
      isFinal: true,
    });
  }
};

describe('RuntimeSignalLoop', () => {
  it('records hot-path metrics for active-bot reads and eligible-group sampling', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps, { strategies: [] });
    const before = metricsStore.snapshot().runtime.hotPath;
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emit({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      eventTime: 60_000,
      openTime: 0,
      closeTime: 59_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1000,
      isFinal: true,
    });

    const after = metricsStore.snapshot().runtime.hotPath;
    expect(after.listActiveBots.total).toBeGreaterThanOrEqual(before.listActiveBots.total + 2);
    expect(after.eligibleGroupsCount.total).toBeGreaterThanOrEqual(before.eligibleGroupsCount.total + 1);

    await loop.stop();
  });

  it('runs position automation fallback from final candle when ticker is stale or missing', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps, { strategies: [] });
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emit({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      eventTime: 60_000,
      openTime: 0,
      closeTime: 59_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1000,
      isFinal: true,
    });

    expect(deps.processPositionAutomation).toHaveBeenCalledTimes(1);
    expect(deps.processPositionAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ticker',
        symbol: 'BTCUSDT',
        marketType: 'FUTURES',
        lastPrice: 100.5,
      })
    );
  });

  it('skips final-candle fallback automation when ticker is fresh', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps, { strategies: [] });
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emit({
      type: 'ticker',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 60_000,
      lastPrice: 100.2,
      priceChangePercent24h: 1.2,
    });

    await emit({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      eventTime: 65_000,
      openTime: 60_000,
      closeTime: 119_000,
      open: 100.2,
      high: 100.9,
      low: 99.8,
      close: 100.7,
      volume: 1000,
      isFinal: true,
    });

    expect(deps.processPositionAutomation).toHaveBeenCalledTimes(1);
    expect(deps.processPositionAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ticker',
        symbol: 'BTCUSDT',
        marketType: 'FUTURES',
        lastPrice: 100.2,
      })
    );
  });

  it('keeps ticker path for position automation only', async () => {
    const { deps, emit } = createDeps();
    deps.listActiveBots = vi.fn(async () => [
      {
        id: 'bot-fallback',
        userId: 'user-1',
        mode: 'PAPER' as const,
        exchange: 'BINANCE' as const,
        paperStartBalance: 1000,
        marketType: 'FUTURES' as const,
        marketGroups: [
          {
            id: 'group-fallback',
            symbolGroupId: 'symbol-group-fallback',
            executionOrder: 1,
            maxOpenPositions: 1,
            symbols: ['BTCUSDT'],
            strategies: [],
          },
        ],
      },
    ]);

    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    const tickerEvent: MarketStreamEvent = {
      type: 'ticker',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 1_000,
      lastPrice: 64000,
      priceChangePercent24h: 2.5,
    };
    await emit(tickerEvent);

    expect(deps.processPositionAutomation).toHaveBeenCalledWith(tickerEvent);
    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
  });

  it('deduplicates runtime candle buffer by openTime and keeps latest OHLCV payload', async () => {
    const { deps } = createDeps();
    const loop = new RuntimeSignalLoop(deps);

    await loop.processCandleEvent({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      eventTime: 61_000,
      openTime: 0,
      closeTime: 59_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1000,
      isFinal: true,
    });

    await loop.processCandleEvent({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      eventTime: 62_000,
      openTime: 0,
      closeTime: 59_000,
      open: 100.2,
      high: 102.4,
      low: 98.7,
      close: 101.3,
      volume: 1250,
      isFinal: true,
    });

    const key = 'FUTURES|BTCUSDT|1m';
    const series = (loop as any).candleSeries.get(key);
    expect(series).toHaveLength(1);
    expect(series[0]).toEqual(
      expect.objectContaining({
        openTime: 0,
        closeTime: 59_000,
        open: 100.2,
        high: 102.4,
        low: 98.7,
        close: 101.3,
        volume: 1250,
      })
    );
  });

  it('stores runtime candles per interval and resolves closes by exact interval first', async () => {
    const { deps } = createDeps();
    const loop = new RuntimeSignalLoop(deps);

    await loop.processCandleEvent({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      eventTime: 61_000,
      openTime: 0,
      closeTime: 59_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1000,
      isFinal: true,
    });

    await loop.processCandleEvent({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '5m',
      eventTime: 301_000,
      openTime: 0,
      closeTime: 299_000,
      open: 100,
      high: 106,
      low: 98,
      close: 104.2,
      volume: 5000,
      isFinal: true,
    });

    expect(
      loop.getRecentCloses({
        marketType: 'FUTURES',
        symbol: 'BTCUSDT',
        interval: '1m',
      })
    ).toEqual([100.5]);

    expect(
      loop.getRecentCloses({
        marketType: 'FUTURES',
        symbol: 'BTCUSDT',
        interval: '5m',
      })
    ).toEqual([104.2]);
  });

  it('creates signal and orchestrates from final candle when strategy votes LONG', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps);
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emitFinalCandleSeries(emit);

    expect(deps.createSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: 'bot-1',
        strategyId: 'strategy-1',
        direction: 'LONG',
        payload: expect.objectContaining({
          source: 'market_stream.candle_final',
        }),
      })
    );
    expect(deps.orchestrateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: 'bot-1',
        strategyId: 'strategy-1',
        direction: 'LONG',
      })
    );
  });

  it('evaluates direction on the just-closed candle even when series contains a newer candle', () => {
    const { deps } = createDeps();
    const loop = new RuntimeSignalLoop(deps);

    const key = 'FUTURES|BTCUSDT|1m';
    (loop as any).candleSeries.set(key, [
      { openTime: 0, close: 120 },
      { openTime: 60_000, close: 110 },
      { openTime: 120_000, close: 100 },
      { openTime: 180_000, close: 130 },
    ]);

    const evaluation = (loop as any).evaluateStrategy({
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      strategy: strategyShortMomentum,
      decisionOpenTime: 120_000,
    });

    expect(evaluation.direction).toBe('SHORT');
  });

  it('evaluates FUNDING_RATE rule from cached derivatives series in runtime strategy path', () => {
    const { deps } = createDeps();
    const loop = new RuntimeSignalLoop(deps);

    const key = 'FUTURES|BTCUSDT|1m';
    (loop as any).candleSeries.set(key, [
      { openTime: 0, closeTime: 59_000, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { openTime: 60_000, closeTime: 119_000, open: 101, high: 102, low: 100, close: 101, volume: 1000 },
      { openTime: 120_000, closeTime: 179_000, open: 102, high: 103, low: 101, close: 102, volume: 1000 },
      { openTime: 180_000, closeTime: 239_000, open: 103, high: 104, low: 102, close: 103, volume: 1000 },
    ]);
    (loop as any).fundingRatePoints.set('FUTURES|BTCUSDT', [
      { timestamp: 0, fundingRate: 0.0002 },
      { timestamp: 120_000, fundingRate: -0.0003 },
    ]);

    const evaluation = (loop as any).evaluateStrategy({
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      strategy: strategyFundingLong,
      decisionOpenTime: 180_000,
    });

    expect(evaluation.direction).toBe('LONG');
    expect(evaluation.indicatorSummary).toContain('FUNDING_RATE');
  });

  it('evaluates OPEN_INTEREST rules from cached derivatives series in runtime strategy path', () => {
    const { deps } = createDeps();
    const loop = new RuntimeSignalLoop(deps);

    const key = 'FUTURES|BTCUSDT|1m';
    (loop as any).candleSeries.set(key, [
      { openTime: 0, closeTime: 59_000, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { openTime: 60_000, closeTime: 119_000, open: 101, high: 102, low: 100, close: 101, volume: 1000 },
      { openTime: 120_000, closeTime: 179_000, open: 102, high: 103, low: 101, close: 102, volume: 1000 },
      { openTime: 180_000, closeTime: 239_000, open: 103, high: 104, low: 102, close: 103, volume: 1000 },
      { openTime: 240_000, closeTime: 299_000, open: 104, high: 105, low: 103, close: 104, volume: 1000 },
    ]);
    (loop as any).openInterestPoints.set('FUTURES|BTCUSDT', [
      { timestamp: 0, openInterest: 1000 },
      { timestamp: 60_000, openInterest: 1100 },
      { timestamp: 120_000, openInterest: 1300 },
      { timestamp: 180_000, openInterest: 1700 },
      { timestamp: 240_000, openInterest: 2600 },
    ]);

    const evaluation = (loop as any).evaluateStrategy({
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      strategy: strategyOpenInterestShort,
      decisionOpenTime: 240_000,
    });

    expect(evaluation.direction).toBe('SHORT');
    expect(evaluation.indicatorSummary).toContain('OPEN_INTEREST');
  });

  it('evaluates ORDER_BOOK rules from cached derivatives series in runtime strategy path', () => {
    const { deps } = createDeps();
    const loop = new RuntimeSignalLoop(deps);

    const key = 'FUTURES|BTCUSDT|1m';
    (loop as any).candleSeries.set(key, [
      { openTime: 0, closeTime: 59_000, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { openTime: 60_000, closeTime: 119_000, open: 101, high: 102, low: 100, close: 101, volume: 1000 },
      { openTime: 120_000, closeTime: 179_000, open: 102, high: 103, low: 101, close: 102, volume: 1000 },
      { openTime: 180_000, closeTime: 239_000, open: 103, high: 104, low: 102, close: 103, volume: 1000 },
    ]);
    (loop as any).orderBookPoints.set('FUTURES|BTCUSDT', [
      { timestamp: 0, imbalance: 0.1, spreadBps: 8, depthRatio: 1.1 },
      { timestamp: 120_000, imbalance: 0.3, spreadBps: 5, depthRatio: 1.8 },
    ]);

    const evaluation = (loop as any).evaluateStrategy({
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      strategy: strategyOrderBookLong,
      decisionOpenTime: 180_000,
    });

    expect(evaluation.direction).toBe('LONG');
    expect(evaluation.indicatorSummary).toContain('ORDER_BOOK_IMBALANCE');
  });

  it('fails closed for derivatives rules when runtime derivative snapshots are missing', () => {
    const { deps } = createDeps();
    const loop = new RuntimeSignalLoop(deps);

    const key = 'FUTURES|BTCUSDT|1m';
    (loop as any).candleSeries.set(key, [
      { openTime: 0, closeTime: 59_000, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { openTime: 60_000, closeTime: 119_000, open: 101, high: 102, low: 100, close: 101, volume: 1000 },
      { openTime: 120_000, closeTime: 179_000, open: 102, high: 103, low: 101, close: 102, volume: 1000 },
      { openTime: 180_000, closeTime: 239_000, open: 103, high: 104, low: 102, close: 103, volume: 1000 },
      { openTime: 240_000, closeTime: 299_000, open: 104, high: 105, low: 103, close: 104, volume: 1000 },
    ]);

    const fundingEvaluation = (loop as any).evaluateStrategy({
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      strategy: strategyFundingLong,
      decisionOpenTime: 240_000,
    });
    const openInterestEvaluation = (loop as any).evaluateStrategy({
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      strategy: strategyOpenInterestShort,
      decisionOpenTime: 240_000,
    });
    const orderBookEvaluation = (loop as any).evaluateStrategy({
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      strategy: strategyOrderBookLong,
      decisionOpenTime: 240_000,
    });

    expect(fundingEvaluation.direction).toBeNull();
    expect(openInterestEvaluation.direction).toBeNull();
    expect(orderBookEvaluation.direction).toBeNull();
  });

  it('deduplicates duplicate final-candle window events', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps);
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emitFinalCandleSeries(emit);
    const signalCallsAfterFirstPass = deps.createSignal.mock.calls.length;
    const orchestrateCallsAfterFirstPass = deps.orchestrateFn.mock.calls.length;

    await emit({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      eventTime: 10_000 + 7 * 60_000,
      openTime: 7 * 60_000,
      closeTime: 7 * 60_000 + 59_000,
      open: 107,
      high: 108,
      low: 106,
      close: 107,
      volume: 1000,
      isFinal: true,
    });

    expect(deps.createSignal).toHaveBeenCalledTimes(signalCallsAfterFirstPass);
    expect(deps.orchestrateFn).toHaveBeenCalledTimes(orchestrateCallsAfterFirstPass);
  });

  it('skips final-candle LONG/SHORT execution when pre-trade blocks signal', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps);
    deps.analyzePreTradeFn = vi.fn(async () => ({
      allowed: false,
      reasons: ['blocked'],
      metrics: {
        userOpenPositions: 1,
        botOpenPositions: 1,
        hasOpenPositionOnSymbol: true,
      },
    }));
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emitFinalCandleSeries(emit);

    expect(deps.analyzePreTradeFn).toHaveBeenCalled();
    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
  });

  it('blocks LIVE execution before orchestrator when exchange minimum constraints fail', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps, { mode: 'LIVE' });
    deps.recordRuntimeEvent = vi.fn(async () => undefined);
    deps.validateExchangeOrderFn = vi.fn(async () => ({
      allowed: false,
      reason: 'exchange_min_notional_not_met',
      details: {
        symbol: 'BTCUSDT',
        quantity: 0.01,
        price: 100,
        notional: 1,
        minQuantity: 0.001,
        minNotional: 5,
      },
    }));

    const loop = new RuntimeSignalLoop(deps);
    await loop.start();
    await emitFinalCandleSeries(emit);

    expect(deps.validateExchangeOrderFn).toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
    expect(deps.recordRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PRETRADE_BLOCKED',
        payload: expect.objectContaining({
          reason: 'EXCHANGE_MIN_ORDER_CONSTRAINT',
          constraintReason: 'exchange_min_notional_not_met',
        }),
      })
    );
  });

  it('skips final-candle LONG/SHORT execution when market-group maxOpenPositions is reached', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps, { maxOpenPositions: 1 });
    deps.countOpenPositionsForBotAndSymbols = vi.fn(async () => 1);
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emitFinalCandleSeries(emit);

    expect(deps.analyzePreTradeFn).not.toHaveBeenCalled();
    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
  });

  it('skips final-candle LONG/SHORT execution when managed external position already exists on symbol', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps, { maxOpenPositions: 5 });
    deps.listRuntimeManagedExternalPositions = vi.fn(async () => [
      { userId: 'user-1', symbol: 'BTCUSDT' },
    ]);
    deps.recordRuntimeEvent = vi.fn(async () => undefined);
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emitFinalCandleSeries(emit);

    expect(deps.countOpenPositionsForBotAndSymbols).not.toHaveBeenCalled();
    expect(deps.analyzePreTradeFn).not.toHaveBeenCalled();
    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
    expect(deps.recordRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PRETRADE_BLOCKED',
        payload: expect.objectContaining({
          reason: 'EXTERNAL_POSITION_ALREADY_OPEN',
        }),
      })
    );
  });

  it('does not evaluate strategy decisions on ticker events', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps);
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emit({
      type: 'ticker',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 20_000,
      lastPrice: 108,
      priceChangePercent24h: 2.1,
    });

    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
  });

  it('ignores non-final candle events for strategy decisions', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps);
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    for (let index = 0; index < 8; index += 1) {
      await emit({
        type: 'candle',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        symbol: 'BTCUSDT',
        interval: '1m',
        eventTime: 10_000 + index * 60_000,
        openTime: index * 60_000,
        closeTime: index * 60_000 + 59_000,
        open: 100 + index,
        high: 101 + index,
        low: 99 + index,
        close: 100 + index,
        volume: 1000,
        isFinal: false,
      });
    }

    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
    expect(deps.processPositionAutomation).not.toHaveBeenCalled();
  });

  it('keeps runtime session watchdog active and re-ensures sessions periodically', async () => {
    vi.useFakeTimers();
    const { deps } = createDeps();
    withStrategyBot(deps, { strategies: [] });
    deps.ensureRuntimeSession = vi.fn(async () => 'session-1');
    deps.closeInactiveRuntimeSessions = vi.fn(async () => undefined);

    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    expect(deps.ensureRuntimeSession).toHaveBeenCalledTimes(1);
    expect(deps.closeInactiveRuntimeSessions).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(16_000);

    expect((deps.ensureRuntimeSession as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
    expect((deps.closeInactiveRuntimeSessions as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);

    await loop.stop();
    vi.useRealTimers();
  });

  it('keeps watchdog ticker reprocessing strategy-neutral via processTickerEvent', async () => {
    const { deps } = createDeps();
    withStrategyBot(deps);
    const loop = new RuntimeSignalLoop(deps);

    await loop.processTickerEvent({
      type: 'ticker',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 25_000,
      lastPrice: 109,
      priceChangePercent24h: 1.8,
    });

    expect(deps.processPositionAutomation).toHaveBeenCalledTimes(1);
    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
  });

  it('restarts subscription without canceling sessions on NO_EVENT stall window', async () => {
    vi.useFakeTimers();
    const { deps } = createDeps();
    withStrategyBot(deps, { strategies: [] });
    deps.ensureRuntimeSession = vi.fn(async () => 'session-1');
    deps.closeRuntimeSession = vi.fn(async () => undefined);
    deps.closeInactiveRuntimeSessions = vi.fn(async () => undefined);
    deps.stallNoEventMs = 20_000;
    deps.stallNoHeartbeatMs = 300_000;
    deps.stallDetectorEnabled = true;

    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    expect(loop.isRunning()).toBe(true);
    await vi.advanceTimersByTimeAsync(35_000);
    await vi.waitFor(() => expect(loop.isRunning()).toBe(false));

    expect(deps.closeRuntimeSession).not.toHaveBeenCalled();
    expect(loop.isRunning()).toBe(false);
    vi.useRealTimers();
  });

  it('cancels running sessions on NO_HEARTBEAT stall when session sync keeps failing', async () => {
    vi.useFakeTimers();
    const { deps } = createDeps();
    withStrategyBot(deps, { strategies: [] });
    deps.closeRuntimeSession = vi.fn(async () => undefined);
    deps.closeInactiveRuntimeSessions = vi.fn(async () => undefined);
    deps.stallNoEventMs = 300_000;
    deps.stallNoHeartbeatMs = 20_000;
    deps.stallDetectorEnabled = true;
    const ensureRuntimeSession = vi
      .fn()
      .mockResolvedValueOnce('session-1')
      .mockRejectedValue(new Error('db_unavailable'));
    deps.ensureRuntimeSession = ensureRuntimeSession;

    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    expect(loop.isRunning()).toBe(true);
    await vi.advanceTimersByTimeAsync(50_000);
    await vi.waitFor(() => expect(deps.closeRuntimeSession).toHaveBeenCalled());

    expect(deps.closeRuntimeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: 'bot-1',
        status: 'CANCELED',
        stopReason: 'runtime_stall_no_heartbeat',
      })
    );
    expect(loop.isRunning()).toBe(false);
    vi.useRealTimers();
  });

  it('auto-restarts runtime loop after stall with cooldown', async () => {
    vi.useFakeTimers();
    const { deps } = createDeps();
    withStrategyBot(deps, { strategies: [] });
    deps.ensureRuntimeSession = vi.fn(async () => 'session-1');
    deps.closeInactiveRuntimeSessions = vi.fn(async () => undefined);
    deps.stallNoEventMs = 20_000;
    deps.stallNoHeartbeatMs = 300_000;
    deps.stallDetectorEnabled = true;
    deps.autoRestartEnabled = true;
    deps.autoRestartCooldownMs = 5_000;
    deps.autoRestartMaxAttempts = 3;
    deps.autoRestartWindowMs = 60_000;

    const loop = new RuntimeSignalLoop(deps);
    await loop.start();
    expect(loop.isRunning()).toBe(true);
    expect(deps.subscribe).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(31_000);
    await vi.waitFor(() => expect(loop.isRunning()).toBe(false));

    await vi.advanceTimersByTimeAsync(6_000);
    await vi.waitFor(() => expect(loop.isRunning()).toBe(true));

    expect((deps.subscribe as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
    await loop.stop();
    vi.useRealTimers();
  });

  it('stops auto-restart attempts after reaching max-attempt guardrail within window', async () => {
    vi.useFakeTimers();
    const { deps } = createDeps();
    withStrategyBot(deps, { strategies: [] });
    deps.ensureRuntimeSession = vi.fn(async () => 'session-1');
    deps.closeInactiveRuntimeSessions = vi.fn(async () => undefined);
    deps.stallNoEventMs = 20_000;
    deps.stallNoHeartbeatMs = 300_000;
    deps.stallDetectorEnabled = true;
    deps.autoRestartEnabled = true;
    deps.autoRestartCooldownMs = 2_000;
    deps.autoRestartMaxAttempts = 1;
    deps.autoRestartWindowMs = 60_000;

    let subscribeCalls = 0;
    deps.subscribe = vi.fn(async () => {
      subscribeCalls += 1;
      if (subscribeCalls === 1) {
        return async () => undefined;
      }
      throw new Error('restart_subscribe_failure');
    });

    const loop = new RuntimeSignalLoop(deps);
    await loop.start();
    expect(loop.isRunning()).toBe(true);

    await vi.advanceTimersByTimeAsync(31_000);
    await vi.waitFor(() => expect(loop.isRunning()).toBe(false));

    await vi.advanceTimersByTimeAsync(20_000);

    expect(subscribeCalls).toBe(2);
    expect(loop.isRunning()).toBe(false);
    await loop.stop();
    vi.useRealTimers();
  });

  it('keeps session continuity during long soak with heartbeat recovery and no stuck CANCELED loop', async () => {
    vi.useFakeTimers();
    const { deps } = createDeps();
    withStrategyBot(deps, { strategies: [] });
    deps.closeRuntimeSession = vi.fn(async () => undefined);
    deps.closeInactiveRuntimeSessions = vi.fn(async () => undefined);
    deps.stallNoEventMs = 300_000;
    deps.stallNoHeartbeatMs = 20_000;
    deps.stallDetectorEnabled = true;
    deps.autoRestartEnabled = true;
    deps.autoRestartCooldownMs = 2_000;
    deps.autoRestartMaxAttempts = 5;
    deps.autoRestartWindowMs = 120_000;

    let ensureCalls = 0;
    deps.ensureRuntimeSession = vi.fn(async () => {
      ensureCalls += 1;
      if (ensureCalls <= 1) return 'session-1';
      if (ensureCalls <= 3) throw new Error('db_unavailable');
      return 'session-1';
    });

    const loop = new RuntimeSignalLoop(deps);
    await loop.start();
    expect(loop.isRunning()).toBe(true);
    expect(deps.subscribe).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(45_000);
    await vi.waitFor(() => expect(deps.closeRuntimeSession).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect((deps.subscribe as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2));
    await vi.waitFor(() => expect(loop.isRunning()).toBe(true));

    await vi.advanceTimersByTimeAsync(180_000);

    expect(loop.isRunning()).toBe(true);
    expect(deps.closeRuntimeSession).toHaveBeenCalledTimes(1);
    expect(deps.closeRuntimeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: 'bot-1',
        status: 'CANCELED',
        stopReason: 'runtime_stall_no_heartbeat',
      })
    );
    expect(ensureCalls).toBeGreaterThan(5);

    await loop.stop();
    vi.useRealTimers();
  });

  it('keeps stream subscription alive when single event handler fails', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps, { strategies: [] });
    deps.processPositionAutomation = vi.fn(async () => {
      throw new Error('automation_failure');
    });

    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await expect(
      emit({
        type: 'ticker',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        symbol: 'BTCUSDT',
        eventTime: 30_000,
        lastPrice: 100,
        priceChangePercent24h: 0.5,
      })
    ).resolves.toBeUndefined();

    expect(loop.isRunning()).toBe(true);
  });

  it('merges final-candle multi-strategy votes with EXIT priority and trace-only behavior', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps, { strategies: [strategyExit, strategyLong] });
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emitFinalCandleSeries(emit);

    expect(deps.createSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: 'bot-1',
        strategyId: 'strategy-exit',
        direction: 'EXIT',
        payload: expect.objectContaining({
          strategyExitTraceOnly: true,
        }),
      })
    );
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
  });

  it('ignores final-candle decisions when bot marketType does not match stream marketType', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps, { marketType: 'SPOT' });
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emitFinalCandleSeries(emit, { marketType: 'FUTURES' });

    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
  });

  it('ignores final-candle decisions when bot exchange does not match stream exchange', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps, { exchange: 'BYBIT' });
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emitFinalCandleSeries(emit, { exchange: 'BINANCE' });

    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
  });

  it('derives market-group max-open cap from active strategy risk settings', () => {
    const derived = deriveRuntimeGroupMaxOpenPositions({
      configuredGroupMaxOpenPositions: 6,
      strategies: [
        {
          strategyConfig: {
            additional: {
              maxPositions: 4,
            },
          },
        },
        {
          strategyConfig: {
            additional: {
              maxOpenPositions: 2,
            },
          },
        },
      ],
    });
    expect(derived).toBe(2);
  });

  it('falls back to configured group max-open cap when strategies do not define risk limits', () => {
    const derived = deriveRuntimeGroupMaxOpenPositions({
      configuredGroupMaxOpenPositions: 3,
      strategies: [
        {
          strategyConfig: {
            additional: {
              dcaEnabled: true,
            },
          },
        },
      ],
    });
    expect(derived).toBe(3);
  });

  it('supports runtime loop only for exchanges with mode-specific capabilities', () => {
    expect(
      supportsRuntimeSignalLoopExchange({
        exchange: 'BINANCE',
        mode: 'PAPER',
      })
    ).toBe(true);

    expect(
      supportsRuntimeSignalLoopExchange({
        exchange: 'BINANCE',
        mode: 'LIVE',
      })
    ).toBe(true);

    expect(
      supportsRuntimeSignalLoopExchange({
        exchange: 'BYBIT',
        mode: 'PAPER',
      })
    ).toBe(false);

    expect(
      supportsRuntimeSignalLoopExchange({
        exchange: 'OKX',
        mode: 'LIVE',
      })
    ).toBe(false);
  });
});
