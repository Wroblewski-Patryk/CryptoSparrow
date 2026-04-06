import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRuntimeTickerStore,
  getRuntimeTicker,
  upsertRuntimeTicker,
} from './runtimeTickerStore';

describe('runtimeTickerStore', () => {
  beforeEach(() => {
    clearRuntimeTickerStore();
  });

  it('stores ticker snapshots per exchange+marketType context', () => {
    upsertRuntimeTicker({
      type: 'ticker',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 1000,
      lastPrice: 60_000,
      priceChangePercent24h: 1.2,
    });
    upsertRuntimeTicker({
      type: 'ticker',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      symbol: 'BTCUSDT',
      eventTime: 1100,
      lastPrice: 59_900,
      priceChangePercent24h: 0.9,
    });

    const futuresTicker = getRuntimeTicker('BTCUSDT', {
      exchange: 'BINANCE',
      marketType: 'FUTURES',
    });
    const spotTicker = getRuntimeTicker('BTCUSDT', {
      exchange: 'BINANCE',
      marketType: 'SPOT',
    });

    expect(futuresTicker?.marketType).toBe('FUTURES');
    expect(futuresTicker?.lastPrice).toBe(60_000);
    expect(spotTicker?.marketType).toBe('SPOT');
    expect(spotTicker?.lastPrice).toBe(59_900);
  });

  it('returns latest symbol snapshot when context is omitted', () => {
    upsertRuntimeTicker({
      type: 'ticker',
      exchange: 'BINANCE',
      marketType: 'SPOT',
      symbol: 'ETHUSDT',
      eventTime: 1_000,
      lastPrice: 3_000,
      priceChangePercent24h: 1.1,
    });
    upsertRuntimeTicker({
      type: 'ticker',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'ETHUSDT',
      eventTime: 2_000,
      lastPrice: 3_050,
      priceChangePercent24h: 1.3,
    });

    const latest = getRuntimeTicker('ETHUSDT');
    expect(latest?.marketType).toBe('FUTURES');
    expect(latest?.eventTime).toBe(2_000);
  });
});
