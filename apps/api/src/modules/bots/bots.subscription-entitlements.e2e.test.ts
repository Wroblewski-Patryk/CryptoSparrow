import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';
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
      name: `Entitlements Universe ${Date.now()}`,
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
      name: `Entitlements Group ${Date.now()}`,
      symbols: ['BTCUSDT', 'ETHUSDT'],
    },
  });

  return symbolGroup.id;
};

const createPayload = (refs: { strategyId: string; marketGroupId: string }) => ({
  name: 'Entitlements Runner',
  mode: 'PAPER',
  strategyId: refs.strategyId,
  marketGroupId: refs.marketGroupId,
  isActive: false,
  liveOptIn: false,
});

describe('Bots subscription entitlements', () => {
  beforeEach(async () => {
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
    await prisma.marketCandleCache.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.runtimeExecutionDedupe.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.paymentIntent.deleteMany();
    await prisma.userSubscription.deleteMany();
    await prisma.user.deleteMany();
  });

  it('blocks second bot on FREE plan with 409 entitlement error payload', async () => {
    const email = 'bots-subscription-free-limit@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Entitlements Free Strategy');
    const marketGroupId = await createMarketGroup(email);

    const firstCreate = await agent.post('/dashboard/bots').send(
      createPayload({
        strategyId,
        marketGroupId,
      }),
    );
    expect(firstCreate.status).toBe(201);

    const secondCreate = await agent.post('/dashboard/bots').send({
      ...createPayload({
        strategyId,
        marketGroupId,
      }),
      name: 'Second bot should fail',
    });
    expect(secondCreate.status).toBe(409);
    expect(secondCreate.body.error.message).toBe('bot limit for active subscription reached');
    expect(secondCreate.body.error.details).toMatchObject({
      planCode: 'FREE',
      maxBotsTotal: 1,
      currentBotsTotal: 1,
      requestedBotsTotal: 2,
    });
  });

  it('allows extra bot after subscription upgrade to ADVANCED', async () => {
    const email = 'bots-subscription-upgrade@example.com';
    const agent = await registerAndLogin(email);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });
    const strategyId = await createStrategy(agent, 'Entitlements Upgrade Strategy');
    const marketGroupId = await createMarketGroup(email);

    const firstCreate = await agent.post('/dashboard/bots').send(
      createPayload({
        strategyId,
        marketGroupId,
      }),
    );
    expect(firstCreate.status).toBe(201);

    await setActiveSubscriptionForUser(prisma, {
      userId: user.id,
      planCode: 'ADVANCED',
      source: 'ADMIN_OVERRIDE',
      metadata: { reason: 'e2e-upgrade-allow-more-bots' },
    });

    const secondCreate = await agent.post('/dashboard/bots').send({
      ...createPayload({
        strategyId,
        marketGroupId,
      }),
      name: 'Second bot should pass on ADVANCED',
    });
    expect(secondCreate.status).toBe(201);
  });
});
