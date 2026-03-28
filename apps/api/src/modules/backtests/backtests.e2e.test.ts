import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../index';
import { analyzePreTrade } from '../engine/preTrade.service';
import { prisma } from '../../prisma/client';
import { reconcileExternalPositionsFromExchange } from '../positions/livePositionReconciliation.service';

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
  name: 'BTC trend run',
  symbol: 'BTCUSDT',
  timeframe: '1h',
  seedConfig: { initialBalance: 1000 },
  notes: 'quick smoke',
});

const getUserIdByEmail = async (email: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return user.id;
};

describe('Backtests runs contract', () => {
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
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/dashboard/backtests/runs');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing token');
  });

  it('supports create/list/get for owner', async () => {
    const ownerEmail = 'backtests-owner@example.com';
    const agent = await registerAndLogin(ownerEmail);

    const createRes = await agent.post('/dashboard/backtests/runs').send(createPayload());
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.status).toBe('PENDING');
    const runId = createRes.body.id as string;
    const userId = await getUserIdByEmail(ownerEmail);

    const listRes = await agent.get('/dashboard/backtests/runs');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(runId);

    const getRes = await agent.get(`/dashboard/backtests/runs/${runId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(runId);

    await prisma.backtestTrade.createMany({
      data: [
        {
          userId,
          backtestRunId: runId,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: 100,
          exitPrice: 110,
          quantity: 1,
          openedAt: new Date('2026-01-01T00:00:00.000Z'),
          closedAt: new Date('2026-01-01T01:00:00.000Z'),
          pnl: 10,
          fee: 1,
        },
        {
          userId,
          backtestRunId: runId,
          symbol: 'BTCUSDT',
          side: 'SHORT',
          entryPrice: 120,
          exitPrice: 110,
          quantity: 1,
          openedAt: new Date('2026-01-01T02:00:00.000Z'),
          closedAt: new Date('2026-01-01T03:00:00.000Z'),
          pnl: 10,
          fee: 1,
        },
      ],
    });
    await prisma.backtestReport.upsert({
      where: { backtestRunId: runId },
      create: {
        userId,
        backtestRunId: runId,
        totalTrades: 2,
        winningTrades: 2,
        losingTrades: 0,
        winRate: 1,
        netPnl: 20,
        grossProfit: 20,
        grossLoss: 0,
        maxDrawdown: 0.05,
        sharpe: 1.2,
        metrics: { expectancy: 10 },
      },
      update: {
        totalTrades: 2,
        winningTrades: 2,
        losingTrades: 0,
        winRate: 1,
        netPnl: 20,
        grossProfit: 20,
        grossLoss: 0,
        maxDrawdown: 0.05,
        sharpe: 1.2,
        metrics: { expectancy: 10 },
      },
    });

    const tradesRes = await agent.get(`/dashboard/backtests/runs/${runId}/trades?limit=1`);
    expect(tradesRes.status).toBe(200);
    expect(tradesRes.body).toHaveLength(1);
    expect(tradesRes.body[0].side).toBe('SHORT');

    const reportRes = await agent.get(`/dashboard/backtests/runs/${runId}/report`);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.backtestRunId).toBe(runId);
    expect(reportRes.body.totalTrades).toBeGreaterThanOrEqual(2);
  });

  it('enforces ownership isolation and strategy ownership at create time', async () => {
    const ownerEmail = 'backtests-owner-2@example.com';
    const ownerAgent = await registerAndLogin(ownerEmail);
    const otherAgent = await registerAndLogin('backtests-other@example.com');

    const ownerUser = await prisma.user.findUniqueOrThrow({
      where: { email: ownerEmail },
    });
    const ownerStrategy = await prisma.strategy.create({
      data: {
        userId: ownerUser.id,
        name: 'Owner strategy',
        interval: '1h',
        leverage: 2,
        walletRisk: 1,
        config: { version: '1.0', entry: {}, exit: {} },
      },
    });

    const createOwnerRun = await ownerAgent.post('/dashboard/backtests/runs').send({
      ...createPayload(),
      strategyId: ownerStrategy.id,
    });
    expect(createOwnerRun.status).toBe(201);
    const runId = createOwnerRun.body.id as string;

    const otherGet = await otherAgent.get(`/dashboard/backtests/runs/${runId}`);
    expect(otherGet.status).toBe(404);

    const otherTradesGet = await otherAgent.get(`/dashboard/backtests/runs/${runId}/trades`);
    expect(otherTradesGet.status).toBe(404);

    const otherReportGet = await otherAgent.get(`/dashboard/backtests/runs/${runId}/report`);
    expect(otherReportGet.status).toBe(404);

    const otherCreateWithForeignStrategy = await otherAgent.post('/dashboard/backtests/runs').send({
      ...createPayload(),
      strategyId: ownerStrategy.id,
    });
    expect(otherCreateWithForeignStrategy.status).toBe(404);
    expect(otherCreateWithForeignStrategy.body.error.message).toBe('Strategy or market universe not found');
  });

  it('returns 404 when report does not exist for owned run', async () => {
    const ownerEmail = 'backtests-owner-3@example.com';
    const agent = await registerAndLogin(ownerEmail);

    const createRes = await agent.post('/dashboard/backtests/runs').send(createPayload());
    expect(createRes.status).toBe(201);
    const runId = createRes.body.id as string;

    const reportRes = await agent.get(`/dashboard/backtests/runs/${runId}/report`);
    expect(reportRes.status).toBe(404);
    expect(reportRes.body.error.message).toBe('Report not found');
  });

  it('covers strategy -> backtest -> paper -> live opt-in critical flow', async () => {
    const ownerEmail = 'backtests-owner-flow@example.com';
    const agent = await registerAndLogin(ownerEmail);

    const strategyRes = await agent.post('/dashboard/strategies').send({
      name: 'Flow strategy',
      description: 'MVP critical path strategy',
      interval: '1h',
      leverage: 2,
      walletRisk: 1,
      config: {
        open: { logic: 'AND', rules: [] },
        close: { logic: 'OR', rules: [] },
      },
    });
    expect(strategyRes.status).toBe(201);
    const strategyId = strategyRes.body.id as string;

    const runRes = await agent.post('/dashboard/backtests/runs').send({
      ...createPayload(),
      strategyId,
    });
    expect(runRes.status).toBe(201);
    expect(runRes.body.strategyId).toBe(strategyId);

    const userId = await getUserIdByEmail(ownerEmail);
    const bot = await prisma.bot.create({
      data: {
        userId,
        name: 'Flow live bot',
        mode: 'LIVE',
        liveOptIn: false,
        consentTextVersion: null,
        isActive: true,
      },
    });

    const paperDecision = await analyzePreTrade({
      userId,
      symbol: 'BTCUSDT',
      mode: 'PAPER',
    });
    expect(paperDecision.allowed).toBe(true);

    const liveBlockedDecision = await analyzePreTrade({
      userId,
      botId: bot.id,
      symbol: 'BTCUSDT',
      mode: 'LIVE',
    });
    expect(liveBlockedDecision.allowed).toBe(false);
    expect(liveBlockedDecision.reasons).toContain('live_opt_in_required');
    expect(liveBlockedDecision.reasons).toContain('live_consent_version_required');

    await prisma.bot.update({
      where: { id: bot.id },
      data: {
        liveOptIn: true,
        consentTextVersion: 'mvp-v1',
      },
    });

    const liveAllowedDecision = await analyzePreTrade({
      userId,
      botId: bot.id,
      symbol: 'BTCUSDT',
      mode: 'LIVE',
    });
    expect(liveAllowedDecision.allowed).toBe(true);
  });

  it('covers strategy -> backtest -> paper/live parity with reconciliation checks', async () => {
    const ownerEmail = 'backtests-parity-reconcile@example.com';
    const agent = await registerAndLogin(ownerEmail);

    const strategyRes = await agent.post('/dashboard/strategies').send({
      name: 'Parity strategy',
      description: 'Parity and reconciliation flow',
      interval: '1h',
      leverage: 3,
      walletRisk: 1,
      config: {
        open: { logic: 'AND', rules: [] },
        close: { logic: 'OR', rules: [] },
      },
    });
    expect(strategyRes.status).toBe(201);
    const strategyId = strategyRes.body.id as string;

    const runRes = await agent.post('/dashboard/backtests/runs').send({
      ...createPayload(),
      strategyId,
      symbol: 'ETHUSDT',
    });
    expect(runRes.status).toBe(201);
    expect(runRes.body.strategyId).toBe(strategyId);

    const userId = await getUserIdByEmail(ownerEmail);
    const bot = await prisma.bot.create({
      data: {
        userId,
        name: 'Parity live bot',
        mode: 'LIVE',
        liveOptIn: true,
        consentTextVersion: 'mvp-v1',
        isActive: true,
      },
    });

    const createKeyRes = await agent.post('/dashboard/profile/apiKeys').send({
      label: 'parity-main',
      exchange: 'BINANCE',
      apiKey: 'EXCHANGEKEY12345',
      apiSecret: 'EXCHANGESECRET12345',
      syncExternalPositions: true,
      manageExternalPositions: false,
    });
    expect(createKeyRes.status).toBe(201);
    const apiKeyId = createKeyRes.body.id as string;

    const firstReconcile = await reconcileExternalPositionsFromExchange();
    expect(firstReconcile.openPositionsSeen).toBeGreaterThan(0);

    const syncedManual = await prisma.position.findFirstOrThrow({
      where: {
        userId,
        symbol: 'BTCUSDT',
        status: 'OPEN',
        origin: 'EXCHANGE_SYNC',
      },
      orderBy: { openedAt: 'desc' },
    });
    expect(syncedManual.managementMode).toBe('MANUAL_MANAGED');
    expect(syncedManual.syncState).toBe('IN_SYNC');

    const listRes = await agent.get('/dashboard/positions?symbol=BTCUSDT&status=OPEN&limit=20');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].origin).toBe('EXCHANGE_SYNC');
    expect(listRes.body[0].managementMode).toBe('MANUAL_MANAGED');

    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { manageExternalPositions: true },
    });

    const secondReconcile = await reconcileExternalPositionsFromExchange();
    expect(secondReconcile.openPositionsSeen).toBeGreaterThan(0);

    const syncedBotManaged = await prisma.position.findUniqueOrThrow({
      where: { id: syncedManual.id },
    });
    expect(syncedBotManaged.managementMode).toBe('BOT_MANAGED');

    const paperBlockedOnSyncedSymbol = await analyzePreTrade({
      userId,
      botId: bot.id,
      symbol: 'BTCUSDT',
      mode: 'PAPER',
    });
    expect(paperBlockedOnSyncedSymbol.allowed).toBe(false);
    expect(paperBlockedOnSyncedSymbol.reasons).toContain('open_position_on_symbol_exists');

    const liveBlockedOnSyncedSymbol = await analyzePreTrade({
      userId,
      botId: bot.id,
      symbol: 'BTCUSDT',
      mode: 'LIVE',
    });
    expect(liveBlockedOnSyncedSymbol.allowed).toBe(false);
    expect(liveBlockedOnSyncedSymbol.reasons).toContain('open_position_on_symbol_exists');
    expect(liveBlockedOnSyncedSymbol.reasons).not.toContain('live_opt_in_required');
    expect(liveBlockedOnSyncedSymbol.reasons).not.toContain('live_consent_version_required');

    const paperAllowedOnFreeSymbol = await analyzePreTrade({
      userId,
      botId: bot.id,
      symbol: 'ETHUSDT',
      mode: 'PAPER',
    });
    const liveAllowedOnFreeSymbol = await analyzePreTrade({
      userId,
      botId: bot.id,
      symbol: 'ETHUSDT',
      mode: 'LIVE',
    });
    expect(paperAllowedOnFreeSymbol.allowed).toBe(true);
    expect(liveAllowedOnFreeSymbol.allowed).toBe(true);
  });
});


