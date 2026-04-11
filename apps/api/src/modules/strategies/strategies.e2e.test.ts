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

const createMarketGroup = async (
  email: string,
  marketType: 'FUTURES' | 'SPOT' = 'FUTURES'
) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const marketUniverse = await prisma.marketUniverse.create({
    data: {
      userId: user.id,
      name: `Strategies Guard Universe ${marketType} ${Date.now()}`,
      marketType,
      baseCurrency: 'USDT',
      whitelist: [],
      blacklist: [],
    },
  });
  const symbolGroup = await prisma.symbolGroup.create({
    data: {
      userId: user.id,
      marketUniverseId: marketUniverse.id,
      name: `Strategies Guard Group ${marketType} ${Date.now()}`,
      symbols: marketType === 'SPOT' ? ['BTCUSDT'] : ['BTCUSDT', 'ETHUSDT'],
    },
  });

  return symbolGroup.id;
};

const createWallet = async (
  email: string,
  marketType: 'FUTURES' | 'SPOT' = 'FUTURES'
) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const wallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      name: `Strategies Guard Wallet ${marketType} ${Date.now()}`,
      mode: 'PAPER',
      exchange: 'BINANCE',
      marketType,
      baseCurrency: 'USDT',
      paperInitialBalance: 10_000,
    },
  });

  return wallet.id;
};

const createBotWithStrategy = async (params: {
  agent: ReturnType<typeof request.agent>;
  email: string;
  strategyId: string;
  isActive: boolean;
}) => {
  const marketGroupId = await createMarketGroup(params.email, 'FUTURES');
  const walletId = await createWallet(params.email, 'FUTURES');
  const createBotRes = await params.agent.post('/dashboard/bots').send({
    name: `Strategy Guard Bot ${Date.now()}`,
    mode: 'PAPER',
    walletId,
    strategyId: params.strategyId,
    marketGroupId,
    isActive: params.isActive,
    liveOptIn: false,
  });
  expect(createBotRes.status).toBe(201);
  return createBotRes.body.id as string;
};

describe('Strategies CRUD contract', () => {
  beforeEach(async () => {
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.backtestTrade.deleteMany();
    await prisma.backtestReport.deleteMany();
    await prisma.backtestRun.deleteMany();
    await prisma.log.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.runtimeExecutionDedupe.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
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

  it('supports export/import flow with format versioning', async () => {
    const agent = await registerAndLogin('strategies-export@example.com');

    const createRes = await agent.post('/dashboard/strategies').send(createStrategyPayload());
    expect(createRes.status).toBe(201);
    const strategyId = createRes.body.id as string;

    const exportRes = await agent.get(`/dashboard/strategies/${strategyId}/export`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.formatVersion).toBe('strategy.v1');
    expect(exportRes.body.strategy.name).toBe('RSI + MACD');

    const importRes = await agent.post('/dashboard/strategies/import').send(exportRes.body);
    expect(importRes.status).toBe(201);
    expect(importRes.body.id).toBeDefined();
    expect(importRes.body.id).not.toBe(strategyId);
    expect(importRes.body.name).toBe(exportRes.body.strategy.name);
    expect(importRes.body.interval).toBe(exportRes.body.strategy.interval);
  });

  it('rejects import when formatVersion is invalid', async () => {
    const agent = await registerAndLogin('strategies-import-invalid@example.com');
    const invalidPayload = {
      formatVersion: 'strategy.v0',
      exportedAt: new Date().toISOString(),
      strategy: createStrategyPayload(),
    };

    const importRes = await agent.post('/dashboard/strategies/import').send(invalidPayload);
    expect(importRes.status).toBe(400);
    expect(importRes.body.error.message).toBe('Invalid strategy import payload');
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
    expect(updateRes.status).toBe(404);
    expect(updateRes.body.error.message).toBe('Not found');

    const deleteRes = await otherAgent.delete(`/dashboard/strategies/${strategyId}`);
    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.error.message).toBe('Not found');
  });

  it('blocks strategy updates when strategy is used by any active bot', async () => {
    const email = 'strategies-active-bot-lock@example.com';
    const agent = await registerAndLogin(email);

    const createRes = await agent.post('/dashboard/strategies').send(createStrategyPayload());
    expect(createRes.status).toBe(201);
    const strategyId = createRes.body.id as string;

    await createBotWithStrategy({
      agent,
      email,
      strategyId,
      isActive: true,
    });

    const updateRes = await agent.put(`/dashboard/strategies/${strategyId}`).send({
      name: 'Blocked strategy update',
    });
    expect(updateRes.status).toBe(409);
    expect(updateRes.body.error.message).toBe('strategy is used by active bot and cannot be edited');
  });

  it('allows strategy updates when linked bots are inactive', async () => {
    const email = 'strategies-inactive-bot-update@example.com';
    const agent = await registerAndLogin(email);

    const createRes = await agent.post('/dashboard/strategies').send(createStrategyPayload());
    expect(createRes.status).toBe(201);
    const strategyId = createRes.body.id as string;

    await createBotWithStrategy({
      agent,
      email,
      strategyId,
      isActive: false,
    });

    const updateRes = await agent.put(`/dashboard/strategies/${strategyId}`).send({
      name: 'Allowed strategy update',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Allowed strategy update');
  });

  it('blocks strategy delete when strategy is used by any active bot', async () => {
    const email = 'strategies-active-bot-delete-lock@example.com';
    const agent = await registerAndLogin(email);

    const createRes = await agent.post('/dashboard/strategies').send(createStrategyPayload());
    expect(createRes.status).toBe(201);
    const strategyId = createRes.body.id as string;

    await createBotWithStrategy({
      agent,
      email,
      strategyId,
      isActive: true,
    });

    const deleteRes = await agent.delete(`/dashboard/strategies/${strategyId}`);
    expect(deleteRes.status).toBe(409);
    expect(deleteRes.body.error.message).toBe('strategy is used by active bot and cannot be deleted');
  });
});


