import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetExchangeSymbolRulesCacheForTests,
  getExchangeSymbolRules,
} from './exchangeSymbolRules.service';

describe('exchangeSymbolRules.service', () => {
  beforeEach(() => {
    __resetExchangeSymbolRulesCacheForTests();
  });

  it('extracts min quantity and min notional from symbol limits and filters', async () => {
    const loadMarketMap = vi.fn(async () => ({
      'BTC/USDT:USDT': {
        id: 'BTCUSDT',
        symbol: 'BTC/USDT:USDT',
        active: true,
        limits: {
          amount: { min: 0.001 },
          cost: { min: 5 },
        },
        info: {
          filters: [
            { filterType: 'LOT_SIZE', minQty: '0.001', stepSize: '0.001' },
            { filterType: 'NOTIONAL', minNotional: '10' },
          ],
        },
      },
    }));

    const rules = await getExchangeSymbolRules(
      {
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        symbol: 'BTCUSDT',
      },
      {
        nowMs: () => 1_000,
        loadMarketMap,
      }
    );

    expect(loadMarketMap).toHaveBeenCalledTimes(1);
    expect(rules).toEqual({
      minQuantity: 0.001,
      minNotional: 10,
      quantityStep: 0.001,
    });
  });

  it('uses cache and avoids repeated exchange market loads inside TTL', async () => {
    let now = 1_000;
    const loadMarketMap = vi.fn(async () => ({
      'ETH/USDT:USDT': {
        id: 'ETHUSDT',
        symbol: 'ETH/USDT:USDT',
        active: true,
        limits: {
          amount: { min: 0.01 },
          cost: { min: 5 },
        },
        info: {
          filters: [{ filterType: 'LOT_SIZE', minQty: '0.01', stepSize: '0.01' }],
        },
      },
    }));

    const deps = {
      nowMs: () => now,
      loadMarketMap,
    };

    await getExchangeSymbolRules(
      {
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        symbol: 'ETHUSDT',
      },
      deps
    );

    now = 2_000;
    await getExchangeSymbolRules(
      {
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        symbol: 'ETHUSDT',
      },
      deps
    );

    expect(loadMarketMap).toHaveBeenCalledTimes(1);
  });

  it('returns null for exchanges without live execution capability', async () => {
    const loadMarketMap = vi.fn(async () => ({}));

    const rules = await getExchangeSymbolRules(
      {
        exchange: 'BYBIT',
        marketType: 'FUTURES',
        symbol: 'BTCUSDT',
      },
      {
        nowMs: () => 1_000,
        loadMarketMap,
      }
    );

    expect(rules).toBeNull();
    expect(loadMarketMap).not.toHaveBeenCalled();
  });
});
