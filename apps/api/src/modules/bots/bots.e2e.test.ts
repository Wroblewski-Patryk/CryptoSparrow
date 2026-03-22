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
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
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
    const strategyRes = await agent.post('/dashboard/strategies').send({
      name: 'Bots Strategy Link',
      interval: '5m',
      leverage: 2,
      walletRisk: 1,
      config: {
        open: { indicatorsLong: [], indicatorsShort: [] },
        close: { mode: 'basic', tp: 2, sl: 1 },
      },
    });
    expect(strategyRes.status).toBe(201);
    const strategyId = strategyRes.body.id as string;

    const createRes = await agent.post('/dashboard/bots').send({
      ...createPayload(),
      strategyId,
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.name).toBe('Momentum Runner');
    expect(createRes.body.positionMode).toBe('ONE_WAY');
    expect(createRes.body.strategyId).toBe(strategyId);
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
    expect(getRes.body.strategyId).toBe(strategyId);

    const mappingAfterCreate = await prisma.botStrategy.findMany({
      where: { botId },
    });
    expect(mappingAfterCreate).toHaveLength(1);
    expect(mappingAfterCreate[0].strategyId).toBe(strategyId);

    const updateRes = await agent.put(`/dashboard/bots/${botId}`).send({
      mode: 'LIVE',
      marketType: 'SPOT',
      positionMode: 'HEDGE',
      liveOptIn: true,
      consentTextVersion: 'mvp-v1',
      maxOpenPositions: 5,
      strategyId: null,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.mode).toBe('LIVE');
    expect(updateRes.body.marketType).toBe('SPOT');
    expect(updateRes.body.positionMode).toBe('HEDGE');
    expect(updateRes.body.liveOptIn).toBe(true);
    expect(updateRes.body.consentTextVersion).toBe('mvp-v1');
    expect(updateRes.body.maxOpenPositions).toBe(5);
    expect(updateRes.body.strategyId).toBeNull();

    const mappingAfterUpdate = await prisma.botStrategy.findMany({
      where: { botId },
    });
    expect(mappingAfterUpdate).toHaveLength(0);

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

  it('persists and audits normalized consentTextVersion across create/update flow', async () => {
    const agent = await registerAndLogin('bots-consent-persist@example.com');

    const createLiveRes = await agent.post('/dashboard/bots').send({
      ...createPayload(),
      mode: 'LIVE',
      liveOptIn: true,
      consentTextVersion: '  mvp-v1  ',
    });
    expect(createLiveRes.status).toBe(201);
    expect(createLiveRes.body.consentTextVersion).toBe('mvp-v1');
    const botId = createLiveRes.body.id as string;

    const storedAfterCreate = await prisma.bot.findUniqueOrThrow({ where: { id: botId } });
    expect(storedAfterCreate.consentTextVersion).toBe('mvp-v1');

    const acceptedLog = await prisma.log.findFirstOrThrow({
      where: {
        botId,
        action: 'bot.live_consent.accepted',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect((acceptedLog.metadata as { consentTextVersion?: string } | null)?.consentTextVersion).toBe('mvp-v1');

    const updateLiveRes = await agent.put(`/dashboard/bots/${botId}`).send({
      consentTextVersion: 'mvp-v2',
      liveOptIn: true,
    });
    expect(updateLiveRes.status).toBe(200);
    expect(updateLiveRes.body.consentTextVersion).toBe('mvp-v2');

    const storedAfterUpdate = await prisma.bot.findUniqueOrThrow({ where: { id: botId } });
    expect(storedAfterUpdate.consentTextVersion).toBe('mvp-v2');

    const updatedLog = await prisma.log.findFirstOrThrow({
      where: {
        botId,
        action: 'bot.live_consent.updated',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect((updatedLog.metadata as { consentTextVersion?: string } | null)?.consentTextVersion).toBe('mvp-v2');
  });

  it('supports market-group CRUD under bot with ownership isolation', async () => {
    const owner = await registerAndLogin('bot-groups-owner@example.com');
    const other = await registerAndLogin('bot-groups-other@example.com');

    const botRes = await owner.post('/dashboard/bots').send(createPayload());
    expect(botRes.status).toBe(201);
    const botId = botRes.body.id as string;

    const marketUniverse = await prisma.marketUniverse.create({
      data: {
        userId: botRes.body.userId as string,
        name: 'Owner Futures Universe',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: [],
        blacklist: [],
      },
    });
    const symbolGroup = await prisma.symbolGroup.create({
      data: {
        userId: botRes.body.userId as string,
        marketUniverseId: marketUniverse.id,
        name: 'Owner Futures Group',
        symbols: ['BTCUSDT', 'ETHUSDT'],
      },
    });

    const createGroupRes = await owner.post(`/dashboard/bots/${botId}/market-groups`).send({
      symbolGroupId: symbolGroup.id,
      lifecycleStatus: 'ACTIVE',
      executionOrder: 10,
      isEnabled: true,
    });
    expect(createGroupRes.status).toBe(201);
    expect(createGroupRes.body.botId).toBe(botId);
    expect(createGroupRes.body.symbolGroupId).toBe(symbolGroup.id);
    const groupId = createGroupRes.body.id as string;

    const listRes = await owner.get(`/dashboard/bots/${botId}/market-groups`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(groupId);

    const getRes = await owner.get(`/dashboard/bots/${botId}/market-groups/${groupId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(groupId);

    const updateRes = await owner.put(`/dashboard/bots/${botId}/market-groups/${groupId}`).send({
      lifecycleStatus: 'PAUSED',
      executionOrder: 20,
      isEnabled: false,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.lifecycleStatus).toBe('PAUSED');
    expect(updateRes.body.executionOrder).toBe(20);
    expect(updateRes.body.isEnabled).toBe(false);

    const otherGetRes = await other.get(`/dashboard/bots/${botId}/market-groups/${groupId}`);
    expect(otherGetRes.status).toBe(404);

    const otherDeleteRes = await other.delete(`/dashboard/bots/${botId}/market-groups/${groupId}`);
    expect(otherDeleteRes.status).toBe(404);

    const deleteRes = await owner.delete(`/dashboard/bots/${botId}/market-groups/${groupId}`);
    expect(deleteRes.status).toBe(204);
  });

  it('supports attach/reorder/update/detach strategy links for bot market-group', async () => {
    const ownerEmail = 'bot-group-links-owner@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const other = await registerAndLogin('bot-group-links-other@example.com');
    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });

    const strategyOneRes = await owner.post('/dashboard/strategies').send({
      name: 'Group Strategy 1',
      interval: '5m',
      leverage: 2,
      walletRisk: 1,
      config: { open: { indicatorsLong: [], indicatorsShort: [] }, close: { mode: 'basic', tp: 2, sl: 1 } },
    });
    expect(strategyOneRes.status).toBe(201);
    const strategyTwoRes = await owner.post('/dashboard/strategies').send({
      name: 'Group Strategy 2',
      interval: '15m',
      leverage: 2,
      walletRisk: 1,
      config: { open: { indicatorsLong: [], indicatorsShort: [] }, close: { mode: 'basic', tp: 2, sl: 1 } },
    });
    expect(strategyTwoRes.status).toBe(201);

    const botRes = await owner.post('/dashboard/bots').send(createPayload());
    expect(botRes.status).toBe(201);
    const botId = botRes.body.id as string;

    const marketUniverse = await prisma.marketUniverse.create({
      data: {
        userId: ownerUser.id,
        name: 'Owner Group Links Universe',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: [],
        blacklist: [],
      },
    });
    const symbolGroup = await prisma.symbolGroup.create({
      data: {
        userId: ownerUser.id,
        marketUniverseId: marketUniverse.id,
        name: 'Owner Group Links Symbol Group',
        symbols: ['BTCUSDT', 'ETHUSDT'],
      },
    });

    const createGroupRes = await owner.post(`/dashboard/bots/${botId}/market-groups`).send({
      symbolGroupId: symbolGroup.id,
    });
    expect(createGroupRes.status).toBe(201);
    const groupId = createGroupRes.body.id as string;

    const attachOneRes = await owner.post(`/dashboard/bots/${botId}/market-groups/${groupId}/strategies`).send({
      strategyId: strategyOneRes.body.id,
      priority: 10,
      weight: 1.5,
      isEnabled: true,
    });
    expect(attachOneRes.status).toBe(201);
    const linkOneId = attachOneRes.body.id as string;

    const attachTwoRes = await owner.post(`/dashboard/bots/${botId}/market-groups/${groupId}/strategies`).send({
      strategyId: strategyTwoRes.body.id,
      priority: 20,
      weight: 1,
      isEnabled: true,
    });
    expect(attachTwoRes.status).toBe(201);
    const linkTwoId = attachTwoRes.body.id as string;

    const listRes = await owner.get(`/dashboard/bots/${botId}/market-groups/${groupId}/strategies`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(2);
    expect(listRes.body[0].id).toBe(linkOneId);

    const reorderRes = await owner.put(`/dashboard/bots/${botId}/market-groups/${groupId}/strategies/reorder`).send({
      items: [
        { id: linkOneId, priority: 40 },
        { id: linkTwoId, priority: 5 },
      ],
    });
    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body[0].id).toBe(linkTwoId);

    const updateRes = await owner
      .put(`/dashboard/bots/${botId}/market-groups/${groupId}/strategies/${linkTwoId}`)
      .send({ weight: 2.25, isEnabled: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.weight).toBe(2.25);
    expect(updateRes.body.isEnabled).toBe(false);

    const otherAttachRes = await other
      .post(`/dashboard/bots/${botId}/market-groups/${groupId}/strategies`)
      .send({ strategyId: strategyTwoRes.body.id });
    expect(otherAttachRes.status).toBe(404);

    const detachRes = await owner.delete(
      `/dashboard/bots/${botId}/market-groups/${groupId}/strategies/${linkOneId}`
    );
    expect(detachRes.status).toBe(204);
  });

  it('exposes runtime graph for bot with ownership isolation', async () => {
    const ownerEmail = 'bot-runtime-graph-owner@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const other = await registerAndLogin('bot-runtime-graph-other@example.com');
    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });

    const strategyRes = await owner.post('/dashboard/strategies').send({
      name: 'Runtime Graph Strategy',
      interval: '5m',
      leverage: 2,
      walletRisk: 1,
      config: { open: { indicatorsLong: [], indicatorsShort: [] }, close: { mode: 'basic', tp: 2, sl: 1 } },
    });
    expect(strategyRes.status).toBe(201);

    const botRes = await owner.post('/dashboard/bots').send({
      ...createPayload(),
      strategyId: strategyRes.body.id,
    });
    expect(botRes.status).toBe(201);
    const botId = botRes.body.id as string;

    const marketUniverse = await prisma.marketUniverse.create({
      data: {
        userId: ownerUser.id,
        name: 'Runtime Graph Universe',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: [],
        blacklist: [],
      },
    });
    const symbolGroup = await prisma.symbolGroup.create({
      data: {
        userId: ownerUser.id,
        marketUniverseId: marketUniverse.id,
        name: 'Runtime Graph Group',
        symbols: ['BTCUSDT'],
      },
    });

    const createGroupRes = await owner.post(`/dashboard/bots/${botId}/market-groups`).send({
      symbolGroupId: symbolGroup.id,
      executionOrder: 1,
    });
    expect(createGroupRes.status).toBe(201);
    const groupId = createGroupRes.body.id as string;

    const attachRes = await owner.post(`/dashboard/bots/${botId}/market-groups/${groupId}/strategies`).send({
      strategyId: strategyRes.body.id,
      priority: 15,
      weight: 1,
    });
    expect(attachRes.status).toBe(201);

    const graphRes = await owner.get(`/dashboard/bots/${botId}/runtime-graph`);
    expect(graphRes.status).toBe(200);
    expect(graphRes.body.bot.id).toBe(botId);
    expect(Array.isArray(graphRes.body.marketGroups)).toBe(true);
    expect(graphRes.body.marketGroups.length).toBeGreaterThan(0);
    expect(graphRes.body.marketGroups[0].strategies.length).toBeGreaterThan(0);
    expect(Array.isArray(graphRes.body.legacyBotStrategies)).toBe(true);

    const otherGraphRes = await other.get(`/dashboard/bots/${botId}/runtime-graph`);
    expect(otherGraphRes.status).toBe(404);
  });

  it('covers one-user multi-bot multi-group multi-strategy flow', async () => {
    const ownerEmail = 'bot-multi-flow-owner@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });

    const strategyAlphaRes = await owner.post('/dashboard/strategies').send({
      name: 'Strategy Alpha',
      interval: '5m',
      leverage: 2,
      walletRisk: 1,
      config: { open: { indicatorsLong: [], indicatorsShort: [] }, close: { mode: 'basic', tp: 2, sl: 1 } },
    });
    const strategyBetaRes = await owner.post('/dashboard/strategies').send({
      name: 'Strategy Beta',
      interval: '15m',
      leverage: 2,
      walletRisk: 1,
      config: { open: { indicatorsLong: [], indicatorsShort: [] }, close: { mode: 'basic', tp: 2, sl: 1 } },
    });
    const strategyGammaRes = await owner.post('/dashboard/strategies').send({
      name: 'Strategy Gamma',
      interval: '1h',
      leverage: 2,
      walletRisk: 1,
      config: { open: { indicatorsLong: [], indicatorsShort: [] }, close: { mode: 'basic', tp: 2, sl: 1 } },
    });

    expect(strategyAlphaRes.status).toBe(201);
    expect(strategyBetaRes.status).toBe(201);
    expect(strategyGammaRes.status).toBe(201);

    const universe = await prisma.marketUniverse.create({
      data: {
        userId: ownerUser.id,
        name: 'Multi Flow Universe',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: [],
        blacklist: [],
      },
    });
    const groupOne = await prisma.symbolGroup.create({
      data: {
        userId: ownerUser.id,
        marketUniverseId: universe.id,
        name: 'Group One',
        symbols: ['BTCUSDT', 'ETHUSDT'],
      },
    });
    const groupTwo = await prisma.symbolGroup.create({
      data: {
        userId: ownerUser.id,
        marketUniverseId: universe.id,
        name: 'Group Two',
        symbols: ['SOLUSDT', 'ADAUSDT'],
      },
    });
    const groupThree = await prisma.symbolGroup.create({
      data: {
        userId: ownerUser.id,
        marketUniverseId: universe.id,
        name: 'Group Three',
        symbols: ['XRPUSDT', 'BNBUSDT'],
      },
    });

    const botOneRes = await owner.post('/dashboard/bots').send({ ...createPayload(), name: 'Bot One' });
    const botTwoRes = await owner.post('/dashboard/bots').send({ ...createPayload(), name: 'Bot Two' });
    expect(botOneRes.status).toBe(201);
    expect(botTwoRes.status).toBe(201);
    const botOneId = botOneRes.body.id as string;
    const botTwoId = botTwoRes.body.id as string;

    const botOneGroupA = await owner.post(`/dashboard/bots/${botOneId}/market-groups`).send({
      symbolGroupId: groupOne.id,
      executionOrder: 1,
      maxOpenPositions: 2,
    });
    const botOneGroupB = await owner.post(`/dashboard/bots/${botOneId}/market-groups`).send({
      symbolGroupId: groupTwo.id,
      executionOrder: 2,
      maxOpenPositions: 1,
    });
    const botTwoGroupA = await owner.post(`/dashboard/bots/${botTwoId}/market-groups`).send({
      symbolGroupId: groupThree.id,
      executionOrder: 1,
      maxOpenPositions: 3,
    });
    expect(botOneGroupA.status).toBe(201);
    expect(botOneGroupB.status).toBe(201);
    expect(botTwoGroupA.status).toBe(201);

    const botOneGroupAId = botOneGroupA.body.id as string;
    const botOneGroupBId = botOneGroupB.body.id as string;
    const botTwoGroupAId = botTwoGroupA.body.id as string;

    const attachResults = await Promise.all([
      owner.post(`/dashboard/bots/${botOneId}/market-groups/${botOneGroupAId}/strategies`).send({
        strategyId: strategyAlphaRes.body.id,
        priority: 10,
        weight: 1.5,
      }),
      owner.post(`/dashboard/bots/${botOneId}/market-groups/${botOneGroupAId}/strategies`).send({
        strategyId: strategyBetaRes.body.id,
        priority: 20,
        weight: 1,
      }),
      owner.post(`/dashboard/bots/${botOneId}/market-groups/${botOneGroupBId}/strategies`).send({
        strategyId: strategyGammaRes.body.id,
        priority: 5,
        weight: 2,
      }),
      owner.post(`/dashboard/bots/${botTwoId}/market-groups/${botTwoGroupAId}/strategies`).send({
        strategyId: strategyBetaRes.body.id,
        priority: 15,
        weight: 1,
      }),
      owner.post(`/dashboard/bots/${botTwoId}/market-groups/${botTwoGroupAId}/strategies`).send({
        strategyId: strategyGammaRes.body.id,
        priority: 25,
        weight: 0.8,
      }),
    ]);
    for (const response of attachResults) {
      expect(response.status).toBe(201);
    }

    const graphOneRes = await owner.get(`/dashboard/bots/${botOneId}/runtime-graph`);
    const graphTwoRes = await owner.get(`/dashboard/bots/${botTwoId}/runtime-graph`);
    expect(graphOneRes.status).toBe(200);
    expect(graphTwoRes.status).toBe(200);

    expect(graphOneRes.body.marketGroups).toHaveLength(2);
    expect(graphOneRes.body.marketGroups[0].strategies.length).toBeGreaterThanOrEqual(2);
    expect(graphOneRes.body.marketGroups[1].strategies.length).toBeGreaterThanOrEqual(1);
    expect(graphTwoRes.body.marketGroups).toHaveLength(1);
    expect(graphTwoRes.body.marketGroups[0].strategies.length).toBeGreaterThanOrEqual(2);
  });
});
