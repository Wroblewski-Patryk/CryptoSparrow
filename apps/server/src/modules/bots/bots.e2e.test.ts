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
  name: 'Momentum Runner',
  mode: 'PAPER',
  marketType: 'FUTURES',
  isActive: false,
  liveOptIn: false,
  maxOpenPositions: 3,
});

describe('Bots module contract', () => {
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
    const res = await request(app).get('/dashboard/bots');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing token');
  });

  it('supports full CRUD for authenticated owner', async () => {
    const agent = await registerAndLogin('bots-owner@example.com');

    const createRes = await agent.post('/dashboard/bots').send(createPayload());
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.name).toBe('Momentum Runner');
    const botId = createRes.body.id as string;
    const futuresBotId = botId;

    const createSpotRes = await agent.post('/dashboard/bots').send({
      ...createPayload(),
      name: 'Spot Runner',
      marketType: 'SPOT',
    });
    expect(createSpotRes.status).toBe(201);
    const spotBotId = createSpotRes.body.id as string;

    const listRes = await agent.get('/dashboard/bots');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(2);

    const futuresListRes = await agent.get('/dashboard/bots').query({ marketType: 'FUTURES' });
    expect(futuresListRes.status).toBe(200);
    expect(futuresListRes.body).toHaveLength(1);
    expect(futuresListRes.body[0].id).toBe(futuresBotId);

    const spotListRes = await agent.get('/dashboard/bots').query({ marketType: 'SPOT' });
    expect(spotListRes.status).toBe(200);
    expect(spotListRes.body).toHaveLength(1);
    expect(spotListRes.body[0].id).toBe(spotBotId);

    const getRes = await agent.get(`/dashboard/bots/${botId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(botId);
    expect(getRes.body.mode).toBe('PAPER');
    expect(getRes.body.marketType).toBe('FUTURES');

    const updateRes = await agent.put(`/dashboard/bots/${botId}`).send({
      mode: 'LIVE',
      marketType: 'SPOT',
      liveOptIn: true,
      consentTextVersion: 'mvp-v1',
      maxOpenPositions: 5,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.mode).toBe('LIVE');
    expect(updateRes.body.marketType).toBe('SPOT');
    expect(updateRes.body.liveOptIn).toBe(true);
    expect(updateRes.body.consentTextVersion).toBe('mvp-v1');
    expect(updateRes.body.maxOpenPositions).toBe(5);

    const deleteRes = await agent.delete(`/dashboard/bots/${botId}`);
    expect(deleteRes.status).toBe(204);

    const getDeletedRes = await agent.get(`/dashboard/bots/${botId}`);
    expect(getDeletedRes.status).toBe(404);
    expect(getDeletedRes.body.error.message).toBe('Not found');
  });

  it('enforces ownership isolation for get/update/delete', async () => {
    const owner = await registerAndLogin('bots-owner-2@example.com');
    const other = await registerAndLogin('bots-other@example.com');

    const createRes = await owner.post('/dashboard/bots').send(createPayload());
    expect(createRes.status).toBe(201);
    const botId = createRes.body.id as string;

    const getRes = await other.get(`/dashboard/bots/${botId}`);
    expect(getRes.status).toBe(404);

    const updateRes = await other.put(`/dashboard/bots/${botId}`).send({
      name: 'Should not update',
    });
    expect(updateRes.status).toBe(404);

    const deleteRes = await other.delete(`/dashboard/bots/${botId}`);
    expect(deleteRes.status).toBe(404);
  });

  it('requires consentTextVersion when enabling live opt-in and writes consent audit log', async () => {
    const agent = await registerAndLogin('bots-consent@example.com');

    const createRes = await agent.post('/dashboard/bots').send(createPayload());
    expect(createRes.status).toBe(201);
    const botId = createRes.body.id as string;

    const missingConsentRes = await agent.put(`/dashboard/bots/${botId}`).send({
      mode: 'LIVE',
      liveOptIn: true,
    });
    expect(missingConsentRes.status).toBe(400);
    expect(missingConsentRes.body.error.message).toBe(
      'consentTextVersion is required when liveOptIn is enabled'
    );

    const withConsentRes = await agent.put(`/dashboard/bots/${botId}`).send({
      mode: 'LIVE',
      liveOptIn: true,
      consentTextVersion: 'mvp-v1',
    });
    expect(withConsentRes.status).toBe(200);

    const consentLog = await prisma.log.findFirst({
      where: {
        userId: withConsentRes.body.userId,
        botId,
        action: 'bot.live_consent.accepted',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(consentLog).toBeTruthy();
    expect(consentLog?.category).toBe('RISK_CONSENT');
  });
});
