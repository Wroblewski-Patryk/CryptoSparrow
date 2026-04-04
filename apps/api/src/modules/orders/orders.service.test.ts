import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../prisma/client';
import { openOrder } from './orders.service';

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
    const bot = await prisma.bot.create({
      data: {
        userId: user.id,
        name: 'Live Bot',
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
});


