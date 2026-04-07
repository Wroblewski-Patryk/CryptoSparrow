import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { assertExchangeCapability } from '../exchange/exchangeCapabilities';
import { CreateWalletDto, ListWalletsQueryDto, UpdateWalletDto } from './wallets.types';

const normalizeBaseCurrency = (value: string | undefined) =>
  (value?.trim().toUpperCase() || 'USDT');

const normalizeWalletInput = (payload: CreateWalletDto | UpdateWalletDto) => {
  const mode = payload.mode;
  const normalized = {
    ...payload,
    baseCurrency: payload.baseCurrency ? normalizeBaseCurrency(payload.baseCurrency) : undefined,
  };

  if (mode === 'PAPER') {
    return {
      ...normalized,
      liveAllocationMode: null,
      liveAllocationValue: null,
      apiKeyId: null,
    };
  }

  return normalized;
};

const assertWalletModeExchangeCapability = (input: {
  mode: 'PAPER' | 'LIVE';
  exchange: 'BINANCE' | 'BYBIT' | 'OKX' | 'KRAKEN' | 'COINBASE';
}) => {
  if (input.mode === 'LIVE') {
    assertExchangeCapability(input.exchange, 'LIVE_EXECUTION');
    return;
  }
  assertExchangeCapability(input.exchange, 'PAPER_PRICING_FEED');
};

const assertWalletLiveApiKeyCompatibility = async (params: {
  userId: string;
  mode: 'PAPER' | 'LIVE';
  exchange: 'BINANCE' | 'BYBIT' | 'OKX' | 'KRAKEN' | 'COINBASE';
  apiKeyId?: string | null;
}) => {
  if (params.mode !== 'LIVE') return;

  if (!params.apiKeyId) {
    throw new Error('WALLET_LIVE_API_KEY_REQUIRED');
  }

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: params.apiKeyId,
      userId: params.userId,
    },
    select: {
      id: true,
      exchange: true,
    },
  });

  if (!apiKey) {
    throw new Error('WALLET_LIVE_API_KEY_REQUIRED');
  }

  if (apiKey.exchange !== params.exchange) {
    throw new Error('WALLET_LIVE_API_KEY_EXCHANGE_MISMATCH');
  }
};

export const listWallets = async (userId: string, query: ListWalletsQueryDto = {}) =>
  prisma.wallet.findMany({
    where: {
      userId,
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.marketType ? { marketType: query.marketType } : {}),
      ...(query.exchange ? { exchange: query.exchange } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
  });

export const getWallet = async (userId: string, id: string) =>
  prisma.wallet.findFirst({
    where: {
      userId,
      id,
    },
  });

export const createWallet = async (userId: string, payload: CreateWalletDto) => {
  const normalized = normalizeWalletInput(payload) as CreateWalletDto;

  assertWalletModeExchangeCapability({
    mode: normalized.mode,
    exchange: normalized.exchange,
  });
  await assertWalletLiveApiKeyCompatibility({
    userId,
    mode: normalized.mode,
    exchange: normalized.exchange,
    apiKeyId: normalized.apiKeyId,
  });

  return prisma.wallet.create({
    data: {
      userId,
      name: normalized.name.trim(),
      mode: normalized.mode,
      exchange: normalized.exchange,
      marketType: normalized.marketType,
      baseCurrency: normalizeBaseCurrency(normalized.baseCurrency),
      paperInitialBalance: normalized.paperInitialBalance,
      liveAllocationMode: normalized.liveAllocationMode ?? null,
      liveAllocationValue: normalized.liveAllocationValue ?? null,
      apiKeyId: normalized.apiKeyId ?? null,
    },
  });
};

export const updateWallet = async (userId: string, id: string, payload: UpdateWalletDto) => {
  const existing = await getWallet(userId, id);
  if (!existing) return null;

  const nextMode = payload.mode ?? existing.mode;
  const nextExchange = payload.exchange ?? existing.exchange;
  const nextData = normalizeWalletInput({
    ...existing,
    ...payload,
    mode: nextMode,
    exchange: nextExchange,
  } as CreateWalletDto);

  assertWalletModeExchangeCapability({
    mode: nextMode,
    exchange: nextExchange,
  });
  await assertWalletLiveApiKeyCompatibility({
    userId,
    mode: nextMode,
    exchange: nextExchange,
    apiKeyId: nextData.apiKeyId,
  });

  return prisma.wallet.update({
    where: { id: existing.id },
    data: {
      ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      mode: nextMode,
      exchange: nextExchange,
      ...(payload.marketType !== undefined ? { marketType: payload.marketType } : {}),
      ...(nextData.baseCurrency ? { baseCurrency: normalizeBaseCurrency(nextData.baseCurrency) } : {}),
      ...(payload.paperInitialBalance !== undefined ? { paperInitialBalance: payload.paperInitialBalance } : {}),
      liveAllocationMode: nextData.liveAllocationMode ?? null,
      liveAllocationValue: nextData.liveAllocationValue ?? null,
      apiKeyId: nextData.apiKeyId ?? null,
    },
  });
};

export const deleteWallet = async (userId: string, id: string) => {
  const existing = await getWallet(userId, id);
  if (!existing) return false;

  const linkedBotsCount = await prisma.bot.count({
    where: {
      userId,
      walletId: existing.id,
    },
  });
  if (linkedBotsCount > 0) {
    throw new Error('WALLET_IN_USE_CANNOT_DELETE');
  }

  try {
    await prisma.wallet.delete({
      where: { id: existing.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new Error('WALLET_IN_USE_CANNOT_DELETE');
    }
    throw error;
  }

  return true;
};

export const getOwnedWalletForBotContext = async (params: {
  userId: string;
  walletId: string;
}) =>
  prisma.wallet.findFirst({
    where: {
      id: params.walletId,
      userId: params.userId,
    },
    select: {
      id: true,
      mode: true,
      exchange: true,
      marketType: true,
      baseCurrency: true,
      paperInitialBalance: true,
      liveAllocationMode: true,
      liveAllocationValue: true,
      apiKeyId: true,
    },
  });
