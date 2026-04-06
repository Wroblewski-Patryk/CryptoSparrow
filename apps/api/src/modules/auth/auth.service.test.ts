import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../prisma/client';
import { registerUser } from './auth.service';

describe('registerUser', () => {
  beforeEach(async () => {
    await prisma.log.deleteMany();
    await prisma.backtestReport.deleteMany();
    await prisma.backtestTrade.deleteMany();
    await prisma.backtestRun.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.runtimeExecutionDedupe.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.paymentIntent.deleteMany();
    await prisma.userSubscription.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should register new user', async () => {
    const user = await registerUser({
      email: 'test@user.com',
      password: 'test123',
    });

    expect(user).toBeDefined();
    expect(user.email).toBe('test@user.com');
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'test@user.com' },
    });
    expect(dbUser.password).not.toBe('test123');

    const activeSubscription = await prisma.userSubscription.findFirstOrThrow({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      include: {
        subscriptionPlan: {
          select: { code: true },
        },
      },
    });
    expect(activeSubscription.subscriptionPlan.code).toBe('FREE');
    expect(activeSubscription.source).toBe('DEFAULT');
  });

  it('should throw if user exists', async () => {
    await registerUser({
      email: 'duplikat@user.com',
      password: 'test123',
    });

    await expect(() =>
      registerUser({
        email: 'duplikat@user.com',
        password: 'test123',
      })
    ).rejects.toThrow('User with this email already exists');
  });
});


