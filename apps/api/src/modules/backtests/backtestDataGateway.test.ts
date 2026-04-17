import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchKlines,
  hasContinuousCandleIntervals,
  resetBacktestDataGatewayCacheForTests,
  setDbCandleDelegateForTests,
  type BacktestKlineCandle,
} from './backtestDataGateway';

const ONE_MINUTE_MS = 60_000;

const buildCandle = (openTime: number): BacktestKlineCandle => ({
  openTime,
  closeTime: openTime + ONE_MINUTE_MS - 1,
  open: 100,
  high: 101,
  low: 99,
  close: 100.5,
  volume: 1_000,
});

const buildBinanceKlinePayloadRow = (openTime: number) => [
  openTime,
  '100',
  '101',
  '99',
  '100.5',
  '1000',
  openTime + ONE_MINUTE_MS - 1,
];

describe('backtestDataGateway', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetBacktestDataGatewayCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetBacktestDataGatewayCacheForTests();
  });

  it('detects interval gaps in DB cache candle windows', () => {
    const baseTime = 1_710_000_000_000;
    const candles = [
      buildCandle(baseTime),
      buildCandle(baseTime + ONE_MINUTE_MS),
      buildCandle(baseTime + ONE_MINUTE_MS * 3),
    ];

    expect(hasContinuousCandleIntervals(candles, '1m')).toBe(false);
    expect(
      hasContinuousCandleIntervals(
        [buildCandle(baseTime), buildCandle(baseTime + ONE_MINUTE_MS), buildCandle(baseTime + ONE_MINUTE_MS * 2)],
        '1m',
      ),
    ).toBe(true);
  });

  it('falls back to network fetch when DB cache candles contain interval gaps', async () => {
    const baseTime = 1_710_000_000_000;
    const findMany = vi.fn(async () => [
      {
        openTime: BigInt(baseTime + ONE_MINUTE_MS * 3),
        closeTime: BigInt(baseTime + ONE_MINUTE_MS * 4 - 1),
        open: 103,
        high: 104,
        low: 102,
        close: 103.5,
        volume: 1_030,
      },
      {
        openTime: BigInt(baseTime + ONE_MINUTE_MS),
        closeTime: BigInt(baseTime + ONE_MINUTE_MS * 2 - 1),
        open: 101,
        high: 102,
        low: 100,
        close: 101.5,
        volume: 1_010,
      },
      {
        openTime: BigInt(baseTime),
        closeTime: BigInt(baseTime + ONE_MINUTE_MS - 1),
        open: 100,
        high: 101,
        low: 99,
        close: 100.5,
        volume: 1_000,
      },
    ]);
    const createMany = vi.fn(async () => ({ count: 3 }));
    setDbCandleDelegateForTests({ findMany, createMany });

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify([
          buildBinanceKlinePayloadRow(baseTime),
          buildBinanceKlinePayloadRow(baseTime + ONE_MINUTE_MS),
          buildBinanceKlinePayloadRow(baseTime + ONE_MINUTE_MS * 2),
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const candles = await fetchKlines('BTCUSDT', '1m', 'FUTURES', 3, baseTime + ONE_MINUTE_MS * 3);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(candles.map((item) => item.openTime)).toEqual([
      baseTime,
      baseTime + ONE_MINUTE_MS,
      baseTime + ONE_MINUTE_MS * 2,
    ]);
    expect(createMany).toHaveBeenCalledTimes(1);
  });
});

