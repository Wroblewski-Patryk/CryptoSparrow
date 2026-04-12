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
  return agent;
};

describe('Profile basic contract', () => {
  beforeEach(async () => {
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
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
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.user.deleteMany();
  });

  it('deletes current user only on DELETE /dashboard/profile/basic', async () => {
    const agent = await registerAndLogin('profile-delete@example.com');
    const deleteRes = await agent.delete('/dashboard/profile/basic');
    expect(deleteRes.status).toBe(204);
  });

  it('returns 404 for legacy DELETE /dashboard/profile/basic/:id route', async () => {
    const agent = await registerAndLogin('profile-delete-legacy@example.com');
    const deleteRes = await agent.delete('/dashboard/profile/basic/some-id');
    expect(deleteRes.status).toBe(404);
  });

  it('persists valid uiPreferences.timeZonePreference in profile basic update', async () => {
    const agent = await registerAndLogin('profile-timezone-valid@example.com');

    const updateRes = await agent.patch('/dashboard/profile/basic').send({
      uiPreferences: {
        timeZonePreference: 'Europe/Warsaw',
      },
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.uiPreferences?.timeZonePreference).toBe('Europe/Warsaw');

    const getRes = await agent.get('/dashboard/profile/basic');
    expect(getRes.status).toBe(200);
    expect(getRes.body.uiPreferences?.timeZonePreference).toBe('Europe/Warsaw');
  });

  it('rejects invalid uiPreferences.timeZonePreference in profile basic update', async () => {
    const agent = await registerAndLogin('profile-timezone-invalid@example.com');

    const updateRes = await agent.patch('/dashboard/profile/basic').send({
      uiPreferences: {
        timeZonePreference: 'Invalid/Timezone',
      },
    });

    expect(updateRes.status).toBe(400);
  });
});



