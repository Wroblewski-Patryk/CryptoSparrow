import { describe, expect, it, vi } from 'vitest';
import { RuntimeScanLoop, isRuntimeScanWatchdogEnabled } from './runtimeScanLoop.service';

describe('RuntimeScanLoop', () => {
  it('keeps watchdog auto-loop disabled by default', async () => {
    vi.useFakeTimers();
    const deps = {
      listScanSymbols: vi.fn(async () => ['BTCUSDT']),
      getTickerSnapshot: vi.fn(async () => ({
        symbol: 'BTCUSDT',
        marketType: 'FUTURES' as const,
        lastPrice: 60300,
        priceChangePercent24h: 0.5,
      })),
      processTicker: vi.fn(async (_event: Record<string, unknown>) => undefined),
      nowMs: vi.fn(() => 123_456),
    };

    const loop = new RuntimeScanLoop(deps);
    loop.start();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(isRuntimeScanWatchdogEnabled()).toBe(false);
    expect(deps.processTicker).not.toHaveBeenCalled();
    loop.stop();
    vi.useRealTimers();
  });

  it('processes configured symbols and forwards synthesized ticker events', async () => {
    const deps = {
      listScanSymbols: vi.fn(async () => ['BTCUSDT', 'ETHUSDT']),
      getTickerSnapshot: vi.fn(async (symbol: string) => {
        if (symbol === 'BTCUSDT') {
          return { symbol: 'BTCUSDT', marketType: 'FUTURES' as const, lastPrice: 60300, priceChangePercent24h: 0.5 };
        }
        return { symbol: 'ETHUSDT', marketType: 'FUTURES' as const, lastPrice: 2970, priceChangePercent24h: -1 };
      }),
      processTicker: vi.fn(async (_event: Record<string, unknown>) => undefined),
      nowMs: vi.fn(() => 123_456),
    };

    const loop = new RuntimeScanLoop(deps);
    await loop.runOnce();

    expect(deps.processTicker).toHaveBeenCalledTimes(2);
    expect(deps.processTicker).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'BTCUSDT',
        lastPrice: 60300,
      })
    );
    expect(deps.processTicker).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'ETHUSDT',
        lastPrice: 2970,
      })
    );
  });

  it('forwards watchdog fallback as ticker-only payloads (no candle semantics)', async () => {
    const deps = {
      listScanSymbols: vi.fn(async () => ['BTCUSDT']),
      getTickerSnapshot: vi.fn(async () => ({
        symbol: 'BTCUSDT',
        marketType: 'FUTURES' as const,
        lastPrice: 61234,
        priceChangePercent24h: 1.25,
      })),
      processTicker: vi.fn(async (_event: Record<string, unknown>) => undefined),
      nowMs: vi.fn(() => 777_000),
    };

    const loop = new RuntimeScanLoop(deps);
    await loop.runOnce();

    expect(deps.processTicker).toHaveBeenCalledTimes(1);
    const forwardedCall = deps.processTicker.mock.calls[0];
    expect(forwardedCall).toBeTruthy();
    const forwarded = (forwardedCall?.[0] ?? {}) as Record<string, unknown>;
    expect(forwarded.type).toBe('ticker');
    expect(forwarded.symbol).toBe('BTCUSDT');
    expect(forwarded.eventTime).toBe(777_000);
    expect(forwarded).not.toHaveProperty('interval');
    expect(forwarded).not.toHaveProperty('isFinal');
    expect(forwarded).not.toHaveProperty('openTime');
    expect(forwarded).not.toHaveProperty('closeTime');
  });
});
