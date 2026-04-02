import { BotMode, PositionManagementMode, PositionStatus, TradeMarket } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { decrypt } from '../../utils/crypto';

const runtimeReferenceBalanceFallback = Number.parseFloat(
  process.env.RUNTIME_REFERENCE_BALANCE_USDT ?? '1000'
);
const liveBalanceCacheTtlMs = Number.parseInt(process.env.RUNTIME_LIVE_BALANCE_CACHE_TTL_MS ?? '30000', 10);
const liveBalanceCache = new Map<string, { value: number; fetchedAt: number }>();

type RuntimeCapitalContextDeps = {
  getBotPaperStartBalance: (input: { userId: string; botId?: string | null; fallback: number }) => Promise<number>;
  listOpenBotManagedPositions: (input: {
    userId: string;
    botId?: string | null;
  }) => Promise<Array<{ entryPrice: number; quantity: number; leverage: number }>>;
  sumClosedBotManagedRealizedPnl: (input: { userId: string; botId?: string | null }) => Promise<number>;
  getLiveApiKeyContext: (input: {
    userId: string;
    botId?: string | null;
    exchange: 'BINANCE';
  }) => Promise<{ apiKey: string; apiSecret: string } | null>;
  fetchLiveUsdtBalance: (input: {
    apiKey: string;
    apiSecret: string;
    marketType: TradeMarket;
  }) => Promise<number | null>;
};

const extractUsdtBalance = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return null;
  const withTotal = payload as { total?: Record<string, unknown>; free?: Record<string, unknown> };
  const totalUsdt = Number(withTotal.total?.USDT);
  if (Number.isFinite(totalUsdt) && totalUsdt > 0) return totalUsdt;
  const freeUsdt = Number(withTotal.free?.USDT);
  if (Number.isFinite(freeUsdt) && freeUsdt > 0) return freeUsdt;
  return null;
};

const defaultDeps: RuntimeCapitalContextDeps = {
  getBotPaperStartBalance: async ({ userId, botId, fallback }) => {
    if (!botId) return Math.max(0, fallback);
    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId },
      select: { paperStartBalance: true },
    });
    if (!bot || !Number.isFinite(bot.paperStartBalance)) return Math.max(0, fallback);
    return Math.max(0, bot.paperStartBalance);
  },
  listOpenBotManagedPositions: async ({ userId, botId }) =>
    prisma.position.findMany({
      where: {
        userId,
        status: PositionStatus.OPEN,
        managementMode: PositionManagementMode.BOT_MANAGED,
        ...(botId ? { botId } : { botId: null }),
      },
      select: {
        entryPrice: true,
        quantity: true,
        leverage: true,
      },
    }),
  sumClosedBotManagedRealizedPnl: async ({ userId, botId }) => {
    const aggregate = await prisma.position.aggregate({
      where: {
        userId,
        status: { not: PositionStatus.OPEN },
        managementMode: PositionManagementMode.BOT_MANAGED,
        realizedPnl: { not: null },
        ...(botId ? { botId } : { botId: null }),
      },
      _sum: {
        realizedPnl: true,
      },
    });
    return Number(aggregate._sum.realizedPnl ?? 0);
  },
  getLiveApiKeyContext: async ({ userId, botId, exchange }) => {
    if (botId) {
      const bot = await prisma.bot.findFirst({
        where: { id: botId, userId },
        select: {
          apiKey: {
            select: {
              apiKey: true,
              apiSecret: true,
              exchange: true,
            },
          },
        },
      });
      if (bot?.apiKey && bot.apiKey.exchange === exchange) {
        return {
          apiKey: decrypt(bot.apiKey.apiKey),
          apiSecret: decrypt(bot.apiKey.apiSecret),
        };
      }
    }

    const latestByExchange = await prisma.apiKey.findFirst({
      where: { userId, exchange },
      orderBy: { updatedAt: 'desc' },
      select: { apiKey: true, apiSecret: true },
    });
    if (!latestByExchange) return null;
    return {
      apiKey: decrypt(latestByExchange.apiKey),
      apiSecret: decrypt(latestByExchange.apiSecret),
    };
  },
  fetchLiveUsdtBalance: async ({ apiKey, apiSecret, marketType }) => {
    try {
      const ccxtModule = (await import('ccxt')) as unknown as {
        binance: new (config: Record<string, unknown>) => {
          fetchBalance: () => Promise<unknown>;
          close?: () => Promise<void>;
        };
      };
      const client = new ccxtModule.binance({
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        options: {
          defaultType: marketType === 'FUTURES' ? 'future' : 'spot',
        },
      });
      try {
        const balance = await client.fetchBalance();
        return extractUsdtBalance(balance);
      } finally {
        if (typeof client.close === 'function') {
          await client.close().catch(() => undefined);
        }
      }
    } catch {
      return null;
    }
  },
};

export const resolvePaperRuntimeCapitalSnapshot = async (
  input: { userId: string; botId?: string | null; paperStartBalance: number },
  deps: RuntimeCapitalContextDeps = defaultDeps
) => {
  const startBalance = await deps.getBotPaperStartBalance({
    userId: input.userId,
    botId: input.botId,
    fallback: input.paperStartBalance,
  });
  const [openPositions, realizedPnl] = await Promise.all([
    deps.listOpenBotManagedPositions({ userId: input.userId, botId: input.botId }),
    deps.sumClosedBotManagedRealizedPnl({ userId: input.userId, botId: input.botId }),
  ]);

  const reservedMargin = openPositions.reduce((sum, position) => {
    const leverage = Math.max(1, position.leverage || 1);
    return sum + (position.entryPrice * position.quantity) / leverage;
  }, 0);
  const referenceBalance = Math.max(0, startBalance + realizedPnl);
  const freeCash = Math.max(0, referenceBalance - reservedMargin);

  return {
    referenceBalance,
    freeCash,
    reservedMargin,
    realizedPnl,
  };
};

export const resolveRuntimeReferenceBalance = async (
  input: {
    userId: string;
    botId?: string | null;
    mode: BotMode | 'PAPER' | 'LIVE';
    exchange: 'BINANCE';
    marketType: TradeMarket;
    paperStartBalance: number;
    nowMs: number;
  },
  deps: RuntimeCapitalContextDeps = defaultDeps
) => {
  if (input.mode === 'PAPER') {
    const snapshot = await resolvePaperRuntimeCapitalSnapshot(
      {
        userId: input.userId,
        botId: input.botId,
        paperStartBalance: input.paperStartBalance,
      },
      deps
    );
    return snapshot.referenceBalance;
  }

  const cacheKey = `${input.userId}:${input.botId ?? 'none'}:${input.exchange}:${input.marketType}`;
  const cached = liveBalanceCache.get(cacheKey);
  if (cached && input.nowMs - cached.fetchedAt <= liveBalanceCacheTtlMs) {
    return cached.value;
  }

  const apiKey = await deps.getLiveApiKeyContext({
    userId: input.userId,
    botId: input.botId,
    exchange: input.exchange,
  });
  if (!apiKey) return runtimeReferenceBalanceFallback;

  const usdtBalance = await deps.fetchLiveUsdtBalance({
    apiKey: apiKey.apiKey,
    apiSecret: apiKey.apiSecret,
    marketType: input.marketType,
  });

  if (Number.isFinite(usdtBalance) && (usdtBalance as number) > 0) {
    const balance = usdtBalance as number;
    liveBalanceCache.set(cacheKey, { value: balance, fetchedAt: input.nowMs });
    return balance;
  }

  return runtimeReferenceBalanceFallback;
};

export const resolveRuntimeDcaFundsExhausted = async (
  input: {
    userId: string;
    botId?: string | null;
    mode: 'PAPER' | 'LIVE';
    exchange: 'BINANCE';
    marketType: TradeMarket;
    paperStartBalance: number;
    markPrice: number;
    addedQuantity: number;
    leverage: number;
    nowMs: number;
  },
  deps: RuntimeCapitalContextDeps = defaultDeps
) => {
  const requiredMargin = (input.markPrice * Math.max(0, input.addedQuantity)) / Math.max(1, input.leverage);
  if (!Number.isFinite(requiredMargin) || requiredMargin <= 0) return false;

  if (input.mode === 'PAPER') {
    const snapshot = await resolvePaperRuntimeCapitalSnapshot(
      {
        userId: input.userId,
        botId: input.botId,
        paperStartBalance: input.paperStartBalance,
      },
      deps
    );
    return requiredMargin > snapshot.freeCash;
  }

  const referenceBalance = await resolveRuntimeReferenceBalance(
    {
      userId: input.userId,
      botId: input.botId,
      mode: input.mode,
      exchange: input.exchange,
      marketType: input.marketType,
      paperStartBalance: input.paperStartBalance,
      nowMs: input.nowMs,
    },
    deps
  );
  if (!Number.isFinite(referenceBalance) || referenceBalance <= 0) return true;
  return requiredMargin > referenceBalance;
};
