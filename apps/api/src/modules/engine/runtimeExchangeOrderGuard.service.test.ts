import { describe, expect, it, vi } from 'vitest';
import { validateRuntimeExchangeOrder } from './runtimeExchangeOrderGuard.service';

describe('validateRuntimeExchangeOrder', () => {
  it('blocks when quantity is below exchange minimum quantity', async () => {
    const decision = await validateRuntimeExchangeOrder(
      {
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        symbol: 'BTCUSDT',
        quantity: 0.001,
        price: 50_000,
      },
      {
        getSymbolRules: vi.fn(async () => ({
          minQuantity: 0.01,
          minNotional: 5,
          quantityStep: 0.001,
        })),
      }
    );

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toBe('exchange_min_quantity_not_met');
  });

  it('blocks when notional is below exchange minimum notional', async () => {
    const decision = await validateRuntimeExchangeOrder(
      {
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        symbol: 'BTCUSDT',
        quantity: 0.01,
        price: 100,
      },
      {
        getSymbolRules: vi.fn(async () => ({
          minQuantity: 0.001,
          minNotional: 5,
          quantityStep: 0.001,
        })),
      }
    );

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toBe('exchange_min_notional_not_met');
  });

  it('allows when exchange rules are unavailable', async () => {
    const decision = await validateRuntimeExchangeOrder(
      {
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        symbol: 'BTCUSDT',
        quantity: 0.01,
        price: 100,
      },
      {
        getSymbolRules: vi.fn(async () => null),
      }
    );

    expect(decision).toEqual({ allowed: true });
  });
});
