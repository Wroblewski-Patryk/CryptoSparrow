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
  baseCurrency: 'USDT',
  filterRules: { minVolume24h: 1_000_000 },
  whitelist: ['BTCUSDT', 'ETHUSDT'],
  blacklist: ['USDCUSDT'],
  autoExcludeRules: { stablePairs: true },
});

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
    expect(getRes.body.baseCurrency).toBe('USDT');

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
