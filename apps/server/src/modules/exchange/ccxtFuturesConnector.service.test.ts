import { describe, expect, it, vi } from 'vitest';
import {
  CcxtClientFactory,
  CcxtExchangeLikeClient,
  CcxtFuturesConnector,
} from './ccxtFuturesConnector.service';

const createMockClient = (): CcxtExchangeLikeClient => ({
  setSandboxMode: vi.fn(),
  loadMarkets: vi.fn().mockResolvedValue(undefined),
  fetchTicker: vi.fn().mockResolvedValue({ last: 100 }),
  createOrder: vi.fn().mockResolvedValue({
    id: 'order-1',
    status: 'open',
    symbol: 'BTC/USDT:USDT',
    side: 'buy',
    type: 'limit',
    amount: 1,
    filled: 0,
    price: 100,
    average: undefined,
  }),
  close: vi.fn().mockResolvedValue(undefined),
});

describe('CcxtFuturesConnector scaffold', () => {
  it('connects and loads markets in sandbox mode', async () => {
    const client = createMockClient();
    const factory: CcxtClientFactory = vi.fn().mockResolvedValue(client);
    const connector = new CcxtFuturesConnector(
      {
        exchangeId: 'binanceusdm',
        sandbox: true,
      },
      factory
    );

    await connector.connect();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(
      'binanceusdm',
      expect.objectContaining({
        options: expect.objectContaining({
          defaultType: 'future',
        }),
      })
    );
    expect(client.setSandboxMode).toHaveBeenCalledWith(true);
    expect(client.loadMarkets).toHaveBeenCalledTimes(1);
  });

  it('fetches mark price from ticker last value', async () => {
    const client = createMockClient();
    const connector = new CcxtFuturesConnector(
      { exchangeId: 'binanceusdm' },
      vi.fn().mockResolvedValue(client)
    );

    const markPrice = await connector.fetchMarkPrice('BTC/USDT:USDT');

    expect(markPrice).toBe(100);
    expect(client.fetchTicker).toHaveBeenCalledWith('BTC/USDT:USDT');
  });

  it('maps futures order payload to createOrder and returns normalized response', async () => {
    const client = createMockClient();
    const connector = new CcxtFuturesConnector(
      { exchangeId: 'binanceusdm' },
      vi.fn().mockResolvedValue(client)
    );

    const order = await connector.placeOrder({
      symbol: 'BTC/USDT:USDT',
      type: 'limit',
      side: 'buy',
      amount: 0.5,
      price: 101,
      reduceOnly: true,
      clientOrderId: 'cs-1',
    });

    expect(client.createOrder).toHaveBeenCalledWith(
      'BTC/USDT:USDT',
      'limit',
      'buy',
      0.5,
      101,
      { reduceOnly: true, clientOrderId: 'cs-1' }
    );
    expect(order.id).toBe('order-1');
    expect(order.status).toBe('open');
  });

  it('passes positionSide in futures hedge mode orders', async () => {
    const client = createMockClient();
    const connector = new CcxtFuturesConnector(
      { exchangeId: 'binanceusdm', marketType: 'future' },
      vi.fn().mockResolvedValue(client)
    );

    await connector.placeOrder({
      symbol: 'BTC/USDT:USDT',
      type: 'market',
      side: 'sell',
      amount: 0.3,
      positionMode: 'HEDGE',
      positionSide: 'SHORT',
      reduceOnly: true,
    });

    expect(client.createOrder).toHaveBeenCalledWith(
      'BTC/USDT:USDT',
      'market',
      'sell',
      0.3,
      undefined,
      { reduceOnly: true, positionSide: 'SHORT' }
    );
  });

  it('throws when hedge mode order is missing positionSide in futures mode', async () => {
    const client = createMockClient();
    const connector = new CcxtFuturesConnector(
      { exchangeId: 'binanceusdm', marketType: 'future' },
      vi.fn().mockResolvedValue(client)
    );

    await expect(
      connector.placeOrder({
        symbol: 'BTC/USDT:USDT',
        type: 'market',
        side: 'buy',
        amount: 0.1,
        positionMode: 'HEDGE',
      })
    ).rejects.toThrow('positionSide is required in HEDGE mode');
  });

  it('configures spot mode and places vanilla spot orders', async () => {
    const client = createMockClient();
    const factory: CcxtClientFactory = vi.fn().mockResolvedValue(client);
    const connector = new CcxtFuturesConnector(
      {
        exchangeId: 'binance',
        marketType: 'spot',
      },
      factory
    );

    await connector.connect();
    await connector.placeOrder({
      symbol: 'BTC/USDT',
      type: 'market',
      side: 'buy',
      amount: 0.2,
    });

    expect(factory).toHaveBeenCalledWith(
      'binance',
      expect.objectContaining({
        options: expect.objectContaining({
          defaultType: 'spot',
        }),
      })
    );
    expect(client.createOrder).toHaveBeenCalledWith(
      'BTC/USDT',
      'market',
      'buy',
      0.2,
      undefined,
      {}
    );
  });

  it('rejects futures-only params in spot mode', async () => {
    const client = createMockClient();
    const connector = new CcxtFuturesConnector(
      { exchangeId: 'binance', marketType: 'spot' },
      vi.fn().mockResolvedValue(client)
    );

    await expect(
      connector.placeOrder({
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'buy',
        amount: 0.2,
        reduceOnly: true,
      })
    ).rejects.toThrow('reduceOnly is not supported in SPOT mode');

    await expect(
      connector.placeOrder({
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'buy',
        amount: 0.2,
        positionMode: 'HEDGE',
        positionSide: 'LONG',
      })
    ).rejects.toThrow('HEDGE position parameters are not supported in SPOT mode');
  });

  it('normalizes uppercase marketType aliases from bot config', async () => {
    const client = createMockClient();
    const factory: CcxtClientFactory = vi.fn().mockResolvedValue(client);
    const connector = new CcxtFuturesConnector(
      {
        exchangeId: 'binance',
        marketType: 'SPOT',
      },
      factory
    );

    await connector.connect();
    await connector.placeOrder({
      symbol: 'BTC/USDT',
      type: 'market',
      side: 'buy',
      amount: 0.1,
    });

    expect(factory).toHaveBeenCalledWith(
      'binance',
      expect.objectContaining({
        options: expect.objectContaining({
          defaultType: 'spot',
        }),
      })
    );
    expect(client.createOrder).toHaveBeenCalledWith(
      'BTC/USDT',
      'market',
      'buy',
      0.1,
      undefined,
      {}
    );
  });
});
