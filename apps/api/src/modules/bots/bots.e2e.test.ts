import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';
import { runtimePositionAutomationService } from '../engine/runtimePositionAutomation.service';

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post('/auth/register').send({
    email,
    password: 'test1234',
  });
  expect(res.status).toBe(201);
  return agent;
};

const createStrategy = async (
  agent: ReturnType<typeof request.agent>,
  name: string = `Bots Strategy ${Date.now()}`,
  config?: Record<string, unknown>
) => {
  const strategyRes = await agent.post('/dashboard/strategies').send({
    name,
    interval: '5m',
    leverage: 2,
    walletRisk: 1,
    config:
      config ?? {
        open: { indicatorsLong: [], indicatorsShort: [] },
        close: { mode: 'basic', tp: 2, sl: 1 },
      },
  });
  expect(strategyRes.status).toBe(201);
  return strategyRes.body.id as string;
};

const createMarketGroup = async (
  email: string,
  marketType: 'FUTURES' | 'SPOT' = 'FUTURES'
) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const marketUniverse = await prisma.marketUniverse.create({
    data: {
      userId: user.id,
      name: `Auto Universe ${marketType} ${Date.now()}`,
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
      name: `Auto Group ${marketType} ${Date.now()}`,
      symbols: marketType === 'SPOT' ? ['BTCUSDT'] : ['BTCUSDT', 'ETHUSDT'],
    },
  });

  return symbolGroup.id;
};

const createPayload = (refs: { strategyId: string; marketGroupId: string }) => ({
  name: 'Momentum Runner',
  mode: 'PAPER',
  strategyId: refs.strategyId,
  marketGroupId: refs.marketGroupId,
  isActive: false,
  liveOptIn: false,
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
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/dashboard/bots');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing token');
  });

  it('returns canonical bot mode in list/get/runtime graph responses', async () => {
    const email = 'bots-canonical-mode@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Canonical Mode Strategy');
    const marketGroupId = await createMarketGroup(email, 'FUTURES');

    const createRes = await agent.post('/dashboard/bots').send({
      ...createPayload({ strategyId, marketGroupId }),
      mode: 'PAPER',
    });
    expect(createRes.status).toBe(201);
    const botId = createRes.body.id as string;

    const listRes = await agent.get('/dashboard/bots');
    expect(listRes.status).toBe(200);
    const listedBot = listRes.body.find((item: { id: string }) => item.id === botId);
    expect(listedBot).toBeTruthy();
    expect(listedBot.mode).toBe('PAPER');

    const getRes = await agent.get(`/dashboard/bots/${botId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.mode).toBe('PAPER');

    const runtimeGraphRes = await agent.get(`/dashboard/bots/${botId}/runtime-graph`);
    expect(runtimeGraphRes.status).toBe(200);
    expect(runtimeGraphRes.body.bot.mode).toBe('PAPER');
  });

  it('supports full CRUD for authenticated owner', async () => {
    const email = 'bots-owner@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Bots Strategy Link');
    const futuresMarketGroupId = await createMarketGroup(email, 'FUTURES');
    const spotMarketGroupId = await createMarketGroup(email, 'SPOT');

    const createRes = await agent.post('/dashboard/bots').send({
      ...createPayload({ strategyId, marketGroupId: futuresMarketGroupId }),
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.name).toBe('Momentum Runner');
    expect(createRes.body.positionMode).toBe('ONE_WAY');
    expect(createRes.body.strategyId).toBe(strategyId);
    const botId = createRes.body.id as string;
    const futuresBotId = botId;

    const createSpotRes = await agent.post('/dashboard/bots').send({
      ...createPayload({ strategyId, marketGroupId: spotMarketGroupId }),
      name: 'Spot Runner',
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
    expect(mappingAfterCreate).toHaveLength(0);

    const marketGroupsAfterCreate = await prisma.botMarketGroup.findMany({
      where: { botId },
    });
    expect(marketGroupsAfterCreate).toHaveLength(1);
    expect(marketGroupsAfterCreate[0].symbolGroupId).toBe(futuresMarketGroupId);

    const strategyLinksAfterCreate = await prisma.marketGroupStrategyLink.findMany({
      where: { botId },
    });
    expect(strategyLinksAfterCreate).toHaveLength(1);
    expect(strategyLinksAfterCreate[0].strategyId).toBe(strategyId);

    const updateRes = await agent.put(`/dashboard/bots/${botId}`).send({
      mode: 'LIVE',
      marketType: 'SPOT',
      liveOptIn: true,
      consentTextVersion: 'mvp-v1',
      strategyId: null,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.mode).toBe('LIVE');
    expect(updateRes.body.marketType).toBe('FUTURES');
    expect(updateRes.body.positionMode).toBe('ONE_WAY');
    expect(updateRes.body.liveOptIn).toBe(true);
    expect(updateRes.body.consentTextVersion).toBe('mvp-v1');
    expect(updateRes.body.maxOpenPositions).toBe(1);
    expect(updateRes.body.strategyId).toBe(strategyId);

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
    const ownerEmail = 'bots-owner-2@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const other = await registerAndLogin('bots-other@example.com');
    const strategyId = await createStrategy(owner, 'Ownership Isolation Strategy');
    const marketGroupId = await createMarketGroup(ownerEmail, 'FUTURES');

    const createRes = await owner
      .post('/dashboard/bots')
      .send(createPayload({ strategyId, marketGroupId }));
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

  it('deletes bot with runtime history cleanup', async () => {
    const email = 'bots-delete-runtime-cleanup@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Delete Runtime Strategy');
    const marketGroupId = await createMarketGroup(email, 'FUTURES');
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    const createRes = await agent.post('/dashboard/bots').send({
      ...createPayload({ strategyId, marketGroupId }),
      isActive: true,
    });
    expect(createRes.status).toBe(201);
    const botId = createRes.body.id as string;

    const session = await prisma.botRuntimeSession.create({
      data: {
        userId: user.id,
        botId,
        mode: 'PAPER',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
    await prisma.botRuntimeEvent.create({
      data: {
        userId: user.id,
        botId,
        sessionId: session.id,
        eventType: 'HEARTBEAT',
        level: 'INFO',
        eventAt: new Date(),
      },
    });
    await prisma.botRuntimeSymbolStat.create({
      data: {
        userId: user.id,
        botId,
        sessionId: session.id,
        symbol: 'BTCUSDT',
      },
    });

    const deleteRes = await agent.delete(`/dashboard/bots/${botId}`);
    expect(deleteRes.status).toBe(204);

    const [sessionsCount, eventsCount, statsCount] = await Promise.all([
      prisma.botRuntimeSession.count({ where: { botId } }),
      prisma.botRuntimeEvent.count({ where: { botId } }),
      prisma.botRuntimeSymbolStat.count({ where: { botId } }),
    ]);

    expect(sessionsCount).toBe(0);
    expect(eventsCount).toBe(0);
    expect(statsCount).toBe(0);
  });

  it('enforces create ownership contract for strategyId/marketGroupId and derives marketType from market group', async () => {
    const ownerEmail = 'bots-create-contract-owner@example.com';
    const otherEmail = 'bots-create-contract-other@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const other = await registerAndLogin(otherEmail);

    const ownerStrategyId = await createStrategy(owner, 'Owner Create Contract Strategy');
    const ownerSpotMarketGroupId = await createMarketGroup(ownerEmail, 'SPOT');
    const otherStrategyId = await createStrategy(other, 'Other Create Contract Strategy');
    const otherMarketGroupId = await createMarketGroup(otherEmail, 'FUTURES');

    const invalidStrategyRes = await owner.post('/dashboard/bots').send(
      createPayload({
        strategyId: otherStrategyId,
        marketGroupId: ownerSpotMarketGroupId,
      })
    );
    expect(invalidStrategyRes.status).toBe(400);
    expect(invalidStrategyRes.body.error.message).toBe('strategyId is invalid for current user');

    const invalidMarketGroupRes = await owner.post('/dashboard/bots').send(
      createPayload({
        strategyId: ownerStrategyId,
        marketGroupId: otherMarketGroupId,
      })
    );
    expect(invalidMarketGroupRes.status).toBe(400);
    expect(invalidMarketGroupRes.body.error.message).toBe('marketGroupId is invalid for current user');

    const createRes = await owner.post('/dashboard/bots').send(
      createPayload({
        strategyId: ownerStrategyId,
        marketGroupId: ownerSpotMarketGroupId,
      })
    );
    expect(createRes.status).toBe(201);
    expect(createRes.body.marketType).toBe('SPOT');
  });

  it('accepts marketUniverse id in create payload and auto-creates symbol group when missing', async () => {
    const email = 'bots-create-from-universe-id@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Create From Universe Strategy');
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    const marketUniverse = await prisma.marketUniverse.create({
      data: {
        userId: user.id,
        name: 'Universe Without Symbol Group',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: ['btcusdt', 'ETHUSDT'],
        blacklist: ['ethusdt'],
      },
    });

    const createRes = await agent.post('/dashboard/bots').send(
      createPayload({
        strategyId,
        marketGroupId: marketUniverse.id,
      })
    );
    expect(createRes.status).toBe(201);
    expect(createRes.body.marketType).toBe('FUTURES');
    const botId = createRes.body.id as string;

    const botMarketGroups = await prisma.botMarketGroup.findMany({
      where: { botId },
      include: { symbolGroup: true },
    });
    expect(botMarketGroups).toHaveLength(1);
    expect(botMarketGroups[0].symbolGroup.marketUniverseId).toBe(marketUniverse.id);
    expect(botMarketGroups[0].symbolGroup.symbols).toEqual(['BTCUSDT']);
  });

  it('ignores removed positionMode/maxOpenPositions fields in update write payload', async () => {
    const email = 'bots-update-write-contract@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Update Contract Strategy');
    const marketGroupId = await createMarketGroup(email, 'FUTURES');

    const createRes = await agent
      .post('/dashboard/bots')
      .send(createPayload({ strategyId, marketGroupId }));
    expect(createRes.status).toBe(201);
    const botId = createRes.body.id as string;

    const updateRes = await agent.put(`/dashboard/bots/${botId}`).send({
      positionMode: 'HEDGE',
      maxOpenPositions: 99,
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.positionMode).toBe('ONE_WAY');
    expect(updateRes.body.maxOpenPositions).toBe(1);
  });

  it('requires consentTextVersion when enabling live opt-in and writes consent audit log', async () => {
    const email = 'bots-consent@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Consent Strategy');
    const marketGroupId = await createMarketGroup(email, 'FUTURES');

    const createRes = await agent
      .post('/dashboard/bots')
      .send(createPayload({ strategyId, marketGroupId }));
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
    const email = 'bots-consent-persist@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Consent Persist Strategy');
    const marketGroupId = await createMarketGroup(email, 'FUTURES');

    const createLiveRes = await agent.post('/dashboard/bots').send({
      ...createPayload({ strategyId, marketGroupId }),
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
    const ownerEmail = 'bot-groups-owner@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const other = await registerAndLogin('bot-groups-other@example.com');
    const strategyId = await createStrategy(owner, 'Market Group Crud Strategy');
    const defaultMarketGroupId = await createMarketGroup(ownerEmail, 'FUTURES');

    const botRes = await owner
      .post('/dashboard/bots')
      .send(createPayload({ strategyId, marketGroupId: defaultMarketGroupId }));
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
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.some((group: { id: string }) => group.id === groupId)).toBe(true);

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
    const createBotStrategyId = await createStrategy(owner, 'Group Links Bot Create Strategy');
    const defaultMarketGroupId = await createMarketGroup(ownerEmail, 'FUTURES');

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

    const botRes = await owner
      .post('/dashboard/bots')
      .send(createPayload({ strategyId: createBotStrategyId, marketGroupId: defaultMarketGroupId }));
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
    const defaultMarketGroupId = await createMarketGroup(ownerEmail, 'FUTURES');

    const botRes = await owner.post('/dashboard/bots').send({
      ...createPayload({ strategyId: strategyRes.body.id as string, marketGroupId: defaultMarketGroupId }),
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

  it('lists and returns runtime session monitoring summary with ownership isolation', async () => {
    const ownerEmail = 'bot-runtime-session-owner@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const other = await registerAndLogin('bot-runtime-session-other@example.com');

    const strategyId = await createStrategy(owner, 'Runtime Session Strategy');
    const defaultMarketGroupId = await createMarketGroup(ownerEmail, 'FUTURES');

    const botRes = await owner.post('/dashboard/bots').send(
      createPayload({
        strategyId,
        marketGroupId: defaultMarketGroupId,
      })
    );
    expect(botRes.status).toBe(201);
    const botId = botRes.body.id as string;
    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });

    const startedAt = new Date('2026-03-31T00:00:00.000Z');
    const finishedAt = new Date('2026-03-31T00:05:00.000Z');
    const session = await prisma.botRuntimeSession.create({
      data: {
        userId: ownerUser.id,
        botId,
        mode: 'PAPER',
        status: 'COMPLETED',
        startedAt,
        finishedAt,
        lastHeartbeatAt: finishedAt,
        stopReason: 'manual_stop',
      },
    });

    await prisma.botRuntimeEvent.create({
      data: {
        userId: ownerUser.id,
        botId,
        sessionId: session.id,
        eventType: 'SIGNAL_DECISION',
        level: 'INFO',
        symbol: 'BTCUSDT',
        signalDirection: 'LONG',
        message: 'signal captured',
        eventAt: new Date('2026-03-31T00:01:00.000Z'),
      },
    });

    await prisma.botRuntimeSymbolStat.create({
      data: {
        userId: ownerUser.id,
        botId,
        sessionId: session.id,
        symbol: 'BTCUSDT',
        totalSignals: 2,
        longEntries: 1,
        exits: 1,
        dcaCount: 1,
        closedTrades: 1,
        realizedPnl: 42.5,
        snapshotAt: new Date('2026-03-31T00:05:00.000Z'),
      },
    });

    await prisma.position.createMany({
      data: [
        {
          userId: ownerUser.id,
          botId,
          symbol: 'BTCUSDT',
          side: 'LONG',
          status: 'OPEN',
          entryPrice: 50000,
          quantity: 0.1,
          leverage: 1,
          openedAt: new Date('2026-03-31T00:03:00.000Z'),
          managementMode: 'BOT_MANAGED',
        },
        {
          userId: ownerUser.id,
          botId,
          symbol: 'ETHUSDT',
          side: 'SHORT',
          status: 'CLOSED',
          entryPrice: 2500,
          quantity: 1,
          leverage: 1,
          openedAt: new Date('2026-03-31T00:00:30.000Z'),
          closedAt: new Date('2026-03-31T00:04:30.000Z'),
          managementMode: 'BOT_MANAGED',
        },
      ],
    });

    await prisma.trade.create({
      data: {
        userId: ownerUser.id,
        botId,
        symbol: 'BTCUSDT',
        side: 'BUY',
        price: 50000,
        quantity: 0.1,
        fee: 2.5,
        feeSource: 'EXCHANGE_FILL',
        feePending: false,
        feeCurrency: 'USDT',
        realizedPnl: 25,
        executedAt: new Date('2026-03-31T00:02:00.000Z'),
      },
    });
    await prisma.trade.create({
      data: {
        userId: ownerUser.id,
        botId,
        symbol: 'BTCUSDT',
        side: 'SELL',
        price: 51000,
        quantity: 0.1,
        fee: 2.5,
        realizedPnl: 20,
        executedAt: new Date('2026-03-31T00:10:00.000Z'),
      },
    });

    const listRes = await owner.get(`/dashboard/bots/${botId}/runtime-sessions`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(session.id);
    expect(listRes.body[0].eventsCount).toBe(1);
    expect(listRes.body[0].symbolsTracked).toBe(1);
    expect(listRes.body[0].summary.totalSignals).toBe(2);
    expect(listRes.body[0].summary.dcaCount).toBe(1);
    expect(listRes.body[0].summary.closedTrades).toBe(1);
    expect(listRes.body[0].summary.realizedPnl).toBe(42.5);

    const detailRes = await owner.get(`/dashboard/bots/${botId}/runtime-sessions/${session.id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.id).toBe(session.id);
    expect(detailRes.body.eventsCount).toBe(1);
    expect(detailRes.body.symbolsTracked).toBe(1);
    expect(detailRes.body.summary.totalSignals).toBe(2);
    expect(detailRes.body.summary.longEntries).toBe(1);
    expect(detailRes.body.summary.exits).toBe(1);
    expect(detailRes.body.summary.dcaCount).toBe(1);
    expect(detailRes.body.summary.closedTrades).toBe(1);
    expect(detailRes.body.summary.realizedPnl).toBe(42.5);

    const symbolStatsRes = await owner.get(
      `/dashboard/bots/${botId}/runtime-sessions/${session.id}/symbol-stats`
    );
    expect(symbolStatsRes.status).toBe(200);
    expect(symbolStatsRes.body.items.length).toBeGreaterThanOrEqual(1);
    expect(symbolStatsRes.body.items.map((item: { symbol: string }) => item.symbol)).toContain('BTCUSDT');
    expect(
      symbolStatsRes.body.items.find((item: { symbol: string }) => item.symbol === 'BTCUSDT')
        ?.lastSignalDirection
    ).toBe('LONG');
    expect(symbolStatsRes.body.summary.totalSignals).toBe(2);
    expect(symbolStatsRes.body.summary.realizedPnl).toBe(42.5);

    const tradesRes = await owner.get(`/dashboard/bots/${botId}/runtime-sessions/${session.id}/trades`);
    expect(tradesRes.status).toBe(200);
    expect(tradesRes.body.total).toBe(1);
    expect(tradesRes.body.items).toHaveLength(1);
    expect(tradesRes.body.items[0].symbol).toBe('BTCUSDT');
    expect(tradesRes.body.items[0].lifecycleAction).toBe('UNKNOWN');
    expect(tradesRes.body.items[0].notional).toBe(5000);
    expect(tradesRes.body.items[0].margin).toBe(5000);
    expect(tradesRes.body.items[0].fee).toBe(2.5);
    expect(tradesRes.body.items[0].feeSource).toBe('EXCHANGE_FILL');
    expect(tradesRes.body.items[0].feePending).toBe(false);
    expect(tradesRes.body.items[0].feeCurrency).toBe('USDT');
    expect(tradesRes.body.items[0].realizedPnl).toBe(25);

    const positionsRes = await owner.get(`/dashboard/bots/${botId}/runtime-sessions/${session.id}/positions`);
    expect(positionsRes.status).toBe(200);
    expect(positionsRes.body.total).toBe(2);
    expect(positionsRes.body.openCount).toBe(1);
    expect(positionsRes.body.closedCount).toBe(1);
    expect(positionsRes.body.openOrdersCount).toBe(0);
    expect(typeof positionsRes.body.showDynamicStopColumns).toBe('boolean');
    expect(positionsRes.body.openOrders).toHaveLength(0);
    expect(positionsRes.body.openItems).toHaveLength(1);
    expect(positionsRes.body.historyItems).toHaveLength(1);
    expect(positionsRes.body.openItems[0].symbol).toBe('BTCUSDT');
    expect(positionsRes.body.historyItems[0].symbol).toBe('ETHUSDT');

    const filteredListRes = await owner.get(`/dashboard/bots/${botId}/runtime-sessions`).query({
      status: 'RUNNING',
    });
    expect(filteredListRes.status).toBe(200);
    expect(filteredListRes.body).toHaveLength(0);

    const otherListRes = await other.get(`/dashboard/bots/${botId}/runtime-sessions`);
    expect(otherListRes.status).toBe(404);

    const otherDetailRes = await other.get(`/dashboard/bots/${botId}/runtime-sessions/${session.id}`);
    expect(otherDetailRes.status).toBe(404);

    const otherSymbolStatsRes = await other.get(
      `/dashboard/bots/${botId}/runtime-sessions/${session.id}/symbol-stats`
    );
    expect(otherSymbolStatsRes.status).toBe(404);

    const otherTradesRes = await other.get(`/dashboard/bots/${botId}/runtime-sessions/${session.id}/trades`);
    expect(otherTradesRes.status).toBe(404);

    const otherPositionsRes = await other.get(`/dashboard/bots/${botId}/runtime-sessions/${session.id}/positions`);
    expect(otherPositionsRes.status).toBe(404);
  });

  it('supports monitoring query filters for status/symbol/limit and enforces session time window', async () => {
    const ownerEmail = 'bot-runtime-monitoring-filters-owner@example.com';
    const owner = await registerAndLogin(ownerEmail);

    const strategyId = await createStrategy(owner, 'Runtime Monitoring Filter Strategy');
    const defaultMarketGroupId = await createMarketGroup(ownerEmail, 'FUTURES');

    const botRes = await owner.post('/dashboard/bots').send(
      createPayload({
        strategyId,
        marketGroupId: defaultMarketGroupId,
      })
    );
    expect(botRes.status).toBe(201);
    const botId = botRes.body.id as string;
    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });

    const completedSession = await prisma.botRuntimeSession.create({
      data: {
        userId: ownerUser.id,
        botId,
        mode: 'PAPER',
        status: 'COMPLETED',
        startedAt: new Date('2026-03-31T01:00:00.000Z'),
        finishedAt: new Date('2026-03-31T01:10:00.000Z'),
        lastHeartbeatAt: new Date('2026-03-31T01:10:00.000Z'),
      },
    });

    const runningSession = await prisma.botRuntimeSession.create({
      data: {
        userId: ownerUser.id,
        botId,
        mode: 'PAPER',
        status: 'RUNNING',
        startedAt: new Date('2026-03-31T02:00:00.000Z'),
        lastHeartbeatAt: new Date('2026-03-31T02:06:00.000Z'),
      },
    });

    await prisma.botRuntimeSymbolStat.createMany({
      data: [
        {
          userId: ownerUser.id,
          botId,
          sessionId: runningSession.id,
          symbol: 'ETHUSDT',
          totalSignals: 4,
          longEntries: 2,
          shortEntries: 1,
          exits: 1,
          dcaCount: 1,
          closedTrades: 1,
          winningTrades: 1,
          losingTrades: 0,
          realizedPnl: 15.2,
          snapshotAt: new Date('2026-03-31T02:06:00.000Z'),
        },
        {
          userId: ownerUser.id,
          botId,
          sessionId: runningSession.id,
          symbol: 'BTCUSDT',
          totalSignals: 3,
          longEntries: 1,
          shortEntries: 1,
          exits: 1,
          dcaCount: 0,
          closedTrades: 1,
          winningTrades: 0,
          losingTrades: 1,
          realizedPnl: -7.5,
          snapshotAt: new Date('2026-03-31T02:06:00.000Z'),
        },
      ],
    });

    await prisma.trade.createMany({
      data: [
        {
          userId: ownerUser.id,
          botId,
          symbol: 'ETHUSDT',
          side: 'BUY',
          lifecycleAction: 'OPEN',
          price: 2000,
          quantity: 0.5,
          fee: 1,
          realizedPnl: 5,
          executedAt: new Date('2026-03-31T02:03:00.000Z'),
        },
        {
          userId: ownerUser.id,
          botId,
          symbol: 'ETHUSDT',
          side: 'SELL',
          lifecycleAction: 'DCA',
          price: 2020,
          quantity: 0.5,
          fee: 1,
          realizedPnl: 10,
          executedAt: new Date('2026-03-31T02:05:30.000Z'),
        },
        {
          userId: ownerUser.id,
          botId,
          symbol: 'ETHUSDT',
          side: 'SELL',
          lifecycleAction: 'CLOSE',
          price: 2040,
          quantity: 0.5,
          fee: 1,
          realizedPnl: 15,
          executedAt: new Date('2026-03-31T02:09:00.000Z'),
        },
        {
          userId: ownerUser.id,
          botId,
          symbol: 'BTCUSDT',
          side: 'BUY',
          lifecycleAction: 'OPEN',
          price: 60000,
          quantity: 0.02,
          fee: 2,
          realizedPnl: -7.5,
          executedAt: new Date('2026-03-31T02:04:00.000Z'),
        },
      ],
    });

    const runningListRes = await owner
      .get(`/dashboard/bots/${botId}/runtime-sessions`)
      .query({ status: 'RUNNING', limit: 1 });
    expect(runningListRes.status).toBe(200);
    expect(runningListRes.body).toHaveLength(1);
    expect(runningListRes.body[0].id).toBe(runningSession.id);

    const ethStatsRes = await owner
      .get(`/dashboard/bots/${botId}/runtime-sessions/${runningSession.id}/symbol-stats`)
      .query({ symbol: 'ethusdt', limit: 1 });
    expect(ethStatsRes.status).toBe(200);
    expect(ethStatsRes.body.items).toHaveLength(1);
    expect(ethStatsRes.body.items[0].symbol).toBe('ETHUSDT');
    expect(ethStatsRes.body.summary.totalSignals).toBe(4);
    expect(ethStatsRes.body.summary.realizedPnl).toBe(15.2);

    const ethTradesRes = await owner
      .get(`/dashboard/bots/${botId}/runtime-sessions/${runningSession.id}/trades`)
      .query({ symbol: 'ETHUSDT', limit: 1 });
    expect(ethTradesRes.status).toBe(200);
    expect(ethTradesRes.body.total).toBe(3);
    expect(ethTradesRes.body.items).toHaveLength(1);
    expect(ethTradesRes.body.items[0].symbol).toBe('ETHUSDT');
    expect(ethTradesRes.body.items[0].executedAt).toContain('2026-03-31T02:09:00.000Z');
    expect(ethTradesRes.body.meta.page).toBe(1);
    expect(ethTradesRes.body.meta.pageSize).toBe(1);
    expect(ethTradesRes.body.meta.total).toBe(3);
    expect(ethTradesRes.body.meta.totalPages).toBe(3);

    const ethTradesPage2Res = await owner
      .get(`/dashboard/bots/${botId}/runtime-sessions/${runningSession.id}/trades`)
      .query({ symbol: 'ETHUSDT', page: 2, pageSize: 1, sortBy: 'realizedPnl', sortDir: 'desc' });
    expect(ethTradesPage2Res.status).toBe(200);
    expect(ethTradesPage2Res.body.total).toBe(3);
    expect(ethTradesPage2Res.body.items).toHaveLength(1);
    expect(ethTradesPage2Res.body.items[0].realizedPnl).toBe(10);
    expect(ethTradesPage2Res.body.meta.page).toBe(2);

    const ethSellTradesRes = await owner
      .get(`/dashboard/bots/${botId}/runtime-sessions/${runningSession.id}/trades`)
      .query({ symbol: 'ETHUSDT', side: 'SELL', page: 1, pageSize: 10 });
    expect(ethSellTradesRes.status).toBe(200);
    expect(ethSellTradesRes.body.total).toBe(2);
    expect(ethSellTradesRes.body.items.every((item: { side: string }) => item.side === 'SELL')).toBe(true);

    const ethCloseTradesRes = await owner
      .get(`/dashboard/bots/${botId}/runtime-sessions/${runningSession.id}/trades`)
      .query({ symbol: 'ETHUSDT', action: 'CLOSE' });
    expect(ethCloseTradesRes.status).toBe(200);
    expect(ethCloseTradesRes.body.total).toBe(1);
    expect(ethCloseTradesRes.body.items[0].lifecycleAction).toBe('CLOSE');

    const ethFromToTradesRes = await owner
      .get(`/dashboard/bots/${botId}/runtime-sessions/${runningSession.id}/trades`)
      .query({
        symbol: 'ETHUSDT',
        from: '2026-03-31T02:05:00.000Z',
        to: '2026-03-31T02:06:00.000Z',
      });
    expect(ethFromToTradesRes.status).toBe(200);
    expect(ethFromToTradesRes.body.total).toBe(1);
    expect(ethFromToTradesRes.body.items[0].executedAt).toContain('2026-03-31T02:05:30.000Z');

    const completedTradesRes = await owner
      .get(`/dashboard/bots/${botId}/runtime-sessions/${completedSession.id}/trades`)
      .query({ symbol: 'ETHUSDT' });
    expect(completedTradesRes.status).toBe(200);
    expect(completedTradesRes.body.total).toBe(0);
    expect(completedTradesRes.body.items).toHaveLength(0);
  });

  it('maps DCA ladder levels for basic repeated, advanced, and legacy strategy configs', async () => {
    const ownerEmail = 'bot-runtime-dca-ladder-owner@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });

    const basicStrategyId = await createStrategy(owner, 'Runtime DCA Basic', {
      open: { indicatorsLong: [], indicatorsShort: [] },
      close: { mode: 'basic', tp: 2, sl: 1 },
      additional: {
        dcaEnabled: true,
        dcaMode: 'basic',
        dcaTimes: 2,
        dcaLevels: [{ percent: -15 }],
      },
    });
    const advancedStrategyId = await createStrategy(owner, 'Runtime DCA Advanced', {
      open: { indicatorsLong: [], indicatorsShort: [] },
      close: { mode: 'basic', tp: 2, sl: 1 },
      additional: {
        dcaEnabled: true,
        dcaMode: 'advanced',
        dcaTimes: 3,
        dcaLevels: [{ percent: -10 }, { percent: -20 }, { percent: -30 }],
      },
    });
    const legacyStrategyId = await createStrategy(owner, 'Runtime DCA Legacy', {
      open: { indicatorsLong: [], indicatorsShort: [] },
      close: { mode: 'basic', tp: 2, sl: 1 },
    });

    const universe = await prisma.marketUniverse.create({
      data: {
        userId: ownerUser.id,
        name: `DCA Ladder Universe ${Date.now()}`,
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: [],
        blacklist: [],
      },
    });

    const groupBasic = await prisma.symbolGroup.create({
      data: {
        userId: ownerUser.id,
        marketUniverseId: universe.id,
        name: 'DCA Basic Group',
        symbols: ['BTCUSDT'],
      },
    });
    const groupAdvanced = await prisma.symbolGroup.create({
      data: {
        userId: ownerUser.id,
        marketUniverseId: universe.id,
        name: 'DCA Advanced Group',
        symbols: ['ETHUSDT'],
      },
    });
    const groupLegacy = await prisma.symbolGroup.create({
      data: {
        userId: ownerUser.id,
        marketUniverseId: universe.id,
        name: 'DCA Legacy Group',
        symbols: ['BNBUSDT'],
      },
    });

    const bot = await prisma.bot.create({
      data: {
        userId: ownerUser.id,
        name: 'DCA Ladder Bot',
        mode: 'PAPER',
        marketType: 'FUTURES',
        isActive: true,
      },
    });

    const basicBotGroup = await prisma.botMarketGroup.create({
      data: {
        userId: ownerUser.id,
        botId: bot.id,
        symbolGroupId: groupBasic.id,
        lifecycleStatus: 'ACTIVE',
        executionOrder: 1,
        isEnabled: true,
      },
    });
    const advancedBotGroup = await prisma.botMarketGroup.create({
      data: {
        userId: ownerUser.id,
        botId: bot.id,
        symbolGroupId: groupAdvanced.id,
        lifecycleStatus: 'ACTIVE',
        executionOrder: 2,
        isEnabled: true,
      },
    });
    const legacyBotGroup = await prisma.botMarketGroup.create({
      data: {
        userId: ownerUser.id,
        botId: bot.id,
        symbolGroupId: groupLegacy.id,
        lifecycleStatus: 'ACTIVE',
        executionOrder: 3,
        isEnabled: true,
      },
    });

    await prisma.marketGroupStrategyLink.createMany({
      data: [
        {
          userId: ownerUser.id,
          botId: bot.id,
          botMarketGroupId: basicBotGroup.id,
          strategyId: basicStrategyId,
          priority: 1,
          weight: 1,
          isEnabled: true,
        },
        {
          userId: ownerUser.id,
          botId: bot.id,
          botMarketGroupId: advancedBotGroup.id,
          strategyId: advancedStrategyId,
          priority: 1,
          weight: 1,
          isEnabled: true,
        },
        {
          userId: ownerUser.id,
          botId: bot.id,
          botMarketGroupId: legacyBotGroup.id,
          strategyId: legacyStrategyId,
          priority: 1,
          weight: 1,
          isEnabled: true,
        },
      ],
    });

    const session = await prisma.botRuntimeSession.create({
      data: {
        userId: ownerUser.id,
        botId: bot.id,
        mode: 'PAPER',
        status: 'RUNNING',
        startedAt: new Date('2026-04-02T10:00:00.000Z'),
        lastHeartbeatAt: new Date('2026-04-02T10:10:00.000Z'),
      },
    });

    const basicPosition = await prisma.position.create({
      data: {
        userId: ownerUser.id,
        botId: bot.id,
        strategyId: basicStrategyId,
        symbol: 'BTCUSDT',
        side: 'LONG',
        status: 'OPEN',
        entryPrice: 65000,
        quantity: 0.2,
        leverage: 15,
        openedAt: new Date('2026-04-02T10:01:00.000Z'),
        managementMode: 'BOT_MANAGED',
      },
    });
    const advancedPosition = await prisma.position.create({
      data: {
        userId: ownerUser.id,
        botId: bot.id,
        strategyId: advancedStrategyId,
        symbol: 'ETHUSDT',
        side: 'SHORT',
        status: 'OPEN',
        entryPrice: 2200,
        quantity: 5,
        leverage: 15,
        openedAt: new Date('2026-04-02T10:02:00.000Z'),
        managementMode: 'BOT_MANAGED',
      },
    });
    const legacyPosition = await prisma.position.create({
      data: {
        userId: ownerUser.id,
        botId: bot.id,
        strategyId: legacyStrategyId,
        symbol: 'BNBUSDT',
        side: 'LONG',
        status: 'OPEN',
        entryPrice: 600,
        quantity: 20,
        leverage: 15,
        openedAt: new Date('2026-04-02T10:03:00.000Z'),
        managementMode: 'BOT_MANAGED',
      },
    });

    await prisma.trade.createMany({
      data: [
        {
          userId: ownerUser.id,
          botId: bot.id,
          positionId: basicPosition.id,
          strategyId: basicStrategyId,
          symbol: 'BTCUSDT',
          side: 'BUY',
          lifecycleAction: 'OPEN',
          price: 65000,
          quantity: 0.1,
          fee: 0,
          realizedPnl: 0,
          executedAt: new Date('2026-04-02T10:01:10.000Z'),
        },
        {
          userId: ownerUser.id,
          botId: bot.id,
          positionId: basicPosition.id,
          strategyId: basicStrategyId,
          symbol: 'BTCUSDT',
          side: 'BUY',
          lifecycleAction: 'DCA',
          price: 64500,
          quantity: 0.05,
          fee: 0,
          realizedPnl: 0,
          executedAt: new Date('2026-04-02T10:01:40.000Z'),
        },
        {
          userId: ownerUser.id,
          botId: bot.id,
          positionId: basicPosition.id,
          strategyId: basicStrategyId,
          symbol: 'BTCUSDT',
          side: 'BUY',
          lifecycleAction: 'DCA',
          price: 64000,
          quantity: 0.05,
          fee: 0,
          realizedPnl: 0,
          executedAt: new Date('2026-04-02T10:02:00.000Z'),
        },
        {
          userId: ownerUser.id,
          botId: bot.id,
          positionId: advancedPosition.id,
          strategyId: advancedStrategyId,
          symbol: 'ETHUSDT',
          side: 'SELL',
          lifecycleAction: 'OPEN',
          price: 2200,
          quantity: 2,
          fee: 0,
          realizedPnl: 0,
          executedAt: new Date('2026-04-02T10:02:10.000Z'),
        },
        {
          userId: ownerUser.id,
          botId: bot.id,
          positionId: advancedPosition.id,
          strategyId: advancedStrategyId,
          symbol: 'ETHUSDT',
          side: 'SELL',
          lifecycleAction: 'DCA',
          price: 2220,
          quantity: 1.5,
          fee: 0,
          realizedPnl: 0,
          executedAt: new Date('2026-04-02T10:02:40.000Z'),
        },
        {
          userId: ownerUser.id,
          botId: bot.id,
          positionId: advancedPosition.id,
          strategyId: advancedStrategyId,
          symbol: 'ETHUSDT',
          side: 'SELL',
          lifecycleAction: 'DCA',
          price: 2240,
          quantity: 1.5,
          fee: 0,
          realizedPnl: 0,
          executedAt: new Date('2026-04-02T10:03:00.000Z'),
        },
        {
          userId: ownerUser.id,
          botId: bot.id,
          positionId: legacyPosition.id,
          strategyId: legacyStrategyId,
          symbol: 'BNBUSDT',
          side: 'BUY',
          lifecycleAction: 'OPEN',
          price: 600,
          quantity: 10,
          fee: 0,
          realizedPnl: 0,
          executedAt: new Date('2026-04-02T10:03:10.000Z'),
        },
        {
          userId: ownerUser.id,
          botId: bot.id,
          positionId: legacyPosition.id,
          strategyId: legacyStrategyId,
          symbol: 'BNBUSDT',
          side: 'BUY',
          lifecycleAction: 'DCA',
          price: 595,
          quantity: 10,
          fee: 0,
          realizedPnl: 0,
          executedAt: new Date('2026-04-02T10:03:40.000Z'),
        },
      ],
    });

    const positionsRes = await owner.get(`/dashboard/bots/${bot.id}/runtime-sessions/${session.id}/positions`);
    expect(positionsRes.status).toBe(200);
    expect(positionsRes.body.openItems).toHaveLength(3);

    const bySymbol = new Map(
      positionsRes.body.openItems.map((item: { symbol: string }) => [item.symbol, item])
    );

    const basic = bySymbol.get('BTCUSDT') as {
      dcaCount: number;
      dcaPlannedLevels: number[];
      dcaExecutedLevels: number[];
    };
    const advanced = bySymbol.get('ETHUSDT') as {
      dcaCount: number;
      dcaPlannedLevels: number[];
      dcaExecutedLevels: number[];
    };
    const legacy = bySymbol.get('BNBUSDT') as {
      dcaCount: number;
      dcaPlannedLevels: number[];
      dcaExecutedLevels: number[];
    };

    expect(basic.dcaCount).toBe(2);
    expect(basic.dcaPlannedLevels).toEqual([-15, -15]);
    expect(basic.dcaExecutedLevels).toEqual([-15, -15]);

    expect(advanced.dcaCount).toBe(2);
    expect(advanced.dcaPlannedLevels).toEqual([-10, -20, -30]);
    expect(advanced.dcaExecutedLevels).toEqual([-10, -20]);

    expect(legacy.dcaCount).toBe(1);
    expect(legacy.dcaPlannedLevels).toEqual([]);
    expect(legacy.dcaExecutedLevels).toEqual([]);
  });

  it('maps dynamic TTP/TSL lifecycle in runtime positions payload (pre-arm, post-arm, fallback)', async () => {
    const ownerEmail = 'bot-runtime-dynamic-stop-owner@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });

    const strategyId = await createStrategy(owner, 'Runtime Dynamic Stop Strategy', {
      open: { indicatorsLong: [], indicatorsShort: [] },
      close: {
        mode: 'advanced',
        tp: 2,
        sl: 1,
        ttp: [{ percent: 4, arm: 1 }],
        tsl: [{ percent: -2, arm: 5 }],
      },
      additional: { dcaEnabled: false },
    });

    const marketGroupId = await createMarketGroup(ownerEmail, 'FUTURES');
    await prisma.symbolGroup.update({
      where: { id: marketGroupId },
      data: { symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'] },
    });
    const createRes = await owner
      .post('/dashboard/bots')
      .send(createPayload({ strategyId, marketGroupId }));
    expect(createRes.status).toBe(201);
    const botId = createRes.body.id as string;
    const nowTs = Date.now();
    const sessionStartedAt = new Date(nowTs - 15 * 60 * 1000);
    const lastHeartbeatAt = new Date(nowTs - 60 * 1000);
    const preArmOpenedAt = new Date(nowTs - 14 * 60 * 1000);
    const postArmOpenedAt = new Date(nowTs - 13 * 60 * 1000);
    const fallbackOpenedAt = new Date(nowTs - 12 * 60 * 1000);
    const snapshotAt = new Date(nowTs - 30 * 1000);

    const session = await prisma.botRuntimeSession.create({
      data: {
        userId: ownerUser.id,
        botId,
        mode: 'PAPER',
        status: 'RUNNING',
        startedAt: sessionStartedAt,
        lastHeartbeatAt,
      },
    });

    const preArm = await prisma.position.create({
      data: {
        userId: ownerUser.id,
        botId,
        strategyId,
        symbol: 'BTCUSDT',
        side: 'LONG',
        status: 'OPEN',
        managementMode: 'BOT_MANAGED',
        entryPrice: 100,
        quantity: 1,
        leverage: 2,
        openedAt: preArmOpenedAt,
      },
    });
    const postArm = await prisma.position.create({
      data: {
        userId: ownerUser.id,
        botId,
        strategyId,
        symbol: 'ETHUSDT',
        side: 'LONG',
        status: 'OPEN',
        managementMode: 'BOT_MANAGED',
        entryPrice: 100,
        quantity: 1,
        leverage: 2,
        openedAt: postArmOpenedAt,
      },
    });
    const fallback = await prisma.position.create({
      data: {
        userId: ownerUser.id,
        botId,
        strategyId,
        symbol: 'BNBUSDT',
        side: 'LONG',
        status: 'OPEN',
        managementMode: 'BOT_MANAGED',
        entryPrice: 100,
        quantity: 1,
        leverage: 2,
        openedAt: fallbackOpenedAt,
      },
    });

    await prisma.trade.createMany({
      data: [
        {
          userId: ownerUser.id,
          botId,
          positionId: preArm.id,
          strategyId,
          symbol: 'BTCUSDT',
          side: 'BUY',
          lifecycleAction: 'OPEN',
          price: 100,
          quantity: 1,
          fee: 0,
          realizedPnl: 0,
          executedAt: new Date(preArmOpenedAt.getTime() + 5_000),
        },
        {
          userId: ownerUser.id,
          botId,
          positionId: postArm.id,
          strategyId,
          symbol: 'ETHUSDT',
          side: 'BUY',
          lifecycleAction: 'OPEN',
          price: 100,
          quantity: 1,
          fee: 0,
          realizedPnl: 0,
          executedAt: new Date(postArmOpenedAt.getTime() + 5_000),
        },
        {
          userId: ownerUser.id,
          botId,
          positionId: fallback.id,
          strategyId,
          symbol: 'BNBUSDT',
          side: 'BUY',
          lifecycleAction: 'OPEN',
          price: 100,
          quantity: 1,
          fee: 0,
          realizedPnl: 0,
          executedAt: new Date(fallbackOpenedAt.getTime() + 5_000),
        },
      ],
    });

    await prisma.botRuntimeSymbolStat.createMany({
      data: [
        {
          userId: ownerUser.id,
          botId,
          sessionId: session.id,
          symbol: 'BTCUSDT',
          totalSignals: 0,
          longEntries: 0,
          shortEntries: 0,
          exits: 0,
          dcaCount: 0,
          closedTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          realizedPnl: 0,
          grossProfit: 0,
          grossLoss: 0,
          feesPaid: 0,
          openPositionCount: 1,
          openPositionQty: 1,
          lastPrice: 102,
          snapshotAt,
        },
        {
          userId: ownerUser.id,
          botId,
          sessionId: session.id,
          symbol: 'ETHUSDT',
          totalSignals: 0,
          longEntries: 0,
          shortEntries: 0,
          exits: 0,
          dcaCount: 0,
          closedTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          realizedPnl: 0,
          grossProfit: 0,
          grossLoss: 0,
          feesPaid: 0,
          openPositionCount: 1,
          openPositionQty: 1,
          lastPrice: 108,
          snapshotAt,
        },
        {
          userId: ownerUser.id,
          botId,
          sessionId: session.id,
          symbol: 'BNBUSDT',
          totalSignals: 0,
          longEntries: 0,
          shortEntries: 0,
          exits: 0,
          dcaCount: 0,
          closedTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          realizedPnl: 0,
          grossProfit: 0,
          grossLoss: 0,
          feesPaid: 0,
          openPositionCount: 1,
          openPositionQty: 1,
          lastPrice: 103,
          snapshotAt,
        },
      ],
    });

    const stateSpy = vi
      .spyOn(runtimePositionAutomationService, 'getPositionStateSnapshot')
      .mockImplementation((positionId: string) => {
        if (positionId === preArm.id) {
          return {
            averageEntryPrice: 100,
            quantity: 1,
            currentAdds: 0,
            trailingAnchorPrice: 101,
          };
        }
        if (positionId === postArm.id) {
          return {
            averageEntryPrice: 100,
            quantity: 1,
            currentAdds: 0,
            trailingAnchorPrice: 106,
            trailingTakeProfitHighPercent: 0.08,
            trailingTakeProfitStepPercent: 0.02,
          };
        }
        if (positionId === fallback.id) {
          return {
            averageEntryPrice: 100,
            quantity: 1,
            currentAdds: 0,
            trailingAnchorPrice: 100,
            trailingLossLimitPercent: 0.04,
          };
        }
        return null;
      });

    try {
      const positionsRes = await owner.get(`/dashboard/bots/${botId}/runtime-sessions/${session.id}/positions`);
      expect(positionsRes.status).toBe(200);
      expect(positionsRes.body.showDynamicStopColumns).toBe(true);

      const bySymbol = new Map(
        positionsRes.body.openItems.map((item: { symbol: string }) => [item.symbol, item])
      );
      expect([...bySymbol.keys()]).toEqual(expect.arrayContaining(['BTCUSDT', 'ETHUSDT', 'BNBUSDT']));
      const preArmItem = bySymbol.get('BTCUSDT') as {
        dynamicTtpStopLoss: number | null;
        dynamicTslStopLoss: number | null;
      };
      const postArmItem = bySymbol.get('ETHUSDT') as {
        dynamicTtpStopLoss: number | null;
        dynamicTslStopLoss: number | null;
      };
      const fallbackItem = bySymbol.get('BNBUSDT') as {
        dynamicTtpStopLoss: number | null;
        dynamicTslStopLoss: number | null;
      };
      expect(preArmItem).toBeDefined();
      expect(postArmItem).toBeDefined();
      expect(fallbackItem).toBeDefined();

      expect(preArmItem.dynamicTtpStopLoss).toBeNull();
      expect(preArmItem.dynamicTslStopLoss).toBeNull();

      expect(postArmItem.dynamicTtpStopLoss).toBeCloseTo(103, 6);
      expect(postArmItem.dynamicTslStopLoss).toBeCloseTo(104.94, 6);

      expect(fallbackItem.dynamicTtpStopLoss).toBeNull();
      expect(fallbackItem.dynamicTslStopLoss).toBeCloseTo(99, 6);
    } finally {
      stateSpy.mockRestore();
    }
  });

  it('computes live signal direction from latest candles when no signal event exists yet', async () => {
    const ownerEmail = 'bot-runtime-live-direction@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });

    const strategyRes = await owner.post('/dashboard/strategies').send({
      name: 'Runtime Live Direction Strategy',
      interval: '5m',
      leverage: 2,
      walletRisk: 1,
      config: {
        open: {
          direction: 'both',
          noMatchAction: 'HOLD',
          indicatorsLong: [{ name: 'RSI', condition: '>', value: 55, params: { period: 14 } }],
          indicatorsShort: [{ name: 'RSI', condition: '<', value: 45, params: { period: 14 } }],
        },
        close: { mode: 'basic', tp: 2, sl: 1 },
      },
    });
    expect(strategyRes.status).toBe(201);
    const strategyId = strategyRes.body.id as string;

    const marketGroupId = await createMarketGroup(ownerEmail, 'FUTURES');
    const botRes = await owner.post('/dashboard/bots').send(
      createPayload({
        strategyId,
        marketGroupId,
      })
    );
    expect(botRes.status).toBe(201);
    const botId = botRes.body.id as string;

    const session = await prisma.botRuntimeSession.create({
      data: {
        userId: ownerUser.id,
        botId,
        mode: 'PAPER',
        status: 'RUNNING',
        startedAt: new Date('2026-04-02T00:00:00.000Z'),
      },
    });

    const candles = Array.from({ length: 40 }).map((_, index) => {
      const openTime = BigInt(1712016000000 + index * 300_000);
      const close = 2000 - index * 12;
      return {
        marketType: 'FUTURES' as const,
        symbol: 'BTCUSDT',
        timeframe: '5m',
        openTime,
        closeTime: openTime + BigInt(299_999),
        open: close + 3,
        high: close + 6,
        low: close - 6,
        close,
        volume: 100 + index,
        source: 'BINANCE',
      };
    });
    await prisma.marketCandleCache.createMany({ data: candles });

    const symbolStatsRes = await owner.get(
      `/dashboard/bots/${botId}/runtime-sessions/${session.id}/symbol-stats`
    );
    expect(symbolStatsRes.status).toBe(200);
    const btc = symbolStatsRes.body.items.find((item: { symbol: string }) => item.symbol === 'BTCUSDT');
    expect(btc).toBeTruthy();
    expect(btc.lastSignalDirection).toBe('SHORT');
    expect(btc.totalSignals).toBe(0);
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
    const createBotStrategyId = await createStrategy(owner, 'Multi Flow Bot Create Strategy');
    const defaultMarketGroupId = await createMarketGroup(ownerEmail, 'FUTURES');

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

    const botOneRes = await owner.post('/dashboard/bots').send({
      ...createPayload({ strategyId: createBotStrategyId, marketGroupId: defaultMarketGroupId }),
      name: 'Bot One',
    });
    const botTwoRes = await owner.post('/dashboard/bots').send({
      ...createPayload({ strategyId: createBotStrategyId, marketGroupId: defaultMarketGroupId }),
      name: 'Bot Two',
    });
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

    expect(graphOneRes.body.marketGroups.length).toBeGreaterThanOrEqual(2);
    const graphOneGroupIds = graphOneRes.body.marketGroups.map((group: { id: string }) => group.id);
    expect(graphOneGroupIds).toContain(botOneGroupAId);
    expect(graphOneGroupIds).toContain(botOneGroupBId);

    const graphTwoGroupIds = graphTwoRes.body.marketGroups.map((group: { id: string }) => group.id);
    expect(graphTwoGroupIds).toContain(botTwoGroupAId);
  });

  it('supports assistant config CRUD with subagent slot hard limit', async () => {
    const ownerEmail = 'assistant-config-owner@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const other = await registerAndLogin('assistant-config-other@example.com');
    const strategyId = await createStrategy(owner, 'Assistant Config Create Strategy');
    const defaultMarketGroupId = await createMarketGroup(ownerEmail, 'FUTURES');

    const botRes = await owner.post('/dashboard/bots').send({
      ...createPayload({ strategyId, marketGroupId: defaultMarketGroupId }),
      name: 'Assistant Bot',
    });
    expect(botRes.status).toBe(201);
    const botId = botRes.body.id as string;

    const upsertMainRes = await owner.put(`/dashboard/bots/${botId}/assistant-config`).send({
      mainAgentEnabled: true,
      mandate: 'Trade only when risk-adjusted edge is present.',
      modelProfile: 'balanced',
      safetyMode: 'STRICT',
      maxDecisionLatencyMs: 2200,
    });
    expect(upsertMainRes.status).toBe(200);
    expect(upsertMainRes.body.mainAgentEnabled).toBe(true);

    const upsertSlot1Res = await owner
      .put(`/dashboard/bots/${botId}/assistant-config/subagents/1`)
      .send({
        role: 'TREND',
        enabled: true,
        modelProfile: 'balanced',
        timeoutMs: 1000,
        safetyMode: 'STRICT',
      });
    expect(upsertSlot1Res.status).toBe(200);
    expect(upsertSlot1Res.body.slotIndex).toBe(1);

    const upsertSlot4Res = await owner
      .put(`/dashboard/bots/${botId}/assistant-config/subagents/4`)
      .send({
        role: 'RISK',
        enabled: true,
        modelProfile: 'balanced',
        timeoutMs: 1200,
        safetyMode: 'BALANCED',
      });
    expect(upsertSlot4Res.status).toBe(200);
    expect(upsertSlot4Res.body.slotIndex).toBe(4);

    const invalidSlotRes = await owner
      .put(`/dashboard/bots/${botId}/assistant-config/subagents/5`)
      .send({
        role: 'GENERAL',
        enabled: true,
        modelProfile: 'balanced',
        timeoutMs: 1200,
        safetyMode: 'STRICT',
      });
    expect(invalidSlotRes.status).toBe(400);
    expect(invalidSlotRes.body.error.message).toBe('slotIndex must be between 1 and 4');

    const getConfigRes = await owner.get(`/dashboard/bots/${botId}/assistant-config`);
    expect(getConfigRes.status).toBe(200);
    expect(getConfigRes.body.assistant).toBeTruthy();
    expect(getConfigRes.body.subagents).toHaveLength(2);

    const otherReadRes = await other.get(`/dashboard/bots/${botId}/assistant-config`);
    expect(otherReadRes.status).toBe(404);

    const deleteSlot1Res = await owner.delete(`/dashboard/bots/${botId}/assistant-config/subagents/1`);
    expect(deleteSlot1Res.status).toBe(204);
  });

  it('returns explainable assistant dry-run trace including NO_TRADE output', async () => {
    const ownerEmail = 'assistant-dryrun-owner@example.com';
    const owner = await registerAndLogin(ownerEmail);
    const strategyId = await createStrategy(owner, 'Assistant Dry Run Create Strategy');
    const defaultMarketGroupId = await createMarketGroup(ownerEmail, 'FUTURES');

    const botRes = await owner.post('/dashboard/bots').send({
      ...createPayload({ strategyId, marketGroupId: defaultMarketGroupId }),
      name: 'Assistant Dry Run Bot',
    });
    expect(botRes.status).toBe(201);
    const botId = botRes.body.id as string;

    const upsertMainRes = await owner.put(`/dashboard/bots/${botId}/assistant-config`).send({
      mainAgentEnabled: true,
      mandate: 'Dry-run mandate',
      modelProfile: 'balanced',
      safetyMode: 'STRICT',
      maxDecisionLatencyMs: 2500,
    });
    expect(upsertMainRes.status).toBe(200);

    const upsertSlotRes = await owner.put(`/dashboard/bots/${botId}/assistant-config/subagents/1`).send({
      role: 'TREND',
      enabled: true,
      modelProfile: 'balanced',
      timeoutMs: 800,
      safetyMode: 'STRICT',
    });
    expect(upsertSlotRes.status).toBe(200);

    const dryRunRes = await owner.post(`/dashboard/bots/${botId}/assistant-config/dry-run`).send({
      symbol: 'BTCUSDT',
      intervalWindow: '5m',
      mode: 'PAPER',
    });
    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.requestId).toBeDefined();
    expect(dryRunRes.body.mode).toBeDefined();
    expect(Array.isArray(dryRunRes.body.statuses)).toBe(true);
    expect(Array.isArray(dryRunRes.body.outputs)).toBe(true);
    expect(dryRunRes.body.finalDecision).toBeDefined();
    expect(typeof dryRunRes.body.finalReason).toBe('string');
  });
});
