import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../index';
import { prisma } from '../../../prisma/client';

const registerAndLogin = async (email: string, password = 'test1234') => {
  const agent = request.agent(app);
  const res = await agent.post('/auth/register').send({
    email,
    password,
  });
  expect(res.status).toBe(201);
  return agent;
};

describe('Profile security contract', () => {
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
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects unauthenticated access', async () => {
    const passwordRes = await request(app).patch('/dashboard/profile/security/password').send({
      currentPassword: 'test1234',
      newPassword: 'next1234',
    });
    expect(passwordRes.status).toBe(401);

    const deleteRes = await request(app).delete('/dashboard/profile/security/account').send({
      password: 'test1234',
    });
    expect(deleteRes.status).toBe(401);
  });

  it('changes password only with valid current password', async () => {
    const agent = await registerAndLogin('security-password@example.com', 'start1234');

    const wrongCurrentRes = await agent.patch('/dashboard/profile/security/password').send({
      currentPassword: 'wrong1234',
      newPassword: 'next1234',
    });
    expect(wrongCurrentRes.status).toBe(400);
    expect(wrongCurrentRes.body.error.message).toBe('Invalid current password');

    const changeRes = await agent.patch('/dashboard/profile/security/password').send({
      currentPassword: 'start1234',
      newPassword: 'next1234',
    });
    expect(changeRes.status).toBe(204);

    await agent.post('/auth/logout').send({});
    const oldLoginRes = await agent.post('/auth/login').send({
      email: 'security-password@example.com',
      password: 'start1234',
    });
    expect(oldLoginRes.status).toBe(401);

    const newLoginRes = await agent.post('/auth/login').send({
      email: 'security-password@example.com',
      password: 'next1234',
    });
    expect(newLoginRes.status).toBe(200);
  });

  it('deletes account only when password confirmation is valid', async () => {
    const email = 'security-delete@example.com';
    const agent = await registerAndLogin(email, 'start1234');
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    await prisma.strategy.create({
      data: {
        userId: user.id,
        name: 'Delete Me Strategy',
        interval: '5m',
        leverage: 2,
        walletRisk: 1,
        config: { open: {}, close: {} },
      },
    });
    await prisma.marketUniverse.create({
      data: {
        userId: user.id,
        name: 'Delete Me Universe',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: ['BTCUSDT'],
        blacklist: [],
      },
    });

    const invalidDeleteRes = await agent.delete('/dashboard/profile/security/account').send({
      password: 'wrong1234',
    });
    expect(invalidDeleteRes.status).toBe(400);
    expect(invalidDeleteRes.body.error.message).toBe('Invalid password');

    const deleteRes = await agent.delete('/dashboard/profile/security/account').send({
      password: 'start1234',
    });
    expect(deleteRes.status).toBe(204);

    const meRes = await agent.get('/auth/me');
    expect(meRes.status).toBe(401);

    const deletedUser = await prisma.user.findUnique({ where: { email } });
    expect(deletedUser).toBeNull();
  });
});

