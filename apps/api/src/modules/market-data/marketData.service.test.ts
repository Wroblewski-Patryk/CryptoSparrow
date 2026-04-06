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

  it('keeps OHLCV cache isolated by exchange and marketType', async () => {
    const provider: MarketDataProvider = {
      fetchOHLCV: vi.fn().mockResolvedValue(baseCandles),
    };
    const service = new MarketDataService(provider, { cacheTtlMs: 60_000 });

    await service.ingestOHLCV({
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      timeframe: '1m',
      limit: 100,
    });
    await service.ingestOHLCV({
      exchange: 'BINANCE',
      marketType: 'SPOT',
      symbol: 'BTCUSDT',
      timeframe: '1m',
      limit: 100,
    });

    expect(provider.fetchOHLCV).toHaveBeenCalledTimes(2);
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

  it('fetches order book snapshot from optional provider', async () => {
    const provider: MarketDataProvider = {
      fetchOHLCV: vi.fn().mockResolvedValue(baseCandles),
      fetchOrderBook: vi.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        timestamp: 1_700_000_000_000,
        bids: [[100, 1.2]],
        asks: [[101, 1.4]],
      }),
    };
    const service = new MarketDataService(provider, { cacheTtlMs: 60_000 });

    const orderBook = await service.getOrderBook({ symbol: 'BTCUSDT', limit: 20 });

    expect(orderBook.bids[0][0]).toBe(100);
    expect(provider.fetchOrderBook).toHaveBeenCalledWith({
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      limit: 20,
    });
  });

  it('fetches funding rate and open interest snapshots from optional provider', async () => {
    const provider: MarketDataProvider = {
      fetchOHLCV: vi.fn().mockResolvedValue(baseCandles),
      fetchFundingRate: vi.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        timestamp: 1_700_000_000_000,
        fundingRate: 0.0005,
      }),
      fetchOpenInterest: vi.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        timestamp: 1_700_000_000_000,
        openInterest: 12_500_000,
      }),
    };
    const service = new MarketDataService(provider, { cacheTtlMs: 60_000 });

    const funding = await service.getFundingRate({ symbol: 'BTCUSDT' });
    const openInterest = await service.getOpenInterest({ symbol: 'BTCUSDT' });

    expect(funding.fundingRate).toBe(0.0005);
    expect(openInterest.openInterest).toBe(12_500_000);
    expect(provider.fetchFundingRate).toHaveBeenCalledWith({
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
    });
    expect(provider.fetchOpenInterest).toHaveBeenCalledWith({
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
    });
  });

  it('returns explicit errors when optional data providers are not configured', async () => {
    const provider: MarketDataProvider = {
      fetchOHLCV: vi.fn().mockResolvedValue(baseCandles),
    };
    const service = new MarketDataService(provider, { cacheTtlMs: 60_000 });

    await expect(service.getOrderBook({ symbol: 'BTCUSDT', limit: 10 })).rejects.toThrow(
      'ORDER_BOOK_PROVIDER_UNAVAILABLE'
    );
    await expect(service.getFundingRate({ symbol: 'BTCUSDT' })).rejects.toThrow(
      'FUNDING_RATE_PROVIDER_UNAVAILABLE'
    );
    await expect(service.getOpenInterest({ symbol: 'BTCUSDT' })).rejects.toThrow(
      'OPEN_INTEREST_PROVIDER_UNAVAILABLE'
    );
  });
});
