import { describe, expect, it, vi } from 'vitest';
import { CcxtFuturesConnector } from './ccxtFuturesConnector.service';
import { CcxtFuturesOrderFill } from './ccxtFuturesConnector.types';
import { reconcileLiveOrderFee } from './liveFeeReconciliation.service';

const baseFill = (patch: Partial<CcxtFuturesOrderFill> = {}): CcxtFuturesOrderFill => ({
  exchangeTradeId: 't-1',
  exchangeOrderId: 'o-1',
  symbol: 'BTC/USDT:USDT',
  side: 'buy',
  price: 100,
  quantity: 1,
  notional: 100,
  feeCost: 0.04,
  feeCurrency: 'USDT',
  feeRate: 0.0004,
  executedAt: new Date('2026-04-02T12:00:00.000Z'),
  source: 'createOrder',
  raw: {},
  ...patch,
});

const createConnector = () =>
  ({
    fetchOrderWithFills: vi.fn(),
    fetchTradesForOrder: vi.fn(),
  }) as unknown as CcxtFuturesConnector & {
    fetchOrderWithFills: ReturnType<typeof vi.fn>;
    fetchTradesForOrder: ReturnType<typeof vi.fn>;
  };

describe('reconcileLiveOrderFee', () => {
  it('uses inline fills when they already contain fee data', async () => {
    const connector = createConnector();
    const result = await reconcileLiveOrderFee(connector, {
      symbol: 'BTCUSDT',
      exchangeOrderId: 'o-1',
      inlineFills: [baseFill()],
      nowMs: Date.parse('2026-04-02T12:10:00.000Z'),
    });

    expect(result.feeSource).toBe('EXCHANGE_FILL');
    expect(result.feePending).toBe(false);
    expect(result.fee).toBe(0.04);
    expect(connector.fetchOrderWithFills).not.toHaveBeenCalled();
    expect(connector.fetchTradesForOrder).not.toHaveBeenCalled();
  });

  it('falls back to fetchOrderWithFills when inline fills are missing', async () => {
    const connector = createConnector();
    connector.fetchOrderWithFills.mockResolvedValue({
      order: { id: 'o-2', raw: {} },
      fills: [baseFill({ exchangeTradeId: 't-2', exchangeOrderId: 'o-2', feeCost: 0.05, source: 'fetchOrder' })],
    });
    connector.fetchTradesForOrder.mockResolvedValue([]);

    const result = await reconcileLiveOrderFee(connector, {
      symbol: 'ETHUSDT',
      exchangeOrderId: 'o-2',
      inlineFills: [],
      nowMs: Date.parse('2026-04-02T13:00:00.000Z'),
    });

    expect(connector.fetchOrderWithFills).toHaveBeenCalledWith({ symbol: 'ETHUSDT', orderId: 'o-2' });
    expect(result.feeSource).toBe('EXCHANGE_FILL');
    expect(result.fee).toBe(0.05);
  });

  it('falls back to fetchTradesForOrder when order snapshot has no fee', async () => {
    const connector = createConnector();
    connector.fetchOrderWithFills.mockResolvedValue({
      order: { id: 'o-3', raw: {} },
      fills: [
        baseFill({
          exchangeTradeId: 't-3',
          exchangeOrderId: 'o-3',
          feeCost: Number.NaN,
          source: 'fetchOrder',
        }),
      ],
    });
    connector.fetchTradesForOrder.mockResolvedValue([
      baseFill({
        exchangeTradeId: 't-3b',
        exchangeOrderId: 'o-3',
        feeCost: 0.07,
        source: 'fetchMyTrades',
      }),
    ]);

    const result = await reconcileLiveOrderFee(connector, {
      symbol: 'BNBUSDT',
      exchangeOrderId: 'o-3',
      inlineFills: [],
      nowMs: Date.parse('2026-04-02T14:00:00.000Z'),
    });

    expect(connector.fetchTradesForOrder).toHaveBeenCalledWith({
      symbol: 'BNBUSDT',
      orderId: 'o-3',
      since: Date.parse('2026-04-02T13:30:00.000Z'),
      limit: 300,
    });
    expect(result.feeSource).toBe('EXCHANGE_FILL');
    expect(result.fee).toBe(0.07);
  });

  it('returns pending estimated state when no fills can be resolved', async () => {
    const connector = createConnector();
    connector.fetchOrderWithFills.mockRejectedValue(new Error('snapshot failed'));
    connector.fetchTradesForOrder.mockRejectedValue(new Error('trades failed'));

    const result = await reconcileLiveOrderFee(connector, {
      symbol: 'BTCUSDT',
      exchangeOrderId: 'o-4',
      inlineFills: [],
      nowMs: Date.parse('2026-04-02T15:00:00.000Z'),
    });

    expect(result.feeSource).toBe('ESTIMATED');
    expect(result.feePending).toBe(true);
    expect(result.fee).toBeNull();
    expect(result.fills).toEqual([]);
  });
});
