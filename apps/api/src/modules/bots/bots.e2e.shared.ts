import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';
import { setActiveSubscriptionForUser } from '../subscriptions/subscriptions.service';

export const PLACEHOLDER_EXCHANGES = ['BYBIT', 'OKX', 'KRAKEN', 'COINBASE'] as const;
export const walletIdByMarketGroupId = new Map<string, string>();

type WalletContext = {
  mode?: 'PAPER' | 'LIVE';
  exchange?: 'BINANCE' | 'BYBIT' | 'OKX' | 'KRAKEN' | 'COINBASE';
  marketType?: 'FUTURES' | 'SPOT';
  baseCurrency?: string;
  apiKeyId?: string | null;
};

export const createWalletForContext = async (
  email: string,
  context: WalletContext = {}
) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });
  const mode = context.mode ?? 'PAPER';
  const exchange = context.exchange ?? 'BINANCE';
  const marketType = context.marketType ?? 'FUTURES';
  const baseCurrency = (context.baseCurrency ?? 'USDT').toUpperCase();

  const created = await prisma.wallet.create({
    data: {
      userId: user.id,
      name: `Auto Wallet ${mode} ${exchange} ${marketType} ${Date.now()}`,
      mode,
      exchange,
      marketType,
      baseCurrency,
      paperInitialBalance: 10_000,
      liveAllocationMode: mode === 'LIVE' ? 'PERCENT' : null,
      liveAllocationValue: mode === 'LIVE' ? 100 : null,
      apiKeyId: mode === 'LIVE' ? (context.apiKeyId ?? null) : null,
    },
    select: { id: true },
  });

  return created.id;
};

export const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post('/auth/register').send({
    email,
    password: 'test1234',
  });
  if (res.status !== 201) {
    throw new Error(`Expected register status 201, got ${res.status}`);
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });
  await setActiveSubscriptionForUser(prisma, {
    userId: user.id,
    planCode: 'PROFESSIONAL',
    source: 'ADMIN_OVERRIDE',
    metadata: { reason: 'bots-e2e-plan-upgrade' },
  });
  return agent;
};

export const createStrategy = async (
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
  if (strategyRes.status !== 201) {
    throw new Error(`Expected strategy create status 201, got ${strategyRes.status}`);
  }
  return strategyRes.body.id as string;
};

export const createMarketGroup = async (
  email: string,
  marketType: 'FUTURES' | 'SPOT' = 'FUTURES',
  exchange: 'BINANCE' | 'BYBIT' | 'OKX' | 'KRAKEN' | 'COINBASE' = 'BINANCE',
  baseCurrency = 'USDT'
) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const marketUniverse = await prisma.marketUniverse.create({
    data: {
      userId: user.id,
      name: `Auto Universe ${marketType} ${Date.now()}`,
      exchange,
      marketType,
      baseCurrency,
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

  const paperWalletId = await createWalletForContext(email, {
    mode: 'PAPER',
    exchange,
    marketType,
    baseCurrency,
  });
  walletIdByMarketGroupId.set(symbolGroup.id, paperWalletId);
  walletIdByMarketGroupId.set(marketUniverse.id, paperWalletId);

  return symbolGroup.id;
};

export const createPayload = (refs: {
  strategyId: string;
  marketGroupId: string;
  walletId?: string;
}) => {
  const walletId = refs.walletId ?? walletIdByMarketGroupId.get(refs.marketGroupId);
  if (!walletId) {
    throw new Error(`Missing wallet mapping for marketGroupId=${refs.marketGroupId}`);
  }

  return {
    name: 'Momentum Runner',
    strategyId: refs.strategyId,
    marketGroupId: refs.marketGroupId,
    walletId,
    isActive: false,
    liveOptIn: false,
  };
};

export const resetBotsE2eState = async () => {
  walletIdByMarketGroupId.clear();
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
  await prisma.runtimeExecutionDedupe.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.user.deleteMany();
};
