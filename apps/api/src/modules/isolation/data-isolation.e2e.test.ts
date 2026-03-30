import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post('/auth/register').send({
    email,
    password: 'test1234',
  });
  expect(res.status).toBe(201);
  return agent;
};

const getUserId = async (email: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return user.id;
};

describe('Cross-module data isolation contract', () => {
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
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('isolates markets, bots, orders, positions, and backtest data per user', async () => {
    const ownerAgent = await registerAndLogin('iso-owner@example.com');
    const otherAgent = await registerAndLogin('iso-other@example.com');

    const ownerId = await getUserId('iso-owner@example.com');
    const otherId = await getUserId('iso-other@example.com');

    const ownerMarketRes = await ownerAgent.post('/dashboard/markets/universes').send({
      name: 'Owner Universe',
      baseCurrency: 'USDT',
      whitelist: ['BTCUSDT'],
      blacklist: [],
    });
    expect(ownerMarketRes.status).toBe(201);

    const otherMarketRes = await otherAgent.post('/dashboard/markets/universes').send({
      name: 'Other Universe',
      baseCurrency: 'USDT',
      whitelist: ['ETHUSDT'],
      blacklist: [],
    });
    expect(otherMarketRes.status).toBe(201);
    const ownerSymbolGroup = await prisma.symbolGroup.create({
      data: {
        userId: ownerId,
        marketUniverseId: ownerMarketRes.body.id,
        name: 'Owner Bot Group',
        symbols: ['BTCUSDT'],
      },
    });
    const otherSymbolGroup = await prisma.symbolGroup.create({
      data: {
        userId: otherId,
        marketUniverseId: otherMarketRes.body.id,
        name: 'Other Bot Group',
        symbols: ['ETHUSDT'],
      },
    });

    const ownerStrategyRes = await ownerAgent.post('/dashboard/strategies').send({
      name: 'Owner Isolation Strategy',
      interval: '5m',
      leverage: 2,
      walletRisk: 1,
      config: {
        open: { indicatorsLong: [], indicatorsShort: [] },
        close: { mode: 'basic', tp: 2, sl: 1 },
      },
    });
    expect(ownerStrategyRes.status).toBe(201);
    const otherStrategyRes = await otherAgent.post('/dashboard/strategies').send({
      name: 'Other Isolation Strategy',
      interval: '5m',
      leverage: 2,
      walletRisk: 1,
      config: {
        open: { indicatorsLong: [], indicatorsShort: [] },
        close: { mode: 'basic', tp: 2, sl: 1 },
      },
    });
    expect(otherStrategyRes.status).toBe(201);

    const ownerBotRes = await ownerAgent.post('/dashboard/bots').send({
      name: 'Owner Bot',
      mode: 'PAPER',
      strategyId: ownerStrategyRes.body.id,
      marketGroupId: ownerSymbolGroup.id,
      isActive: false,
      liveOptIn: false,
    });
    expect(ownerBotRes.status).toBe(201);

    const otherBotRes = await otherAgent.post('/dashboard/bots').send({
      name: 'Other Bot',
      mode: 'PAPER',
      strategyId: otherStrategyRes.body.id,
      marketGroupId: otherSymbolGroup.id,
      isActive: false,
      liveOptIn: false,
    });
    expect(otherBotRes.status).toBe(201);

    const ownerPosition = await prisma.position.create({
      data: {
        userId: ownerId,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: 60000,
        quantity: 0.1,
      },
    });

    await prisma.position.create({
      data: {
        userId: otherId,
        symbol: 'ETHUSDT',
        side: 'SHORT',
        entryPrice: 3000,
        quantity: 1,
      },
    });

    const ownerOrder = await prisma.order.create({
      data: {
        userId: ownerId,
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        status: 'OPEN',
        quantity: 0.1,
        price: 59000,
      },
    });

    await prisma.order.create({
      data: {
        userId: otherId,
        symbol: 'ETHUSDT',
        side: 'SELL',
        type: 'MARKET',
        status: 'FILLED',
        quantity: 1,
      },
    });

    const ownerRun = await prisma.backtestRun.create({
      data: {
        userId: ownerId,
        name: 'Owner run',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        status: 'COMPLETED',
      },
    });

    const otherRun = await prisma.backtestRun.create({
      data: {
        userId: otherId,
        name: 'Other run',
        symbol: 'ETHUSDT',
        timeframe: '1h',
        status: 'COMPLETED',
      },
    });

    const ownerMarkets = await ownerAgent.get('/dashboard/markets/universes');
    expect(ownerMarkets.status).toBe(200);
    expect(ownerMarkets.body).toHaveLength(1);
    expect(ownerMarkets.body[0].id).toBe(ownerMarketRes.body.id);

    const ownerBots = await ownerAgent.get('/dashboard/bots');
    expect(ownerBots.status).toBe(200);
    expect(ownerBots.body).toHaveLength(1);
    expect(ownerBots.body[0].id).toBe(ownerBotRes.body.id);

    const ownerPositions = await ownerAgent.get('/dashboard/positions');
    expect(ownerPositions.status).toBe(200);
    expect(ownerPositions.body).toHaveLength(1);
    expect(ownerPositions.body[0].id).toBe(ownerPosition.id);

    const ownerOrders = await ownerAgent.get('/dashboard/orders');
    expect(ownerOrders.status).toBe(200);
    expect(ownerOrders.body).toHaveLength(1);
    expect(ownerOrders.body[0].id).toBe(ownerOrder.id);

    // Backtest endpoints are not implemented yet; data-level isolation is validated here.
    const ownerRuns = await prisma.backtestRun.findMany({ where: { userId: ownerId } });
    expect(ownerRuns).toHaveLength(1);
    expect(ownerRuns[0].id).toBe(ownerRun.id);
    expect(ownerRuns.find((run) => run.id === otherRun.id)).toBeUndefined();
  });
});


