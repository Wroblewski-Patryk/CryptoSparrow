import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../prisma/client';
import { openOrder, resolveLiveExecutionApiKey } from './orders.service';

const cleanupDb = async () => {
  await prisma.log.deleteMany();
  await prisma.backtestReport.deleteMany();
  await prisma.backtestTrade.deleteMany();
  await prisma.backtestRun.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.order.deleteMany();
  await prisma.position.deleteMany();
  await prisma.signal.deleteMany();
  await prisma.botRuntimeSymbolStat.deleteMany();
  await prisma.botRuntimeEvent.deleteMany();
  await prisma.botRuntimeSession.deleteMany();
  await prisma.botStrategy.deleteMany();
  await prisma.botSubagentConfig.deleteMany();
  await prisma.botAssistantConfig.deleteMany();
  await prisma.marketGroupStrategyLink.deleteMany();
  await prisma.botMarketGroup.deleteMany();
  await prisma.bot.deleteMany();
  await prisma.symbolGroup.deleteMany();
  await prisma.marketUniverse.deleteMany();
  await prisma.strategy.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.user.deleteMany();
};

describe('openOrder live execution contract', () => {
  beforeEach(async () => {
    await cleanupDb();
  });

  it('does not execute exchange side effects for PAPER mode', async () => {
    const user = await prisma.user.create({
      data: { email: 'orders-paper@example.com', password: 'hashed' },
    });
    const executeLiveOrder = vi.fn();
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const order = await openOrder(
        user.id,
        {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: 0.1,
          mode: 'PAPER',
          riskAck: false,
        },
        { executeLiveOrder }
      );

      expect(executeLiveOrder).not.toHaveBeenCalled();
      expect(order.status).toBe('FILLED');
      expect(order.exchangeOrderId).toBeNull();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('executes exchange order for LIVE and persists exchangeOrderId/status', async () => {
    const user = await prisma.user.create({
      data: { email: 'orders-live@example.com', password: 'hashed' },
    });
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        label: 'Binance Live Key',
        exchange: 'BINANCE',
        apiKey: 'encrypted_key',
        apiSecret: 'encrypted_secret',
      },
    });
    const bot = await prisma.bot.create({
      data: {
        userId: user.id,
        name: 'Live Bot',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        positionMode: 'ONE_WAY',
        apiKeyId: apiKey.id,
        isActive: true,
        liveOptIn: true,
        consentTextVersion: 'mvp-v1',
        maxOpenPositions: 3,
      },
    });

    const executeLiveOrder = vi.fn().mockResolvedValue({
      exchangeOrderId: 'binance-order-123',
      status: 'FILLED' as const,
    });
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const order = await openOrder(
        user.id,
        {
          botId: bot.id,
          symbol: 'ETHUSDT',
          side: 'SELL',
          type: 'LIMIT',
          quantity: 2,
          price: 3200,
          mode: 'LIVE',
          riskAck: true,
        },
        { executeLiveOrder }
      );

      expect(executeLiveOrder).toHaveBeenCalledOnce();
      expect(executeLiveOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          bot: expect.objectContaining({
            id: bot.id,
            exchange: 'BINANCE',
            apiKeyId: apiKey.id,
          }),
        })
      );
      expect(order.exchangeOrderId).toBe('binance-order-123');
      expect(order.status).toBe('FILLED');
      expect(order.filledQuantity).toBe(2);
      expect(order.filledAt).not.toBeNull();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('persists live fee metadata and order fills returned by adapter', async () => {
    const user = await prisma.user.create({
      data: { email: 'orders-live-fees@example.com', password: 'hashed' },
    });
    const bot = await prisma.bot.create({
      data: {
        userId: user.id,
        name: 'Live Bot Fees',
        mode: 'LIVE',
        marketType: 'FUTURES',
        positionMode: 'ONE_WAY',
        isActive: true,
        liveOptIn: true,
        consentTextVersion: 'mvp-v1',
        maxOpenPositions: 3,
      },
    });

    const executeLiveOrder = vi.fn().mockResolvedValue({
      exchangeOrderId: 'binance-order-fee-1',
      status: 'FILLED' as const,
      exchangeTradeId: 'binance-trade-fee-1',
      fee: 2.5,
      feeSource: 'EXCHANGE_FILL' as const,
      feePending: false,
      feeCurrency: 'USDT',
      effectiveFeeRate: 0.001,
      fills: [
        {
          exchangeTradeId: 'binance-fill-1',
          exchangeOrderId: 'binance-order-fee-1',
          symbol: 'ETHUSDT',
          side: 'sell',
          price: 3200,
          quantity: 2,
          notional: 6400,
          feeCost: 2.5,
          feeCurrency: 'USDT',
          feeRate: 0.001,
          executedAt: new Date('2026-04-03T10:00:00.000Z'),
          source: 'fetchMyTrades',
          raw: { provider: 'binance' },
        },
      ],
    });
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const order = await openOrder(
        user.id,
        {
          botId: bot.id,
          symbol: 'ETHUSDT',
          side: 'SELL',
          type: 'LIMIT',
          quantity: 2,
          price: 3200,
          mode: 'LIVE',
          riskAck: true,
        },
        { executeLiveOrder }
      );

      expect(order.exchangeOrderId).toBe('binance-order-fee-1');
      expect(order.exchangeTradeId).toBe('binance-trade-fee-1');
      expect(order.fee).toBe(2.5);
      expect(order.feeSource).toBe('EXCHANGE_FILL');
      expect(order.feePending).toBe(false);
      expect(order.feeCurrency).toBe('USDT');
      expect(order.effectiveFeeRate).toBeCloseTo(0.001, 10);

      const fills = await prisma.orderFill.findMany({
        where: {
          orderId: order.id,
        },
      });
      expect(fills).toHaveLength(1);
      expect(fills[0]?.exchangeTradeId).toBe('binance-fill-1');
      expect(fills[0]?.feeCost).toBe(2.5);
      expect(fills[0]?.feeCurrency).toBe('USDT');
      expect(fills[0]?.feeRate).toBeCloseTo(0.001, 10);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('propagates LIVE execution error', async () => {
    const user = await prisma.user.create({
      data: { email: 'orders-live-fail@example.com', password: 'hashed' },
    });
    const bot = await prisma.bot.create({
      data: {
        userId: user.id,
        name: 'Live Bot Fail',
        mode: 'LIVE',
        marketType: 'FUTURES',
        positionMode: 'ONE_WAY',
        isActive: true,
        liveOptIn: true,
        consentTextVersion: 'mvp-v1',
        maxOpenPositions: 3,
      },
    });

    const executeLiveOrder = vi.fn().mockRejectedValue(new Error('LIVE_EXECUTION_FAILED'));
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      await expect(
        openOrder(
          user.id,
          {
            botId: bot.id,
            symbol: 'SOLUSDT',
            side: 'BUY',
            type: 'MARKET',
            quantity: 10,
            mode: 'LIVE',
            riskAck: true,
          },
          { executeLiveOrder }
        )
      ).rejects.toThrow('LIVE_EXECUTION_FAILED');
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('propagates LIVE pretrade guard errors without masking', async () => {
    const user = await prisma.user.create({
      data: { email: 'orders-live-pretrade@example.com', password: 'hashed' },
    });
    const bot = await prisma.bot.create({
      data: {
        userId: user.id,
        name: 'Live Bot Pretrade',
        mode: 'LIVE',
        marketType: 'FUTURES',
        positionMode: 'ONE_WAY',
        isActive: true,
        liveOptIn: true,
        consentTextVersion: 'mvp-v1',
        maxOpenPositions: 3,
      },
    });

    const executeLiveOrder = vi
      .fn()
      .mockRejectedValue(new Error('LIVE_PRETRADE_EXTERNAL_POSITION_OPEN'));
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      await expect(
        openOrder(
          user.id,
          {
            botId: bot.id,
            symbol: 'BNBUSDT',
            side: 'BUY',
            type: 'MARKET',
            quantity: 1,
            mode: 'LIVE',
            riskAck: true,
          },
          { executeLiveOrder }
        )
      ).rejects.toThrow('LIVE_PRETRADE_EXTERNAL_POSITION_OPEN');
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});

describe('resolveLiveExecutionApiKey', () => {
  beforeEach(async () => {
    await cleanupDb();
  });

  it('uses bot-bound API key when ownership and exchange match bot context', async () => {
    const user = await prisma.user.create({
      data: { email: 'orders-resolver-bound@example.com', password: 'hashed' },
    });
    const key = await prisma.apiKey.create({
      data: {
        userId: user.id,
        label: 'Bound key',
        exchange: 'BINANCE',
        apiKey: 'bound_key',
        apiSecret: 'bound_secret',
      },
    });

    const resolved = await resolveLiveExecutionApiKey({
      userId: user.id,
      bot: {
        exchange: 'BINANCE',
        apiKeyId: key.id,
      },
    });

    expect(resolved.id).toBe(key.id);
  });

  it('falls back to latest key matching bot exchange when bound key is incompatible', async () => {
    const user = await prisma.user.create({
      data: { email: 'orders-resolver-fallback@example.com', password: 'hashed' },
    });
    const mismatch = await prisma.apiKey.create({
      data: {
        userId: user.id,
        label: 'Mismatched key',
        exchange: 'BYBIT',
        apiKey: 'bybit_key',
        apiSecret: 'bybit_secret',
      },
    });
    await prisma.apiKey.create({
      data: {
        userId: user.id,
        label: 'Old binance',
        exchange: 'BINANCE',
        apiKey: 'binance_old',
        apiSecret: 'binance_old_secret',
      },
    });
    const latest = await prisma.apiKey.create({
      data: {
        userId: user.id,
        label: 'Latest binance',
        exchange: 'BINANCE',
        apiKey: 'binance_latest',
        apiSecret: 'binance_latest_secret',
      },
    });

    const resolved = await resolveLiveExecutionApiKey({
      userId: user.id,
      bot: {
        exchange: 'BINANCE',
        apiKeyId: mismatch.id,
      },
    });

    expect(resolved.id).toBe(latest.id);
    expect(resolved.exchange).toBe('BINANCE');
  });

  it('fails closed when no compatible API key exists for bot exchange', async () => {
    const user = await prisma.user.create({
      data: { email: 'orders-resolver-missing@example.com', password: 'hashed' },
    });
    const mismatch = await prisma.apiKey.create({
      data: {
        userId: user.id,
        label: 'Only BYBIT key',
        exchange: 'BYBIT',
        apiKey: 'bybit_only',
        apiSecret: 'bybit_only_secret',
      },
    });

    await expect(
      resolveLiveExecutionApiKey({
        userId: user.id,
        bot: {
          exchange: 'BINANCE',
          apiKeyId: mismatch.id,
        },
      })
    ).rejects.toThrow('LIVE_API_KEY_REQUIRED');
  });
});


