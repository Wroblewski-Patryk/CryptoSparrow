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
  name: 'BTC trend run',
  symbol: 'BTCUSDT',
  timeframe: '1h',
  seedConfig: { initialBalance: 1000 },
  notes: 'quick smoke',
});

describe('Backtests runs contract', () => {
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
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/dashboard/backtests/runs');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing token');
  });

  it('supports create/list/get for owner', async () => {
    const agent = await registerAndLogin('backtests-owner@example.com');

    const createRes = await agent.post('/dashboard/backtests/runs').send(createPayload());
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.status).toBe('PENDING');
    const runId = createRes.body.id as string;

    const listRes = await agent.get('/dashboard/backtests/runs');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(runId);

    const getRes = await agent.get(`/dashboard/backtests/runs/${runId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(runId);
  });

  it('enforces ownership isolation and strategy ownership at create time', async () => {
    const ownerAgent = await registerAndLogin('backtests-owner-2@example.com');
    const otherAgent = await registerAndLogin('backtests-other@example.com');

    const ownerUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'backtests-owner-2@example.com' },
    });
    const ownerStrategy = await prisma.strategy.create({
      data: {
        userId: ownerUser.id,
        name: 'Owner strategy',
        interval: '1h',
        leverage: 2,
        walletRisk: 1,
        config: { version: '1.0', entry: {}, exit: {} },
      },
    });

    const createOwnerRun = await ownerAgent.post('/dashboard/backtests/runs').send({
      ...createPayload(),
      strategyId: ownerStrategy.id,
    });
    expect(createOwnerRun.status).toBe(201);
    const runId = createOwnerRun.body.id as string;

    const otherGet = await otherAgent.get(`/dashboard/backtests/runs/${runId}`);
    expect(otherGet.status).toBe(404);

    const otherCreateWithForeignStrategy = await otherAgent.post('/dashboard/backtests/runs').send({
      ...createPayload(),
      strategyId: ownerStrategy.id,
    });
    expect(otherCreateWithForeignStrategy.status).toBe(404);
    expect(otherCreateWithForeignStrategy.body.error.message).toBe('Strategy not found');
  });
});
