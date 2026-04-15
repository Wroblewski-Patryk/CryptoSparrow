import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import {
  assertExchangeCapability,
  getExchangeBaseCurrencyFallbacks,
  getExchangeMarketTypeOptions,
  supportsExchangeCapability,
  type ExchangeMarketType,
} from '../exchange/exchangeCapabilities';
import { decrypt } from '../../utils/crypto';
import { getMarketCatalog } from '../markets/markets.service';
import {
  CreateWalletDto,
  ListWalletsQueryDto,
  WalletMetadataQueryDto,
  UpdateWalletDto,
  WalletBalancePreviewDto,
} from './wallets.types';
import { walletErrors } from './wallets.errors';
import { isAppErrorLike } from '../../lib/errors';

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
    throw walletErrors.liveApiKeyRequired();
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
    throw walletErrors.liveApiKeyRequired();
  }

  if (apiKey.exchange !== params.exchange) {
    throw walletErrors.liveApiKeyExchangeMismatch();
  }
};

type WalletMetadataMarketTypeEntry = {
  marketType: ExchangeMarketType;
  baseCurrency: string;
  baseCurrencies: string[];
  source: 'MARKET_CATALOG' | 'EXCHANGE_CAPABILITIES';
};

const resolveWalletMetadataForMarketType = async (params: {
  exchange: CreateWalletDto['exchange'];
  marketType: ExchangeMarketType;
}): Promise<WalletMetadataMarketTypeEntry> => {
  const fallbackCurrencies = getExchangeBaseCurrencyFallbacks(params.exchange, params.marketType)
    .map((item) => normalizeBaseCurrency(item))
    .filter(Boolean);
  const resolvedFallbackCurrencies =
    fallbackCurrencies.length > 0 ? [...new Set(fallbackCurrencies)] : ['USDT'];
  const fallbackBaseCurrency = resolvedFallbackCurrencies[0] ?? 'USDT';

  if (!supportsExchangeCapability(params.exchange, 'MARKET_CATALOG')) {
    return {
      marketType: params.marketType,
      baseCurrency: fallbackBaseCurrency,
      baseCurrencies: resolvedFallbackCurrencies,
      source: 'EXCHANGE_CAPABILITIES',
    };
  }

  try {
    const catalog = await getMarketCatalog(undefined, params.marketType, params.exchange);
    const normalizedCatalogBaseCurrencies = (catalog.baseCurrencies ?? [])
      .map((item) => normalizeBaseCurrency(item))
      .filter(Boolean);
    const baseCurrencies = normalizedCatalogBaseCurrencies.length
      ? [...new Set(normalizedCatalogBaseCurrencies)]
      : resolvedFallbackCurrencies;
    const baseCurrency = baseCurrencies.includes(normalizeBaseCurrency(catalog.baseCurrency))
      ? normalizeBaseCurrency(catalog.baseCurrency)
      : (baseCurrencies[0] ?? fallbackBaseCurrency);

    return {
      marketType: params.marketType,
      baseCurrency,
      baseCurrencies,
      source: 'MARKET_CATALOG',
    };
  } catch {
    return {
      marketType: params.marketType,
      baseCurrency: fallbackBaseCurrency,
      baseCurrencies: resolvedFallbackCurrencies,
      source: 'EXCHANGE_CAPABILITIES',
    };
  }
};

export const getWalletMetadata = async (query: WalletMetadataQueryDto) => {
  const marketTypes = getExchangeMarketTypeOptions(query.exchange);
  const resolvedMarketType =
    query.marketType && marketTypes.includes(query.marketType)
      ? query.marketType
      : (marketTypes[0] ?? 'SPOT');

  const marketTypeEntries = await Promise.all(
    marketTypes.map((marketType) =>
      resolveWalletMetadataForMarketType({
        exchange: query.exchange,
        marketType,
      })
    )
  );

  const byMarketType = marketTypeEntries.reduce<
    Record<ExchangeMarketType, WalletMetadataMarketTypeEntry>
  >(
    (acc, entry) => {
      acc[entry.marketType] = entry;
      return acc;
    },
    {
      FUTURES: {
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        baseCurrencies: ['USDT'],
        source: 'EXCHANGE_CAPABILITIES',
      },
      SPOT: {
        marketType: 'SPOT',
        baseCurrency: 'USDT',
        baseCurrencies: ['USDT'],
        source: 'EXCHANGE_CAPABILITIES',
      },
    }
  );

  const selected = byMarketType[resolvedMarketType] ?? byMarketType.SPOT;

  return {
    exchange: query.exchange,
    marketTypes,
    marketType: selected.marketType,
    baseCurrency: selected.baseCurrency,
    baseCurrencies: selected.baseCurrencies,
    source: selected.source,
    byMarketType,
  };
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
    throw walletErrors.inUseCannotDelete();
  }

  try {
    await prisma.wallet.delete({
      where: { id: existing.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw walletErrors.inUseCannotDelete();
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

const extractBalanceForCurrency = (payload: unknown, currency: string) => {
  if (!payload || typeof payload !== 'object') return null;
  const normalizedCurrency = currency.toUpperCase();
  const parsed = payload as { total?: Record<string, unknown>; free?: Record<string, unknown> };

  const total = Number(parsed.total?.[normalizedCurrency]);
  const free = Number(parsed.free?.[normalizedCurrency]);

  const normalizedTotal = Number.isFinite(total) && total >= 0 ? total : null;
  const normalizedFree = Number.isFinite(free) && free >= 0 ? free : null;

  return {
    accountBalance: normalizedTotal ?? normalizedFree,
    freeBalance: normalizedFree ?? normalizedTotal,
  };
};

const resolveReferenceBalanceFromAllocation = (params: {
  accountBalance: number;
  liveAllocationMode?: 'PERCENT' | 'FIXED' | null;
  liveAllocationValue?: number | null;
}) => {
  if (!Number.isFinite(params.accountBalance) || params.accountBalance <= 0) return 0;

  if (params.liveAllocationMode === 'PERCENT' && Number.isFinite(params.liveAllocationValue)) {
    const percent = Math.max(0, Math.min(100, params.liveAllocationValue ?? 0));
    return params.accountBalance * (percent / 100);
  }

  if (params.liveAllocationMode === 'FIXED' && Number.isFinite(params.liveAllocationValue)) {
    const fixed = Math.max(0, params.liveAllocationValue ?? 0);
    return Math.min(params.accountBalance, fixed);
  }

  return params.accountBalance;
};

const fetchBinanceBalancePreview = async (params: {
  apiKey: string;
  apiSecret: string;
  marketType: 'FUTURES' | 'SPOT';
  baseCurrency: string;
}) => {
  if (process.env.NODE_ENV === 'test') {
    const account = Number.parseFloat(process.env.WALLET_PREVIEW_TEST_ACCOUNT_BALANCE ?? '1000');
    const free = Number.parseFloat(process.env.WALLET_PREVIEW_TEST_FREE_BALANCE ?? String(account));
    if (!Number.isFinite(account) || account <= 0) return null;
    const normalizedFree = Number.isFinite(free) && free >= 0 ? Math.min(free, account) : account;
    return {
      accountBalance: account,
      freeBalance: normalizedFree,
    };
  }

  const ccxtModule = (await import('ccxt')) as unknown as {
    binance: new (config: Record<string, unknown>) => {
      fetchBalance: () => Promise<unknown>;
      close?: () => Promise<void>;
    };
  };

  const client = new ccxtModule.binance({
    apiKey: params.apiKey,
    secret: params.apiSecret,
    enableRateLimit: true,
    options: {
      defaultType: params.marketType === 'FUTURES' ? 'future' : 'spot',
    },
  });

  try {
    const balancePayload = await client.fetchBalance();
    return extractBalanceForCurrency(balancePayload, params.baseCurrency);
  } finally {
    if (typeof client.close === 'function') {
      await client.close().catch(() => undefined);
    }
  }
};

export const previewWalletBalance = async (userId: string, payload: WalletBalancePreviewDto) => {
  assertExchangeCapability(payload.exchange, 'LIVE_EXECUTION');

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: payload.apiKeyId,
      userId,
      exchange: payload.exchange,
    },
    select: {
      id: true,
      apiKey: true,
      apiSecret: true,
    },
  });

  if (!apiKey) {
    throw walletErrors.previewApiKeyNotFound();
  }

  const decodedApiKey = decrypt(apiKey.apiKey);
  const decodedApiSecret = decrypt(apiKey.apiSecret);

  try {
    const snapshot = await fetchBinanceBalancePreview({
      apiKey: decodedApiKey,
      apiSecret: decodedApiSecret,
      marketType: payload.marketType,
      baseCurrency: payload.baseCurrency.trim().toUpperCase(),
    });

    if (snapshot?.accountBalance == null) {
      throw walletErrors.previewFetchFailed();
    }

    const referenceBalance = resolveReferenceBalanceFromAllocation({
      accountBalance: snapshot.accountBalance,
      liveAllocationMode: payload.liveAllocationMode,
      liveAllocationValue: payload.liveAllocationValue,
    });

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });

    return {
      exchange: payload.exchange,
      marketType: payload.marketType,
      baseCurrency: payload.baseCurrency.trim().toUpperCase(),
      accountBalance: snapshot.accountBalance,
      freeBalance: snapshot.freeBalance,
      referenceBalance,
      allocationApplied:
        payload.liveAllocationMode && typeof payload.liveAllocationValue === 'number'
          ? {
              mode: payload.liveAllocationMode,
              value: payload.liveAllocationValue,
            }
          : null,
      fetchedAt: new Date().toISOString(),
      source: 'BINANCE' as const,
    };
  } catch (error) {
    if (isAppErrorLike(error) && error.code === 'WALLET_PREVIEW_FETCH_FAILED') {
      throw error;
    }
    throw walletErrors.previewFetchFailed();
  }
};
