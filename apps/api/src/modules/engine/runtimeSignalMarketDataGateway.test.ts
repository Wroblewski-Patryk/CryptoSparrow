import { describe, expect, it } from 'vitest';
import { RuntimeSignalMarketDataGateway } from './runtimeSignalMarketDataGateway';

describe('RuntimeSignalMarketDataGateway', () => {
  it('ingests final candles with dedupe/sort and returns recent closes', async () => {
    const gateway = new RuntimeSignalMarketDataGateway({
      nowMs: () => 1_000,
    });

    await gateway.ingestCandleEvent({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      eventTime: 120_000,
      openTime: 60_000,
      closeTime: 119_000,
      open: 101,
      high: 103,
      low: 100,
      close: 102,
      volume: 2_000,
      isFinal: true,
    });
    await gateway.ingestCandleEvent({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      eventTime: 60_000,
      openTime: 0,
      closeTime: 59_000,
      open: 100,
      high: 102,
      low: 99,
      close: 101,
      volume: 1_000,
      isFinal: true,
    });
    await gateway.ingestCandleEvent({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      eventTime: 120_000,
      openTime: 60_000,
      closeTime: 119_000,
      open: 101,
      high: 104,
      low: 100,
      close: 103,
      volume: 2_200,
      isFinal: true,
    });

    const series = gateway.getSeries('FUTURES', 'BTCUSDT', '1m');
    expect(series).toHaveLength(2);
    expect(series?.map((candle) => candle.openTime)).toEqual([0, 60_000]);
    expect(series?.[1].close).toBe(103);

    const recentCloses = gateway.getRecentCloses({
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      limit: 2,
    });
    expect(recentCloses).toEqual([101, 103]);
  });

  it('aligns derivatives points to candle timeline', async () => {
    const gateway = new RuntimeSignalMarketDataGateway({
      nowMs: () => 1_000,
    });

    await gateway.ingestCandleEvent({
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
      close: 100,
      volume: 1_000,
      isFinal: true,
    });
    await gateway.ingestCandleEvent({
      type: 'candle',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      interval: '1m',
      eventTime: 120_000,
      openTime: 60_000,
      closeTime: 119_000,
      open: 101,
      high: 102,
      low: 100,
      close: 101,
      volume: 1_100,
      isFinal: true,
    });

    gateway.getFundingRatePointsStore().set('FUTURES|BTCUSDT', [
      { timestamp: 59_000, fundingRate: 0.0001 },
      { timestamp: 119_000, fundingRate: -0.0002 },
    ]);
    gateway.getOpenInterestPointsStore().set('FUTURES|BTCUSDT', [
      { timestamp: 59_000, openInterest: 101 },
      { timestamp: 119_000, openInterest: 120 },
    ]);
    gateway.getOrderBookPointsStore().set('FUTURES|BTCUSDT', [
      { timestamp: 59_000, imbalance: 0.1, spreadBps: 2.5, depthRatio: 1.2 },
      { timestamp: 119_000, imbalance: 0.3, spreadBps: 3.5, depthRatio: 1.8 },
    ]);

    const candles = gateway.getSeries('FUTURES', 'BTCUSDT', '1m')!;
    const funding = gateway.resolveFundingRateSeriesForCandles('FUTURES', 'BTCUSDT', candles);
    const openInterest = gateway.resolveOpenInterestSeriesForCandles('FUTURES', 'BTCUSDT', candles);
    const orderBook = gateway.resolveOrderBookSeriesForCandles('FUTURES', 'BTCUSDT', candles);

    expect(funding).toEqual([0.0001, -0.0002]);
    expect(openInterest).toEqual([101, 120]);
    expect(orderBook?.orderBookImbalance).toEqual([0.1, 0.3]);
    expect(orderBook?.orderBookSpreadBps).toEqual([2.5, 3.5]);
    expect(orderBook?.orderBookDepthRatio).toEqual([1.2, 1.8]);
  });
});
