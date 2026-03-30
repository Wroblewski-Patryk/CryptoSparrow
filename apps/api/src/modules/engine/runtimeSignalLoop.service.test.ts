import { describe, expect, it, vi } from 'vitest';
import { RuntimeSignalLoop } from './runtimeSignalLoop.service';
import { MarketStreamEvent } from '../market-stream/binanceStream.types';

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

const withStrategyBot = (deps: any, options?: { maxOpenPositions?: number; strategies?: any[]; marketType?: 'FUTURES' | 'SPOT' }) => {
  deps.listActiveBots = vi.fn(async () => [
    {
      id: 'bot-1',
      userId: 'user-1',
      mode: 'PAPER' as const,
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
  options?: { symbol?: string; marketType?: 'FUTURES' | 'SPOT'; interval?: string; points?: number }
) => {
  const symbol = options?.symbol ?? 'BTCUSDT';
  const marketType = options?.marketType ?? 'FUTURES';
  const interval = options?.interval ?? '1m';
  const points = options?.points ?? 8;
  for (let index = 0; index < points; index += 1) {
    await emit({
      type: 'candle',
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
  it('keeps ticker path for position automation only', async () => {
    const { deps, emit } = createDeps();
    deps.listActiveBots = vi.fn(async () => [
      {
        id: 'bot-fallback',
        userId: 'user-1',
        mode: 'PAPER' as const,
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

  it('does not evaluate strategy decisions on ticker events', async () => {
    const { deps, emit } = createDeps();
    withStrategyBot(deps);
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emit({
      type: 'ticker',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 20_000,
      lastPrice: 108,
      priceChangePercent24h: 2.1,
    });

    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
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
});
