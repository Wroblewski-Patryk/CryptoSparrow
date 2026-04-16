import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketStreamEvent } from './binanceStream.types';

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock('redis', () => ({
  createClient: createClientMock,
}));

const buildRedisClientMock = () => ({
  on: vi.fn(),
  connect: vi.fn(async () => undefined),
  subscribe: vi.fn(async () => 1),
  unsubscribe: vi.fn(async () => 1),
  disconnect: vi.fn(async () => undefined),
  publish: vi.fn(async () => 1),
  set: vi.fn(async () => 'OK' as const),
  eval: vi.fn(async () => 1),
});

const initialNodeEnv = process.env.NODE_ENV;

describe('marketStreamFanout', () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockReset();
  });

  afterEach(() => {
    process.env.NODE_ENV = initialNodeEnv;
  });

  it('forwards each valid payload once and ignores malformed messages', async () => {
    process.env.NODE_ENV = 'development';
    const subscriberClient = buildRedisClientMock();
    let subscriberHandler: ((payload: string) => void) | null = null;
    subscriberClient.subscribe.mockImplementation(async (_channel: string, handler: (payload: string) => void) => {
      subscriberHandler = handler;
      return 1;
    });
    createClientMock.mockReturnValue(subscriberClient as any);

    const { subscribeMarketStreamEvents } = await import('./marketStreamFanout');
    const onEvent = vi.fn();

    const unsubscribe = await subscribeMarketStreamEvents(onEvent);

    const event: MarketStreamEvent = {
      type: 'ticker',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 120_000,
      lastPrice: 100.5,
      priceChangePercent24h: 0.4,
    };

    subscriberHandler?.(JSON.stringify(event));
    subscriberHandler?.('{bad-json');
    await Promise.resolve();

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(event);

    await unsubscribe();
    expect(subscriberClient.unsubscribe).toHaveBeenCalledWith('market_stream.events');
    expect(subscriberClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it('acquires and releases warmup lock with NX/PX semantics', async () => {
    process.env.NODE_ENV = 'development';
    const lockClient = buildRedisClientMock();
    lockClient.set.mockResolvedValue('OK');
    createClientMock.mockReturnValue(lockClient as any);

    const { acquireMarketStreamWarmupLock } = await import('./marketStreamFanout');
    const lock = await acquireMarketStreamWarmupLock({
      seriesKey: 'FUTURES|BTCUSDT|5m',
      ttlMs: 30_000,
    });

    expect(lock.acquired).toBe(true);
    expect(lockClient.set).toHaveBeenCalledWith(
      'market_stream.runtime_warmup_lock:FUTURES|BTCUSDT|5m',
      expect.any(String),
      expect.objectContaining({
        NX: true,
        PX: 30_000,
      })
    );

    await lock.release();
    expect(lockClient.eval).toHaveBeenCalledTimes(1);
  });

  it('returns non-acquired lock handle when key is already held', async () => {
    process.env.NODE_ENV = 'development';
    const lockClient = buildRedisClientMock();
    lockClient.set.mockResolvedValue(null);
    createClientMock.mockReturnValue(lockClient as any);

    const { acquireMarketStreamWarmupLock } = await import('./marketStreamFanout');
    const lock = await acquireMarketStreamWarmupLock({
      seriesKey: 'FUTURES|BTCUSDT|5m',
      ttlMs: 30_000,
    });

    expect(lock.acquired).toBe(false);
  });
});
