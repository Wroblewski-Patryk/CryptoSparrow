import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaperRuntimeMarketDataService, PaperRuntimeService } from './paperRuntime.service';

const baseCandles = [
  {
    timestamp: 1_700_000_000_000,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume: 1000,
  },
];

describe('PaperRuntimeService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls live market feed on interval and forwards candles to task handler', async () => {
    const marketDataService: PaperRuntimeMarketDataService = {
      ingestOHLCV: vi.fn().mockResolvedValue(baseCandles),
    };
    const onTick = vi.fn().mockResolvedValue(undefined);
    const runtime = new PaperRuntimeService(marketDataService);

    runtime.start({
      pollIntervalMs: 1000,
      tasks: [{ symbol: 'BTCUSDT', timeframe: '1m', onTick }],
    });

    await vi.advanceTimersByTimeAsync(3000);

    expect(marketDataService.ingestOHLCV).toHaveBeenCalledTimes(3);
    expect(marketDataService.ingestOHLCV).toHaveBeenCalledWith(
      { symbol: 'BTCUSDT', timeframe: '1m', limit: 200 },
      true
    );
    expect(onTick).toHaveBeenCalledTimes(3);
    expect(onTick).toHaveBeenLastCalledWith(baseCandles);
  });

  it('stops polling when runtime is stopped', async () => {
    const marketDataService: PaperRuntimeMarketDataService = {
      ingestOHLCV: vi.fn().mockResolvedValue(baseCandles),
    };
    const runtime = new PaperRuntimeService(marketDataService);

    runtime.start({
      pollIntervalMs: 1000,
      tasks: [{ symbol: 'BTCUSDT', timeframe: '1m', onTick: vi.fn() }],
    });

    await vi.advanceTimersByTimeAsync(1500);
    runtime.stop();
    await vi.advanceTimersByTimeAsync(3000);

    expect(marketDataService.ingestOHLCV).toHaveBeenCalledTimes(1);
    expect(runtime.isRunning()).toBe(false);
  });

  it('does not overlap task execution for the same symbol and timeframe', async () => {
    let releaseFetch: () => void = () => {};
    const pendingFetch = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });

    const marketDataService: PaperRuntimeMarketDataService = {
      ingestOHLCV: vi.fn().mockImplementation(async () => {
        await pendingFetch;
        return baseCandles;
      }),
    };
    const runtime = new PaperRuntimeService(marketDataService);

    runtime.start({
      pollIntervalMs: 1000,
      tasks: [{ symbol: 'BTCUSDT', timeframe: '1m', onTick: vi.fn() }],
    });

    await vi.advanceTimersByTimeAsync(3000);
    expect(marketDataService.ingestOHLCV).toHaveBeenCalledTimes(1);

    releaseFetch();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    expect(marketDataService.ingestOHLCV).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid poll interval values', () => {
    const marketDataService: PaperRuntimeMarketDataService = {
      ingestOHLCV: vi.fn().mockResolvedValue(baseCandles),
    };
    const runtime = new PaperRuntimeService(marketDataService);

    expect(() =>
      runtime.start({
        pollIntervalMs: 0,
        tasks: [{ symbol: 'BTCUSDT', timeframe: '1m', onTick: vi.fn() }],
      })
    ).toThrow('Paper runtime requires a positive pollIntervalMs');
  });

  it('rejects tasks with empty symbol/timeframe', () => {
    const marketDataService: PaperRuntimeMarketDataService = {
      ingestOHLCV: vi.fn().mockResolvedValue(baseCandles),
    };
    const runtime = new PaperRuntimeService(marketDataService);

    expect(() =>
      runtime.start({
        pollIntervalMs: 1000,
        tasks: [{ symbol: ' ', timeframe: '1m', onTick: vi.fn() }],
      })
    ).toThrow('Paper runtime task requires a non-empty symbol');

    expect(() =>
      runtime.start({
        pollIntervalMs: 1000,
        tasks: [{ symbol: 'BTCUSDT', timeframe: ' ', onTick: vi.fn() }],
      })
    ).toThrow('Paper runtime task requires a non-empty timeframe');
  });

  it('emits structured worker logs for skip/error/success paths', async () => {
    let releaseFetch: () => void = () => {};
    const pendingFetch = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const marketDataService: PaperRuntimeMarketDataService = {
      ingestOHLCV: vi
        .fn()
        .mockImplementationOnce(async () => {
          await pendingFetch;
          return baseCandles;
        })
        .mockResolvedValueOnce(baseCandles)
        .mockRejectedValueOnce(new Error('feed unavailable')),
    };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const runtime = new PaperRuntimeService(marketDataService, logger);

    const slowOnTick = vi.fn().mockResolvedValue(undefined);
    const failingOnTick = vi.fn().mockRejectedValue(new Error('handler failed'));

    const firstRun = runtime.runOnce([{ symbol: 'BTCUSDT', timeframe: '1m', onTick: slowOnTick }]);
    await Promise.resolve();
    await runtime.runOnce([{ symbol: 'BTCUSDT', timeframe: '1m', onTick: vi.fn() }]);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'worker.paper_runtime.task_skipped_inflight',
      })
    );

    releaseFetch();
    await firstRun;

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'worker.paper_runtime.task_processed',
        candlesCount: baseCandles.length,
      })
    );

    await runtime.runOnce([{ symbol: 'ETHUSDT', timeframe: '1m', onTick: failingOnTick }]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'worker.paper_runtime.task_failed',
      })
    );
  });
});
