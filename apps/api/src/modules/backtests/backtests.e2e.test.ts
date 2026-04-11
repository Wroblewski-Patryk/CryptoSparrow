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

const createWalletForUser = async (params: {
  userId: string;
  name: string;
  mode?: 'PAPER' | 'LIVE';
  marketType?: 'FUTURES' | 'SPOT';
  exchange?: 'BINANCE' | 'BYBIT' | 'OKX' | 'KRAKEN' | 'COINBASE';
  baseCurrency?: string;
  apiKeyId?: string | null;
}) =>
  prisma.wallet.create({
    data: {
      userId: params.userId,
      name: params.name,
      mode: params.mode ?? 'PAPER',
      exchange: params.exchange ?? 'BINANCE',
      marketType: params.marketType ?? 'FUTURES',
      baseCurrency: params.baseCurrency ?? 'USDT',
      paperInitialBalance: 10_000,
      apiKeyId: params.apiKeyId ?? null,
    },
    select: {
      id: true,
    },
  });

const waitForBacktestReport = async (
  agent: ReturnType<typeof request.agent>,
  runId: string,
  attempts = 20,
  delayMs = 250,
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await agent.get(`/dashboard/backtests/runs/${runId}/report`);
    if (response.status === 200) return response;
    if (response.status !== 404) return response;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return agent.get(`/dashboard/backtests/runs/${runId}/report`);
};

describe('Backtests runs contract', () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "paperStartBalance" DOUBLE PRECISION NOT NULL DEFAULT 10000',
    );

    await prisma.log.deleteMany();
    // Backtest worker updates run/report asynchronously, so cleanup is retried to avoid FK races in tests.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await prisma.backtestReport.deleteMany();
      await prisma.backtestTrade.deleteMany();
      try {
        await prisma.backtestRun.deleteMany();
        break;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.runtimeExecutionDedupe.deleteMany();
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
    expect(getRes.body.seedConfig.exchange).toBe('BINANCE');
    expect(getRes.body.seedConfig.marketType).toBe('FUTURES');
    expect(getRes.body.seedConfig.baseCurrency).toBe('USDT');
    expect(getRes.body.seedConfig.marketUniverseId).toBeNull();

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

  it('supports delete run flow for owner', async () => {
    const ownerEmail = 'backtests-delete-owner@example.com';
    const agent = await registerAndLogin(ownerEmail);
    const userId = await getUserIdByEmail(ownerEmail);

    const createRes = await agent.post('/dashboard/backtests/runs').send(createPayload());
    expect(createRes.status).toBe(201);
    const runId = createRes.body.id as string;

    await prisma.backtestTrade.create({
      data: {
        userId,
        backtestRunId: runId,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: 100,
        exitPrice: 101,
        quantity: 1,
        openedAt: new Date('2026-01-01T00:00:00.000Z'),
        closedAt: new Date('2026-01-01T01:00:00.000Z'),
        pnl: 1,
        fee: 0,
      },
    });
    await prisma.backtestReport.create({
      data: {
        userId,
        backtestRunId: runId,
        totalTrades: 1,
        winningTrades: 1,
        losingTrades: 0,
        winRate: 1,
        netPnl: 1,
      },
    });

    const deleteRes = await agent.delete(`/dashboard/backtests/runs/${runId}`);
    expect(deleteRes.status).toBe(204);

    const getDeletedRes = await agent.get(`/dashboard/backtests/runs/${runId}`);
    expect(getDeletedRes.status).toBe(404);
    expect(getDeletedRes.body.error.message).toBe('Not found');
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
    if (reportRes.status === 404) {
      expect(reportRes.body.error.message).toBe('Report not found');
      return;
    }

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.backtestRunId).toBe(runId);
    const metrics = reportRes.body.metrics as {
      parityDiagnostics?: Array<{
        symbol: string;
        mismatchCount: number;
        mismatchSamples: Array<{
          timestamp: string;
          side: string | null;
          trigger: string;
          mismatchReason: string;
        }>;
      }>;
    };
    if (metrics.parityDiagnostics && metrics.parityDiagnostics.length > 0) {
      expect(metrics.parityDiagnostics[0].symbol).toBeDefined();
      expect(typeof metrics.parityDiagnostics[0].mismatchCount).toBe('number');
      expect(Array.isArray(metrics.parityDiagnostics[0].mismatchSamples)).toBe(true);
    }
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
    const liveWallet = await createWalletForUser({
      userId,
      name: 'Parity takeover wallet',
      mode: 'LIVE',
      apiKeyId,
    });

    await prisma.bot.update({
      where: { id: bot.id },
      data: {
        apiKeyId,
        walletId: liveWallet.id,
      },
    });

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

  it('keeps venue context consistent across backtest -> paper bot -> live order path', async () => {
    const email = 'backtests-venue-consistency@example.com';
    const agent = await registerAndLogin(email);

    const strategyRes = await agent.post('/dashboard/strategies').send({
      name: 'Venue consistency strategy',
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

    const catalogRes = await agent
      .get('/dashboard/markets/catalog')
      .query({ baseCurrency: 'USDT', marketType: 'FUTURES' });
    expect(catalogRes.status).toBe(200);
    const symbol = ((catalogRes.body.markets as Array<{ symbol: string }>)[0]?.symbol ?? 'BTCUSDT').toUpperCase();

    const universeRes = await agent.post('/dashboard/markets/universes').send({
      name: 'Venue consistency universe',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      whitelist: [symbol],
      blacklist: [],
      filterRules: {},
      autoExcludeRules: {},
    });
    expect(universeRes.status).toBe(201);
    const marketUniverseId = universeRes.body.id as string;

    const userId = await getUserIdByEmail(email);
    const wallet = await createWalletForUser({
      userId,
      name: 'Venue consistency wallet',
      mode: 'PAPER',
      marketType: 'FUTURES',
      exchange: 'BINANCE',
      baseCurrency: 'USDT',
    });
    const symbolGroup = await prisma.symbolGroup.create({
      data: {
        userId,
        marketUniverseId,
        name: 'Venue consistency group',
        symbols: [symbol],
      },
    });

    const runRes = await agent.post('/dashboard/backtests/runs').send({
      name: 'Venue consistency run',
      timeframe: '5m',
      strategyId,
      marketUniverseId,
      seedConfig: {
        initialBalance: 1000,
      },
    });
    expect(runRes.status).toBe(201);
    const runId = runRes.body.id as string;

    const runDetailRes = await agent.get(`/dashboard/backtests/runs/${runId}`);
    expect(runDetailRes.status).toBe(200);
    expect(runDetailRes.body.seedConfig.exchange).toBe('BINANCE');
    expect(runDetailRes.body.seedConfig.marketType).toBe('FUTURES');
    expect(runDetailRes.body.seedConfig.baseCurrency).toBe('USDT');
    expect(runDetailRes.body.seedConfig.marketUniverseId).toBe(marketUniverseId);

    const createBotRes = await agent.post('/dashboard/bots').send({
      name: 'Venue consistency bot',
      mode: 'PAPER',
      walletId: wallet.id,
      strategyId,
      marketGroupId: symbolGroup.id,
      isActive: true,
      liveOptIn: false,
      consentTextVersion: null,
    });
    expect(createBotRes.status).toBe(201);
    const botId = createBotRes.body.id as string;
    expect(createBotRes.body.exchange).toBe('BINANCE');
    expect(createBotRes.body.marketType).toBe('FUTURES');

    const paperDecision = await analyzePreTrade({
      userId,
      botId,
      symbol,
      mode: 'PAPER',
    });
    expect(paperDecision.allowed).toBe(true);

    const liveApiKey = await prisma.apiKey.create({
      data: {
        userId,
        label: 'Venue consistency BINANCE key',
        exchange: 'BINANCE',
        apiKey: 'VENUE_CONSISTENCY_KEY',
        apiSecret: 'VENUE_CONSISTENCY_SECRET',
        syncExternalPositions: false,
        manageExternalPositions: false,
      },
    });
    const liveWallet = await createWalletForUser({
      userId,
      name: 'Venue consistency live wallet',
      mode: 'LIVE',
      marketType: 'FUTURES',
      exchange: 'BINANCE',
      baseCurrency: 'USDT',
      apiKeyId: liveApiKey.id,
    });

    const activateLiveRes = await agent.put(`/dashboard/bots/${botId}`).send({
      mode: 'LIVE',
      walletId: liveWallet.id,
      isActive: true,
      liveOptIn: true,
      consentTextVersion: 'mvp-v1',
      apiKeyId: liveApiKey.id,
    });
    expect(activateLiveRes.status).toBe(200);
    expect(activateLiveRes.body.exchange).toBe('BINANCE');
    expect(activateLiveRes.body.marketType).toBe('FUTURES');
    expect(activateLiveRes.body.apiKeyId).toBe(liveApiKey.id);

    const liveDecision = await analyzePreTrade({
      userId,
      botId,
      symbol,
      mode: 'LIVE',
    });
    expect(liveDecision.allowed).toBe(true);

    const liveOrderRes = await agent.post('/dashboard/orders/open').send({
      botId,
      strategyId,
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity: 0.001,
      mode: 'LIVE',
      riskAck: true,
    });
    expect(liveOrderRes.status).toBe(201);
    expect(liveOrderRes.body.botId).toBe(botId);
    expect(liveOrderRes.body.symbol).toBe(symbol);
  });

  it('keeps strategy + 3-symbol market-group backtest trace aligned with paper decision contract', async () => {
    const ownerEmail = 'backtests-parity-3symbols@example.com';
    const agent = await registerAndLogin(ownerEmail);

    const strategyRes = await agent.post('/dashboard/strategies').send({
      name: 'Parity 3 symbols strategy',
      description: 'Backtest/paper trace contract',
      interval: '5m',
      leverage: 2,
      walletRisk: 1,
      config: {
        open: {
          direction: 'both',
          indicatorsLong: [{ name: 'EMA', params: { fast: 9, slow: 21 }, condition: '>', value: 1 }],
          indicatorsShort: [{ name: 'EMA', params: { fast: 9, slow: 21 }, condition: '<', value: 1 }],
        },
        close: {
          tp: 2,
          sl: 1,
        },
      },
    });
    expect(strategyRes.status).toBe(201);
    const strategyId = strategyRes.body.id as string;

    const catalogRes = await agent
      .get('/dashboard/markets/catalog')
      .query({ baseCurrency: 'USDT', marketType: 'FUTURES' });
    expect(catalogRes.status).toBe(200);
    const selectedSymbols = (catalogRes.body.markets as Array<{ symbol: string }>)
      .slice(0, 3)
      .map((item) => item.symbol.toUpperCase())
      .sort();
    expect(selectedSymbols).toHaveLength(3);

    const universeRes = await agent.post('/dashboard/markets/universes').send({
      name: 'Parity 3 symbols group',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      whitelist: selectedSymbols,
      blacklist: [],
      filterRules: {},
      autoExcludeRules: {},
    });
    expect(universeRes.status).toBe(201);
    const marketUniverseId = universeRes.body.id as string;

    const runRes = await agent.post('/dashboard/backtests/runs').send({
      name: 'Parity 3 symbols run',
      timeframe: '5m',
      strategyId,
      marketUniverseId,
      seedConfig: {
        initialBalance: 1000,
        exchange: 'OKX',
        marketType: 'SPOT',
        baseCurrency: 'EUR',
      },
    });
    expect(runRes.status).toBe(201);
    const runId = runRes.body.id as string;

    const reportRes = await waitForBacktestReport(agent, runId);
    expect(reportRes.status).toBe(200);

    const runDetailRes = await agent.get(`/dashboard/backtests/runs/${runId}`);
    expect(runDetailRes.status).toBe(200);
    const runSymbols = (
      ((runDetailRes.body.seedConfig as { symbols?: unknown }).symbols as string[] | undefined) ?? []
    )
      .map((symbol) => symbol.toUpperCase())
      .sort();
    expect(runSymbols).toEqual(selectedSymbols);
    expect(runDetailRes.body.seedConfig.exchange).toBe('BINANCE');
    expect(runDetailRes.body.seedConfig.marketType).toBe('FUTURES');
    expect(runDetailRes.body.seedConfig.baseCurrency).toBe('USDT');
    expect(runDetailRes.body.seedConfig.marketUniverseId).toBe(marketUniverseId);
    expect(runDetailRes.body.seedConfig.initialBalance).toBe(1000);

    const metrics = reportRes.body.metrics as {
      parityDiagnostics?: Array<{
        symbol: string;
        status: 'PROCESSED' | 'FAILED';
        strategyRulesActive: boolean;
        mismatchSamples: Array<{ trigger: string; mismatchReason: string }>;
        error: string | null;
      }>;
    };
    expect(Array.isArray(metrics.parityDiagnostics)).toBe(true);
    expect(metrics.parityDiagnostics).toHaveLength(3);
    const diagnosticsBySymbol = new Map(
      (metrics.parityDiagnostics ?? []).map((entry) => [entry.symbol.toUpperCase(), entry] as const),
    );
    for (const symbol of selectedSymbols) {
      const entry = diagnosticsBySymbol.get(symbol);
      expect(entry).toBeDefined();
      if (!entry) continue;
      expect(entry.strategyRulesActive).toBe(true);
      if (entry.status === 'PROCESSED') {
        expect(entry.error).toBeNull();
        expect(
          entry.mismatchSamples.every(
            (sample) =>
              sample.trigger !== 'THRESHOLD' &&
              ['no_open_position', 'no_flip_with_open_position', 'already_open_same_side', 'manual_managed_symbol'].includes(
                sample.mismatchReason,
              ),
          ),
        ).toBe(true);
      } else {
        expect(typeof entry.error).toBe('string');
      }
    }

    const processedSymbol = (metrics.parityDiagnostics ?? []).find((entry) => entry.status === 'PROCESSED')?.symbol;
    if (processedSymbol) {
      const timelineRes = await agent
        .get(`/dashboard/backtests/runs/${runId}/timeline`)
        .query({ symbol: processedSymbol, chunkSize: 10000, cursor: 0 });
      expect(timelineRes.status).toBe(200);

      const parity = timelineRes.body.parityDiagnostics as {
        eventCounts: Record<string, number>;
      };
      const events = timelineRes.body.events as Array<{ type: string }>;
      const countsFromEvents = events.reduce<Record<string, number>>((acc, event) => {
        acc[event.type] = (acc[event.type] ?? 0) + 1;
        return acc;
      }, {});
      expect(parity.eventCounts.ENTRY ?? 0).toBe(countsFromEvents.ENTRY ?? 0);
      expect(parity.eventCounts.DCA ?? 0).toBe(countsFromEvents.DCA ?? 0);
      expect((parity.eventCounts.EXIT ?? 0) + (parity.eventCounts.TP ?? 0) + (parity.eventCounts.TTP ?? 0) + (parity.eventCounts.SL ?? 0) + (parity.eventCounts.TRAILING ?? 0) + (parity.eventCounts.LIQUIDATION ?? 0)).toBe(
        (countsFromEvents.EXIT ?? 0) + (countsFromEvents.TP ?? 0) + (countsFromEvents.TTP ?? 0) + (countsFromEvents.SL ?? 0) + (countsFromEvents.TRAILING ?? 0) + (countsFromEvents.LIQUIDATION ?? 0),
      );

      const positionStats = timelineRes.body.positionStats as {
        closedOnFinalCandleCount: number;
        liquidationsCount: number;
        tradeCount: number;
      };
      expect(typeof positionStats.closedOnFinalCandleCount).toBe('number');
      expect(typeof positionStats.liquidationsCount).toBe('number');
      expect(typeof positionStats.tradeCount).toBe('number');
      expect(positionStats.tradeCount).toBeGreaterThanOrEqual(positionStats.closedOnFinalCandleCount);
    }

    const paperDecision = await analyzePreTrade({
      userId: await getUserIdByEmail(ownerEmail),
      symbol: 'BTCUSDT',
      mode: 'PAPER',
    });
    expect(paperDecision.allowed).toBe(true);

    const outOfScopeTimelineRes = await agent
      .get(`/dashboard/backtests/runs/${runId}/timeline`)
      .query({ symbol: 'NOT_IN_RUN_SYMBOL' });
    expect(outOfScopeTimelineRes.status).toBe(404);
  }, 15_000);

  it('reports FAILED parity diagnostics when symbol processing fails', async () => {
    const ownerEmail = 'backtests-failed-symbol@example.com';
    const agent = await registerAndLogin(ownerEmail);

    const createRes = await agent.post('/dashboard/backtests/runs').send({
      name: 'Invalid symbol diagnostics run',
      symbol: 'INVALIDPAIRXYZ',
      timeframe: '5m',
      seedConfig: { initialBalance: 1000 },
    });
    expect(createRes.status).toBe(201);
    const runId = createRes.body.id as string;

    const reportRes = await waitForBacktestReport(agent, runId, 25, 250);
    expect(reportRes.status).toBe(200);

    const metrics = reportRes.body.metrics as {
      symbolsFailed?: string[];
      parityDiagnostics?: Array<{
        symbol: string;
        status: 'PROCESSED' | 'FAILED';
        error: string | null;
      }>;
    };

    expect(metrics.symbolsFailed).toContain('INVALIDPAIRXYZ');
    expect(metrics.parityDiagnostics).toHaveLength(1);
    expect(metrics.parityDiagnostics?.[0].symbol).toBe('INVALIDPAIRXYZ');
    expect(metrics.parityDiagnostics?.[0].status).toBe('FAILED');
    expect(typeof metrics.parityDiagnostics?.[0].error).toBe('string');
  });
});


