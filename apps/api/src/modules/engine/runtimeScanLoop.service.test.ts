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
      processTicker: vi.fn(async () => undefined),
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
      processTicker: vi.fn(async () => undefined),
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
});
