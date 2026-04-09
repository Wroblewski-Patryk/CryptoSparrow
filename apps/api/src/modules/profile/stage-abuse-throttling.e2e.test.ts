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
  return { agent };
};

const withRateLimiterEnabled = async (run: () => Promise<void>) => {
  const previousFlag = process.env.RATE_LIMIT_ENABLE_TEST_MODE;
  process.env.RATE_LIMIT_ENABLE_TEST_MODE = 'true';
  try {
    await run();
  } finally {
    if (previousFlag === undefined) {
      delete process.env.RATE_LIMIT_ENABLE_TEST_MODE;
    } else {
      process.env.RATE_LIMIT_ENABLE_TEST_MODE = previousFlag;
    }
  }
};

describe('Stage abuse throttling verification', () => {
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

  it('limits checkout-intent abuse per user', async () => {
    await withRateLimiterEnabled(async () => {
      const { agent } = await registerAndLogin('stage-abuse-checkout@example.com');

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await agent.post('/dashboard/profile/subscription/checkout-intents').send({
          planCode: 'FREE',
        });
        expect(response.status).not.toBe(429);
        expect(response.status).toBeLessThan(500);
      }

      const blocked = await agent.post('/dashboard/profile/subscription/checkout-intents').send({
        planCode: 'FREE',
      });
      expect(blocked.status).toBe(429);
    });
  });

  it('limits password update abuse per user', async () => {
    await withRateLimiterEnabled(async () => {
      const { agent } = await registerAndLogin('stage-abuse-password@example.com');

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await agent.patch('/dashboard/profile/security/password').send({
          currentPassword: 'invalid-current-password',
          newPassword: 'next-password-1234',
        });
        expect(response.status).not.toBe(429);
        expect(response.status).toBeLessThan(500);
      }

      const blocked = await agent.patch('/dashboard/profile/security/password').send({
        currentPassword: 'invalid-current-password',
        newPassword: 'next-password-1234',
      });
      expect(blocked.status).toBe(429);
    });
  });

  it('limits account delete abuse per user', async () => {
    await withRateLimiterEnabled(async () => {
      const { agent } = await registerAndLogin('stage-abuse-delete@example.com');

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await agent.delete('/dashboard/profile/security/account').send({
          password: 'invalid-current-password',
        });
        expect(response.status).not.toBe(429);
        expect(response.status).toBeLessThan(500);
      }

      const blocked = await agent.delete('/dashboard/profile/security/account').send({
        password: 'invalid-current-password',
      });
      expect(blocked.status).toBe(429);
    });
  });
});
