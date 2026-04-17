import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';
import { setActiveSubscriptionForUser } from '../subscriptions/subscriptions.service';

const walletIdByMarketGroupId = new Map<string, string>();

const createWalletForContext = async (email: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });
  const created = await prisma.wallet.create({
    data: {
      userId: user.id,
      name: `Duplicate Guard Wallet ${Date.now()}`,
      mode: 'PAPER',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      paperInitialBalance: 10_000,
    },
    select: { id: true },
  });
  return created.id;
};

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post('/auth/register').send({
    email,
    password: 'test1234',
  });
  expect(res.status).toBe(201);
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });
  await setActiveSubscriptionForUser(prisma, {
    userId: user.id,
    planCode: 'PROFESSIONAL',
    source: 'ADMIN_OVERRIDE',
    metadata: { reason: 'bots-duplicate-e2e-plan-upgrade' },
  });
  return agent;
};

const createStrategy = async (agent: ReturnType<typeof request.agent>, name: string) => {
  const strategyRes = await agent.post('/dashboard/strategies').send({
    name,
    interval: '5m',
    leverage: 2,
    walletRisk: 1,
    config: {
      open: { indicatorsLong: [], indicatorsShort: [] },
      close: { mode: 'basic', tp: 2, sl: 1 },
    },
  });
  expect(strategyRes.status).toBe(201);
  return strategyRes.body.id as string;
};

const createMarketGroup = async (email: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const marketUniverse = await prisma.marketUniverse.create({
    data: {
      userId: user.id,
      name: `Duplicate Guard Universe ${Date.now()}`,
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      whitelist: ['BTCUSDT', 'ETHUSDT'],
      blacklist: [],
    },
  });
  const symbolGroup = await prisma.symbolGroup.create({
    data: {
      userId: user.id,
      marketUniverseId: marketUniverse.id,
      name: `Duplicate Guard Group ${Date.now()}`,
      symbols: ['BTCUSDT', 'ETHUSDT'],
    },
  });
  const walletId = await createWalletForContext(email);
  walletIdByMarketGroupId.set(symbolGroup.id, walletId);
  walletIdByMarketGroupId.set(marketUniverse.id, walletId);

  return symbolGroup.id;
};

describe('Bots duplicate active guard', () => {
  beforeEach(async () => {
    walletIdByMarketGroupId.clear();
    await prisma.log.deleteMany();
    await prisma.backtestReport.deleteMany();
    await prisma.backtestTrade.deleteMany();
    await prisma.backtestRun.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('blocks creating second active bot for same strategy + market group pair', async () => {
    const email = 'bots-duplicate-create@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Duplicate Create Strategy');
    const marketGroupId = await createMarketGroup(email);

    const firstCreate = await agent.post('/dashboard/bots').send({
      name: 'Primary Active',
      strategyId,
      marketGroupId,
      walletId: walletIdByMarketGroupId.get(marketGroupId),
      isActive: true,
      liveOptIn: false,
    });
    expect(firstCreate.status).toBe(201);

    const duplicateActiveCreate = await agent.post('/dashboard/bots').send({
      name: 'Duplicate Active',
      strategyId,
      marketGroupId,
      walletId: walletIdByMarketGroupId.get(marketGroupId),
      isActive: true,
      liveOptIn: false,
    });
    expect(duplicateActiveCreate.status).toBe(409);
    expect(duplicateActiveCreate.body.error.message).toBe(
      'active bot already exists for this wallet + strategy + market group tuple'
    );

    const inactiveCreate = await agent.post('/dashboard/bots').send({
      name: 'Duplicate Inactive',
      strategyId,
      marketGroupId,
      walletId: walletIdByMarketGroupId.get(marketGroupId),
      isActive: false,
      liveOptIn: false,
    });
    expect(inactiveCreate.status).toBe(201);

    const secondWalletId = await createWalletForContext(email);
    const activeWithDifferentWallet = await agent.post('/dashboard/bots').send({
      name: 'Active Other Wallet',
      strategyId,
      marketGroupId,
      walletId: secondWalletId,
      isActive: true,
      liveOptIn: false,
    });
    expect(activeWithDifferentWallet.status).toBe(201);
  });

  it('blocks activating duplicate bot when same strategy + market group already active', async () => {
    const email = 'bots-duplicate-update@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Duplicate Update Strategy');
    const marketGroupId = await createMarketGroup(email);

    const firstCreate = await agent.post('/dashboard/bots').send({
      name: 'Primary Active',
      strategyId,
      marketGroupId,
      walletId: walletIdByMarketGroupId.get(marketGroupId),
      isActive: true,
      liveOptIn: false,
    });
    expect(firstCreate.status).toBe(201);

    const secondCreate = await agent.post('/dashboard/bots').send({
      name: 'Secondary Inactive',
      strategyId,
      marketGroupId,
      walletId: walletIdByMarketGroupId.get(marketGroupId),
      isActive: false,
      liveOptIn: false,
    });
    expect(secondCreate.status).toBe(201);

    const activateSecondary = await agent.put(`/dashboard/bots/${secondCreate.body.id}`).send({
      isActive: true,
    });
    expect(activateSecondary.status).toBe(409);
    expect(activateSecondary.body.error.message).toBe(
      'active bot already exists for this wallet + strategy + market group tuple'
    );
  });
});
