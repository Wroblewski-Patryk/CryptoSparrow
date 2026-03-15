import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';

const createStrategyPayload = () => ({
  name: 'RSI + MACD',
  description: 'Contract test strategy',
  interval: '5m',
  leverage: 3,
  walletRisk: 1.5,
  config: {
    open: { logic: 'AND', rules: [] },
    close: { logic: 'OR', rules: [] },
  },
});

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);

  const res = await agent.post('/auth/register').send({
    email,
    password: 'test1234',
  });

  expect(res.status).toBe(201);
  return agent;
};

describe('Strategies CRUD contract', () => {
  beforeEach(async () => {
    await prisma.apiKey.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/dashboard/strategies');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing token');
  });

  it('supports create/list/get/update/delete flow for authenticated user', async () => {
    const agent = await registerAndLogin('strategies-owner@example.com');

    const createRes = await agent.post('/dashboard/strategies').send(createStrategyPayload());
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.name).toBe('RSI + MACD');
    const strategyId = createRes.body.id as string;

    const listRes = await agent.get('/dashboard/strategies');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(strategyId);

    const getRes = await agent.get(`/dashboard/strategies/${strategyId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(strategyId);
    expect(getRes.body.interval).toBe('5m');

    const updateRes = await agent.put(`/dashboard/strategies/${strategyId}`).send({
      name: 'RSI + MACD v2',
      leverage: 5,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('RSI + MACD v2');
    expect(updateRes.body.leverage).toBe(5);

    const deleteRes = await agent.delete(`/dashboard/strategies/${strategyId}`);
    expect(deleteRes.status).toBe(204);

    const getDeletedRes = await agent.get(`/dashboard/strategies/${strategyId}`);
    expect(getDeletedRes.status).toBe(404);
    expect(getDeletedRes.body.error.message).toBe('Not found');
  });

  it('enforces ownership isolation on get/update/delete', async () => {
    const ownerAgent = await registerAndLogin('strategies-owner-2@example.com');
    const otherAgent = await registerAndLogin('strategies-other@example.com');

    const createRes = await ownerAgent.post('/dashboard/strategies').send(createStrategyPayload());
    expect(createRes.status).toBe(201);
    const strategyId = createRes.body.id as string;

    const getRes = await otherAgent.get(`/dashboard/strategies/${strategyId}`);
    expect(getRes.status).toBe(404);
    expect(getRes.body.error.message).toBe('Not found');

    const updateRes = await otherAgent.put(`/dashboard/strategies/${strategyId}`).send({
      name: 'Should not update',
    });
    expect(updateRes.status).toBe(500);

    const deleteRes = await otherAgent.delete(`/dashboard/strategies/${strategyId}`);
    expect(deleteRes.status).toBe(500);
  });
});
