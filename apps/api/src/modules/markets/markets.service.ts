import { Exchange as PrismaExchange } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { resolveUniverseSymbols } from '../../lib/symbols';
import { assertExchangeCapability } from '../exchange/exchangeCapabilities';
import { CreateMarketUniverseDto, UpdateMarketUniverseDto } from './markets.types';

type MarketType = 'SPOT' | 'FUTURES';
type Exchange = PrismaExchange;

type PublicMarketEntry = {
  symbol: string;
  displaySymbol: string;
  baseAsset: string;
  quoteAsset: string;
  quoteVolume24h: number;
  lastPrice: number | null;
};

type MarketLike = {
  id?: string;
  symbol?: string;
  base?: string;
  quote?: string;
  active?: boolean;
};

type CcxtMarketMap = Record<string, MarketLike>;

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

const TEST_MARKETS: Record<MarketType, PublicMarketEntry[]> = {
  SPOT: [
    { symbol: 'BTCUSDT', displaySymbol: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT', quoteVolume24h: 3500000000, lastPrice: 68000 },
    { symbol: 'ETHUSDT', displaySymbol: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT', quoteVolume24h: 2100000000, lastPrice: 3600 },
    { symbol: 'SOLUSDT', displaySymbol: 'SOL/USDT', baseAsset: 'SOL', quoteAsset: 'USDT', quoteVolume24h: 900000000, lastPrice: 150 },
    { symbol: 'BTCEUR', displaySymbol: 'BTC/EUR', baseAsset: 'BTC', quoteAsset: 'EUR', quoteVolume24h: 100000000, lastPrice: 62000 },
  ],
  FUTURES: [
    { symbol: 'BTCUSDT', displaySymbol: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT', quoteVolume24h: 4500000000, lastPrice: 68050 },
    { symbol: 'ETHUSDT', displaySymbol: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT', quoteVolume24h: 2600000000, lastPrice: 3610 },
    { symbol: 'SOLUSDT', displaySymbol: 'SOL/USDT', baseAsset: 'SOL', quoteAsset: 'USDT', quoteVolume24h: 1300000000, lastPrice: 151 },
    { symbol: 'XRPUSDT', displaySymbol: 'XRP/USDT', baseAsset: 'XRP', quoteAsset: 'USDT', quoteVolume24h: 760000000, lastPrice: 0.65 },
  ],
};

let catalogCache: Record<MarketType, { fetchedAt: number; entries: PublicMarketEntry[] } | null> = {
  SPOT: null,
  FUTURES: null,
};

const normalizeAsset = (value: string | undefined) => value?.trim().toUpperCase() ?? '';

const toPublicMarketEntry = (market: MarketLike): PublicMarketEntry | null => {
  const id = normalizeAsset(market.id);
  const baseAsset = normalizeAsset(market.base);
  const quoteAsset = normalizeAsset(market.quote);
  if (!id || !baseAsset || !quoteAsset) return null;

  return {
    symbol: id,
    displaySymbol: market.symbol?.trim() || `${baseAsset}/${quoteAsset}`,
    baseAsset,
    quoteAsset,
    quoteVolume24h: 0,
    lastPrice: null,
  };
};

type BinanceTickerPayload = {
  symbol?: string;
  quoteVolume?: string;
  lastPrice?: string;
};

const fetchTickerMap = async (marketType: MarketType): Promise<Map<string, { quoteVolume24h: number; lastPrice: number | null }>> => {
  const endpoint =
    marketType === 'FUTURES'
      ? 'https://fapi.binance.com/fapi/v1/ticker/24hr'
      : 'https://api.binance.com/api/v3/ticker/24hr';

  try {
    const response = await fetch(endpoint);
    if (!response.ok) return new Map();
    const payload = (await response.json()) as BinanceTickerPayload[];
    if (!Array.isArray(payload)) return new Map();

    const map = new Map<string, { quoteVolume24h: number; lastPrice: number | null }>();
    for (const item of payload) {
      const symbol = normalizeAsset(item.symbol);
      if (!symbol) continue;
      const quoteVolume24h = Number.parseFloat(item.quoteVolume ?? '0');
      const lastPriceRaw = Number.parseFloat(item.lastPrice ?? '');
      map.set(symbol, {
        quoteVolume24h: Number.isFinite(quoteVolume24h) ? quoteVolume24h : 0,
        lastPrice: Number.isFinite(lastPriceRaw) ? lastPriceRaw : null,
      });
    }

    return map;
  } catch {
    return new Map();
  }
};

const fetchPublicBinanceMarkets = async (marketType: MarketType): Promise<PublicMarketEntry[]> => {
  if (process.env.NODE_ENV === 'test') {
    return TEST_MARKETS[marketType];
  }

  const now = Date.now();
  const currentCache = catalogCache[marketType];
  if (currentCache && now - currentCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return currentCache.entries;
  }

  try {
    const ccxtModule = (await import('ccxt')) as unknown as {
      binance: new (config: Record<string, unknown>) => {
        loadMarkets: () => Promise<CcxtMarketMap>;
        close?: () => Promise<void>;
      };
      binanceusdm: new (config: Record<string, unknown>) => {
        loadMarkets: () => Promise<CcxtMarketMap>;
        close?: () => Promise<void>;
      };
    };

    const ExchangeCtor = marketType === 'FUTURES' ? ccxtModule.binanceusdm : ccxtModule.binance;
    const client = new ExchangeCtor({
      enableRateLimit: true,
      options: { defaultType: marketType === 'FUTURES' ? 'future' : 'spot' },
    });

    const markets = await client.loadMarkets();
    if (typeof client.close === 'function') {
      await client.close();
    }

    const tickerMap = await fetchTickerMap(marketType);

    const map = new Map<string, PublicMarketEntry>();
    for (const market of Object.values(markets)) {
      if (market.active === false) continue;
      const baseEntry = toPublicMarketEntry(market);
      if (!baseEntry) continue;
      const ticker = tickerMap.get(baseEntry.symbol);
      const entry: PublicMarketEntry = {
        ...baseEntry,
        quoteVolume24h: ticker?.quoteVolume24h ?? 0,
        lastPrice: ticker?.lastPrice ?? null,
      };
      if (!entry) continue;
      if (!map.has(entry.symbol)) {
        map.set(entry.symbol, entry);
      }
    }

    const entries = [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
    catalogCache[marketType] = { fetchedAt: now, entries };
    return entries;
  } catch {
    if (currentCache?.entries.length) return currentCache.entries;
    return TEST_MARKETS[marketType];
  }
};

export const getMarketCatalog = async (
  requestedBaseCurrency?: string,
  marketType: MarketType = 'FUTURES',
  exchange: Exchange = 'BINANCE'
) => {
  assertExchangeCapability(exchange, 'MARKET_CATALOG');
  const entries = await fetchPublicBinanceMarkets(marketType);
  const baseCurrencies = [...new Set(entries.map((entry) => entry.quoteAsset))].sort((a, b) =>
    a.localeCompare(b)
  );

  const normalizedRequested = normalizeAsset(requestedBaseCurrency);
  const resolvedBaseCurrency = baseCurrencies.includes(normalizedRequested)
    ? normalizedRequested
    : (baseCurrencies.includes('USDT') ? 'USDT' : baseCurrencies[0] ?? 'USDT');

  const markets = entries
    .filter((entry) => entry.quoteAsset === resolvedBaseCurrency)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    source: 'BINANCE_PUBLIC',
    exchange,
    marketType,
    baseCurrency: resolvedBaseCurrency,
    baseCurrencies,
    totalAvailable: entries.length,
    totalForBaseCurrency: markets.length,
    markets,
  };
};

export const listUniverses = async (userId: string) => {
  return prisma.marketUniverse.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

export const getUniverse = async (userId: string, id: string) => {
  return prisma.marketUniverse.findFirst({
    where: { id, userId },
  });
};

const assertUniverseNotUsedByActiveBot = async (params: { userId: string; marketUniverseId: string }) => {
  const { userId, marketUniverseId } = params;

  const usedByActiveCanonicalBot = await prisma.botMarketGroup.findFirst({
    where: {
      userId,
      isEnabled: true,
      bot: {
        userId,
        isActive: true,
      },
      symbolGroup: {
        marketUniverseId,
      },
    },
    select: { id: true },
  });

  const usedByActiveLegacyBot = await prisma.botStrategy.findFirst({
    where: {
      isEnabled: true,
      bot: {
        userId,
        isActive: true,
      },
      symbolGroup: {
        marketUniverseId,
      },
    },
    select: { id: true },
  });

  if (usedByActiveCanonicalBot || usedByActiveLegacyBot) {
    throw new Error('MARKET_UNIVERSE_USED_BY_ACTIVE_BOT');
  }
};

export const createUniverse = async (userId: string, data: CreateMarketUniverseDto) => {
  return prisma.marketUniverse.create({
    data: {
      userId,
      ...data,
    },
  });
};

export const updateUniverse = async (
  userId: string,
  id: string,
  data: UpdateMarketUniverseDto
) => {
  const existing = await getUniverse(userId, id);
  if (!existing) return null;
  await assertUniverseNotUsedByActiveBot({ userId, marketUniverseId: existing.id });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.marketUniverse.update({
      where: { id: existing.id },
      data,
    });

    const shouldSyncSymbols = data.whitelist !== undefined || data.blacklist !== undefined;
    if (shouldSyncSymbols) {
      const resolvedSymbols = resolveUniverseSymbols(updated.whitelist, updated.blacklist);
      await tx.symbolGroup.updateMany({
        where: {
          userId,
          marketUniverseId: updated.id,
        },
        data: {
          symbols: resolvedSymbols,
        },
      });
    }

    return updated;
  });
};

export const deleteUniverse = async (userId: string, id: string) => {
  const existing = await getUniverse(userId, id);
  if (!existing) return false;
  await assertUniverseNotUsedByActiveBot({ userId, marketUniverseId: existing.id });

  await prisma.$transaction(async (tx) => {
    const symbolGroups = await tx.symbolGroup.findMany({
      where: {
        userId,
        marketUniverseId: existing.id,
      },
      select: { id: true },
    });

    const symbolGroupIds = symbolGroups.map((group) => group.id);
    if (symbolGroupIds.length > 0) {
      await tx.marketGroupStrategyLink.deleteMany({
        where: {
          userId,
          botMarketGroup: {
            symbolGroupId: { in: symbolGroupIds },
          },
        },
      });

      await tx.botStrategy.deleteMany({
        where: {
          symbolGroupId: { in: symbolGroupIds },
          bot: { userId },
        },
      });

      await tx.botMarketGroup.deleteMany({
        where: {
          userId,
          symbolGroupId: { in: symbolGroupIds },
        },
      });

      await tx.symbolGroup.deleteMany({
        where: {
          userId,
          id: { in: symbolGroupIds },
        },
      });
    }

    await tx.marketUniverse.delete({
      where: { id: existing.id },
    });
  });

  return true;
};
