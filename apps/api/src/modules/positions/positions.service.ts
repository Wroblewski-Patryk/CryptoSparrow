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
