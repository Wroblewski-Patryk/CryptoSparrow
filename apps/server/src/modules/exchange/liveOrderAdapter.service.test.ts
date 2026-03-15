import { describe, expect, it, vi } from 'vitest';
import { CcxtFuturesConnector } from './ccxtFuturesConnector.service';
import { LiveOrderAdapter } from './liveOrderAdapter.service';

const liveOrder = {
  symbol: 'BTC/USDT:USDT',
  type: 'limit' as const,
  side: 'buy' as const,
  amount: 0.1,
  price: 100,
  clientOrderId: 'order-1',
};

describe('LiveOrderAdapter', () => {
  it('places order on first attempt when connector succeeds', async () => {
    const placeOrder = vi.fn().mockResolvedValue({ id: 'ok-1', raw: {} });
    const connector = { placeOrder } as unknown as CcxtFuturesConnector;
    const sleep = vi.fn().mockResolvedValue(undefined);
    const adapter = new LiveOrderAdapter(connector, sleep);

    const result = await adapter.placeLiveOrderWithRetry({
      order: liveOrder,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 100 },
    });

    expect(result.id).toBe('ok-1');
    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries on retryable errors and then succeeds', async () => {
    const placeOrder = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockRejectedValueOnce(new Error('rate limit reached'))
      .mockResolvedValue({ id: 'ok-2', raw: {} });
    const connector = { placeOrder } as unknown as CcxtFuturesConnector;
    const sleep = vi.fn().mockResolvedValue(undefined);
    const adapter = new LiveOrderAdapter(connector, sleep);

    const result = await adapter.placeLiveOrderWithRetry({
      order: liveOrder,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 200 },
    });

    expect(result.id).toBe('ok-2');
    expect(placeOrder).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 200);
    expect(sleep).toHaveBeenNthCalledWith(2, 400);
  });

  it('stops retries on non-retryable error', async () => {
    const placeOrder = vi.fn().mockRejectedValue(new Error('Invalid order size'));
    const connector = { placeOrder } as unknown as CcxtFuturesConnector;
    const sleep = vi.fn().mockResolvedValue(undefined);
    const adapter = new LiveOrderAdapter(connector, sleep);

    await expect(
      adapter.placeLiveOrderWithRetry({
        order: liveOrder,
        retryPolicy: { maxAttempts: 3, baseDelayMs: 50 },
      })
    ).rejects.toThrow('Invalid order size');

    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('throws after exhausting retry attempts', async () => {
    const placeOrder = vi.fn().mockRejectedValue(new Error('network disconnected'));
    const connector = { placeOrder } as unknown as CcxtFuturesConnector;
    const sleep = vi.fn().mockResolvedValue(undefined);
    const adapter = new LiveOrderAdapter(connector, sleep);

    await expect(
      adapter.placeLiveOrderWithRetry({
        order: liveOrder,
        retryPolicy: { maxAttempts: 3, baseDelayMs: 10 },
      })
    ).rejects.toThrow('network disconnected');

    expect(placeOrder).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
