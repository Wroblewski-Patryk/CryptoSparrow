import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../index';
import { prisma } from '../../../prisma/client';

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post('/auth/register').send({
    email,
    password: 'test1234',
  });
  expect(res.status).toBe(201);
  return {
    agent,
    userId: res.body.user.id as string,
  };
};

describe('Profile subscription contract', () => {
  beforeEach(async () => {
    await prisma.orderFill.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.backtestReport.deleteMany();
    await prisma.backtestTrade.deleteMany();
    await prisma.backtestRun.deleteMany();
    await prisma.log.deleteMany();
    await prisma.runtimeExecutionDedupe.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.paymentIntent.deleteMany();
    await prisma.userSubscription.deleteMany();
    await prisma.user.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
  });

  it('returns subscription catalog and active subscription for current user', async () => {
    const { agent } = await registerAndLogin('profile-subscription@example.com');

    const response = await agent.get('/dashboard/profile/subscription');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.catalog)).toBe(true);
    expect(response.body.catalog).toHaveLength(3);
    expect(response.body.catalog.map((item: { code: string }) => item.code)).toEqual([
      'FREE',
      'ADVANCED',
      'PROFESSIONAL',
    ]);
    expect(response.body.activePlanCode).toBe('FREE');
    expect(response.body.activeSubscription).toMatchObject({
      planCode: 'FREE',
      source: 'DEFAULT',
      status: 'ACTIVE',
    });
  });

  it('restores FREE assignment for legacy user without active subscription', async () => {
    const { agent, userId } = await registerAndLogin('profile-subscription-legacy@example.com');

    await prisma.userSubscription.deleteMany({
      where: { userId },
    });

    const response = await agent.get('/dashboard/profile/subscription');

    expect(response.status).toBe(200);
    expect(response.body.activePlanCode).toBe('FREE');
    expect(response.body.activeSubscription).toMatchObject({
      planCode: 'FREE',
      status: 'ACTIVE',
    });
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/dashboard/profile/subscription');
    expect(response.status).toBe(401);
  });
});

