import { describe, expect, it, vi } from 'vitest';
import { RuntimeScanLoop } from './runtimeScanLoop.service';

describe('RuntimeScanLoop', () => {
  it('processes configured symbols and forwards synthesized ticker events', async () => {
    const deps = {
      listScanSymbols: vi.fn(async () => ['BTCUSDT', 'ETHUSDT']),
      getTickerSnapshot: vi.fn(async (symbol: string) => {
        if (symbol === 'BTCUSDT') {
          return { symbol: 'BTCUSDT', lastPrice: 60300, priceChangePercent24h: 0.5 };
        }
        return { symbol: 'ETHUSDT', lastPrice: 2970, priceChangePercent24h: -1 };
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
