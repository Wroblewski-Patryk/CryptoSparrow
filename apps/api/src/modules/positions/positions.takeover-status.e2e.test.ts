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

describe('Positions takeover status API', () => {
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
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/dashboard/positions/takeover-status');
    expect(res.status).toBe(401);
  });

  it('returns takeover classification summary for exchange-synced OPEN positions', async () => {
    const email = 'positions-takeover-owner@example.com';
    const agent = await registerAndLogin(email);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    const createApiKey = async (label: string) => {
      const res = await agent.post('/dashboard/profile/apiKeys').send({
        label,
        exchange: 'BINANCE',
        apiKey: `APIKEY_${label}_${Date.now()}`,
        apiSecret: `APISECRET_${label}_${Date.now()}`,
      });
      expect(res.status).toBe(201);
      return res.body.id as string;
    };

    const keyOwned = await createApiKey('owned');
    const keyUnowned = await createApiKey('unowned');
    const keyAmbiguous = await createApiKey('ambiguous');

    const ownedWallet = await prisma.wallet.create({
      data: {
        userId: owner.id,
        name: 'Owned LIVE wallet',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        paperInitialBalance: 10_000,
        liveAllocationMode: 'PERCENT',
        liveAllocationValue: 100,
        apiKeyId: keyOwned,
      },
      select: { id: true },
    });

    const ambiguousWalletA = await prisma.wallet.create({
      data: {
        userId: owner.id,
        name: 'Ambiguous LIVE wallet A',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        paperInitialBalance: 10_000,
        liveAllocationMode: 'PERCENT',
        liveAllocationValue: 100,
        apiKeyId: keyAmbiguous,
      },
      select: { id: true },
    });

    const ambiguousWalletB = await prisma.wallet.create({
      data: {
        userId: owner.id,
        name: 'Ambiguous LIVE wallet B',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        paperInitialBalance: 10_000,
        liveAllocationMode: 'PERCENT',
        liveAllocationValue: 100,
        apiKeyId: keyAmbiguous,
      },
      select: { id: true },
    });

    const ownedBot = await prisma.bot.create({
      data: {
        userId: owner.id,
        name: 'Owned live bot',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        positionMode: 'ONE_WAY',
        isActive: true,
        liveOptIn: true,
        apiKeyId: keyOwned,
        walletId: ownedWallet.id,
      },
      select: { id: true },
    });

    await prisma.bot.create({
      data: {
        userId: owner.id,
        name: 'Ambiguous live bot A',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        positionMode: 'ONE_WAY',
        isActive: true,
        liveOptIn: true,
        apiKeyId: keyAmbiguous,
        walletId: ambiguousWalletA.id,
      },
    });

    await prisma.bot.create({
      data: {
        userId: owner.id,
        name: 'Ambiguous live bot B',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        positionMode: 'ONE_WAY',
        isActive: true,
        liveOptIn: true,
        apiKeyId: keyAmbiguous,
        walletId: ambiguousWalletB.id,
      },
    });

    await prisma.position.createMany({
      data: [
        {
          userId: owner.id,
          botId: ownedBot.id,
          walletId: ownedWallet.id,
          externalId: `${keyOwned}:BTCUSDT:LONG`,
          origin: 'EXCHANGE_SYNC',
          managementMode: 'BOT_MANAGED',
          syncState: 'IN_SYNC',
          symbol: 'BTCUSDT',
          side: 'LONG',
          status: 'OPEN',
          entryPrice: 68000,
          quantity: 0.01,
          leverage: 3,
        },
        {
          userId: owner.id,
          externalId: `${keyUnowned}:ETHUSDT:LONG`,
          origin: 'EXCHANGE_SYNC',
          managementMode: 'BOT_MANAGED',
          syncState: 'DRIFT',
          symbol: 'ETHUSDT',
          side: 'LONG',
          status: 'OPEN',
          entryPrice: 3000,
          quantity: 0.2,
          leverage: 3,
        },
        {
          userId: owner.id,
          externalId: `${keyAmbiguous}:BNBUSDT:SHORT`,
          origin: 'EXCHANGE_SYNC',
          managementMode: 'BOT_MANAGED',
          syncState: 'DRIFT',
          symbol: 'BNBUSDT',
          side: 'SHORT',
          status: 'OPEN',
          entryPrice: 500,
          quantity: 1,
          leverage: 3,
        },
        {
          userId: owner.id,
          externalId: `${keyUnowned}:XRPUSDT:LONG`,
          origin: 'EXCHANGE_SYNC',
          managementMode: 'MANUAL_MANAGED',
          syncState: 'IN_SYNC',
          symbol: 'XRPUSDT',
          side: 'LONG',
          status: 'OPEN',
          entryPrice: 1,
          quantity: 100,
          leverage: 1,
        },
        {
          userId: owner.id,
          externalId: `${keyOwned}:ADAUSDT:LONG`,
          origin: 'EXCHANGE_SYNC',
          managementMode: 'BOT_MANAGED',
          syncState: 'IN_SYNC',
          symbol: 'ADAUSDT',
          side: 'LONG',
          status: 'CLOSED',
          entryPrice: 0.7,
          quantity: 100,
          leverage: 1,
          closedAt: new Date(),
        },
      ],
    });

    const res = await agent.get('/dashboard/positions/takeover-status');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.summary).toEqual({
      OWNED_AND_MANAGED: 1,
      UNOWNED: 1,
      AMBIGUOUS: 1,
      MANUAL_ONLY: 1,
    });

    const bySymbol = new Map(
      (res.body.items as Array<{ symbol: string; takeoverStatus: string }>).map((item) => [
        item.symbol,
        item.takeoverStatus,
      ])
    );
    expect(bySymbol.get('BTCUSDT')).toBe('OWNED_AND_MANAGED');
    expect(bySymbol.get('ETHUSDT')).toBe('UNOWNED');
    expect(bySymbol.get('BNBUSDT')).toBe('AMBIGUOUS');
    expect(bySymbol.get('XRPUSDT')).toBe('MANUAL_ONLY');
  });

  it('rebinds unowned BOT_MANAGED exchange-synced positions when exactly one LIVE owner exists', async () => {
    const email = 'positions-takeover-rebind@example.com';
    const agent = await registerAndLogin(email);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    const createApiKey = async (label: string) => {
      const res = await agent.post('/dashboard/profile/apiKeys').send({
        label,
        exchange: 'BINANCE',
        apiKey: `APIKEY_${label}_${Date.now()}`,
        apiSecret: `APISECRET_${label}_${Date.now()}`,
      });
      expect(res.status).toBe(201);
      return res.body.id as string;
    };

    const keyOwned = await createApiKey('owned-rebind');
    const keyAmbiguous = await createApiKey('ambiguous-rebind');
    const keyUnowned = await createApiKey('unowned-rebind');

    const ownedWallet = await prisma.wallet.create({
      data: {
        userId: owner.id,
        name: 'Owned rebind wallet',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        paperInitialBalance: 10_000,
        liveAllocationMode: 'PERCENT',
        liveAllocationValue: 100,
        apiKeyId: keyOwned,
      },
      select: { id: true },
    });

    await prisma.bot.create({
      data: {
        userId: owner.id,
        name: 'Owned rebind bot',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        positionMode: 'ONE_WAY',
        isActive: true,
        liveOptIn: true,
        apiKeyId: keyOwned,
        walletId: ownedWallet.id,
      },
    });

    const ambiguousWalletA = await prisma.wallet.create({
      data: {
        userId: owner.id,
        name: 'Ambiguous rebind wallet A',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        paperInitialBalance: 10_000,
        liveAllocationMode: 'PERCENT',
        liveAllocationValue: 100,
        apiKeyId: keyAmbiguous,
      },
      select: { id: true },
    });
    const ambiguousWalletB = await prisma.wallet.create({
      data: {
        userId: owner.id,
        name: 'Ambiguous rebind wallet B',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        paperInitialBalance: 10_000,
        liveAllocationMode: 'PERCENT',
        liveAllocationValue: 100,
        apiKeyId: keyAmbiguous,
      },
      select: { id: true },
    });

    await prisma.bot.createMany({
      data: [
        {
          userId: owner.id,
          name: 'Ambiguous rebind bot A',
          mode: 'LIVE',
          exchange: 'BINANCE',
          marketType: 'FUTURES',
          positionMode: 'ONE_WAY',
          isActive: true,
          liveOptIn: true,
          apiKeyId: keyAmbiguous,
          walletId: ambiguousWalletA.id,
        },
        {
          userId: owner.id,
          name: 'Ambiguous rebind bot B',
          mode: 'LIVE',
          exchange: 'BINANCE',
          marketType: 'FUTURES',
          positionMode: 'ONE_WAY',
          isActive: true,
          liveOptIn: true,
          apiKeyId: keyAmbiguous,
          walletId: ambiguousWalletB.id,
        },
      ],
    });

    await prisma.position.createMany({
      data: [
        {
          userId: owner.id,
          externalId: `${keyOwned}:SOLUSDT:LONG`,
          origin: 'EXCHANGE_SYNC',
          managementMode: 'BOT_MANAGED',
          syncState: 'DRIFT',
          symbol: 'SOLUSDT',
          side: 'LONG',
          status: 'OPEN',
          entryPrice: 100,
          quantity: 1,
          leverage: 2,
        },
        {
          userId: owner.id,
          externalId: `${keyAmbiguous}:BNBUSDT:SHORT`,
          origin: 'EXCHANGE_SYNC',
          managementMode: 'BOT_MANAGED',
          syncState: 'DRIFT',
          symbol: 'BNBUSDT',
          side: 'SHORT',
          status: 'OPEN',
          entryPrice: 600,
          quantity: 0.5,
          leverage: 2,
        },
        {
          userId: owner.id,
          externalId: `${keyUnowned}:ADAUSDT:LONG`,
          origin: 'EXCHANGE_SYNC',
          managementMode: 'BOT_MANAGED',
          syncState: 'DRIFT',
          symbol: 'ADAUSDT',
          side: 'LONG',
          status: 'OPEN',
          entryPrice: 1,
          quantity: 100,
          leverage: 1,
        },
      ],
    });

    const rebindRes = await agent.post('/dashboard/positions/takeover-rebind');
    expect(rebindRes.status).toBe(200);
    expect(rebindRes.body).toMatchObject({
      scanned: 3,
      rebound: 1,
      ambiguous: 1,
      unowned: 1,
      skippedOwned: 0,
    });

    const statusRes = await agent.get('/dashboard/positions/takeover-status');
    expect(statusRes.status).toBe(200);
    const bySymbol = new Map(
      (statusRes.body.items as Array<{ symbol: string; takeoverStatus: string; botId: string | null }>).map(
        (item) => [item.symbol, item]
      )
    );

    expect(bySymbol.get('SOLUSDT')?.takeoverStatus).toBe('OWNED_AND_MANAGED');
    expect(bySymbol.get('SOLUSDT')?.botId).toBeTruthy();
    expect(bySymbol.get('BNBUSDT')?.takeoverStatus).toBe('AMBIGUOUS');
    expect(bySymbol.get('ADAUSDT')?.takeoverStatus).toBe('UNOWNED');
  });

  it('rebinds BOT-origin open positions without owner when exactly one LIVE owner exists', async () => {
    const email = 'positions-bot-origin-rebind@example.com';
    const agent = await registerAndLogin(email);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    const createApiKeyRes = await agent.post('/dashboard/profile/apiKeys').send({
      label: 'bot-origin-rebind',
      exchange: 'BINANCE',
      apiKey: `APIKEY_BOT_ORIGIN_${Date.now()}`,
      apiSecret: `APISECRET_BOT_ORIGIN_${Date.now()}`,
    });
    expect(createApiKeyRes.status).toBe(201);
    const apiKeyId = createApiKeyRes.body.id as string;

    const wallet = await prisma.wallet.create({
      data: {
        userId: owner.id,
        name: 'bot-origin-live-wallet',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        paperInitialBalance: 10_000,
        liveAllocationMode: 'PERCENT',
        liveAllocationValue: 100,
        apiKeyId,
      },
      select: { id: true },
    });

    const bot = await prisma.bot.create({
      data: {
        userId: owner.id,
        name: 'bot-origin-live-bot',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        positionMode: 'ONE_WAY',
        isActive: true,
        liveOptIn: true,
        apiKeyId,
        walletId: wallet.id,
      },
      select: { id: true },
    });

    const position = await prisma.position.create({
      data: {
        userId: owner.id,
        origin: 'BOT',
        managementMode: 'BOT_MANAGED',
        syncState: 'IN_SYNC',
        symbol: 'DOGEUSDT',
        side: 'LONG',
        status: 'OPEN',
        entryPrice: 0.2,
        quantity: 100,
        leverage: 1,
      },
      select: { id: true },
    });

    const rebindRes = await agent.post('/dashboard/positions/takeover-rebind');
    expect(rebindRes.status).toBe(200);
    expect(rebindRes.body).toMatchObject({
      scanned: 1,
      rebound: 1,
      ambiguous: 0,
      unowned: 0,
      skippedOwned: 0,
      scannedByOrigin: {
        EXCHANGE_SYNC: 0,
        BOT: 1,
      },
      reboundByOrigin: {
        EXCHANGE_SYNC: 0,
        BOT: 1,
      },
    });

    const updatedPosition = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
      select: { botId: true, walletId: true },
    });
    expect(updatedPosition.botId).toBe(bot.id);
    expect(updatedPosition.walletId).toBe(wallet.id);
  });
});
