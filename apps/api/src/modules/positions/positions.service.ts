import { prisma } from '../../prisma/client';
import { ListPositionsQuery } from './positions.types';
import { decrypt } from '../../utils/crypto';

export type ExchangePositionSnapshotItem = {
  symbol: string;
  side: string | null;
  contracts: number;
  entryPrice: number | null;
  markPrice: number | null;
  unrealizedPnl: number | null;
  leverage: number | null;
  marginMode: string | null;
  liquidationPrice: number | null;
  timestamp: string | null;
};

export type ExchangePositionSnapshot = {
  source: 'BINANCE';
  syncedAt: string;
  positions: ExchangePositionSnapshotItem[];
};

export type ExchangeOpenOrderSnapshotItem = {
  exchangeOrderId: string | null;
  symbol: string;
  side: string | null;
  type: string | null;
  status: string | null;
  amount: number;
  filled: number;
  remaining: number | null;
  price: number | null;
  timestamp: string | null;
};

export type ExchangeOpenOrderSnapshot = {
  source: 'BINANCE';
  syncedAt: string;
  orders: ExchangeOpenOrderSnapshotItem[];
};

export type ExternalTakeoverStatus =
  | 'OWNED_AND_MANAGED'
  | 'UNOWNED'
  | 'AMBIGUOUS'
  | 'MANUAL_ONLY';

export type ExternalTakeoverStatusItem = {
  positionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  openedAt: string;
  externalId: string | null;
  apiKeyId: string | null;
  managementMode: 'BOT_MANAGED' | 'MANUAL_MANAGED';
  syncState: 'IN_SYNC' | 'DRIFT' | 'ORPHAN_LOCAL' | 'ORPHAN_EXCHANGE';
  botId: string | null;
  walletId: string | null;
  takeoverStatus: ExternalTakeoverStatus;
};

export type ExternalTakeoverStatusResponse = {
  total: number;
  summary: Record<ExternalTakeoverStatus, number>;
  items: ExternalTakeoverStatusItem[];
};

export type ExternalTakeoverRebindResponse = {
  scanned: number;
  rebound: number;
  ambiguous: number;
  unowned: number;
  skippedOwned: number;
  scannedByOrigin: {
    EXCHANGE_SYNC: number;
    BOT: number;
  };
  reboundByOrigin: {
    EXCHANGE_SYNC: number;
    BOT: number;
  };
};

type ExchangePositionLike = {
  symbol?: string;
  side?: string;
  contracts?: number;
  entryPrice?: number;
  markPrice?: number;
  unrealizedPnl?: number;
  leverage?: number;
  marginMode?: string;
  liquidationPrice?: number;
  timestamp?: number;
};

type BinanceClientLike = {
  fetchPositions: () => Promise<ExchangePositionLike[]>;
  fetchOpenOrders?: (
    symbol?: string,
    since?: number,
    limit?: number,
    params?: Record<string, unknown>
  ) => Promise<Array<Record<string, unknown>>>;
  close?: () => Promise<void>;
};

type ApiKeyRecordForSnapshot = {
  id: string;
  apiKey: string;
  apiSecret: string;
};

export class ExchangeSnapshotError extends Error {
  constructor(public readonly code: 'API_KEY_NOT_FOUND' | 'EXCHANGE_FETCH_FAILED', message: string) {
    super(message);
    this.name = 'ExchangeSnapshotError';
  }
}

const defaultBinanceClientFactory = async (credentials: {
  apiKey: string;
  secret: string;
}): Promise<BinanceClientLike> => {
  const ccxtModule = (await import('ccxt')) as unknown as {
    binance: new (config: Record<string, unknown>) => BinanceClientLike;
  };

  return new ccxtModule.binance({
    apiKey: credentials.apiKey,
    secret: credentials.secret,
    enableRateLimit: true,
    options: {
      defaultType: 'future',
    },
  });
};

const normalizeExchangePosition = (position: ExchangePositionLike): ExchangePositionSnapshotItem => ({
  symbol: position.symbol ?? 'UNKNOWN',
  side: position.side ?? null,
  contracts: typeof position.contracts === 'number' ? position.contracts : 0,
  entryPrice: typeof position.entryPrice === 'number' ? position.entryPrice : null,
  markPrice: typeof position.markPrice === 'number' ? position.markPrice : null,
  unrealizedPnl: typeof position.unrealizedPnl === 'number' ? position.unrealizedPnl : null,
  leverage: typeof position.leverage === 'number' ? position.leverage : null,
  marginMode: position.marginMode ?? null,
  liquidationPrice: typeof position.liquidationPrice === 'number' ? position.liquidationPrice : null,
  timestamp: typeof position.timestamp === 'number' ? new Date(position.timestamp).toISOString() : null,
});

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const normalizeExchangeOpenOrder = (order: Record<string, unknown>): ExchangeOpenOrderSnapshotItem => {
  const info = (order.info ?? {}) as Record<string, unknown>;
  const timestampMs =
    readNumber(order.timestamp) ?? readNumber(info.time) ?? readNumber(info.transactTime);
  const amount = readNumber(order.amount) ?? readNumber(info.origQty) ?? 0;
  const filled = readNumber(order.filled) ?? readNumber(info.executedQty) ?? 0;
  const explicitRemaining = readNumber(order.remaining);
  const remaining =
    typeof explicitRemaining === 'number'
      ? explicitRemaining
      : Number.isFinite(amount) && Number.isFinite(filled)
        ? Math.max(0, amount - filled)
        : null;

  return {
    exchangeOrderId: readString(order.id) ?? readString(info.orderId) ?? null,
    symbol: readString(order.symbol) ?? readString(info.symbol) ?? 'UNKNOWN',
    side: readString(order.side) ?? readString(info.side) ?? null,
    type: readString(order.type) ?? readString(info.type) ?? null,
    status: readString(order.status) ?? readString(info.status) ?? null,
    amount,
    filled,
    remaining,
    price: readNumber(order.price) ?? readNumber(info.price),
    timestamp: typeof timestampMs === 'number' ? new Date(timestampMs).toISOString() : null,
  };
};

const buildSnapshotForApiKey = async (apiKey: ApiKeyRecordForSnapshot): Promise<ExchangePositionSnapshot> => {
  if (process.env.NODE_ENV === 'test') {
    if (process.env.POSITIONS_SNAPSHOT_FORCE_ERROR === '1') {
      throw new ExchangeSnapshotError('EXCHANGE_FETCH_FAILED', 'Unable to fetch exchange positions snapshot.');
    }

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });

    return {
      source: 'BINANCE',
      syncedAt: new Date().toISOString(),
      positions: [
        {
          symbol: 'BTC/USDT:USDT',
          side: 'long',
          contracts: 0.01,
          entryPrice: 50000,
          markPrice: 50100,
          unrealizedPnl: 1,
          leverage: 2,
          marginMode: 'isolated',
          liquidationPrice: 42000,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const decryptedKey = decrypt(apiKey.apiKey);
  const decryptedSecret = decrypt(apiKey.apiSecret);

  const client = await defaultBinanceClientFactory({
    apiKey: decryptedKey,
    secret: decryptedSecret,
  });

  try {
    const rawPositions = await client.fetchPositions();

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });

    return {
      source: 'BINANCE',
      syncedAt: new Date().toISOString(),
      positions: rawPositions.map(normalizeExchangePosition),
    };
  } catch {
    throw new ExchangeSnapshotError('EXCHANGE_FETCH_FAILED', 'Unable to fetch exchange positions snapshot.');
  } finally {
    if (typeof client.close === 'function') {
      await client.close();
    }
  }
};

const buildOpenOrdersSnapshotForApiKey = async (
  apiKey: ApiKeyRecordForSnapshot
): Promise<ExchangeOpenOrderSnapshot> => {
  if (process.env.NODE_ENV === 'test') {
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });

    return {
      source: 'BINANCE',
      syncedAt: new Date().toISOString(),
      orders: [
        {
          exchangeOrderId: 'test-open-order-1',
          symbol: 'BTC/USDT:USDT',
          side: 'buy',
          type: 'limit',
          status: 'open',
          amount: 0.01,
          filled: 0,
          remaining: 0.01,
          price: 50000,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const decryptedKey = decrypt(apiKey.apiKey);
  const decryptedSecret = decrypt(apiKey.apiSecret);

  const client = await defaultBinanceClientFactory({
    apiKey: decryptedKey,
    secret: decryptedSecret,
  });

  try {
    if (typeof client.fetchOpenOrders !== 'function') {
      return {
        source: 'BINANCE',
        syncedAt: new Date().toISOString(),
        orders: [],
      };
    }

    const rawOrders = await client.fetchOpenOrders();

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });

    return {
      source: 'BINANCE',
      syncedAt: new Date().toISOString(),
      orders: rawOrders.map(normalizeExchangeOpenOrder),
    };
  } catch {
    throw new ExchangeSnapshotError('EXCHANGE_FETCH_FAILED', 'Unable to fetch exchange open orders snapshot.');
  } finally {
    if (typeof client.close === 'function') {
      await client.close();
    }
  }
};

export const listPositions = async (userId: string, query: ListPositionsQuery) => {
  const skip = (query.page - 1) * query.limit;
  const where = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.symbol ? { symbol: query.symbol } : {}),
  };

  return prisma.position.findMany({
    where,
    skip,
    take: query.limit,
    orderBy: { openedAt: 'desc' },
  });
};

export const getPosition = async (userId: string, id: string) => {
  return prisma.position.findFirst({
    where: { id, userId },
  });
};

export const updatePositionManagementMode = async (
  userId: string,
  id: string,
  managementMode: 'BOT_MANAGED' | 'MANUAL_MANAGED'
) => {
  const updated = await prisma.position.updateMany({
    where: { id, userId },
    data: { managementMode },
  });

  if (updated.count === 0) return null;

  return prisma.position.findFirst({
    where: { id, userId },
  });
};

export const fetchExchangePositionsSnapshot = async (userId: string): Promise<ExchangePositionSnapshot> => {
  const apiKey = await prisma.apiKey.findFirst({
    where: { userId, exchange: 'BINANCE' },
    orderBy: { updatedAt: 'desc' },
  });

  if (!apiKey) {
    throw new ExchangeSnapshotError('API_KEY_NOT_FOUND', 'No Binance API key configured.');
  }

  return buildSnapshotForApiKey(apiKey);
};

export const fetchExchangePositionsSnapshotByApiKeyId = async (
  userId: string,
  apiKeyId: string
): Promise<ExchangePositionSnapshot> => {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
      exchange: 'BINANCE',
    },
    select: {
      id: true,
      apiKey: true,
      apiSecret: true,
    },
  });

  if (!apiKey) {
    throw new ExchangeSnapshotError('API_KEY_NOT_FOUND', 'No Binance API key configured.');
  }

  return buildSnapshotForApiKey(apiKey);
};

export const fetchExchangeOpenOrdersSnapshotByApiKeyId = async (
  userId: string,
  apiKeyId: string
): Promise<ExchangeOpenOrderSnapshot> => {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
      exchange: 'BINANCE',
    },
    select: {
      id: true,
      apiKey: true,
      apiSecret: true,
    },
  });

  if (!apiKey) {
    throw new ExchangeSnapshotError('API_KEY_NOT_FOUND', 'No Binance API key configured.');
  }

  return buildOpenOrdersSnapshotForApiKey(apiKey);
};

const parseApiKeyIdFromExternalId = (externalId: string | null): string | null => {
  if (!externalId) return null;
  const [apiKeyId] = externalId.split(':');
  if (!apiKeyId || apiKeyId.trim().length === 0) return null;
  return apiKeyId.trim();
};

export const rebindExternalTakeoverOwnership = async (
  userId: string
): Promise<ExternalTakeoverRebindResponse> => {
  const [positions, eligibleBots] = await Promise.all([
    prisma.position.findMany({
      where: {
        userId,
        status: 'OPEN',
        managementMode: 'BOT_MANAGED',
        origin: { in: ['EXCHANGE_SYNC', 'BOT'] },
      },
      select: {
        id: true,
        externalId: true,
        botId: true,
        origin: true,
      },
    }),
    prisma.bot.findMany({
      where: {
        userId,
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        isActive: true,
        liveOptIn: true,
        walletId: { not: null },
        apiKeyId: { not: null },
      },
      select: {
        id: true,
        walletId: true,
        apiKeyId: true,
      },
    }),
  ]);

  const ownersByApiKeyId = new Map<string, Array<{ botId: string; walletId: string }>>();
  for (const bot of eligibleBots) {
    if (!bot.apiKeyId || !bot.walletId) continue;
    const current = ownersByApiKeyId.get(bot.apiKeyId) ?? [];
    current.push({ botId: bot.id, walletId: bot.walletId });
    ownersByApiKeyId.set(bot.apiKeyId, current);
  }

  const result: ExternalTakeoverRebindResponse = {
    scanned: positions.length,
    rebound: 0,
    ambiguous: 0,
    unowned: 0,
    skippedOwned: 0,
    scannedByOrigin: {
      EXCHANGE_SYNC: 0,
      BOT: 0,
    },
    reboundByOrigin: {
      EXCHANGE_SYNC: 0,
      BOT: 0,
    },
  };

  for (const position of positions) {
    if (position.origin === 'EXCHANGE_SYNC') {
      result.scannedByOrigin.EXCHANGE_SYNC += 1;
    } else if (position.origin === 'BOT') {
      result.scannedByOrigin.BOT += 1;
    }

    if (position.botId) {
      result.skippedOwned += 1;
      continue;
    }

    let owners: Array<{ botId: string; walletId: string }> = [];
    if (position.origin === 'EXCHANGE_SYNC') {
      const apiKeyId = parseApiKeyIdFromExternalId(position.externalId);
      if (!apiKeyId) {
        result.unowned += 1;
        continue;
      }
      owners = ownersByApiKeyId.get(apiKeyId) ?? [];
    } else if (position.origin === 'BOT') {
      owners = eligibleBots
        .filter((bot): bot is { id: string; walletId: string; apiKeyId: string | null } => Boolean(bot.walletId))
        .map((bot) => ({ botId: bot.id, walletId: bot.walletId as string }));
    }

    if (owners.length === 0) {
      result.unowned += 1;
      continue;
    }
    if (owners.length > 1) {
      result.ambiguous += 1;
      continue;
    }

    const owner = owners[0];
    const update = await prisma.position.updateMany({
      where: {
        id: position.id,
        userId,
        botId: null,
      },
      data: {
        botId: owner.botId,
        walletId: owner.walletId,
        syncState: 'IN_SYNC',
      },
    });

    if (update.count > 0) {
      result.rebound += 1;
      if (position.origin === 'EXCHANGE_SYNC') {
        result.reboundByOrigin.EXCHANGE_SYNC += 1;
      } else if (position.origin === 'BOT') {
        result.reboundByOrigin.BOT += 1;
      }
    }
  }

  return result;
};

export const listExternalTakeoverStatuses = async (
  userId: string
): Promise<ExternalTakeoverStatusResponse> => {
  const positions = await prisma.position.findMany({
    where: {
      userId,
      status: 'OPEN',
      origin: 'EXCHANGE_SYNC',
    },
    orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      symbol: true,
      side: true,
      openedAt: true,
      externalId: true,
      managementMode: true,
      syncState: true,
      botId: true,
      walletId: true,
    },
  });

  const apiKeyIds = [
    ...new Set(
      positions
        .map((position) => parseApiKeyIdFromExternalId(position.externalId))
        .filter((apiKeyId): apiKeyId is string => Boolean(apiKeyId))
    ),
  ];

  const eligibleBots =
    apiKeyIds.length === 0
      ? []
      : await prisma.bot.findMany({
          where: {
            userId,
            apiKeyId: { in: apiKeyIds },
            mode: 'LIVE',
            exchange: 'BINANCE',
            marketType: 'FUTURES',
            isActive: true,
            liveOptIn: true,
            walletId: { not: null },
          },
          select: {
            apiKeyId: true,
            id: true,
          },
        });

  const eligibleCountByApiKeyId = new Map<string, number>();
  for (const bot of eligibleBots) {
    if (!bot.apiKeyId) continue;
    eligibleCountByApiKeyId.set(bot.apiKeyId, (eligibleCountByApiKeyId.get(bot.apiKeyId) ?? 0) + 1);
  }

  const items: ExternalTakeoverStatusItem[] = positions.map((position) => {
    const apiKeyId = parseApiKeyIdFromExternalId(position.externalId);
    const eligibleOwnerCount = apiKeyId ? (eligibleCountByApiKeyId.get(apiKeyId) ?? 0) : 0;

    let takeoverStatus: ExternalTakeoverStatus;
    if (position.managementMode === 'MANUAL_MANAGED') {
      takeoverStatus = 'MANUAL_ONLY';
    } else if (position.botId) {
      takeoverStatus = 'OWNED_AND_MANAGED';
    } else if (eligibleOwnerCount > 1) {
      takeoverStatus = 'AMBIGUOUS';
    } else {
      takeoverStatus = 'UNOWNED';
    }

    return {
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      openedAt: position.openedAt.toISOString(),
      externalId: position.externalId,
      apiKeyId,
      managementMode: position.managementMode,
      syncState: position.syncState,
      botId: position.botId,
      walletId: position.walletId,
      takeoverStatus,
    };
  });

  const summary: Record<ExternalTakeoverStatus, number> = {
    OWNED_AND_MANAGED: 0,
    UNOWNED: 0,
    AMBIGUOUS: 0,
    MANUAL_ONLY: 0,
  };
  for (const item of items) {
    summary[item.takeoverStatus] += 1;
  }

  return {
    total: items.length,
    summary,
    items,
  };
};
