import { describe, expect, it, vi } from 'vitest';
import { RuntimeSignalLoop } from './runtimeSignalLoop.service';
import { MarketStreamEvent } from '../market-stream/binanceStream.types';

const createDeps = () => {
  let handler: ((event: MarketStreamEvent) => void) | null = null;

  const deps: any = {
    subscribe: vi.fn(async (inputHandler: (event: MarketStreamEvent) => void | Promise<void>) => {
      handler = inputHandler as (event: MarketStreamEvent) => void;
      return async () => undefined;
    }),
    listActiveBots: vi.fn(async () => [
      {
        id: 'bot-1',
        userId: 'user-1',
        mode: 'PAPER' as const,
        marketType: 'FUTURES' as const,
        strategyId: null,
        strategyInterval: null,
        strategyConfig: null,
      },
    ]),
    listRuntimeManagedExternalPositions: vi.fn(async () => []),
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

describe('RuntimeSignalLoop', () => {
  it('creates signal and orchestrates on actionable ticker event', async () => {
    const { deps, emit } = createDeps();
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emit({
      type: 'ticker',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 1_000,
      lastPrice: 64000,
      priceChangePercent24h: 1.5,
    });

    expect(deps.listActiveBots).toHaveBeenCalled();
    expect(deps.analyzePreTradeFn).toHaveBeenCalled();
    expect(deps.createSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'LONG',
        symbol: 'BTCUSDT',
      })
    );
    expect(deps.orchestrateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'LONG',
        symbol: 'BTCUSDT',
      })
    );
  });

  it('skips signal/orchestration when pre-trade blocks LONG/SHORT', async () => {
    const { deps, emit } = createDeps();
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

    await emit({
      type: 'ticker',
      marketType: 'FUTURES',
      symbol: 'ETHUSDT',
      eventTime: 2_000,
      lastPrice: 3000,
      priceChangePercent24h: -1.2,
    });

    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
  });

  it('deduplicates repeated direction in cooldown window', async () => {
    const { deps, emit } = createDeps();
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emit({
      type: 'ticker',
      marketType: 'FUTURES',
      symbol: 'SOLUSDT',
      eventTime: 3_000,
      lastPrice: 150,
      priceChangePercent24h: 1.1,
    });
    await emit({
      type: 'ticker',
      marketType: 'FUTURES',
      symbol: 'SOLUSDT',
      eventTime: 4_000,
      lastPrice: 151,
      priceChangePercent24h: 1.2,
    });

    expect(deps.createSignal).toHaveBeenCalledTimes(1);
    expect(deps.orchestrateFn).toHaveBeenCalledTimes(1);
  });

  it('handles EXIT signal for runtime-managed external position without botId', async () => {
    const { deps, emit } = createDeps();
    deps.listActiveBots = vi.fn(async () => []);
    deps.listRuntimeManagedExternalPositions = vi.fn(async () => [
      {
        userId: 'manual-user-1',
        symbol: 'BTCUSDT',
      },
    ]);
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emit({
      type: 'ticker',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 6_000,
      lastPrice: 63500,
      priceChangePercent24h: 0.05,
    });

    expect(deps.createSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'manual-user-1',
        botId: undefined,
        direction: 'EXIT',
        symbol: 'BTCUSDT',
      })
    );
    expect(deps.orchestrateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'manual-user-1',
        direction: 'EXIT',
        symbol: 'BTCUSDT',
      })
    );
  });

  it('ignores ticker events when bot marketType does not match stream marketType', async () => {
    const { deps, emit } = createDeps();
    deps.listActiveBots = vi.fn(async () => [
      {
        id: 'bot-spot',
        userId: 'user-1',
        mode: 'PAPER' as const,
        marketType: 'SPOT' as const,
        strategyId: null,
        strategyInterval: null,
        strategyConfig: null,
      },
    ]);
    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    await emit({
      type: 'ticker',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 8_000,
      lastPrice: 64500,
      priceChangePercent24h: 1.4,
    });

    expect(deps.analyzePreTradeFn).not.toHaveBeenCalled();
    expect(deps.createSignal).not.toHaveBeenCalled();
    expect(deps.orchestrateFn).not.toHaveBeenCalled();
  });

  it('uses strategy indicators when strategy is assigned', async () => {
    const { deps, emit } = createDeps();
    deps.listActiveBots = vi.fn(async () => [
      {
        id: 'bot-strategy',
        userId: 'user-1',
        mode: 'PAPER' as const,
        marketType: 'FUTURES' as const,
        strategyId: 'strategy-1',
        strategyInterval: '1m',
        strategyConfig: {
          open: {
            indicatorsLong: [
              { name: 'EMA', params: { fast: 3, slow: 5 }, condition: '>' },
              { name: 'RSI', params: { period: 3 }, condition: '>', value: 50 },
            ],
            indicatorsShort: [],
          },
        },
      },
    ]);

    const loop = new RuntimeSignalLoop(deps);
    await loop.start();

    for (let index = 0; index < 8; index += 1) {
      await emit({
        type: 'candle',
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
        isFinal: true,
      });
    }

    await emit({
      type: 'ticker',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 20_000,
      lastPrice: 108,
      priceChangePercent24h: 0.1,
    });

    expect(deps.createSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: 'bot-strategy',
        strategyId: 'strategy-1',
        direction: 'LONG',
      })
    );
  });
});
