import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';
import { RuntimeSignalLoop } from './runtimeSignalLoop.service';
import { setActiveSubscriptionForUser } from '../subscriptions/subscriptions.service';

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post('/auth/register').send({
    email,
    password: 'test1234',
  });
  expect(res.status).toBe(201);
  return agent;
};

describe('Runtime flow e2e (strategy -> backtest -> live runtime)', () => {
  beforeEach(async () => {
    await prisma.log.deleteMany();
    await prisma.backtestReport.deleteMany();
    await prisma.backtestTrade.deleteMany();
    await prisma.backtestRun.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('creates runtime orders/positions and closes via ticker lifecycle after strategy entry for LIVE bot', async () => {
    const runtimeSignalLoop = new RuntimeSignalLoop();
    const email = 'runtime-flow@example.com';
    const agent = await registerAndLogin(email);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });
    await setActiveSubscriptionForUser(prisma, {
      userId: user.id,
      planCode: 'PROFESSIONAL',
      source: 'ADMIN_OVERRIDE',
      metadata: { reason: 'runtime-flow-e2e-plan-upgrade' },
    });

    const strategyRes = await agent.post('/dashboard/strategies').send({
      name: 'Runtime Strategy',
      interval: '1m',
      leverage: 1,
      walletRisk: 1,
      config: {
        open: {
          direction: 'both',
          noMatchAction: 'EXIT',
          indicatorsLong: [
            {
              name: 'RSI',
              condition: '>',
              value: 99,
              params: { period: 2 },
            },
          ],
          indicatorsShort: [],
        },
        close: { mode: 'basic', tp: 2, sl: 1 },
      },
    });
    expect(strategyRes.status).toBe(201);
    const strategyId = strategyRes.body.id as string;
    const createMarketUniverse = await prisma.marketUniverse.create({
      data: {
        userId: user.id,
        name: 'Runtime Bot Create Universe',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: [],
        blacklist: [],
      },
    });
    const createSymbolGroup = await prisma.symbolGroup.create({
      data: {
        userId: user.id,
        marketUniverseId: createMarketUniverse.id,
        name: 'Runtime Bot Create Group',
        symbols: ['BTCUSDT'],
      },
    });

    const backtestRes = await agent.post('/dashboard/backtests/runs').send({
      name: 'Runtime Backtest',
      symbol: 'BTCUSDT',
      timeframe: '1m',
      strategyId,
    });
    expect(backtestRes.status).toBe(201);

    const apiKeyRes = await agent.post('/dashboard/profile/apiKeys').send({
      label: 'runtime-flow-live',
      exchange: 'BINANCE',
      apiKey: 'RUNTIME_FLOW_LIVE_KEY',
      apiSecret: 'RUNTIME_FLOW_LIVE_SECRET',
      syncExternalPositions: true,
      manageExternalPositions: false,
    });
    expect(apiKeyRes.status).toBe(201);
    const wallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        name: 'Runtime Flow Live Wallet',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        paperInitialBalance: 10_000,
        liveAllocationMode: 'PERCENT',
        liveAllocationValue: 100,
        apiKeyId: apiKeyRes.body.id as string,
      },
      select: {
        id: true,
      },
    });

    const botRes = await agent.post('/dashboard/bots').send({
      name: 'Runtime Live Bot',
      walletId: wallet.id,
      strategyId,
      marketGroupId: createSymbolGroup.id,
      isActive: true,
      liveOptIn: true,
      consentTextVersion: 'mvp-v1',
    });
    expect(botRes.status).toBe(201);
    const botId = botRes.body.id as string;
    const userId = botRes.body.userId as string;

    const marketUniverse = await prisma.marketUniverse.create({
      data: {
        userId,
        name: 'Runtime Flow Universe',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: [],
        blacklist: [],
      },
    });

    const symbolGroup = await prisma.symbolGroup.create({
      data: {
        userId,
        marketUniverseId: marketUniverse.id,
        name: 'Runtime Flow Group',
        symbols: ['BTCUSDT'],
      },
    });

    const marketGroupRes = await agent.post(`/dashboard/bots/${botId}/market-groups`).send({
      symbolGroupId: symbolGroup.id,
      lifecycleStatus: 'ACTIVE',
      executionOrder: 1,
      isEnabled: true,
    });
    expect(marketGroupRes.status).toBe(201);

    const candleBaseTime = Date.now();
    const emitFinalCandle = async (index: number, close: number) => {
      const openTime = candleBaseTime + index * 60_000;
      const closeTime = openTime + 59_999;
      await runtimeSignalLoop.processCandleEvent({
        type: 'candle',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        symbol: 'BTCUSDT',
        interval: '1m',
        eventTime: closeTime,
        openTime,
        closeTime,
        open: close,
        high: close * 1.001,
        low: close * 0.999,
        close,
        volume: 1000 + index,
        isFinal: true,
      });
    };

    await emitFinalCandle(0, 64000);
    await emitFinalCandle(1, 64100);
    await emitFinalCandle(2, 64200);

    await runtimeSignalLoop.processTickerEvent({
      type: 'ticker',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: Date.now(),
      lastPrice: 64200,
      priceChangePercent24h: 1.8,
    });

    const openedPosition = await prisma.position.findFirst({
      where: {
        botId,
        symbol: 'BTCUSDT',
        status: 'OPEN',
      },
    });
    expect(openedPosition).toBeTruthy();

    const openedOrder = await prisma.order.findFirst({
      where: {
        botId,
        symbol: 'BTCUSDT',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(openedOrder).toBeTruthy();

    const runtimeSignal = await prisma.signal.findFirst({
      where: {
        botId,
        symbol: 'BTCUSDT',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(runtimeSignal?.direction).toBe('LONG');

    await emitFinalCandle(3, 50000);
    const exitSignal = await prisma.signal.findFirst({
      where: {
        botId,
        symbol: 'BTCUSDT',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(exitSignal?.direction).toBe('EXIT');

    await runtimeSignalLoop.processTickerEvent({
      type: 'ticker',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: Date.now() + 60_000,
      lastPrice: 50000,
      priceChangePercent24h: -3.8,
    });

    const closedPosition = await prisma.position.findFirst({
      where: {
        botId,
        symbol: 'BTCUSDT',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(closedPosition?.status).toBe('CLOSED');
  });
});


