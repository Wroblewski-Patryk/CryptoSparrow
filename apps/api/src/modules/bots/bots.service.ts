import { Exchange } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { orchestrateAssistantDecision } from '../engine/assistantOrchestrator.service';
import { runtimePositionAutomationService } from '../engine/runtimePositionAutomation.service';
import { runtimePositionStateStore } from '../engine/runtimePositionState.store';
import { runtimeSignalLoop } from '../engine/runtimeSignalLoop.service';
import { runtimeTelemetryService } from '../engine/runtimeTelemetry.service';
import { getRuntimeTicker } from '../engine/runtimeTickerStore';
import { assertExchangeCapability } from '../exchange/exchangeCapabilities';
import { getMarketCatalog } from '../markets/markets.service';
import {
  parseStrategySignalRules,
} from '../engine/strategySignalEvaluator';
import {
  AssistantDryRunDto,
  CreateBotDto,
  CreateBotMarketGroupDto,
  ListBotsQueryDto,
  ListBotRuntimeSymbolStatsQueryDto,
  ListBotRuntimePositionsQueryDto,
  ListBotRuntimeTradesQueryDto,
  ReorderMarketGroupStrategiesDto,
  AttachMarketGroupStrategyDto,
  ListBotRuntimeSessionsQueryDto,
  UpsertBotAssistantConfigDto,
  UpsertBotSubagentConfigDto,
  UpdateBotDto,
  UpdateBotMarketGroupDto,
  UpdateMarketGroupStrategyDto,
} from './bots.types';
import {
  cleanupStaleRuntimePositionSerializationState,
  resolveDcaExecutedLevels,
  resolveRuntimePositionDynamicStops,
  TrailingStopDisplayLevel,
  TrailingTakeProfitDisplayLevel,
} from './runtimePositionSerialization.service';

type BotConsentState = {
  mode: 'PAPER' | 'LIVE';
  liveOptIn: boolean;
  consentTextVersion?: string | null;
};

const normalizeConsentTextVersion = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeKlineInterval = (value?: string | null) => {
  if (!value) return '1m';
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    '1 min': '1m',
    '3 min': '3m',
    '5 min': '5m',
    '10 min': '10m',
    '15 min': '15m',
    '30 min': '30m',
    '60 min': '1h',
  };
  return aliases[normalized] ?? normalized;
};

const klineFallbackCache = new Map<string, { fetchedAt: number; closes: number[] }>();
const KLINE_FALLBACK_TTL_MS = 10_000;
const tickerPriceFallbackCache = new Map<string, { fetchedAt: number; prices: Map<string, number> }>();
const TICKER_PRICE_FALLBACK_TTL_MS = 5_000;

const fetchFallbackKlineCloses = async (params: {
  marketType: 'FUTURES' | 'SPOT';
  symbol: string;
  interval: string;
  limit?: number;
}) => {
  if (process.env.NODE_ENV === 'test') return [];
  const normalizedInterval = normalizeKlineInterval(params.interval);
  const limit = Math.min(1000, Math.max(20, params.limit ?? 300));
  const cacheKey = `${params.marketType}|${params.symbol.toUpperCase()}|${normalizedInterval}|${limit}`;
  const now = Date.now();
  const cached = klineFallbackCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < KLINE_FALLBACK_TTL_MS) {
    return cached.closes;
  }

  const base =
    params.marketType === 'SPOT'
      ? process.env.BINANCE_SPOT_REST_URL ?? 'https://api.binance.com'
      : process.env.BINANCE_FUTURES_REST_URL ?? 'https://fapi.binance.com';
  const endpoint = params.marketType === 'SPOT' ? '/api/v3/klines' : '/fapi/v1/klines';
  const url = `${base}${endpoint}?symbol=${encodeURIComponent(
    params.symbol.toUpperCase()
  )}&interval=${encodeURIComponent(normalizedInterval)}&limit=${limit}`;

  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) return [];
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) return [];
    const now = Date.now();
    const closes = payload
      .map((row) => {
        if (!Array.isArray(row)) return Number.NaN;
        const close = Number(row[4]);
        const closeTime = Number(row[6]);
        if (Number.isFinite(closeTime) && closeTime > now) return Number.NaN;
        return close;
      })
      .filter((value): value is number => Number.isFinite(value));
    if (closes.length > 0) {
      klineFallbackCache.set(cacheKey, { fetchedAt: now, closes });
    }
    return closes;
  } catch {
    return [];
  }
};

const fetchFallbackTickerPrices = async (params: {
  marketType: 'FUTURES' | 'SPOT';
  symbols: string[];
}) => {
  if (process.env.NODE_ENV === 'test') return new Map<string, number>();
  const normalizedSymbols = normalizeSymbols(params.symbols);
  if (normalizedSymbols.length === 0) return new Map<string, number>();

  const cacheKey = params.marketType;
  const now = Date.now();
  const cached = tickerPriceFallbackCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < TICKER_PRICE_FALLBACK_TTL_MS) {
    const fromCache = normalizedSymbols
      .map((symbol) => [symbol, cached.prices.get(symbol)] as const)
      .filter((entry): entry is [string, number] => Number.isFinite(entry[1]));
    return new Map(fromCache);
  }

  const base =
    params.marketType === 'SPOT'
      ? process.env.BINANCE_SPOT_REST_URL ?? 'https://api.binance.com'
      : process.env.BINANCE_FUTURES_REST_URL ?? 'https://fapi.binance.com';
  const endpoint = params.marketType === 'SPOT' ? '/api/v3/ticker/price' : '/fapi/v1/ticker/price';
  const url = `${base}${endpoint}`;

  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) return new Map<string, number>();
    const payload = (await response.json()) as unknown;
    const allPrices = new Map<string, number>();
    const rows = Array.isArray(payload) ? payload : [payload];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const parsedRow = row as { symbol?: unknown; price?: unknown };
      if (typeof parsedRow.symbol !== 'string') continue;
      const symbol = parsedRow.symbol.trim().toUpperCase();
      if (!symbol) continue;
      const priceRaw =
        typeof parsedRow.price === 'number'
          ? parsedRow.price
          : typeof parsedRow.price === 'string'
            ? Number.parseFloat(parsedRow.price)
            : Number.NaN;
      if (!Number.isFinite(priceRaw) || priceRaw <= 0) continue;
      allPrices.set(symbol, priceRaw);
    }

    if (allPrices.size > 0) {
      tickerPriceFallbackCache.set(cacheKey, {
        fetchedAt: now,
        prices: allPrices,
      });
    }

    const selected = normalizedSymbols
      .map((symbol) => [symbol, allPrices.get(symbol)] as const)
      .filter((entry): entry is [string, number] => Number.isFinite(entry[1]));
    return new Map(selected);
  } catch {
    return new Map<string, number>();
  }
};

const validateLiveConsentState = (state: BotConsentState) => {
  if (state.liveOptIn && !normalizeConsentTextVersion(state.consentTextVersion)) {
    throw new Error('LIVE_CONSENT_VERSION_REQUIRED');
  }
};

const assertBotActivationExchangeCapability = (params: {
  exchange: Exchange;
  mode: 'PAPER' | 'LIVE';
}) => {
  if (params.mode === 'LIVE') {
    assertExchangeCapability(params.exchange, 'LIVE_EXECUTION');
    return;
  }
  assertExchangeCapability(params.exchange, 'PAPER_PRICING_FEED');
};

const mapBotResponse = <
  T extends {
    botStrategies: Array<{ strategyId: string; isEnabled: boolean }>;
    marketGroupStrategyLinks?: Array<{ strategyId: string; isEnabled: boolean }>;
  },
>(bot: T) => {
  const { botStrategies, marketGroupStrategyLinks = [], ...rest } = bot;
  const activeStrategy =
    botStrategies.find((item) => item.isEnabled) ??
    botStrategies[0] ??
    marketGroupStrategyLinks.find((item) => item.isEnabled) ??
    marketGroupStrategyLinks[0] ??
    null;
  return {
    ...rest,
    strategyId: activeStrategy?.strategyId ?? null,
  };
};

const getOrCreateDefaultSymbolGroup = async (userId: string, marketType: 'FUTURES' | 'SPOT') => {
  const existing = await prisma.symbolGroup.findFirst({
    where: {
      userId,
      marketUniverse: {
        marketType,
      },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) return existing.id;

  const baseCurrency = marketType === 'SPOT' ? 'USDT' : 'USDT';
  const universe = await prisma.marketUniverse.create({
    data: {
      userId,
      name: `Auto ${marketType} Universe`,
      marketType,
      baseCurrency,
      whitelist: [],
      blacklist: [],
    },
    select: { id: true },
  });

  const symbolGroup = await prisma.symbolGroup.create({
    data: {
      userId,
      marketUniverseId: universe.id,
      name: `Auto ${marketType} Group`,
      symbols: [],
    },
    select: { id: true },
  });

  return symbolGroup.id;
};

const upsertBotStrategy = async (params: {
  userId: string;
  botId: string;
  strategyId: string | null;
  marketType: 'FUTURES' | 'SPOT';
}) => {
  if (!params.strategyId) {
    await prisma.botStrategy.deleteMany({
      where: { botId: params.botId },
    });
    return;
  }

  const strategy = await prisma.strategy.findFirst({
    where: {
      id: params.strategyId,
      userId: params.userId,
    },
    select: { id: true },
  });

  if (!strategy) {
    throw new Error('BOT_STRATEGY_NOT_FOUND');
  }

  const symbolGroupId = await getOrCreateDefaultSymbolGroup(params.userId, params.marketType);

  await prisma.$transaction([
    prisma.botStrategy.deleteMany({
      where: { botId: params.botId },
    }),
    prisma.botStrategy.create({
      data: {
        botId: params.botId,
        strategyId: strategy.id,
        symbolGroupId,
        isEnabled: true,
      },
    }),
  ]);
};

const writeLiveConsentAudit = async (params: {
  userId: string;
  botId: string;
  mode: 'PAPER' | 'LIVE';
  liveOptIn: boolean;
  consentTextVersion: string;
  action: 'bot.live_consent.accepted' | 'bot.live_consent.updated';
}) => {
  try {
    await prisma.log.create({
      data: {
        userId: params.userId,
        botId: params.botId,
        action: params.action,
        level: 'INFO',
        source: 'bots.service',
        message: `LIVE consent recorded (${params.consentTextVersion})`,
        category: 'RISK_CONSENT',
        entityType: 'BOT',
        entityId: params.botId,
        metadata: {
          mode: params.mode,
          liveOptIn: params.liveOptIn,
          consentTextVersion: params.consentTextVersion,
        },
      },
    });
  } catch {
    // Audit failures should not block core bot updates.
  }
};

const getOwnedBot = async (userId: string, botId: string) =>
  prisma.bot.findFirst({
    where: { id: botId, userId },
    select: { id: true, marketType: true, exchange: true, apiKeyId: true },
  });

const getOwnedBotRuntimeSession = async (userId: string, botId: string, sessionId: string) =>
  prisma.botRuntimeSession.findFirst({
    where: {
      id: sessionId,
      userId,
      botId,
    },
  });

const resolveSessionWindowEnd = (session: {
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  finishedAt: Date | null;
  lastHeartbeatAt: Date | null;
  startedAt: Date;
}) => {
  if (session.finishedAt) return session.finishedAt;
  if (session.status === 'RUNNING') return new Date();
  return session.lastHeartbeatAt ?? session.startedAt;
};

const getOwnedSymbolGroup = async (userId: string, symbolGroupId: string) =>
  prisma.symbolGroup.findFirst({
    where: { id: symbolGroupId, userId },
    select: {
      id: true,
      marketUniverse: {
        select: { marketType: true, exchange: true },
      },
    },
  });

const getOwnedApiKey = async (userId: string, apiKeyId: string) =>
  prisma.apiKey.findFirst({
    where: { id: apiKeyId, userId },
    select: {
      id: true,
      exchange: true,
    },
  });

const findLatestApiKeyByExchange = async (userId: string, exchange: Exchange) =>
  prisma.apiKey.findFirst({
    where: {
      userId,
      exchange,
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      exchange: true,
    },
  });

const resolveCompatibleBotApiKey = async (params: {
  userId: string;
  exchange: Exchange;
  requestedApiKeyId?: string | null;
  requireForActivation: boolean;
}) => {
  if (params.requestedApiKeyId) {
    const apiKey = await getOwnedApiKey(params.userId, params.requestedApiKeyId);
    if (!apiKey) throw new Error('BOT_LIVE_API_KEY_NOT_FOUND');
    if (apiKey.exchange !== params.exchange) {
      throw new Error('BOT_LIVE_API_KEY_EXCHANGE_MISMATCH');
    }
    return apiKey.id;
  }

  if (!params.requireForActivation) return null;

  const latest = await findLatestApiKeyByExchange(params.userId, params.exchange);
  if (!latest) throw new Error('BOT_LIVE_API_KEY_NOT_FOUND');
  return latest.id;
};

const getOwnedMarketUniverse = async (userId: string, marketUniverseId: string) =>
  prisma.marketUniverse.findFirst({
    where: { id: marketUniverseId, userId },
    select: {
      id: true,
      name: true,
      exchange: true,
      marketType: true,
      whitelist: true,
      blacklist: true,
    },
  });

const normalizeSymbols = (symbols: string[]) =>
  [...new Set(symbols.map((item) => item.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

const resolveUniverseSymbols = (whitelist: string[], blacklist: string[]) => {
  const normalizedWhitelist = normalizeSymbols(whitelist);
  const blacklistSet = new Set(normalizeSymbols(blacklist));
  return normalizedWhitelist.filter((symbol) => !blacklistSet.has(symbol));
};

const resolveMinQuoteVolumeFilter = (filterRules: unknown) => {
  const parsedRules =
    filterRules && typeof filterRules === 'object'
      ? (filterRules as {
          minQuoteVolumeEnabled?: unknown;
          minQuoteVolume24h?: unknown;
          minVolume24h?: unknown;
        })
      : null;
  const enabled = parsedRules?.minQuoteVolumeEnabled === true;
  const minRaw = Number(parsedRules?.minQuoteVolume24h ?? parsedRules?.minVolume24h ?? 0);
  const min = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : 0;
  return { enabled, min };
};

const resolveCatalogSymbolsForUniverse = async (
  universe: {
    exchange: Exchange;
    marketType: 'FUTURES' | 'SPOT';
    baseCurrency: string;
    filterRules: unknown;
    blacklist: string[];
  },
  cache: Map<string, string[]>
) => {
  const volumeFilter = resolveMinQuoteVolumeFilter(universe.filterRules);
  const cacheKey = [
    universe.exchange,
    universe.marketType,
    universe.baseCurrency.toUpperCase(),
    volumeFilter.enabled ? '1' : '0',
    volumeFilter.min.toString(),
    normalizeSymbols(universe.blacklist).join(','),
  ].join('|');
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const catalog = await getMarketCatalog(
      universe.baseCurrency,
      universe.marketType,
      universe.exchange
    );
    const blacklistSet = new Set(normalizeSymbols(universe.blacklist));
    const symbols = normalizeSymbols(
      catalog.markets
        .filter((market) =>
          volumeFilter.enabled ? (market.quoteVolume24h ?? 0) >= volumeFilter.min : true
        )
        .map((market) => market.symbol)
    ).filter((symbol) => !blacklistSet.has(symbol));
    cache.set(cacheKey, symbols);
    return symbols;
  } catch {
    cache.set(cacheKey, []);
    return [];
  }
};

const resolveEffectiveSymbolGroupSymbols = (params: {
  symbols?: string[] | null;
  marketUniverse?: { whitelist?: string[] | null; blacklist?: string[] | null } | null;
}) => {
  const whitelist = params.marketUniverse?.whitelist;
  const blacklist = params.marketUniverse?.blacklist;
  if (Array.isArray(whitelist) && Array.isArray(blacklist)) {
    const universeSymbols = resolveUniverseSymbols(whitelist, blacklist);
    if (universeSymbols.length > 0) {
      return universeSymbols;
    }
  }
  return normalizeSymbols(params.symbols ?? []);
};

const resolveEffectiveSymbolGroupSymbolsWithCatalog = async (
  params: {
    symbols?: string[] | null;
    marketUniverse?: {
      exchange?: Exchange | null;
      marketType?: 'FUTURES' | 'SPOT' | null;
      baseCurrency?: string | null;
      filterRules?: unknown;
      whitelist?: string[] | null;
      blacklist?: string[] | null;
    } | null;
  },
  cache: Map<string, string[]>
) => {
  const directSymbols = resolveEffectiveSymbolGroupSymbols(params);
  if (directSymbols.length > 0) return directSymbols;

  const universe = params.marketUniverse;
  if (!universe?.exchange || !universe.marketType || !universe.baseCurrency) {
    return [];
  }

  return resolveCatalogSymbolsForUniverse(
    {
      exchange: universe.exchange,
      marketType: universe.marketType,
      baseCurrency: universe.baseCurrency,
      filterRules: universe.filterRules,
      blacklist: universe.blacklist ?? [],
    },
    cache
  );
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const hasAdvancedCloseMode = (config: unknown) => {
  const root = asRecord(config);
  const close = asRecord(root?.close);
  const mode = typeof close?.mode === 'string' ? close.mode.trim().toLowerCase() : null;
  return mode === 'advanced';
};

const resolveBotAdvancedCloseMode = async (userId: string, botId: string) => {
  const [groupLinks, legacyLinks] = await Promise.all([
    prisma.marketGroupStrategyLink.findMany({
      where: {
        isEnabled: true,
        botMarketGroup: {
          botId,
          userId,
        },
      },
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
      },
    }),
    prisma.botStrategy.findMany({
      where: {
        isEnabled: true,
        botId,
        bot: {
          userId,
        },
      },
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
      },
    }),
  ]);

  const configs = [
    ...groupLinks.map((item) => item.strategy.config),
    ...legacyLinks.map((item) => item.strategy.config),
  ];

  return configs.some((config) => hasAdvancedCloseMode(config));
};

const toFiniteInteger = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const resolveTrailingTakeProfitLevelsFromStrategyConfig = (
  config: unknown
): TrailingTakeProfitDisplayLevel[] => {
  const root = asRecord(config);
  const close = asRecord(root?.close);
  const mode = typeof close?.mode === 'string' ? close.mode.trim().toLowerCase() : null;
  if (mode !== 'advanced') return [];

  const rawLevels = Array.isArray(close?.ttp) ? close.ttp : [];
  return rawLevels
    .map((item) => asRecord(item))
    .map((item) => ({
      armPercent: Math.abs(Number(item?.percent)) / 100,
      trailPercent: Math.abs(Number(item?.arm)) / 100,
    }))
    .filter(
      (item) =>
        Number.isFinite(item.armPercent) &&
        Number.isFinite(item.trailPercent) &&
        item.armPercent > 0 &&
        item.trailPercent > 0
    )
    .sort((left, right) => left.armPercent - right.armPercent);
};

const resolveTrailingStopLevelsFromStrategyConfig = (
  config: unknown
): TrailingStopDisplayLevel[] => {
  const root = asRecord(config);
  const close = asRecord(root?.close);
  const mode = typeof close?.mode === 'string' ? close.mode.trim().toLowerCase() : null;
  if (mode !== 'advanced') return [];

  const rawLevels = Array.isArray(close?.tsl) ? close.tsl : [];
  return rawLevels
    .map((item) => asRecord(item))
    .map((item) => ({
      armPercent: Math.abs(Number(item?.arm)) / 100,
      trailPercent: Math.abs(Number(item?.percent)) / 100,
    }))
    .filter(
      (item) =>
        Number.isFinite(item.armPercent) &&
        Number.isFinite(item.trailPercent) &&
        item.armPercent > 0 &&
        item.trailPercent > 0
    )
    .sort((left, right) => left.armPercent - right.armPercent);
};

const resolveDcaPlannedLevelsFromStrategyConfig = (config: unknown): number[] => {
  const root = asRecord(config);
  const additional = asRecord(root?.additional);
  if (!additional) return [];

  const dcaEnabledRaw = additional.dcaEnabled;
  const dcaEnabled =
    typeof dcaEnabledRaw === 'boolean' ? dcaEnabledRaw : true;
  if (!dcaEnabled) return [];

  const dcaMode =
    typeof additional.dcaMode === 'string' && additional.dcaMode.trim().toLowerCase() === 'advanced'
      ? 'advanced'
      : 'basic';
  const dcaTimes = toFiniteInteger(additional.dcaTimes);
  const rawDcaLevels = Array.isArray(additional.dcaLevels) ? additional.dcaLevels : [];
  const parsedLevelPercents = rawDcaLevels
    .map((level) => asRecord(level))
    .map((level) => Number(level?.percent))
    .filter((level): level is number => Number.isFinite(level) && level !== 0);
  const primaryLevel = parsedLevelPercents[0] ?? null;

  if (dcaMode === 'advanced') {
    if (parsedLevelPercents.length > 0) {
      return dcaTimes > 0 ? parsedLevelPercents.slice(0, dcaTimes) : parsedLevelPercents;
    }
    if (dcaTimes > 0 && primaryLevel != null) {
      return Array.from({ length: dcaTimes }, () => primaryLevel);
    }
    return [];
  }

  const basicCount = dcaTimes > 0 ? dcaTimes : parsedLevelPercents.length > 0 ? 1 : 0;
  if (basicCount <= 0 || primaryLevel == null) return [];
  return Array.from({ length: basicCount }, () => primaryLevel);
};

const resolveBotDcaPlanBySymbol = async (userId: string, botId: string, symbols: string[]) => {
  const normalizedSymbols = normalizeSymbols(symbols);
  const dcaPlanBySymbol = new Map<string, number[]>();
  if (normalizedSymbols.length === 0) return dcaPlanBySymbol;

  const [groupLinks, legacyLinks] = await Promise.all([
    prisma.marketGroupStrategyLink.findMany({
      where: {
        isEnabled: true,
        botMarketGroup: {
          botId,
          userId,
          isEnabled: true,
          lifecycleStatus: {
            in: ['ACTIVE', 'PAUSED'],
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        botMarketGroup: {
          select: {
            symbolGroup: {
              select: {
                symbols: true,
                marketUniverse: {
                  select: {
                    whitelist: true,
                    blacklist: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.botStrategy.findMany({
      where: {
        isEnabled: true,
        botId,
        bot: {
          userId,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        symbolGroup: {
          select: {
            symbols: true,
            marketUniverse: {
              select: {
                exchange: true,
                marketType: true,
                baseCurrency: true,
                filterRules: true,
                whitelist: true,
                blacklist: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const assignPlanToSymbols = (targetSymbols: string[], config: unknown) => {
    const plannedLevels = resolveDcaPlannedLevelsFromStrategyConfig(config);
    for (const symbol of targetSymbols) {
      if (!normalizedSymbols.includes(symbol)) continue;
      if (!dcaPlanBySymbol.has(symbol)) {
        dcaPlanBySymbol.set(symbol, plannedLevels);
      }
    }
  };

  for (const link of groupLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.botMarketGroup.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignPlanToSymbols(targetSymbols, link.strategy.config);
  }

  for (const link of legacyLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignPlanToSymbols(targetSymbols, link.strategy.config);
  }

  return dcaPlanBySymbol;
};

const resolveBotTrailingStopLevelsBySymbol = async (
  userId: string,
  botId: string,
  symbols: string[]
) => {
  const normalizedSymbols = normalizeSymbols(symbols);
  const trailingLevelsBySymbol = new Map<string, TrailingStopDisplayLevel[]>();
  if (normalizedSymbols.length === 0) return trailingLevelsBySymbol;

  const [groupLinks, legacyLinks] = await Promise.all([
    prisma.marketGroupStrategyLink.findMany({
      where: {
        isEnabled: true,
        botMarketGroup: {
          botId,
          userId,
          isEnabled: true,
          lifecycleStatus: {
            in: ['ACTIVE', 'PAUSED'],
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        botMarketGroup: {
          select: {
            symbolGroup: {
              select: {
                symbols: true,
                marketUniverse: {
                  select: {
                    whitelist: true,
                    blacklist: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.botStrategy.findMany({
      where: {
        isEnabled: true,
        botId,
        bot: {
          userId,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        symbolGroup: {
          select: {
            symbols: true,
            marketUniverse: {
              select: {
                exchange: true,
                marketType: true,
                baseCurrency: true,
                filterRules: true,
                whitelist: true,
                blacklist: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const assignLevelsToSymbols = (targetSymbols: string[], config: unknown) => {
    const levels = resolveTrailingStopLevelsFromStrategyConfig(config);
    for (const symbol of targetSymbols) {
      if (!normalizedSymbols.includes(symbol)) continue;
      const existing = trailingLevelsBySymbol.get(symbol) ?? [];
      if (levels.length > 0 || existing.length === 0) {
        trailingLevelsBySymbol.set(symbol, levels);
      }
    }
  };

  for (const link of groupLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.botMarketGroup.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignLevelsToSymbols(targetSymbols, link.strategy.config);
  }

  for (const link of legacyLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignLevelsToSymbols(targetSymbols, link.strategy.config);
  }

  return trailingLevelsBySymbol;
};

const resolveBotTrailingTakeProfitLevelsBySymbol = async (
  userId: string,
  botId: string,
  symbols: string[]
) => {
  const normalizedSymbols = normalizeSymbols(symbols);
  const trailingLevelsBySymbol = new Map<string, TrailingTakeProfitDisplayLevel[]>();
  if (normalizedSymbols.length === 0) return trailingLevelsBySymbol;

  const [groupLinks, legacyLinks] = await Promise.all([
    prisma.marketGroupStrategyLink.findMany({
      where: {
        isEnabled: true,
        botMarketGroup: {
          botId,
          userId,
          isEnabled: true,
          lifecycleStatus: {
            in: ['ACTIVE', 'PAUSED'],
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        botMarketGroup: {
          select: {
            symbolGroup: {
              select: {
                symbols: true,
                marketUniverse: {
                  select: {
                    exchange: true,
                    marketType: true,
                    baseCurrency: true,
                    filterRules: true,
                    whitelist: true,
                    blacklist: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.botStrategy.findMany({
      where: {
        isEnabled: true,
        botId,
        bot: {
          userId,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        symbolGroup: {
          select: {
            symbols: true,
            marketUniverse: {
              select: {
                exchange: true,
                marketType: true,
                baseCurrency: true,
                filterRules: true,
                whitelist: true,
                blacklist: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const assignLevelsToSymbols = (targetSymbols: string[], config: unknown) => {
    const levels = resolveTrailingTakeProfitLevelsFromStrategyConfig(config);
    for (const symbol of targetSymbols) {
      if (!normalizedSymbols.includes(symbol)) continue;
      const existing = trailingLevelsBySymbol.get(symbol) ?? [];
      if (levels.length > 0 || existing.length === 0) {
        trailingLevelsBySymbol.set(symbol, levels);
      }
    }
  };

  for (const link of groupLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.botMarketGroup.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignLevelsToSymbols(targetSymbols, link.strategy.config);
  }

  for (const link of legacyLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignLevelsToSymbols(targetSymbols, link.strategy.config);
  }

  return trailingLevelsBySymbol;
};

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatSignalRule = (rule: {
  name: string;
  condition: string;
  value: number;
  params: Record<string, unknown>;
}) => {
  const indicator = rule.name.toUpperCase();
  if (indicator.includes('RSI')) {
    const period = toFiniteNumber(rule.params.period ?? rule.params.length) ?? 14;
    return `RSI(${Math.trunc(period)}) ${rule.condition} ${rule.value}`;
  }
  if (indicator.includes('MOMENTUM')) {
    const period = toFiniteNumber(rule.params.period ?? rule.params.length) ?? 14;
    return `MOMENTUM(${Math.trunc(period)}) ${rule.condition} ${rule.value}`;
  }
  if (indicator.includes('EMA')) {
    const fast = toFiniteNumber(rule.params.fast) ?? 9;
    const slow = toFiniteNumber(rule.params.slow) ?? 21;
    return `EMA(${Math.trunc(fast)}/${Math.trunc(slow)}) ${rule.condition}`;
  }
  return `${indicator} ${rule.condition} ${rule.value}`;
};

const buildSignalConditionSummary = (
  strategyConfig: Record<string, unknown> | null | undefined,
  direction: 'LONG' | 'SHORT' | 'EXIT' | null
) => {
  if (!strategyConfig) return null;
  const rules = parseStrategySignalRules(strategyConfig);
  if (!rules) return null;
  if (direction === 'EXIT') {
    return rules.noMatchAction === 'EXIT'
      ? 'No-match action: EXIT'
      : 'No-match action: HOLD';
  }
  if (direction === 'LONG' || direction === 'SHORT') {
    const source = direction === 'SHORT' ? rules.shortRules : rules.longRules;
    if (source.length === 0) return null;
    return source.map(formatSignalRule).join(' | ');
  }
  const longSummary =
    rules.longRules.length > 0 ? `LONG: ${rules.longRules.map(formatSignalRule).join(' & ')}` : null;
  const shortSummary =
    rules.shortRules.length > 0 ? `SHORT: ${rules.shortRules.map(formatSignalRule).join(' & ')}` : null;
  if (!longSummary && !shortSummary) return null;
  return [longSummary, shortSummary].filter((item): item is string => item != null).join(' | ');
};

const humanizeMergeReason = (reason: string | null) => {
  if (reason === 'weighted_winner') return 'Weighted winner';
  if (reason === 'exit_priority') return 'Exit priority';
  if (reason === 'weak_consensus') return 'Weak consensus';
  if (reason === 'tie') return 'Tie';
  if (reason === 'no_votes') return 'No votes';
  return reason;
};

const clampPeriod = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(2, Math.floor(parsed));
};

const computeEmaSeriesFromCloses = (closes: number[], period: number): Array<number | null> => {
  const alpha = 2 / (period + 1);
  let ema: number | null = null;
  const output: Array<number | null> = [];
  for (let index = 0; index < closes.length; index += 1) {
    const price = closes[index];
    if (!Number.isFinite(price)) {
      output.push(null);
      continue;
    }
    if (ema === null) ema = price;
    else ema = alpha * price + (1 - alpha) * ema;
    output.push(index + 1 >= period ? ema : null);
  }
  return output;
};

const computeRsiSeriesFromCloses = (closes: number[], period: number): Array<number | null> => {
  const output: Array<number | null> = Array.from({ length: closes.length }, () => null);
  if (closes.length <= period) return output;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = closes[index] - closes[index - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  output[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let index = period + 1; index < closes.length; index += 1) {
    const diff = closes[index] - closes[index - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    output[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return output;
};

const computeMomentumSeriesFromCloses = (closes: number[], period: number): Array<number | null> => {
  const output: Array<number | null> = [];
  for (let index = 0; index < closes.length; index += 1) {
    if (index < period) {
      output.push(null);
      continue;
    }
    output.push(closes[index] - closes[index - period]);
  }
  return output;
};

const formatIndicatorValue = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(4)).toString();
};

type SignalConditionLine = {
  scope: 'LONG' | 'SHORT';
  left: string;
  value: string;
  operator: string;
  right: string;
};

const parseSignalConditionLines = (value: unknown): SignalConditionLine[] | null => {
  if (!Array.isArray(value)) return null;
  const lines = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const scope = row.scope === 'LONG' || row.scope === 'SHORT' ? row.scope : null;
      const left = typeof row.left === 'string' ? row.left.trim() : '';
      const lineValue = typeof row.value === 'string' ? row.value.trim() : '';
      const operator = typeof row.operator === 'string' ? row.operator.trim() : '';
      const right = typeof row.right === 'string' ? row.right.trim() : '';
      if (!scope || !left || !operator || !right) return null;
      return {
        scope,
        left,
        value: lineValue.length > 0 ? lineValue : 'X',
        operator,
        right,
      } satisfies SignalConditionLine;
    })
    .filter((item): item is SignalConditionLine => Boolean(item));
  return lines.length > 0 ? lines : null;
};

const buildSignalConditionLines = (params: {
  strategyConfig: Record<string, unknown> | null | undefined;
  direction: 'LONG' | 'SHORT' | 'EXIT' | null;
  closes: number[];
}): SignalConditionLine[] | null => {
  if (!params.strategyConfig) return null;
  if (params.direction === 'EXIT') return null;
  const rules = parseStrategySignalRules(params.strategyConfig);
  if (!rules) return null;

  const latestIndex = params.closes.length > 0 ? params.closes.length - 1 : -1;
  const emaCache = new Map<number, Array<number | null>>();
  const rsiCache = new Map<number, Array<number | null>>();
  const momentumCache = new Map<number, Array<number | null>>();

  const ensureEma = (period: number) => {
    if (!emaCache.has(period)) {
      emaCache.set(period, computeEmaSeriesFromCloses(params.closes, period));
    }
    return emaCache.get(period)!;
  };
  const ensureRsi = (period: number) => {
    if (!rsiCache.has(period)) {
      rsiCache.set(period, computeRsiSeriesFromCloses(params.closes, period));
    }
    return rsiCache.get(period)!;
  };
  const ensureMomentum = (period: number) => {
    if (!momentumCache.has(period)) {
      momentumCache.set(period, computeMomentumSeriesFromCloses(params.closes, period));
    }
    return momentumCache.get(period)!;
  };

  const formatFixedTarget = (value: number) => Number(value.toFixed(6)).toString();
  const formatLive = (value: number | null | undefined) => formatIndicatorValue(value) ?? 'X';
  const buildLinesForScope = (
    scope: 'LONG' | 'SHORT',
    selectedRules: Array<{ name: string; condition: string; value: number; params: Record<string, unknown> }>
  ): SignalConditionLine[] => {
    const output: SignalConditionLine[] = [];
    for (const rule of selectedRules) {
      const indicator = rule.name.toUpperCase();
      if (indicator.includes('EMA')) {
        const fast = clampPeriod(rule.params.fast, 9);
        const slow = clampPeriod(rule.params.slow, 21);
        const fastValue = ensureEma(fast)[latestIndex];
        const slowValue = ensureEma(slow)[latestIndex];
        output.push({
          scope,
          left: `EMA(${fast})`,
          value: formatLive(fastValue),
          operator: rule.condition,
          right: `EMA(${slow})=${formatLive(slowValue)}`,
        });
        continue;
      }

      if (indicator.includes('RSI')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureRsi(period)[latestIndex];
        output.push({
          scope,
          left: `RSI(${period})`,
          value: formatLive(value),
          operator: rule.condition,
          right: formatFixedTarget(rule.value),
        });
        continue;
      }

      if (indicator.includes('MOMENTUM')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureMomentum(period)[latestIndex];
        output.push({
          scope,
          left: `MOMENTUM(${period})`,
          value: formatLive(value),
          operator: rule.condition,
          right: formatFixedTarget(rule.value),
        });
        continue;
      }

      output.push({
        scope,
        left: indicator,
        value: '-',
        operator: rule.condition,
        right: formatFixedTarget(rule.value),
      });
    }
    return output;
  };

  if (params.direction === 'LONG') {
    const lines = buildLinesForScope('LONG', rules.longRules);
    return lines.length > 0 ? lines : null;
  }
  if (params.direction === 'SHORT') {
    const lines = buildLinesForScope('SHORT', rules.shortRules);
    return lines.length > 0 ? lines : null;
  }
  const neutralLines = [
    ...buildLinesForScope('LONG', rules.longRules),
    ...buildLinesForScope('SHORT', rules.shortRules),
  ];
  return neutralLines.length > 0 ? neutralLines : null;
};

const buildSignalIndicatorSummary = (params: {
  strategyConfig: Record<string, unknown> | null | undefined;
  direction: 'LONG' | 'SHORT' | 'EXIT' | null;
  closes: number[];
}) => {
  if (!params.strategyConfig) return null;
  if (params.direction === 'EXIT') return null;

  const rules = parseStrategySignalRules(params.strategyConfig);
  if (!rules) return null;
  const selectedRules =
    params.direction === 'LONG'
      ? rules.longRules
      : params.direction === 'SHORT'
        ? rules.shortRules
        : [...rules.longRules, ...rules.shortRules];
  if (selectedRules.length === 0) return null;

  const parts: string[] = [];
  const latestIndex = params.closes.length > 0 ? params.closes.length - 1 : -1;
  const emaCache = new Map<number, Array<number | null>>();
  const seenEmaSeries = new Set<string>();
  const seenRsiPeriods = new Set<number>();
  const seenMomentumPeriods = new Set<number>();

  const ensureEmaSeries = (period: number) => {
    if (!emaCache.has(period)) {
      emaCache.set(period, computeEmaSeriesFromCloses(params.closes, period));
    }
    return emaCache.get(period)!;
  };

  for (const rule of selectedRules) {
    const indicator = rule.name.toUpperCase();

    if (indicator.includes('RSI')) {
      const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
      if (seenRsiPeriods.has(period)) continue;
      const series = computeRsiSeriesFromCloses(params.closes, period);
      const value = formatIndicatorValue(series[latestIndex]) ?? 'X';
      parts.push(`RSI(${period})=${value}`);
      seenRsiPeriods.add(period);
      continue;
    }

    if (indicator.includes('MOMENTUM')) {
      const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
      if (seenMomentumPeriods.has(period)) continue;
      const series = computeMomentumSeriesFromCloses(params.closes, period);
      const value = formatIndicatorValue(series[latestIndex]) ?? 'X';
      parts.push(`MOMENTUM(${period})=${value}`);
      seenMomentumPeriods.add(period);
      continue;
    }

    if (indicator.includes('EMA')) {
      const fast = clampPeriod(rule.params.fast, 9);
      const slow = clampPeriod(rule.params.slow, 21);
      const fastSeriesKey = `EMA_FAST_${fast}`;
      const slowSeriesKey = `EMA_SLOW_${slow}`;
      if (!seenEmaSeries.has(fastSeriesKey)) {
        const fastValue = formatIndicatorValue(ensureEmaSeries(fast)[latestIndex]) ?? 'X';
        parts.push(`EMA(${fast})=${fastValue}`);
        seenEmaSeries.add(fastSeriesKey);
      }
      if (!seenEmaSeries.has(slowSeriesKey)) {
        const slowValue = formatIndicatorValue(ensureEmaSeries(slow)[latestIndex]) ?? 'X';
        parts.push(`EMA(${slow})=${slowValue}`);
        seenEmaSeries.add(slowSeriesKey);
      }
      continue;
    }
  }

  return parts.length > 0 ? parts.join(' | ') : null;
};

const resolveCreateMarketGroupToSymbolGroup = async (userId: string, marketGroupId: string) => {
  const directSymbolGroup = await getOwnedSymbolGroup(userId, marketGroupId);
  if (directSymbolGroup) return directSymbolGroup;

  const marketUniverse = await getOwnedMarketUniverse(userId, marketGroupId);
  if (!marketUniverse) return null;

  const existingSymbolGroup = await prisma.symbolGroup.findFirst({
    where: {
      userId,
      marketUniverseId: marketUniverse.id,
    },
    select: {
      id: true,
      marketUniverse: {
        select: { marketType: true, exchange: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (existingSymbolGroup) return existingSymbolGroup;

  const normalizedWhitelist = normalizeSymbols(marketUniverse.whitelist);
  const blacklistSet = new Set(normalizeSymbols(marketUniverse.blacklist));
  const resolvedSymbols = normalizedWhitelist.filter((symbol) => !blacklistSet.has(symbol));

  return prisma.symbolGroup.create({
    data: {
      userId,
      marketUniverseId: marketUniverse.id,
      name: `${marketUniverse.name} Group`,
      symbols: resolvedSymbols,
    },
    select: {
      id: true,
      marketUniverse: {
        select: { marketType: true, exchange: true },
      },
    },
  });
};

const getOwnedStrategy = async (userId: string, strategyId: string) =>
  prisma.strategy.findFirst({
    where: { id: strategyId, userId },
    select: {
      id: true,
      config: true,
    },
  });

const deriveMaxOpenPositionsFromStrategy = (config: unknown) => {
  if (!config || typeof config !== 'object') return 1;

  const cfg = config as Record<string, unknown>;
  const candidates = [
    cfg.maxOpenPositions,
    (cfg.risk as Record<string, unknown> | undefined)?.maxOpenPositions,
    (cfg.open as Record<string, unknown> | undefined)?.maxOpenPositions,
    (cfg.position as Record<string, unknown> | undefined)?.maxOpenPositions,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return 1;
};

const findDuplicateActiveBotByStrategyAndSymbolGroup = async (params: {
  userId: string;
  strategyId: string;
  symbolGroupId: string;
  excludeBotId?: string;
}) =>
  prisma.marketGroupStrategyLink.findFirst({
    where: {
      userId: params.userId,
      strategyId: params.strategyId,
      isEnabled: true,
      bot: {
        userId: params.userId,
        isActive: true,
        ...(params.excludeBotId ? { id: { not: params.excludeBotId } } : {}),
      },
      botMarketGroup: {
        userId: params.userId,
        symbolGroupId: params.symbolGroupId,
        isEnabled: true,
        lifecycleStatus: 'ACTIVE',
      },
    },
    select: {
      bot: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

const assertNoDuplicateActiveBotByStrategyAndSymbolGroup = async (params: {
  userId: string;
  strategyId: string;
  symbolGroupId: string;
  excludeBotId?: string;
}) => {
  const duplicate = await findDuplicateActiveBotByStrategyAndSymbolGroup(params);
  if (duplicate?.bot) {
    throw new Error('ACTIVE_BOT_STRATEGY_MARKET_GROUP_DUPLICATE');
  }
};

const validateSymbolGroupForBot = async (params: {
  userId: string;
  botId: string;
  symbolGroupId: string;
}) => {
  const bot = await getOwnedBot(params.userId, params.botId);
  if (!bot) throw new Error('BOT_NOT_FOUND');

  const symbolGroup = await getOwnedSymbolGroup(params.userId, params.symbolGroupId);
  if (!symbolGroup) throw new Error('SYMBOL_GROUP_NOT_FOUND');

  if (symbolGroup.marketUniverse.marketType !== bot.marketType) {
    throw new Error('BOT_MARKET_GROUP_MARKET_TYPE_MISMATCH');
  }
  if (symbolGroup.marketUniverse.exchange !== bot.exchange) {
    throw new Error('BOT_MARKET_GROUP_EXCHANGE_MISMATCH');
  }
};

export const listBots = async (userId: string, query: ListBotsQueryDto = {}) => {
  const bots = await prisma.bot.findMany({
    where: {
      userId,
      ...(query.marketType ? { marketType: query.marketType } : {}),
    },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
      marketGroupStrategyLinks: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return bots.map((bot) => mapBotResponse(bot));
};

export const getBot = async (userId: string, id: string) => {
  const bot = await prisma.bot.findFirst({
    where: { id, userId },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
      marketGroupStrategyLinks: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
  });

  return bot ? mapBotResponse(bot) : null;
};

export const createBot = async (userId: string, data: CreateBotDto) => {
  validateLiveConsentState(data);

  const { strategyId, marketGroupId, apiKeyId, ...botData } = data;
  const strategy = await getOwnedStrategy(userId, strategyId);
  if (!strategy) throw new Error('BOT_STRATEGY_NOT_FOUND');

  const symbolGroup = await resolveCreateMarketGroupToSymbolGroup(userId, marketGroupId);
  if (!symbolGroup) throw new Error('SYMBOL_GROUP_NOT_FOUND');
  const derivedMarketType = symbolGroup.marketUniverse.marketType;
  const derivedExchange = symbolGroup.marketUniverse.exchange;
  const derivedMaxOpenPositions = deriveMaxOpenPositionsFromStrategy(strategy.config);
  if (botData.isActive) {
    assertBotActivationExchangeCapability({
      exchange: derivedExchange,
      mode: botData.mode,
    });
  }
  const resolvedApiKeyId = await resolveCompatibleBotApiKey({
    userId,
    exchange: derivedExchange,
    requestedApiKeyId: apiKeyId,
    requireForActivation: botData.mode === 'LIVE' && botData.isActive,
  });

  if (botData.isActive) {
    await assertNoDuplicateActiveBotByStrategyAndSymbolGroup({
      userId,
      strategyId,
      symbolGroupId: symbolGroup.id,
    });
  }

  const createdBotId = await prisma.$transaction(async (tx) => {
    const createdBot = await tx.bot.create({
      data: {
        userId,
        ...botData,
        apiKeyId: resolvedApiKeyId,
        exchange: derivedExchange,
        marketType: derivedMarketType,
        positionMode: 'ONE_WAY',
        maxOpenPositions: derivedMaxOpenPositions,
        consentTextVersion: botData.liveOptIn
          ? normalizeConsentTextVersion(botData.consentTextVersion)
          : null,
      },
      select: {
        id: true,
      },
    });

    const createdBotMarketGroup = await tx.botMarketGroup.create({
      data: {
        userId,
        botId: createdBot.id,
        symbolGroupId: symbolGroup.id,
        lifecycleStatus: 'ACTIVE',
        executionOrder: 100,
        maxOpenPositions: derivedMaxOpenPositions,
        isEnabled: true,
      },
      select: {
        id: true,
      },
    });

    await tx.marketGroupStrategyLink.create({
      data: {
        userId,
        botId: createdBot.id,
        botMarketGroupId: createdBotMarketGroup.id,
        strategyId,
        priority: 100,
        weight: 1,
        isEnabled: true,
      },
      select: {
        id: true,
      },
    });

    return createdBot.id;
  });

  if (botData.liveOptIn && botData.consentTextVersion) {
    await writeLiveConsentAudit({
      userId,
      botId: createdBotId,
      mode: botData.mode,
      liveOptIn: botData.liveOptIn,
      consentTextVersion: normalizeConsentTextVersion(botData.consentTextVersion)!,
      action: 'bot.live_consent.accepted',
    });
  }

  const withStrategy = await prisma.bot.findUnique({
    where: { id: createdBotId },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
      marketGroupStrategyLinks: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
  });

  if (!withStrategy) throw new Error('BOT_NOT_FOUND');
  return mapBotResponse(withStrategy);
};

export const updateBot = async (userId: string, id: string, data: UpdateBotDto) => {
  const existing = await getBot(userId, id);
  if (!existing) return null;

  const nextState: BotConsentState = {
    mode: data.mode ?? existing.mode,
    liveOptIn: data.liveOptIn ?? existing.liveOptIn,
    consentTextVersion:
      data.consentTextVersion !== undefined
        ? data.consentTextVersion
        : existing.consentTextVersion,
  };
  validateLiveConsentState(nextState);

  const nextConsentTextVersion = nextState.liveOptIn
    ? normalizeConsentTextVersion(nextState.consentTextVersion)
    : null;

  const strategyIdUpdateRequested = Object.prototype.hasOwnProperty.call(data, 'strategyId');
  const requestedStrategyId = strategyIdUpdateRequested ? (data.strategyId ?? null) : undefined;
  const marketGroupIdUpdateRequested = Object.prototype.hasOwnProperty.call(data, 'marketGroupId');
  const requestedMarketGroupId = marketGroupIdUpdateRequested ? (data.marketGroupId ?? null) : undefined;
  const apiKeyIdUpdateRequested = Object.prototype.hasOwnProperty.call(data, 'apiKeyId');
  const requestedApiKeyId = apiKeyIdUpdateRequested ? (data.apiKeyId ?? null) : undefined;
  const nextIsActive = data.isActive ?? existing.isActive;
  const nextMode = nextState.mode;
  let targetExchange = existing.exchange as Exchange;
  let targetMarketType = existing.marketType as 'FUTURES' | 'SPOT';

  if (requestedMarketGroupId) {
    const resolvedGroup = await resolveCreateMarketGroupToSymbolGroup(userId, requestedMarketGroupId);
    if (!resolvedGroup) throw new Error('SYMBOL_GROUP_NOT_FOUND');
    targetExchange = resolvedGroup.marketUniverse.exchange;
    targetMarketType = resolvedGroup.marketUniverse.marketType;
  }

  if (nextIsActive) {
    assertBotActivationExchangeCapability({
      exchange: targetExchange,
      mode: nextMode,
    });
  }

  if (nextIsActive) {
    const targetStrategyId = requestedStrategyId !== undefined ? requestedStrategyId : (existing.strategyId ?? null);
    if (targetStrategyId) {
      let targetSymbolGroupId: string | null = null;

      if (requestedMarketGroupId) {
        const resolvedGroup = await resolveCreateMarketGroupToSymbolGroup(userId, requestedMarketGroupId);
        if (!resolvedGroup) throw new Error('SYMBOL_GROUP_NOT_FOUND');
        targetSymbolGroupId = resolvedGroup.id;
      } else {
        const primaryGroup = await prisma.botMarketGroup.findFirst({
          where: {
            userId,
            botId: existing.id,
            isEnabled: true,
          },
          orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            symbolGroupId: true,
          },
        });
        targetSymbolGroupId = primaryGroup?.symbolGroupId ?? null;
      }

      if (targetSymbolGroupId) {
        await assertNoDuplicateActiveBotByStrategyAndSymbolGroup({
          userId,
          strategyId: targetStrategyId,
          symbolGroupId: targetSymbolGroupId,
          excludeBotId: existing.id,
        });
      }
    }
  }

  const shouldRequireLiveApiKey = nextMode === 'LIVE' && nextIsActive;
  let resolvedApiKeyId = existing.apiKeyId ?? null;
  if (shouldRequireLiveApiKey || apiKeyIdUpdateRequested) {
    const desiredApiKeyId =
      requestedApiKeyId !== undefined ? requestedApiKeyId : (existing.apiKeyId ?? null);
    resolvedApiKeyId = await resolveCompatibleBotApiKey({
      userId,
      exchange: targetExchange,
      requestedApiKeyId: desiredApiKeyId,
      requireForActivation: shouldRequireLiveApiKey,
    });
  }

  const {
    strategyId: _ignoredStrategyId,
    marketGroupId: _ignoredMarketGroupId,
    apiKeyId: _ignoredApiKeyId,
    ...botData
  } = data;
  const updated = await prisma.bot.update({
    where: { id: existing.id },
    data: {
      ...botData,
      exchange: targetExchange,
      marketType: targetMarketType,
      apiKeyId: resolvedApiKeyId,
      consentTextVersion: nextConsentTextVersion,
    },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
      marketGroupStrategyLinks: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
  });

  if (strategyIdUpdateRequested) {
    await upsertBotStrategy({
      userId,
      botId: updated.id,
      strategyId: requestedStrategyId ?? null,
      marketType: updated.marketType,
    });
  }

  if (updated.liveOptIn && updated.consentTextVersion) {
    const consentChanged = updated.consentTextVersion !== existing.consentTextVersion;
    const optInChanged = updated.liveOptIn !== existing.liveOptIn;
    if (consentChanged || optInChanged) {
      await writeLiveConsentAudit({
        userId,
        botId: updated.id,
        mode: updated.mode,
        liveOptIn: updated.liveOptIn,
        consentTextVersion: updated.consentTextVersion,
        action: optInChanged ? 'bot.live_consent.accepted' : 'bot.live_consent.updated',
      });
    }
  }

  if (existing.isActive && !updated.isActive) {
    await runtimeTelemetryService.closeRuntimeSession({
      botId: updated.id,
      status: 'CANCELED',
      stopReason: 'bot_deactivated',
    });
  }

  const withStrategy = await prisma.bot.findUnique({
    where: { id: updated.id },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
      marketGroupStrategyLinks: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
  });

  return withStrategy ? mapBotResponse(withStrategy) : mapBotResponse(updated);
};

export const deleteBot = async (userId: string, id: string) => {
  const existing = await getBot(userId, id);
  if (!existing) return false;

  if (existing.isActive) {
    await runtimeTelemetryService.closeRuntimeSession({
      botId: existing.id,
      status: 'CANCELED',
      stopReason: 'bot_deleted',
    });
  }

  await prisma.$transaction([
    prisma.position.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.order.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.trade.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.signal.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.log.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.orderFill.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.botRuntimeEvent.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botRuntimeSymbolStat.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botRuntimeSession.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.marketGroupStrategyLink.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botMarketGroup.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botStrategy.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botSubagentConfig.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botAssistantConfig.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.bot.delete({
      where: { id: existing.id },
    }),
  ]);

  return true;
};

export const listBotMarketGroups = async (userId: string, botId: string) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  return prisma.botMarketGroup.findMany({
    where: {
      userId,
      botId,
    },
    orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
  });
};

export const getBotMarketGroup = async (userId: string, botId: string, marketGroupId: string) => {
  return prisma.botMarketGroup.findFirst({
    where: {
      id: marketGroupId,
      userId,
      botId,
    },
  });
};

export const createBotMarketGroup = async (
  userId: string,
  botId: string,
  data: CreateBotMarketGroupDto
) => {
  await validateSymbolGroupForBot({ userId, botId, symbolGroupId: data.symbolGroupId });

  return prisma.botMarketGroup.create({
    data: {
      userId,
      botId,
      symbolGroupId: data.symbolGroupId,
      lifecycleStatus: data.lifecycleStatus,
      executionOrder: data.executionOrder,
      maxOpenPositions: data.maxOpenPositions,
      isEnabled: data.isEnabled,
    },
  });
};

export const updateBotMarketGroup = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  data: UpdateBotMarketGroupDto
) => {
  const existing = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!existing) return null;

  if (data.symbolGroupId) {
    await validateSymbolGroupForBot({ userId, botId, symbolGroupId: data.symbolGroupId });
  }

  return prisma.botMarketGroup.update({
    where: { id: existing.id },
    data: {
      ...(data.symbolGroupId ? { symbolGroupId: data.symbolGroupId } : {}),
      ...(data.lifecycleStatus ? { lifecycleStatus: data.lifecycleStatus } : {}),
      ...(data.executionOrder !== undefined ? { executionOrder: data.executionOrder } : {}),
      ...(data.maxOpenPositions !== undefined ? { maxOpenPositions: data.maxOpenPositions } : {}),
      ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
    },
  });
};

export const deleteBotMarketGroup = async (userId: string, botId: string, marketGroupId: string) => {
  const existing = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!existing) return false;

  await prisma.botMarketGroup.delete({
    where: { id: existing.id },
  });

  return true;
};

export const listMarketGroupStrategyLinks = async (userId: string, botId: string, marketGroupId: string) => {
  const group = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!group) return null;

  return prisma.marketGroupStrategyLink.findMany({
    where: {
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
};

export const attachMarketGroupStrategy = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  data: AttachMarketGroupStrategyDto
) => {
  const group = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!group) throw new Error('BOT_MARKET_GROUP_NOT_FOUND');

  const strategy = await getOwnedStrategy(userId, data.strategyId);
  if (!strategy) throw new Error('BOT_STRATEGY_NOT_FOUND');

  try {
    return prisma.marketGroupStrategyLink.create({
      data: {
        userId,
        botId,
        botMarketGroupId: marketGroupId,
        strategyId: data.strategyId,
        priority: data.priority,
        weight: data.weight,
        isEnabled: data.isEnabled,
      },
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new Error('MARKET_GROUP_STRATEGY_ALREADY_ATTACHED');
    }
    throw error;
  }
};

export const updateMarketGroupStrategy = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  linkId: string,
  data: UpdateMarketGroupStrategyDto
) => {
  const existing = await prisma.marketGroupStrategyLink.findFirst({
    where: {
      id: linkId,
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    select: { id: true },
  });

  if (!existing) return null;

  return prisma.marketGroupStrategyLink.update({
    where: { id: existing.id },
    data: {
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.weight !== undefined ? { weight: data.weight } : {}),
      ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
    },
  });
};

export const detachMarketGroupStrategy = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  linkId: string
) => {
  const existing = await prisma.marketGroupStrategyLink.findFirst({
    where: {
      id: linkId,
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    select: { id: true },
  });

  if (!existing) return false;

  await prisma.marketGroupStrategyLink.delete({
    where: { id: existing.id },
  });

  return true;
};

export const reorderMarketGroupStrategies = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  data: ReorderMarketGroupStrategiesDto
) => {
  const group = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!group) return null;

  const ids = data.items.map((item) => item.id);
  const existing = await prisma.marketGroupStrategyLink.findMany({
    where: {
      id: { in: ids },
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    select: { id: true },
  });

  if (existing.length !== ids.length) {
    throw new Error('MARKET_GROUP_STRATEGY_LINK_NOT_FOUND');
  }

  await prisma.$transaction(
    data.items.map((item) =>
      prisma.marketGroupStrategyLink.update({
        where: { id: item.id },
        data: { priority: item.priority },
      })
    )
  );

  return prisma.marketGroupStrategyLink.findMany({
    where: {
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
};

export const getBotRuntimeGraph = async (userId: string, botId: string) => {
  const bot = await prisma.bot.findFirst({
    where: { id: botId, userId },
    select: {
      id: true,
      userId: true,
      name: true,
      mode: true,
      marketType: true,
      positionMode: true,
      isActive: true,
      liveOptIn: true,
      maxOpenPositions: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!bot) return null;

  const marketGroups = await prisma.botMarketGroup.findMany({
    where: {
      userId,
      botId,
    },
    include: {
      symbolGroup: {
        select: {
          id: true,
          name: true,
          symbols: true,
          marketUniverseId: true,
        },
      },
      strategyLinks: {
        include: {
          strategy: {
            select: {
              id: true,
              name: true,
              interval: true,
            },
          },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const legacyBotStrategies = await prisma.botStrategy.findMany({
    where: { botId, bot: { userId } },
    include: {
      symbolGroup: {
        select: {
          id: true,
          name: true,
          symbols: true,
          marketUniverseId: true,
        },
      },
      strategy: {
        select: {
          id: true,
          name: true,
          interval: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  return {
    bot,
    marketGroups: marketGroups.map((group) => ({
      id: group.id,
      botId: group.botId,
      symbolGroupId: group.symbolGroupId,
      lifecycleStatus: group.lifecycleStatus,
      executionOrder: group.executionOrder,
      isEnabled: group.isEnabled,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      symbolGroup: group.symbolGroup,
      strategies: group.strategyLinks.map((link) => ({
        id: link.id,
        strategyId: link.strategyId,
        priority: link.priority,
        weight: link.weight,
        isEnabled: link.isEnabled,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
        strategy: link.strategy,
      })),
    })),
    legacyBotStrategies: legacyBotStrategies.map((item) => ({
      id: item.id,
      strategyId: item.strategyId,
      symbolGroupId: item.symbolGroupId,
      isEnabled: item.isEnabled,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      strategy: item.strategy,
      symbolGroup: item.symbolGroup,
    })),
  };
};

export const listBotRuntimeSessions = async (
  userId: string,
  botId: string,
  query: ListBotRuntimeSessionsQueryDto
) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  const sessions = await prisma.botRuntimeSession.findMany({
    where: {
      userId,
      botId,
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: [{ lastHeartbeatAt: 'desc' }, { startedAt: 'desc' }, { createdAt: 'desc' }],
    take: query.limit,
  });

  if (sessions.length === 0) return [];
  const sessionIds = sessions.map((session) => session.id);

  const [eventCounts, symbolCounts, symbolSums] = await Promise.all([
    prisma.botRuntimeEvent.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _count: { _all: true },
    }),
    prisma.botRuntimeSymbolStat.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _count: { _all: true },
    }),
    prisma.botRuntimeSymbolStat.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _sum: {
        totalSignals: true,
        dcaCount: true,
        closedTrades: true,
        realizedPnl: true,
      },
    }),
  ]);

  const eventCountMap = new Map(eventCounts.map((entry) => [entry.sessionId, entry._count._all]));
  const symbolCountMap = new Map(symbolCounts.map((entry) => [entry.sessionId, entry._count._all]));
  const symbolSumMap = new Map(
    symbolSums.map((entry) => [
      entry.sessionId,
      {
        totalSignals: entry._sum.totalSignals ?? 0,
        dcaCount: entry._sum.dcaCount ?? 0,
        closedTrades: entry._sum.closedTrades ?? 0,
        realizedPnl: entry._sum.realizedPnl ?? 0,
      },
    ])
  );

  return sessions.map((session) => {
    const summary = symbolSumMap.get(session.id) ?? {
      totalSignals: 0,
      dcaCount: 0,
      closedTrades: 0,
      realizedPnl: 0,
    };
    const windowEnd = resolveSessionWindowEnd(session);
    const durationMs = Math.max(0, windowEnd.getTime() - session.startedAt.getTime());

    return {
      id: session.id,
      botId: session.botId,
      mode: session.mode,
      status: session.status,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
      stopReason: session.stopReason,
      errorMessage: session.errorMessage,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      durationMs,
      eventsCount: eventCountMap.get(session.id) ?? 0,
      symbolsTracked: symbolCountMap.get(session.id) ?? 0,
      summary,
    };
  });
};

export const getBotRuntimeSession = async (userId: string, botId: string, sessionId: string) => {
  const session = await getOwnedBotRuntimeSession(userId, botId, sessionId);
  if (!session) return null;

  const [eventCount, symbolsTracked, symbolStatsAggregate] = await Promise.all([
    prisma.botRuntimeEvent.count({
      where: { sessionId: session.id },
    }),
    prisma.botRuntimeSymbolStat.count({
      where: { sessionId: session.id },
    }),
    prisma.botRuntimeSymbolStat.aggregate({
      where: { sessionId: session.id },
      _sum: {
        totalSignals: true,
        longEntries: true,
        shortEntries: true,
        exits: true,
        dcaCount: true,
        closedTrades: true,
        winningTrades: true,
        losingTrades: true,
        realizedPnl: true,
        grossProfit: true,
        grossLoss: true,
        feesPaid: true,
        openPositionCount: true,
        openPositionQty: true,
      },
    }),
  ]);

  const windowEnd = resolveSessionWindowEnd(session);
  const durationMs = Math.max(0, windowEnd.getTime() - session.startedAt.getTime());

  return {
    id: session.id,
    botId: session.botId,
    mode: session.mode,
    status: session.status,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    lastHeartbeatAt: session.lastHeartbeatAt,
    stopReason: session.stopReason,
    errorMessage: session.errorMessage,
    metadata: session.metadata,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    durationMs,
    eventsCount: eventCount,
    symbolsTracked,
    summary: {
      totalSignals: symbolStatsAggregate._sum.totalSignals ?? 0,
      longEntries: symbolStatsAggregate._sum.longEntries ?? 0,
      shortEntries: symbolStatsAggregate._sum.shortEntries ?? 0,
      exits: symbolStatsAggregate._sum.exits ?? 0,
      dcaCount: symbolStatsAggregate._sum.dcaCount ?? 0,
      closedTrades: symbolStatsAggregate._sum.closedTrades ?? 0,
      winningTrades: symbolStatsAggregate._sum.winningTrades ?? 0,
      losingTrades: symbolStatsAggregate._sum.losingTrades ?? 0,
      realizedPnl: symbolStatsAggregate._sum.realizedPnl ?? 0,
      grossProfit: symbolStatsAggregate._sum.grossProfit ?? 0,
      grossLoss: symbolStatsAggregate._sum.grossLoss ?? 0,
      feesPaid: symbolStatsAggregate._sum.feesPaid ?? 0,
      openPositionCount: symbolStatsAggregate._sum.openPositionCount ?? 0,
      openPositionQty: symbolStatsAggregate._sum.openPositionQty ?? 0,
    },
  };
};

export const listBotRuntimeSessionSymbolStats = async (
  userId: string,
  botId: string,
  sessionId: string,
  query: ListBotRuntimeSymbolStatsQueryDto
) => {
  const session = await getOwnedBotRuntimeSession(userId, botId, sessionId);
  if (!session) return null;

  const normalizedSymbol = query.symbol?.trim().toUpperCase();
  const where = {
    userId,
    botId,
    sessionId,
    ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
  };
  const windowEnd = resolveSessionWindowEnd(session);

  const [
    items,
    summary,
    configuredMarketGroups,
    configuredBotStrategies,
    configuredMarketGroupStrategyLinks,
    botMarketTypeRow,
  ] = await Promise.all([
    prisma.botRuntimeSymbolStat.findMany({
      where,
      orderBy: [{ realizedPnl: 'desc' }, { updatedAt: 'desc' }],
      take: query.limit,
    }),
    prisma.botRuntimeSymbolStat.aggregate({
      where,
      _sum: {
        totalSignals: true,
        longEntries: true,
        shortEntries: true,
        exits: true,
        dcaCount: true,
        closedTrades: true,
        winningTrades: true,
        losingTrades: true,
        realizedPnl: true,
        grossProfit: true,
        grossLoss: true,
        feesPaid: true,
      },
    }),
    prisma.botMarketGroup.findMany({
      where: {
        userId,
        botId,
        isEnabled: true,
        lifecycleStatus: {
          in: ['ACTIVE', 'PAUSED'],
        },
      },
      select: {
        symbolGroup: {
          select: {
            symbols: true,
            marketUniverse: {
              select: {
                exchange: true,
                marketType: true,
                baseCurrency: true,
                filterRules: true,
                whitelist: true,
                blacklist: true,
              },
            },
          },
        },
      },
      orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.botStrategy.findMany({
      where: {
        botId,
        isEnabled: true,
        bot: {
          userId,
        },
      },
      select: {
        strategyId: true,
        symbolGroup: {
          select: {
            symbols: true,
            marketUniverse: {
              select: {
                whitelist: true,
                blacklist: true,
              },
            },
          },
        },
        strategy: {
          select: {
            id: true,
            name: true,
            interval: true,
            config: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.marketGroupStrategyLink.findMany({
      where: {
        userId,
        botId,
        isEnabled: true,
        botMarketGroup: {
          lifecycleStatus: {
            in: ['ACTIVE', 'PAUSED'],
          },
          isEnabled: true,
        },
      },
      select: {
        strategyId: true,
        strategy: {
          select: {
            id: true,
            name: true,
            interval: true,
            config: true,
          },
        },
        botMarketGroup: {
          select: {
            symbolGroup: {
              select: {
                symbols: true,
                marketUniverse: {
                  select: {
                    exchange: true,
                    marketType: true,
                    baseCurrency: true,
                    filterRules: true,
                    whitelist: true,
                    blacklist: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.bot.findFirst({
      where: {
        id: botId,
        userId,
      },
      select: {
        marketType: true,
      },
    }),
  ]);
  const botMarketType = botMarketTypeRow?.marketType ?? 'FUTURES';

  const catalogSymbolsCache = new Map<string, string[]>();
  const [configuredMarketGroupSymbols, configuredBotStrategySymbols] = await Promise.all([
    Promise.all(
      configuredMarketGroups.map((group) =>
        resolveEffectiveSymbolGroupSymbolsWithCatalog(group.symbolGroup, catalogSymbolsCache)
      )
    ),
    Promise.all(
      configuredBotStrategies.map((strategy) =>
        resolveEffectiveSymbolGroupSymbolsWithCatalog(strategy.symbolGroup, catalogSymbolsCache)
      )
    ),
  ]);
  const configuredSymbols = normalizeSymbols(
    [...configuredMarketGroupSymbols.flat(), ...configuredBotStrategySymbols.flat()]
  );
  let symbols = (
    normalizedSymbol
      ? [normalizedSymbol]
      : normalizeSymbols([...configuredSymbols, ...items.map((item) => item.symbol)])
  ).slice(0, query.limit);
  if (!normalizedSymbol && symbols.length === 0) {
    const fallbackEventRows = await prisma.botRuntimeEvent.findMany({
      where: {
        userId,
        botId,
        sessionId,
        symbol: { not: null },
      },
      select: { symbol: true },
      orderBy: [{ eventAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.max(50, query.limit * 10),
    });
    symbols = normalizeSymbols(
      fallbackEventRows
        .map((row) => row.symbol)
        .filter((symbol): symbol is string => typeof symbol === 'string' && symbol.trim().length > 0)
    ).slice(0, query.limit);
  }
  const [openPositions, latestTradeBySymbolRows, latestSignalEvents] = symbols.length
    ? await Promise.all([
        prisma.position.findMany({
          where: {
            userId,
            botId,
            status: 'OPEN',
            managementMode: 'BOT_MANAGED',
            symbol: { in: symbols },
            openedAt: {
              gte: session.startedAt,
              lte: windowEnd,
            },
          },
          select: {
            symbol: true,
            side: true,
            entryPrice: true,
            quantity: true,
          },
        }),
        prisma.trade.groupBy({
          by: ['symbol'],
          where: {
            userId,
            botId,
            symbol: { in: symbols },
            executedAt: {
              gte: session.startedAt,
              lte: windowEnd,
            },
          },
          _max: {
            executedAt: true,
          },
        }),
        prisma.botRuntimeEvent.findMany({
          where: {
            sessionId,
            eventType: 'SIGNAL_DECISION',
            symbol: { in: symbols },
          },
          orderBy: [{ eventAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            symbol: true,
            signalDirection: true,
            eventAt: true,
            message: true,
            strategyId: true,
            payload: true,
          },
        }),
      ])
    : [[], [], []];

  const lastPriceBySymbol = new Map(items.map((item) => [item.symbol, item.lastPrice]));
  for (const symbol of symbols) {
    const ticker = getRuntimeTicker(symbol);
    if (ticker && Number.isFinite(ticker.lastPrice)) {
      lastPriceBySymbol.set(symbol, ticker.lastPrice);
    }
  }
  const latestTradeAtBySymbol = new Map(
    latestTradeBySymbolRows.map((row) => [row.symbol, row._max.executedAt ?? null])
  );
  const latestSignalBySymbol = new Map<
    string,
    {
      signalDirection: 'LONG' | 'SHORT' | 'EXIT' | null;
      eventAt: Date | null;
      message: string | null;
      mergeReason: string | null;
      strategyId: string | null;
      scoreLong: number | null;
      scoreShort: number | null;
      analysisByStrategy: Record<
        string,
        { conditionLines: SignalConditionLine[] | null; indicatorSummary: string | null }
      >;
    }
  >();
  const strategiesById = new Map<
    string,
    { name: string; interval: string; config: Record<string, unknown> | null }
  >();
  for (const configuredBotStrategy of configuredBotStrategies) {
    const strategy = configuredBotStrategy.strategy;
    if (!strategy) continue;
    strategiesById.set(strategy.id, {
      name: strategy.name,
      interval: strategy.interval,
      config: asRecord(strategy.config) ?? null,
    });
  }
  for (const configuredLink of configuredMarketGroupStrategyLinks) {
    const strategy = configuredLink.strategy;
    if (!strategy) continue;
    strategiesById.set(strategy.id, {
      name: strategy.name,
      interval: strategy.interval,
      config: asRecord(strategy.config) ?? null,
    });
  }
  const latestSignalStrategyIds = new Set<string>();
  for (const event of latestSignalEvents) {
    if (!event.symbol || latestSignalBySymbol.has(event.symbol)) continue;
    const payload = asRecord(event.payload);
    const merge = asRecord(payload?.merge);
    const scores = asRecord(merge?.scores);
    const winner = asRecord(merge?.winner);
    const analysis = asRecord(payload?.analysis);
    const byStrategy = asRecord(analysis?.byStrategy);
    const parsedAnalysisByStrategy: Record<
      string,
      { conditionLines: SignalConditionLine[] | null; indicatorSummary: string | null }
    > = {};
    if (byStrategy) {
      for (const [strategyKey, rawStats] of Object.entries(byStrategy)) {
        if (typeof strategyKey !== 'string' || strategyKey.trim().length === 0) continue;
        const strategyStats = asRecord(rawStats);
        if (!strategyStats) continue;
        parsedAnalysisByStrategy[strategyKey.trim()] = {
          conditionLines: parseSignalConditionLines(strategyStats.conditionLines),
          indicatorSummary:
            typeof strategyStats.indicatorSummary === 'string' && strategyStats.indicatorSummary.trim().length > 0
              ? strategyStats.indicatorSummary.trim()
              : null,
        };
      }
    }
    const mergeReasonRaw =
      typeof merge?.reason === 'string' && merge.reason.trim().length > 0
        ? merge.reason.trim()
        : null;
    const winnerStrategyId =
      typeof winner?.strategyId === 'string' && winner.strategyId.trim().length > 0
        ? winner.strategyId.trim()
        : null;
    const strategyId =
      (typeof event.strategyId === 'string' && event.strategyId.trim().length > 0
        ? event.strategyId.trim()
        : null) ??
      winnerStrategyId;
    if (strategyId) latestSignalStrategyIds.add(strategyId);
    latestSignalBySymbol.set(event.symbol, {
      signalDirection:
        event.signalDirection === 'LONG' ||
        event.signalDirection === 'SHORT' ||
        event.signalDirection === 'EXIT'
          ? event.signalDirection
          : null,
      eventAt: event.eventAt ?? null,
      message: event.message ?? null,
      mergeReason: humanizeMergeReason(mergeReasonRaw),
      strategyId,
      scoreLong: toFiniteNumber(scores?.longScore),
      scoreShort: toFiniteNumber(scores?.shortScore),
      analysisByStrategy: parsedAnalysisByStrategy,
    });
  }
  const missingStrategyIds = [...latestSignalStrategyIds].filter((strategyId) => !strategiesById.has(strategyId));
  if (missingStrategyIds.length > 0) {
    const signalStrategies = await prisma.strategy.findMany({
      where: {
        userId,
        id: { in: missingStrategyIds },
      },
      select: {
        id: true,
        name: true,
        interval: true,
        config: true,
      },
    });
    for (const strategy of signalStrategies) {
      strategiesById.set(strategy.id, {
        name: strategy.name,
        interval: strategy.interval,
        config: asRecord(strategy.config) ?? null,
      });
    }
  }

  const configuredStrategyBySymbol = new Map<string, string>();
  const configuredBotStrategySymbolsResolved = await Promise.all(
    configuredBotStrategies.map(async (configuredBotStrategy) => ({
      strategyId: configuredBotStrategy.strategyId?.trim() ?? '',
      symbols: await resolveEffectiveSymbolGroupSymbolsWithCatalog(
        configuredBotStrategy.symbolGroup,
        catalogSymbolsCache
      ),
    }))
  );
  for (const configuredBotStrategy of configuredBotStrategySymbolsResolved) {
    const strategyId = configuredBotStrategy.strategyId?.trim();
    if (!strategyId) continue;
    const assignedSymbols = configuredBotStrategy.symbols;
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : symbols;
    for (const symbol of targetSymbols) {
      if (!configuredStrategyBySymbol.has(symbol)) {
        configuredStrategyBySymbol.set(symbol, strategyId);
      }
    }
  }
  const configuredLinkSymbolsResolved = await Promise.all(
    configuredMarketGroupStrategyLinks.map(async (configuredLink) => ({
      strategyId: configuredLink.strategyId?.trim() ?? '',
      symbols: await resolveEffectiveSymbolGroupSymbolsWithCatalog(
        configuredLink.botMarketGroup.symbolGroup,
        catalogSymbolsCache
      ),
    }))
  );
  for (const configuredLink of configuredLinkSymbolsResolved) {
    const strategyId = configuredLink.strategyId?.trim();
    if (!strategyId) continue;
    const assignedSymbols = configuredLink.symbols;
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : symbols;
    for (const symbol of targetSymbols) {
      if (!configuredStrategyBySymbol.has(symbol)) {
        configuredStrategyBySymbol.set(symbol, strategyId);
      }
    }
  }
  if (configuredStrategyBySymbol.size === 0 && strategiesById.size > 0) {
    const [fallbackStrategyId] = [...strategiesById.keys()];
    for (const symbol of symbols) {
      if (!configuredStrategyBySymbol.has(symbol)) {
        configuredStrategyBySymbol.set(symbol, fallbackStrategyId);
      }
    }
  }

  const strategySeriesKeys = new Map<string, { symbol: string; interval: string }>();
  for (const symbol of symbols) {
    const latestSignal = latestSignalBySymbol.get(symbol);
    const strategyId = latestSignal?.strategyId ?? configuredStrategyBySymbol.get(symbol) ?? null;
    if (!strategyId) continue;
    const strategy = strategiesById.get(strategyId);
    if (!strategy?.interval) continue;
    const interval = strategy.interval.trim().toLowerCase();
    if (!interval) continue;
    const key = `${symbol}|${interval}`;
    strategySeriesKeys.set(key, { symbol, interval });
  }

  const candleClosesBySeries = new Map<string, number[]>();
  if (strategySeriesKeys.size > 0) {
    const entries = [...strategySeriesKeys.values()];
    const seriesRows = await Promise.all(
      entries.map(async ({ symbol, interval }) => {
        const inMemoryCloses = runtimeSignalLoop.getRecentCloses({
          marketType: botMarketType,
          symbol,
          interval,
          limit: 300,
        });
        if (inMemoryCloses.length > 0) {
          return {
            key: `${symbol}|${interval}`,
            closes: inMemoryCloses,
          };
        }

        const candles = await prisma.marketCandleCache.findMany({
          where: {
            marketType: botMarketType,
            symbol,
            timeframe: interval,
          },
          orderBy: [{ openTime: 'desc' }],
          take: 300,
          select: {
            close: true,
          },
        });
        return {
          key: `${symbol}|${interval}`,
          closes:
            candles
            .map((item) => item.close)
            .filter((value): value is number => Number.isFinite(value))
            .reverse(),
        };
      })
    );
    for (const row of seriesRows) {
      if (row.closes.length > 0) {
        candleClosesBySeries.set(row.key, row.closes);
        continue;
      }
      const [symbol, interval] = row.key.split('|');
      const fallbackCloses = await fetchFallbackKlineCloses({
        marketType: botMarketType,
        symbol,
        interval,
        limit: 300,
      });
      candleClosesBySeries.set(row.key, fallbackCloses);
    }
  }
  const openPositionCountBySymbol = new Map<string, number>();
  const openPositionQtyBySymbol = new Map<string, number>();
  const unrealizedPnlBySymbol = new Map<string, number>();

  for (const position of openPositions) {
    const lastPrice = lastPriceBySymbol.get(position.symbol);
    if (typeof lastPrice === 'number' && Number.isFinite(lastPrice)) {
      const sideMultiplier = position.side === 'LONG' ? 1 : -1;
      const pnl = (lastPrice - position.entryPrice) * position.quantity * sideMultiplier;
      unrealizedPnlBySymbol.set(
        position.symbol,
        (unrealizedPnlBySymbol.get(position.symbol) ?? 0) + pnl
      );
    }
    openPositionCountBySymbol.set(
      position.symbol,
      (openPositionCountBySymbol.get(position.symbol) ?? 0) + 1
    );
    openPositionQtyBySymbol.set(
      position.symbol,
      (openPositionQtyBySymbol.get(position.symbol) ?? 0) + position.quantity
    );
  }

  const statBySymbol = new Map(items.map((item) => [item.symbol, item]));
  const itemsWithLivePnl = symbols.map((symbol) => {
    const stat = statBySymbol.get(symbol) ?? null;
    const openCount = openPositionCountBySymbol.get(symbol);
    const openQty = openPositionQtyBySymbol.get(symbol);
    const unrealizedPnl = unrealizedPnlBySymbol.get(symbol) ?? 0;
    const latestSignal = latestSignalBySymbol.get(symbol);
    const lastPrice = lastPriceBySymbol.get(symbol) ?? null;
    const fallbackStrategyId = configuredStrategyBySymbol.get(symbol) ?? null;
    const signalStrategyId = latestSignal?.strategyId ?? fallbackStrategyId;
    const signalStrategy = signalStrategyId != null ? strategiesById.get(signalStrategyId) ?? null : null;
    const signalSeriesKey =
      signalStrategy?.interval != null ? `${symbol}|${signalStrategy.interval.trim().toLowerCase()}` : null;
    const signalCloses = signalSeriesKey ? candleClosesBySeries.get(signalSeriesKey) ?? [] : [];
    // Live checks should expose only runtime-decided signals (accepted decisions),
    // not directional preview inferred from latest candles.
    const effectiveSignalDirection = latestSignal?.signalDirection ?? null;
    const signalConditionSummary = buildSignalConditionSummary(
      signalStrategy?.config ?? null,
      effectiveSignalDirection
    );
    const signalAnalysis =
      signalStrategyId != null ? latestSignal?.analysisByStrategy?.[signalStrategyId] ?? null : null;
    const signalIndicatorSummary = buildSignalIndicatorSummary({
      strategyConfig: signalStrategy?.config ?? null,
      direction: effectiveSignalDirection,
      closes: signalCloses,
    });
    const signalConditionLines = buildSignalConditionLines({
      strategyConfig: signalStrategy?.config ?? null,
      direction: effectiveSignalDirection,
      closes: signalCloses,
    });
    const useComputedSignalValues =
      effectiveSignalDirection != null &&
      signalCloses.length > 0 &&
      signalAnalysis == null;
    const signalScoreSummary =
      latestSignal?.scoreLong != null || latestSignal?.scoreShort != null
        ? {
            longScore: latestSignal?.scoreLong ?? 0,
            shortScore: latestSignal?.scoreShort ?? 0,
          }
        : null;

    return {
      id: stat?.id ?? `virtual-${sessionId}-${symbol}`,
      userId,
      botId,
      sessionId,
      symbol,
      totalSignals: stat?.totalSignals ?? 0,
      longEntries: stat?.longEntries ?? 0,
      shortEntries: stat?.shortEntries ?? 0,
      exits: stat?.exits ?? 0,
      dcaCount: stat?.dcaCount ?? 0,
      closedTrades: stat?.closedTrades ?? 0,
      winningTrades: stat?.winningTrades ?? 0,
      losingTrades: stat?.losingTrades ?? 0,
      realizedPnl: stat?.realizedPnl ?? 0,
      grossProfit: stat?.grossProfit ?? 0,
      grossLoss: stat?.grossLoss ?? 0,
      feesPaid: stat?.feesPaid ?? 0,
      openPositionCount: openCount ?? stat?.openPositionCount ?? 0,
      openPositionQty: openQty ?? stat?.openPositionQty ?? 0,
      unrealizedPnl,
      lastPrice,
      lastSignalAt: stat?.lastSignalAt ?? null,
      lastTradeAt: stat?.lastTradeAt ?? latestTradeAtBySymbol.get(symbol) ?? null,
      lastSignalDirection: effectiveSignalDirection,
      lastSignalDecisionAt: latestSignal?.eventAt ?? stat?.lastSignalAt ?? null,
      lastSignalMessage: latestSignal?.message ?? null,
      lastSignalReason: latestSignal?.mergeReason ?? null,
      lastSignalStrategyId: latestSignal?.strategyId ?? null,
      lastSignalStrategyName: signalStrategy?.name ?? null,
      lastSignalConditionSummary: signalConditionSummary,
      lastSignalIndicatorSummary: useComputedSignalValues
        ? signalIndicatorSummary
        : signalAnalysis?.indicatorSummary ?? signalIndicatorSummary,
      lastSignalConditionLines: useComputedSignalValues
        ? signalConditionLines
        : signalAnalysis?.conditionLines ?? signalConditionLines,
      lastSignalScoreSummary: signalScoreSummary,
      snapshotAt: stat?.snapshotAt ?? session.startedAt,
      createdAt: stat?.createdAt ?? session.createdAt,
      updatedAt: stat?.updatedAt ?? session.updatedAt,
    };
  });

  const summaryUnrealizedPnl = itemsWithLivePnl.reduce(
    (acc, item) => acc + (Number.isFinite(item.unrealizedPnl) ? item.unrealizedPnl : 0),
    0
  );
  const summaryOpenPositionCount = itemsWithLivePnl.reduce((acc, item) => acc + item.openPositionCount, 0);
  const summaryOpenPositionQty = itemsWithLivePnl.reduce((acc, item) => acc + item.openPositionQty, 0);
  const summaryRealizedPnl = summary._sum.realizedPnl ?? 0;

  return {
    sessionId,
    items: itemsWithLivePnl,
    summary: {
      totalSignals: summary._sum.totalSignals ?? 0,
      longEntries: summary._sum.longEntries ?? 0,
      shortEntries: summary._sum.shortEntries ?? 0,
      exits: summary._sum.exits ?? 0,
      dcaCount: summary._sum.dcaCount ?? 0,
      closedTrades: summary._sum.closedTrades ?? 0,
      winningTrades: summary._sum.winningTrades ?? 0,
      losingTrades: summary._sum.losingTrades ?? 0,
      realizedPnl: summaryRealizedPnl,
      unrealizedPnl: summaryUnrealizedPnl,
      totalPnl: summaryRealizedPnl + summaryUnrealizedPnl,
      grossProfit: summary._sum.grossProfit ?? 0,
      grossLoss: summary._sum.grossLoss ?? 0,
      feesPaid: summary._sum.feesPaid ?? 0,
      openPositionCount: summaryOpenPositionCount,
      openPositionQty: summaryOpenPositionQty,
    },
  };
};

export const listBotRuntimeSessionTrades = async (
  userId: string,
  botId: string,
  sessionId: string,
  query: ListBotRuntimeTradesQueryDto
) => {
  type RuntimeTradeActionReason =
    | 'SIGNAL_ENTRY'
    | 'DCA_LEVEL'
    | 'TAKE_PROFIT'
    | 'STOP_LOSS'
    | 'TRAILING_TAKE_PROFIT'
    | 'TRAILING_STOP'
    | 'SIGNAL_EXIT'
    | 'MANUAL'
    | 'UNKNOWN';
  const normalizeCloseReason = (value: unknown): RuntimeTradeActionReason | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'take_profit') return 'TAKE_PROFIT';
    if (normalized === 'stop_loss') return 'STOP_LOSS';
    if (normalized === 'trailing_take_profit') return 'TRAILING_TAKE_PROFIT';
    if (normalized === 'trailing_stop') return 'TRAILING_STOP';
    if (normalized === 'signal_exit') return 'SIGNAL_EXIT';
    if (normalized === 'manual') return 'MANUAL';
    return null;
  };

  const session = await getOwnedBotRuntimeSession(userId, botId, sessionId);
  if (!session) return null;

  const normalizedSymbol = query.symbol?.trim().toUpperCase();
  const normalizedSide = query.side?.trim().toUpperCase() as 'BUY' | 'SELL' | undefined;
  const normalizedAction = query.action?.trim().toUpperCase() as
    | 'OPEN'
    | 'DCA'
    | 'CLOSE'
    | 'UNKNOWN'
    | undefined;
  const isLegacyLimitOnly =
    query.limit != null &&
    query.page == null &&
    query.pageSize == null &&
    query.sortBy == null &&
    query.sortDir == null &&
    query.side == null &&
    query.action == null &&
    query.from == null &&
    query.to == null;
  const page = isLegacyLimitOnly ? 1 : Math.max(1, query.page ?? 1);
  const pageSize = Math.min(
    200,
    Math.max(1, isLegacyLimitOnly ? query.limit : (query.pageSize ?? query.limit ?? 50))
  );
  const sortBy = query.sortBy ?? 'executedAt';
  const sortDir = query.sortDir ?? 'desc';
  const windowEnd = resolveSessionWindowEnd(session);
  const rangeStart = query.from ? new Date(Math.max(query.from.getTime(), session.startedAt.getTime())) : session.startedAt;
  const rangeEnd = query.to ? new Date(Math.min(query.to.getTime(), windowEnd.getTime())) : windowEnd;
  if (rangeStart.getTime() > rangeEnd.getTime()) {
    return {
      sessionId,
      total: 0,
      meta: {
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        hasPrev: page > 1,
        hasNext: false,
      },
      window: {
        startedAt: session.startedAt,
        finishedAt: windowEnd,
      },
      items: [],
    };
  }
  const windowClause = {
    executedAt: {
      gte: rangeStart,
      lte: rangeEnd,
    },
  };

  const carryOverPositionIds =
    session.status === 'RUNNING' && !query.from && !query.to
      ? (
          await prisma.position.findMany({
            where: {
              userId,
              botId,
              managementMode: 'BOT_MANAGED',
              ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
              openedAt: {
                lte: windowEnd,
              },
              OR: [{ closedAt: null }, { closedAt: { gte: session.startedAt } }],
            },
            select: {
              id: true,
            },
          })
        ).map((position) => position.id)
      : [];

  const where = {
    userId,
    botId,
    ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
    ...(normalizedSide ? { side: normalizedSide } : {}),
    OR:
      carryOverPositionIds.length > 0
        ? [windowClause, { positionId: { in: carryOverPositionIds } }]
        : [windowClause],
  };

  const rows = await prisma.trade.findMany({
    where,
    select: {
      id: true,
      symbol: true,
      side: true,
      lifecycleAction: true,
      price: true,
      quantity: true,
      fee: true,
      feeSource: true,
      feePending: true,
      feeCurrency: true,
      realizedPnl: true,
      executedAt: true,
      createdAt: true,
      orderId: true,
      positionId: true,
      strategyId: true,
      origin: true,
      managementMode: true,
    },
  });
  const closeEventRows = await prisma.botRuntimeEvent.findMany({
    where: {
      userId,
      botId,
      sessionId,
      eventType: 'POSITION_CLOSED',
      eventAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
      ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
    },
    select: {
      eventAt: true,
      payload: true,
    },
    orderBy: [{ eventAt: 'desc' }],
  });

  const closeReasonByOrderId = new Map<string, { reason: RuntimeTradeActionReason; eventAt: number }>();
  const closeReasonByPositionId = new Map<string, { reason: RuntimeTradeActionReason; eventAt: number }>();
  for (const row of closeEventRows) {
    const payload = asRecord(row.payload);
    const reason = normalizeCloseReason(payload?.reason);
    if (!reason) continue;
    const eventAtTs = row.eventAt.getTime();
    const orderId = typeof payload?.orderId === 'string' ? payload.orderId : null;
    const positionId = typeof payload?.positionId === 'string' ? payload.positionId : null;
    if (orderId) {
      const current = closeReasonByOrderId.get(orderId);
      if (!current || eventAtTs >= current.eventAt) {
        closeReasonByOrderId.set(orderId, { reason, eventAt: eventAtTs });
      }
    }
    if (positionId) {
      const current = closeReasonByPositionId.get(positionId);
      if (!current || eventAtTs >= current.eventAt) {
        closeReasonByPositionId.set(positionId, { reason, eventAt: eventAtTs });
      }
    }
  }

  const positionIds = [
    ...new Set(rows.map((trade) => trade.positionId).filter((value): value is string => Boolean(value))),
  ];

  const positionMetaById = new Map<string, { side: 'LONG' | 'SHORT'; leverage: number; entryPrice: number }>();
  const lifecycleActionByTradeId = new Map<string, 'OPEN' | 'DCA' | 'CLOSE' | 'UNKNOWN'>();

  if (positionIds.length > 0) {
    const [positionMetaRows, allPositionTrades] = await Promise.all([
      prisma.position.findMany({
        where: {
          id: { in: positionIds },
          userId,
        },
        select: {
          id: true,
          side: true,
          leverage: true,
          entryPrice: true,
        },
      }),
      prisma.trade.findMany({
        where: {
          userId,
          botId,
          positionId: {
            in: positionIds,
          },
        },
        orderBy: [{ executedAt: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          positionId: true,
          side: true,
        },
      }),
    ]);

    for (const row of positionMetaRows) {
      positionMetaById.set(row.id, {
        side: row.side,
        leverage: row.leverage,
        entryPrice: row.entryPrice,
      });
    }

    const tradesByPosition = new Map<string, Array<{ id: string; side: 'BUY' | 'SELL' }>>();
    for (const trade of allPositionTrades) {
      if (!trade.positionId) continue;
      const bucket = tradesByPosition.get(trade.positionId) ?? [];
      bucket.push({
        id: trade.id,
        side: trade.side,
      });
      tradesByPosition.set(trade.positionId, bucket);
    }

    for (const [positionId, trades] of tradesByPosition.entries()) {
      const positionMeta = positionMetaById.get(positionId);
      if (!positionMeta) continue;
      const entrySide: 'BUY' | 'SELL' = positionMeta.side === 'LONG' ? 'BUY' : 'SELL';
      let entryLegs = 0;
      for (const trade of trades) {
        if (trade.side === entrySide) {
          lifecycleActionByTradeId.set(trade.id, entryLegs === 0 ? 'OPEN' : 'DCA');
          entryLegs += 1;
          continue;
        }
        lifecycleActionByTradeId.set(trade.id, 'CLOSE');
      }
    }
  }

  const enrichedRows = rows
    .map((trade) => {
      const notional = trade.price * trade.quantity;
      const positionMeta = positionMetaById.get(trade.positionId ?? '');
      const leverage = positionMeta?.leverage ?? 1;
      const effectiveLeverage = Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
      const inferredLifecycleAction =
        trade.lifecycleAction && trade.lifecycleAction !== 'UNKNOWN'
          ? trade.lifecycleAction
          : lifecycleActionByTradeId.get(trade.id) ?? 'UNKNOWN';
      const actionReason: RuntimeTradeActionReason =
        inferredLifecycleAction === 'OPEN'
          ? 'SIGNAL_ENTRY'
          : inferredLifecycleAction === 'DCA'
            ? 'DCA_LEVEL'
            : inferredLifecycleAction === 'CLOSE'
            ? closeReasonByOrderId.get(trade.orderId ?? '')?.reason ??
                closeReasonByPositionId.get(trade.positionId ?? '')?.reason ??
                (trade.managementMode === 'MANUAL_MANAGED' ? 'MANUAL' : 'UNKNOWN')
              : 'UNKNOWN';
      const marginNotional =
        inferredLifecycleAction === 'CLOSE' && positionMeta
          ? positionMeta.entryPrice * trade.quantity
          : notional;

      return {
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        price: trade.price,
        quantity: trade.quantity,
        fee: trade.fee ?? 0,
        feeSource: trade.feeSource,
        feePending: trade.feePending,
        feeCurrency: trade.feeCurrency ?? null,
        realizedPnl: trade.realizedPnl ?? 0,
        executedAt: trade.executedAt,
        createdAt: trade.createdAt,
        orderId: trade.orderId,
        positionId: trade.positionId,
        strategyId: trade.strategyId,
        origin: trade.origin,
        managementMode: trade.managementMode,
        lifecycleAction: inferredLifecycleAction,
        actionReason,
        notional,
        margin: marginNotional / effectiveLeverage,
      };
    })
    .filter((trade) => (normalizedAction ? trade.lifecycleAction === normalizedAction : true));

  const primaryCompare = (
    left: (typeof enrichedRows)[number],
    right: (typeof enrichedRows)[number]
  ) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const compareNumbers = (a: number, b: number) => (a === b ? 0 : a > b ? 1 : -1) * dir;
    const compareStrings = (a: string, b: string) => a.localeCompare(b) * dir;
    switch (sortBy) {
      case 'symbol':
        return compareStrings(left.symbol, right.symbol);
      case 'side':
        return compareStrings(left.side, right.side);
      case 'lifecycleAction':
        return compareStrings(left.lifecycleAction, right.lifecycleAction);
      case 'margin':
        return compareNumbers(left.margin, right.margin);
      case 'fee':
        return compareNumbers(left.fee, right.fee);
      case 'realizedPnl':
        return compareNumbers(left.realizedPnl, right.realizedPnl);
      case 'executedAt':
      default:
        return compareNumbers(left.executedAt.getTime(), right.executedAt.getTime());
    }
  };

  const sortedRows = [...enrichedRows].sort((left, right) => {
    const first = primaryCompare(left, right);
    if (first !== 0) return first;
    const byExecuted = right.executedAt.getTime() - left.executedAt.getTime();
    if (byExecuted !== 0) return byExecuted;
    const byCreated = right.createdAt.getTime() - left.createdAt.getTime();
    if (byCreated !== 0) return byCreated;
    return right.id.localeCompare(left.id);
  });

  const total = sortedRows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const pagedRows = sortedRows.slice(offset, offset + pageSize);

  return {
    sessionId,
    total,
    meta: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      hasPrev: safePage > 1 && totalPages > 0,
      hasNext: safePage < totalPages,
    },
    window: {
      startedAt: session.startedAt,
      finishedAt: windowEnd,
    },
    items: pagedRows.map((trade) => {
      const { createdAt: _createdAt, ...rest } = trade;
      return rest;
    }),
  };
};

export const listBotRuntimeSessionPositions = async (
  userId: string,
  botId: string,
  sessionId: string,
  query: ListBotRuntimePositionsQueryDto
) => {
  const session = await getOwnedBotRuntimeSession(userId, botId, sessionId);
  if (!session) return null;
  const showDynamicStopColumns = await resolveBotAdvancedCloseMode(userId, botId);

  const normalizedSymbol = query.symbol?.trim().toUpperCase();
  const windowEnd = resolveSessionWindowEnd(session);

  const positions = await prisma.position.findMany({
    where: {
      userId,
      botId,
      managementMode: 'BOT_MANAGED',
      ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
      openedAt: {
        lte: windowEnd,
      },
      OR: [{ closedAt: null }, { closedAt: { gte: session.startedAt } }],
    },
    orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
    take: query.limit,
    select: {
      id: true,
      symbol: true,
      side: true,
      status: true,
      entryPrice: true,
      quantity: true,
      leverage: true,
      stopLoss: true,
      takeProfit: true,
      openedAt: true,
      closedAt: true,
      realizedPnl: true,
      unrealizedPnl: true,
    },
  });

  if (positions.length === 0) {
    const openOrders = await prisma.order.findMany({
      where: {
        userId,
        botId,
        managementMode: 'BOT_MANAGED',
        status: {
          in: ['PENDING', 'OPEN', 'PARTIALLY_FILLED'],
        },
        ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
        createdAt: {
          gte: session.startedAt,
          lte: windowEnd,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
      take: query.limit,
      select: {
        id: true,
        symbol: true,
        side: true,
        type: true,
        status: true,
        quantity: true,
        filledQuantity: true,
        price: true,
        stopPrice: true,
        submittedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      sessionId,
      total: 0,
      openCount: 0,
      closedCount: 0,
      openOrdersCount: openOrders.length,
      showDynamicStopColumns,
      window: {
        startedAt: session.startedAt,
        finishedAt: windowEnd,
      },
      summary: {
        realizedPnl: 0,
        unrealizedPnl: 0,
        feesPaid: 0,
      },
      openOrders: openOrders,
      openItems: [],
      historyItems: [],
    };
  }

  const positionIds = positions.map((position) => position.id);
  const symbols = [...new Set(positions.map((position) => position.symbol))];
  const [dcaPlanBySymbol, trailingStopLevelsBySymbol, trailingTakeProfitLevelsBySymbol, persistedRuntimeStatesByPositionId] = await Promise.all([
    resolveBotDcaPlanBySymbol(userId, botId, symbols),
    resolveBotTrailingStopLevelsBySymbol(userId, botId, symbols),
    resolveBotTrailingTakeProfitLevelsBySymbol(userId, botId, symbols),
    runtimePositionStateStore.getPositionRuntimeStates(positionIds),
  ]);

  const [trades, lastSymbolPrices, openOrders] = await Promise.all([
    prisma.trade.findMany({
      where: {
        userId,
        botId,
        positionId: { in: positionIds },
      },
      orderBy: [{ executedAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        positionId: true,
        side: true,
        price: true,
        quantity: true,
        fee: true,
        realizedPnl: true,
        executedAt: true,
      },
    }),
    prisma.botRuntimeSymbolStat.findMany({
      where: {
        sessionId,
        symbol: { in: symbols },
      },
      select: {
        symbol: true,
        lastPrice: true,
      },
    }),
    prisma.order.findMany({
      where: {
        userId,
        botId,
        managementMode: 'BOT_MANAGED',
        status: {
          in: ['PENDING', 'OPEN', 'PARTIALLY_FILLED'],
        },
        ...(normalizedSymbol ? { symbol: normalizedSymbol } : {}),
        createdAt: {
          gte: session.startedAt,
          lte: windowEnd,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
      take: query.limit,
      select: {
        id: true,
        symbol: true,
        side: true,
        type: true,
        status: true,
        quantity: true,
        filledQuantity: true,
        price: true,
        stopPrice: true,
        submittedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const tradesByPosition = new Map<string, typeof trades>();
  for (const trade of trades) {
    if (!trade.positionId) continue;
    const bucket = tradesByPosition.get(trade.positionId) ?? [];
    bucket.push(trade);
    tradesByPosition.set(trade.positionId, bucket);
  }

  const lastPriceBySymbol = new Map(
    lastSymbolPrices.map((row) => [row.symbol, row.lastPrice])
  );
  for (const symbol of symbols) {
    const ticker = getRuntimeTicker(symbol);
    if (ticker && Number.isFinite(ticker.lastPrice)) {
      lastPriceBySymbol.set(symbol, ticker.lastPrice);
    }
  }
  const missingPriceSymbols = symbols.filter((symbol) => {
    const current = lastPriceBySymbol.get(symbol);
    return !Number.isFinite(current) || (current as number) <= 0;
  });
  if (missingPriceSymbols.length > 0) {
    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId },
      select: { exchange: true, marketType: true },
    });
    if (bot?.exchange === 'BINANCE') {
      const fallbackPrices = await fetchFallbackTickerPrices({
        marketType: bot.marketType === 'SPOT' ? 'SPOT' : 'FUTURES',
        symbols: missingPriceSymbols,
      });
      for (const [symbol, price] of fallbackPrices) {
        if (Number.isFinite(price) && price > 0) {
          lastPriceBySymbol.set(symbol, price);
        }
      }
    }
  }

  const nowTs = Date.now();
  cleanupStaleRuntimePositionSerializationState(nowTs);

  const mappedPositions = positions.map((position) => {
    const positionTrades = tradesByPosition.get(position.id) ?? [];
    const entrySide = position.side === 'LONG' ? 'BUY' : 'SELL';
    const entryLegs = positionTrades.filter((trade) => trade.side === entrySide);
    const exitLegs = positionTrades.filter((trade) => trade.side !== entrySide);

    const feesPaid = positionTrades.reduce((acc, trade) => acc + (trade.fee ?? 0), 0);
    const tradeRealizedPnl = positionTrades.reduce((acc, trade) => acc + (trade.realizedPnl ?? 0), 0);
    const entryTrade = entryLegs[0] ?? positionTrades[0] ?? null;
    const exitTrade = exitLegs.at(-1) ?? (position.status === 'CLOSED' ? positionTrades.at(-1) ?? null : null);
    const dcaCount = Math.max(0, entryLegs.length - 1);
    const dcaPlannedLevels = dcaPlanBySymbol.get(position.symbol) ?? [];
    const trailingStopLevels = trailingStopLevelsBySymbol.get(position.symbol) ?? [];
    const trailingTakeProfitLevels = trailingTakeProfitLevelsBySymbol.get(position.symbol) ?? [];
    const dcaExecutedLevels = resolveDcaExecutedLevels(dcaCount, dcaPlannedLevels);

    const marketPrice = lastPriceBySymbol.get(position.symbol);
    const runtimeState =
      runtimePositionAutomationService.getPositionStateSnapshot(position.id) ??
      persistedRuntimeStatesByPositionId.get(position.id) ??
      null;
    const stateEntryPrice =
      runtimeState && Number.isFinite(runtimeState.averageEntryPrice) && runtimeState.averageEntryPrice > 0
        ? runtimeState.averageEntryPrice
        : position.entryPrice;
    const {
      dynamicTtpStopLoss,
      dynamicTslStopLoss,
      liveUnrealizedPnl,
    } = resolveRuntimePositionDynamicStops({
      positionId: position.id,
      positionStatus: position.status,
      positionSide: position.side,
      entryPrice: position.entryPrice,
      quantity: position.quantity,
      leverage: position.leverage,
      unrealizedPnl: position.unrealizedPnl ?? null,
      marketPrice,
      stateEntryPrice,
      runtimeState,
      trailingStopLevels,
      trailingTakeProfitLevels,
      nowTs,
    });

    const holdUntil = position.closedAt ?? windowEnd;
    const holdMs = Math.max(0, holdUntil.getTime() - position.openedAt.getTime());

    return {
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      status: position.status,
      quantity: position.quantity,
      leverage: position.leverage,
      entryPrice: position.entryPrice,
      entryNotional: position.entryPrice * position.quantity,
      exitPrice: exitTrade?.price ?? null,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      openedAt: position.openedAt,
      closedAt: position.closedAt,
      holdMs,
      dcaCount,
      dcaPlannedLevels,
      dcaExecutedLevels,
      trailingStopLevels,
      trailingTakeProfitLevels,
      feesPaid,
      realizedPnl: position.realizedPnl ?? tradeRealizedPnl ?? 0,
      unrealizedPnl: liveUnrealizedPnl ?? position.unrealizedPnl ?? null,
      markPrice: typeof marketPrice === 'number' && Number.isFinite(marketPrice) ? marketPrice : null,
      dynamicTtpStopLoss,
      dynamicTslStopLoss,
      firstTradeAt: entryTrade?.executedAt ?? null,
      lastTradeAt: positionTrades.at(-1)?.executedAt ?? null,
      tradesCount: positionTrades.length,
    };
  });

  const openItems = mappedPositions
    .filter((position) => position.status === 'OPEN')
    .sort((left, right) => right.openedAt.getTime() - left.openedAt.getTime());
  const historyItems = mappedPositions
    .filter((position) => position.status === 'CLOSED')
    .sort((left, right) => (right.closedAt?.getTime() ?? 0) - (left.closedAt?.getTime() ?? 0));

  return {
    sessionId,
    total: mappedPositions.length,
    openCount: openItems.length,
    closedCount: historyItems.length,
    openOrdersCount: openOrders.length,
    showDynamicStopColumns,
    window: {
      startedAt: session.startedAt,
      finishedAt: windowEnd,
    },
    summary: {
      realizedPnl: mappedPositions.reduce((acc, position) => acc + (position.realizedPnl ?? 0), 0),
      unrealizedPnl: openItems.reduce((acc, position) => acc + (position.unrealizedPnl ?? 0), 0),
      feesPaid: mappedPositions.reduce((acc, position) => acc + position.feesPaid, 0),
    },
    openOrders,
    openItems,
    historyItems,
  };
};

export const getBotAssistantConfig = async (userId: string, botId: string) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  const assistant = await prisma.botAssistantConfig.findUnique({
    where: { botId },
  });
  const subagents = await prisma.botSubagentConfig.findMany({
    where: { userId, botId },
    orderBy: { slotIndex: 'asc' },
  });

  return { assistant, subagents };
};

export const upsertBotAssistantConfig = async (
  userId: string,
  botId: string,
  data: UpsertBotAssistantConfigDto
) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  return prisma.botAssistantConfig.upsert({
    where: { botId },
    update: {
      mainAgentEnabled: data.mainAgentEnabled,
      mandate: data.mandate ?? null,
      modelProfile: data.modelProfile,
      safetyMode: data.safetyMode,
      maxDecisionLatencyMs: data.maxDecisionLatencyMs,
    },
    create: {
      userId,
      botId,
      mainAgentEnabled: data.mainAgentEnabled,
      mandate: data.mandate ?? null,
      modelProfile: data.modelProfile,
      safetyMode: data.safetyMode,
      maxDecisionLatencyMs: data.maxDecisionLatencyMs,
    },
  });
};

export const upsertBotSubagentConfig = async (
  userId: string,
  botId: string,
  slotIndex: number,
  data: UpsertBotSubagentConfigDto
) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;
  if (slotIndex < 1 || slotIndex > 4) throw new Error('SUBAGENT_SLOT_OUT_OF_RANGE');

  return prisma.botSubagentConfig.upsert({
    where: {
      botId_slotIndex: {
        botId,
        slotIndex,
      },
    },
    update: {
      role: data.role,
      enabled: data.enabled,
      modelProfile: data.modelProfile,
      timeoutMs: data.timeoutMs,
      safetyMode: data.safetyMode,
    },
    create: {
      userId,
      botId,
      slotIndex,
      role: data.role,
      enabled: data.enabled,
      modelProfile: data.modelProfile,
      timeoutMs: data.timeoutMs,
      safetyMode: data.safetyMode,
    },
  });
};

export const deleteBotSubagentConfig = async (userId: string, botId: string, slotIndex: number) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return false;
  if (slotIndex < 1 || slotIndex > 4) throw new Error('SUBAGENT_SLOT_OUT_OF_RANGE');

  const existing = await prisma.botSubagentConfig.findUnique({
    where: {
      botId_slotIndex: {
        botId,
        slotIndex,
      },
    },
  });

  if (!existing || existing.userId !== userId) return false;

  await prisma.botSubagentConfig.delete({
    where: {
      botId_slotIndex: {
        botId,
        slotIndex,
      },
    },
  });

  return true;
};

export const runAssistantDryRun = async (userId: string, botId: string, input: AssistantDryRunDto) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  const assistantConfig = await prisma.botAssistantConfig.findUnique({
    where: { botId },
    select: {
      mandate: true,
      safetyMode: true,
    },
  });

  const subagents = await prisma.botSubagentConfig.findMany({
    where: { userId, botId },
    orderBy: { slotIndex: 'asc' },
  });

  return orchestrateAssistantDecision({
    requestId: `dryrun:${Date.now()}:${botId}`,
    userId,
    botId,
    botMarketGroupId: 'dry-run',
    symbol: input.symbol.toUpperCase(),
    intervalWindow: input.intervalWindow,
    mode: input.mode,
    mandate: assistantConfig?.mandate ?? null,
    forbiddenActions:
      assistantConfig?.safetyMode === 'STRICT' ? ['SHORT'] : undefined,
    subagents: subagents.map((slot) => ({
      slotIndex: slot.slotIndex,
      role: slot.role,
      enabled: slot.enabled,
      timeoutMs: slot.timeoutMs,
    })),
  });
};
