import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MarketDataProvider, MarketDataService } from './marketData.service';
import { OhlcvCandle } from './marketData.types';

const baseCandles: OhlcvCandle[] = [
  {
    timestamp: 1_700_000_000_000,
    open: 100,
    high: 110,
    low: 95,
    close: 105,
    volume: 1234,
  },
];

describe('MarketDataService cache behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns cached OHLCV within TTL', async () => {
    const provider: MarketDataProvider = {
      fetchOHLCV: vi.fn().mockResolvedValue(baseCandles),
    };
    const service = new MarketDataService(provider, { cacheTtlMs: 60_000 });

    const first = await service.ingestOHLCV({
      symbol: 'btcusdt',
      timeframe: '1m',
      limit: 100,
    });
    const second = await service.ingestOHLCV({
      symbol: 'BTCUSDT',
      timeframe: '1m',
      limit: 100,
    });

    expect(first).toEqual(baseCandles);
    expect(second).toEqual(baseCandles);
    expect(provider.fetchOHLCV).toHaveBeenCalledTimes(1);
  });

  it('refreshes cache after TTL expires', async () => {
    const provider: MarketDataProvider = {
      fetchOHLCV: vi
        .fn()
        .mockResolvedValueOnce(baseCandles)
        .mockResolvedValueOnce([
          { ...baseCandles[0], close: 106, timestamp: 1_700_000_060_000 },
        ]),
    };
    const service = new MarketDataService(provider, { cacheTtlMs: 30_000 });

    const first = await service.ingestOHLCV({
      symbol: 'BTCUSDT',
      timeframe: '5m',
      limit: 50,
    });

    vi.setSystemTime(new Date('2026-03-15T10:00:31.000Z'));

    const second = await service.ingestOHLCV({
      symbol: 'BTCUSDT',
      timeframe: '5m',
      limit: 50,
    });

    expect(first[0].close).toBe(105);
    expect(second[0].close).toBe(106);
    expect(provider.fetchOHLCV).toHaveBeenCalledTimes(2);
  });

  it('bypasses cache when forceRefresh=true', async () => {
    const provider: MarketDataProvider = {
      fetchOHLCV: vi
        .fn()
        .mockResolvedValueOnce(baseCandles)
        .mockResolvedValueOnce([
          { ...baseCandles[0], close: 107, timestamp: 1_700_000_010_000 },
        ]),
    };
    const service = new MarketDataService(provider, { cacheTtlMs: 60_000 });

    const first = await service.ingestOHLCV({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      limit: 20,
    });
    const refreshed = await service.ingestOHLCV(
      {
        symbol: 'BTCUSDT',
        timeframe: '15m',
        limit: 20,
      },
      true
    );

    expect(first[0].close).toBe(105);
    expect(refreshed[0].close).toBe(107);
    expect(provider.fetchOHLCV).toHaveBeenCalledTimes(2);
  });
});
