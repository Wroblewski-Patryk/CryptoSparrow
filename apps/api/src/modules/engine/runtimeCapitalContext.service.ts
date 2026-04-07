import { BotMode, Exchange, PositionManagementMode, PositionStatus, TradeMarket, WalletAllocationMode } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { decrypt } from '../../utils/crypto';

const runtimeReferenceBalanceFallback = Number.parseFloat(
  process.env.RUNTIME_REFERENCE_BALANCE_USDT ?? '1000'
);
const liveBalanceCacheTtlMs = Number.parseInt(process.env.RUNTIME_LIVE_BALANCE_CACHE_TTL_MS ?? '30000', 10);
const liveBalanceCache = new Map<string, { value: number; fetchedAt: number }>();

type RuntimeCapitalContextDeps = {
  getWalletContext: (input: {
    userId: string;
    walletId?: string | null;
  }) => Promise<{
    id: string;
    mode: BotMode;
    paperInitialBalance: number;
    liveAllocationMode: WalletAllocationMode | null;
    liveAllocationValue: number | null;
    baseCurrency: string;
    exchange: Exchange;
    apiKey: {
      apiKey: string;
      apiSecret: string;
      exchange: Exchange;
    } | null;
  } | null>;
  getBotPaperStartBalance: (input: { userId: string; botId?: string | null; fallback: number }) => Promise<number>;
  listOpenBotManagedPositions: (input: {
    userId: string;
    botId?: string | null;
    walletId?: string | null;
  }) => Promise<Array<{ entryPrice: number; quantity: number; leverage: number }>>;
  sumClosedBotManagedRealizedPnl: (input: {
    userId: string;
    botId?: string | null;
    walletId?: string | null;
  }) => Promise<number>;
  getLiveApiKeyContext: (input: {
    userId: string;
    botId?: string | null;
    walletId?: string | null;
    exchange: Exchange;
  }) => Promise<{ apiKey: string; apiSecret: string } | null>;
  fetchLiveBalance: (input: {
    apiKey: string;
    apiSecret: string;
    marketType: TradeMarket;
    baseCurrency: string;
  }) => Promise<number | null>;
};

const extractBalanceForCurrency = (payload: unknown, baseCurrency: string) => {
  if (!payload || typeof payload !== 'object') return null;
  const normalizedBaseCurrency = baseCurrency.toUpperCase();
  const withTotal = payload as { total?: Record<string, unknown>; free?: Record<string, unknown> };
  const total = Number(withTotal.total?.[normalizedBaseCurrency]);
  if (Number.isFinite(total) && total > 0) return total;
  const free = Number(withTotal.free?.[normalizedBaseCurrency]);
  if (Number.isFinite(free) && free > 0) return free;
  return null;
};

const defaultDeps: RuntimeCapitalContextDeps = {
  getWalletContext: async ({ userId, walletId }) => {
    if (!walletId) return null;
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId },
      select: {
        id: true,
        mode: true,
        paperInitialBalance: true,
        liveAllocationMode: true,
        liveAllocationValue: true,
        baseCurrency: true,
        exchange: true,
        apiKey: {
          select: {
            apiKey: true,
            apiSecret: true,
            exchange: true,
          },
        },
      },
    });
    if (!wallet) return null;
    return wallet;
  },
  getBotPaperStartBalance: async ({ userId, botId, fallback }) => {
    if (!botId) return Math.max(0, fallback);
    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId },
      select: { paperStartBalance: true },
    });
    if (!bot || !Number.isFinite(bot.paperStartBalance)) return Math.max(0, fallback);
    return Math.max(0, bot.paperStartBalance);
  },
  listOpenBotManagedPositions: async ({ userId, botId, walletId }) =>
    prisma.position.findMany({
      where: {
        userId,
        status: PositionStatus.OPEN,
        managementMode: PositionManagementMode.BOT_MANAGED,
        ...(walletId ? { walletId } : botId ? { botId } : { botId: null }),
      },
      select: {
        entryPrice: true,
        quantity: true,
        leverage: true,
      },
    }),
  sumClosedBotManagedRealizedPnl: async ({ userId, botId, walletId }) => {
    const aggregate = await prisma.position.aggregate({
      where: {
        userId,
        status: { not: PositionStatus.OPEN },
        managementMode: PositionManagementMode.BOT_MANAGED,
        realizedPnl: { not: null },
        ...(walletId ? { walletId } : botId ? { botId } : { botId: null }),
      },
      _sum: {
        realizedPnl: true,
      },
    });
    return Number(aggregate._sum.realizedPnl ?? 0);
  },
  getLiveApiKeyContext: async ({ userId, botId, walletId, exchange }) => {
    if (walletId) {
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId },
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
      if (wallet?.apiKey && wallet.apiKey.exchange === exchange) {
        return {
          apiKey: decrypt(wallet.apiKey.apiKey),
          apiSecret: decrypt(wallet.apiKey.apiSecret),
        };
      }
    }

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
  fetchLiveBalance: async ({ apiKey, apiSecret, marketType, baseCurrency }) => {
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
        return extractBalanceForCurrency(balance, baseCurrency);
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

const resolveWalletReferenceBalanceFromAllocation = (input: {
  accountBalance: number;
  liveAllocationMode: WalletAllocationMode | null;
  liveAllocationValue: number | null;
}) => {
  if (!Number.isFinite(input.accountBalance) || input.accountBalance <= 0) return 0;

  if (input.liveAllocationMode === 'PERCENT' && Number.isFinite(input.liveAllocationValue)) {
    const percent = Math.max(0, Math.min(100, input.liveAllocationValue ?? 0));
    return input.accountBalance * (percent / 100);
  }

  if (input.liveAllocationMode === 'FIXED' && Number.isFinite(input.liveAllocationValue)) {
    const fixed = Math.max(0, input.liveAllocationValue ?? 0);
    return Math.min(input.accountBalance, fixed);
  }

  return input.accountBalance;
};

export const resolvePaperRuntimeCapitalSnapshot = async (
  input: { userId: string; botId?: string | null; walletId?: string | null; paperStartBalance: number },
  deps: RuntimeCapitalContextDeps = defaultDeps
) => {
  const wallet = await deps.getWalletContext({
    userId: input.userId,
    walletId: input.walletId,
  });

  const startBalance = wallet
    ? Math.max(0, wallet.paperInitialBalance)
    : await deps.getBotPaperStartBalance({
        userId: input.userId,
        botId: input.botId,
        fallback: input.paperStartBalance,
      });

  const [openPositions, realizedPnl] = await Promise.all([
    deps.listOpenBotManagedPositions({
      userId: input.userId,
      botId: input.botId,
      walletId: input.walletId,
    }),
    deps.sumClosedBotManagedRealizedPnl({
      userId: input.userId,
      botId: input.botId,
      walletId: input.walletId,
    }),
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

const resolveLiveRuntimeCapitalSnapshot = async (
  input: {
    userId: string;
    botId?: string | null;
    walletId?: string | null;
    exchange: Exchange;
    marketType: TradeMarket;
    nowMs: number;
  },
  deps: RuntimeCapitalContextDeps = defaultDeps
) => {
  const wallet = await deps.getWalletContext({
    userId: input.userId,
    walletId: input.walletId,
  });
  const baseCurrency = (wallet?.baseCurrency ?? 'USDT').toUpperCase();

  const cacheKey = `${input.userId}:${input.walletId ?? input.botId ?? 'none'}:${input.exchange}:${input.marketType}:${baseCurrency}`;
  const cached = liveBalanceCache.get(cacheKey);
  if (cached && input.nowMs - cached.fetchedAt <= liveBalanceCacheTtlMs) {
    const [openPositions] = await Promise.all([
      deps.listOpenBotManagedPositions({
        userId: input.userId,
        botId: input.botId,
        walletId: input.walletId,
      }),
    ]);
    const reservedMargin = openPositions.reduce((sum, position) => {
      const leverage = Math.max(1, position.leverage || 1);
      return sum + (position.entryPrice * position.quantity) / leverage;
    }, 0);
    const freeCash = Math.max(0, cached.value - reservedMargin);
    return {
      referenceBalance: cached.value,
      freeCash,
      reservedMargin,
      accountBalance: cached.value,
      baseCurrency,
    };
  }

  const apiKey = await deps.getLiveApiKeyContext({
    userId: input.userId,
    botId: input.botId,
    walletId: input.walletId,
    exchange: input.exchange,
  });

  let accountBalance = runtimeReferenceBalanceFallback;
  if (apiKey) {
    const fetched = await deps.fetchLiveBalance({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
      marketType: input.marketType,
      baseCurrency,
    });
    if (Number.isFinite(fetched) && (fetched as number) > 0) {
      accountBalance = fetched as number;
    }
  }

  const referenceBalance = wallet
    ? resolveWalletReferenceBalanceFromAllocation({
        accountBalance,
        liveAllocationMode: wallet.liveAllocationMode,
        liveAllocationValue: wallet.liveAllocationValue,
      })
    : accountBalance;

  liveBalanceCache.set(cacheKey, { value: referenceBalance, fetchedAt: input.nowMs });

  const openPositions = await deps.listOpenBotManagedPositions({
    userId: input.userId,
    botId: input.botId,
    walletId: input.walletId,
  });
  const reservedMargin = openPositions.reduce((sum, position) => {
    const leverage = Math.max(1, position.leverage || 1);
    return sum + (position.entryPrice * position.quantity) / leverage;
  }, 0);
  const freeCash = Math.max(0, referenceBalance - reservedMargin);

  return {
    referenceBalance,
    freeCash,
    reservedMargin,
    accountBalance,
    baseCurrency,
  };
};

export const resolveRuntimeReferenceBalance = async (
  input: {
    userId: string;
    botId?: string | null;
    walletId?: string | null;
    mode: BotMode | 'PAPER' | 'LIVE';
    exchange: Exchange;
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
        walletId: input.walletId,
        paperStartBalance: input.paperStartBalance,
      },
      deps
    );
    return snapshot.referenceBalance;
  }

  const snapshot = await resolveLiveRuntimeCapitalSnapshot(
    {
      userId: input.userId,
      botId: input.botId,
      walletId: input.walletId,
      exchange: input.exchange,
      marketType: input.marketType,
      nowMs: input.nowMs,
    },
    deps
  );

  return snapshot.referenceBalance;
};

export const resolveRuntimeDcaFundsExhausted = async (
  input: {
    userId: string;
    botId?: string | null;
    walletId?: string | null;
    mode: 'PAPER' | 'LIVE';
    exchange: Exchange;
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
        walletId: input.walletId,
        paperStartBalance: input.paperStartBalance,
      },
      deps
    );
    return requiredMargin > snapshot.freeCash;
  }

  const snapshot = await resolveLiveRuntimeCapitalSnapshot(
    {
      userId: input.userId,
      botId: input.botId,
      walletId: input.walletId,
      exchange: input.exchange,
      marketType: input.marketType,
      nowMs: input.nowMs,
    },
    deps
  );

  return requiredMargin > snapshot.freeCash;
};
