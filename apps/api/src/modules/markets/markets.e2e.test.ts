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

const createPayload = () => ({
  name: 'Top USDT Futures',
  marketType: 'FUTURES',
  baseCurrency: 'USDT',
  filterRules: { minVolume24h: 1_000_000 },
  whitelist: ['BTCUSDT', 'ETHUSDT'],
  blacklist: ['USDCUSDT'],
  autoExcludeRules: { stablePairs: true },
});

const createActiveBotUsingUniverse = async (params: {
  userId: string;
  universeId: string;
  isActive?: boolean;
}) => {
  const symbolGroup = await prisma.symbolGroup.create({
    data: {
      userId: params.userId,
      marketUniverseId: params.universeId,
      name: `Guard group ${Date.now()}`,
      symbols: ['BTCUSDT', 'ETHUSDT'],
    },
  });

  const bot = await prisma.bot.create({
    data: {
      userId: params.userId,
      name: `Guard bot ${Date.now()}`,
      mode: 'PAPER',
      isActive: params.isActive ?? true,
      paperStartBalance: 10_000,
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      positionMode: 'ONE_WAY',
      maxOpenPositions: 1,
    },
  });

  await prisma.botMarketGroup.create({
    data: {
      userId: params.userId,
      botId: bot.id,
      symbolGroupId: symbolGroup.id,
      lifecycleStatus: 'ACTIVE',
      isEnabled: true,
      executionOrder: 1,
      maxOpenPositions: 1,
    },
  });
};

describe('Markets module contract', () => {
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
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/dashboard/markets/universes');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing token');
  });

  it('supports full CRUD for authenticated owner', async () => {
    const agent = await registerAndLogin('markets-owner@example.com');

    const createRes = await agent.post('/dashboard/markets/universes').send(createPayload());
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.name).toBe('Top USDT Futures');
    expect(createRes.body.exchange).toBe('BINANCE');
    expect(createRes.body.marketType).toBe('FUTURES');
    expect(createRes.body.whitelist).toEqual(['BTCUSDT', 'ETHUSDT']);
    const universeId = createRes.body.id as string;

    const listRes = await agent.get('/dashboard/markets/universes');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(universeId);

    const getRes = await agent.get(`/dashboard/markets/universes/${universeId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(universeId);
    expect(getRes.body.exchange).toBe('BINANCE');
    expect(getRes.body.baseCurrency).toBe('USDT');
    expect(getRes.body.marketType).toBe('FUTURES');

    const updateRes = await agent.put(`/dashboard/markets/universes/${universeId}`).send({
      name: 'Top Liquid Futures',
      whitelist: ['BTCUSDT'],
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Top Liquid Futures');
    expect(updateRes.body.whitelist).toEqual(['BTCUSDT']);

    const deleteRes = await agent.delete(`/dashboard/markets/universes/${universeId}`);
    expect(deleteRes.status).toBe(204);

    const getDeletedRes = await agent.get(`/dashboard/markets/universes/${universeId}`);
    expect(getDeletedRes.status).toBe(404);
    expect(getDeletedRes.body.error.message).toBe('Not found');
  });

  it('syncs linked symbol groups when universe whitelist/blacklist changes', async () => {
    const agent = await registerAndLogin('markets-sync@example.com');

    const createRes = await agent.post('/dashboard/markets/universes').send(createPayload());
    expect(createRes.status).toBe(201);
    const universeId = createRes.body.id as string;
    const createdUniverse = await prisma.marketUniverse.findUnique({
      where: { id: universeId },
      select: { userId: true },
    });
    expect(createdUniverse?.userId).toBeTruthy();
    const userId = createdUniverse!.userId;

    const symbolGroup = await prisma.symbolGroup.create({
      data: {
        userId,
        marketUniverseId: universeId,
        name: 'Synced group',
        symbols: ['BTCUSDT', 'ETHUSDT'],
      },
    });

    const updateRes = await agent.put(`/dashboard/markets/universes/${universeId}`).send({
      whitelist: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'],
      blacklist: ['ETHUSDT'],
    });
    expect(updateRes.status).toBe(200);

    const refreshedGroup = await prisma.symbolGroup.findUnique({
      where: { id: symbolGroup.id },
      select: { symbols: true },
    });
    expect(refreshedGroup?.symbols).toEqual(['BTCUSDT', 'SOLUSDT', 'XRPUSDT']);
  });

  it('returns public market catalog filtered by base currency and market type', async () => {
    const agent = await registerAndLogin('markets-catalog@example.com');

    const res = await agent.get('/dashboard/markets/catalog').query({
      exchange: 'BINANCE',
      baseCurrency: 'USDT',
      marketType: 'FUTURES',
    });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('BINANCE_PUBLIC');
    expect(res.body.exchange).toBe('BINANCE');
    expect(res.body.marketType).toBe('FUTURES');
    expect(res.body.baseCurrency).toBe('USDT');
    expect(Array.isArray(res.body.baseCurrencies)).toBe(true);
    expect(res.body.baseCurrencies).toContain('USDT');
    expect(Array.isArray(res.body.markets)).toBe(true);
    expect(res.body.markets.length).toBeGreaterThan(0);
    expect(res.body.markets[0]).toHaveProperty('symbol');
    expect(res.body.markets[0]).toHaveProperty('displaySymbol');
    expect(res.body.markets[0]).toHaveProperty('baseAsset');
    expect(res.body.markets[0]).toHaveProperty('quoteAsset', 'USDT');
  });

  it('allows persisting universes with placeholder exchanges', async () => {
    const agent = await registerAndLogin('markets-placeholder-create@example.com');

    const createRes = await agent.post('/dashboard/markets/universes').send({
      ...createPayload(),
      exchange: 'OKX',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.exchange).toBe('OKX');
    const universeId = createRes.body.id as string;

    const getRes = await agent.get(`/dashboard/markets/universes/${universeId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.exchange).toBe('OKX');

    const listRes = await agent.get('/dashboard/markets/universes');
    expect(listRes.status).toBe(200);
    const persisted = listRes.body.find((item: { id: string }) => item.id === universeId);
    expect(persisted?.exchange).toBe('OKX');
  });

  it('returns explicit not-implemented contract for placeholder market catalog requests', async () => {
    const agent = await registerAndLogin('markets-placeholder-catalog@example.com');

    const res = await agent.get('/dashboard/markets/catalog').query({
      exchange: 'OKX',
      baseCurrency: 'USDT',
      marketType: 'FUTURES',
    });

    expect(res.status).toBe(501);
    expect(res.body.error.message).toContain('Exchange OKX does not support MARKET_CATALOG');
    expect(res.body.error.details).toEqual({
      code: 'EXCHANGE_NOT_IMPLEMENTED',
      exchange: 'OKX',
      capability: 'MARKET_CATALOG',
    });
  });

  it('blocks universe update/delete when linked symbol group is used by active bot', async () => {
    const agent = await registerAndLogin('markets-active-guard@example.com');

    const createRes = await agent.post('/dashboard/markets/universes').send(createPayload());
    expect(createRes.status).toBe(201);
    const universeId = createRes.body.id as string;
    const universe = await prisma.marketUniverse.findUnique({
      where: { id: universeId },
      select: { userId: true },
    });
    expect(universe?.userId).toBeTruthy();
    const userId = universe!.userId;

    await createActiveBotUsingUniverse({
      userId,
      universeId,
      isActive: true,
    });

    const updateRes = await agent.put(`/dashboard/markets/universes/${universeId}`).send({
      name: 'Blocked while active bot runs',
    });
    expect(updateRes.status).toBe(409);
    expect(updateRes.body.error.message).toBe(
      'market universe is used by active bot and cannot be edited'
    );

    const deleteRes = await agent.delete(`/dashboard/markets/universes/${universeId}`);
    expect(deleteRes.status).toBe(409);
    expect(deleteRes.body.error.message).toBe(
      'market universe is used by active bot and cannot be deleted'
    );
  });

  it('allows universe updates and delete when linked bot is inactive', async () => {
    const agent = await registerAndLogin('markets-inactive-guard@example.com');

    const createRes = await agent.post('/dashboard/markets/universes').send(createPayload());
    expect(createRes.status).toBe(201);
    const universeId = createRes.body.id as string;
    const universe = await prisma.marketUniverse.findUnique({
      where: { id: universeId },
      select: { userId: true },
    });
    expect(universe?.userId).toBeTruthy();
    const userId = universe!.userId;

    await createActiveBotUsingUniverse({
      userId,
      universeId,
      isActive: false,
    });

    const updateRes = await agent.put(`/dashboard/markets/universes/${universeId}`).send({
      name: 'Allowed when bot inactive',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Allowed when bot inactive');

    const deleteRes = await agent.delete(`/dashboard/markets/universes/${universeId}`);
    expect(deleteRes.status).toBe(204);

    const deletedUniverse = await prisma.marketUniverse.findUnique({
      where: { id: universeId },
      select: { id: true },
    });
    expect(deletedUniverse).toBeNull();
  });

  it('enforces ownership isolation for get/update/delete', async () => {
    const owner = await registerAndLogin('markets-owner-2@example.com');
    const other = await registerAndLogin('markets-other@example.com');

    const createRes = await owner.post('/dashboard/markets/universes').send(createPayload());
    expect(createRes.status).toBe(201);
    const universeId = createRes.body.id as string;

    const getRes = await other.get(`/dashboard/markets/universes/${universeId}`);
    expect(getRes.status).toBe(404);

    const updateRes = await other.put(`/dashboard/markets/universes/${universeId}`).send({
      name: 'Should not update',
    });
    expect(updateRes.status).toBe(404);

    const deleteRes = await other.delete(`/dashboard/markets/universes/${universeId}`);
    expect(deleteRes.status).toBe(404);
  });
});


