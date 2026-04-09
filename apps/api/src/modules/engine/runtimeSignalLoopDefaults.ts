import { Exchange, SignalDirection } from '@prisma/client';
import { CandlePatternParams } from './sharedCandlePatternSeries';
import { computeRiskBasedOrderQuantity, normalizeWalletRiskPercent } from './positionSizing';
import { supportsExchangeCapability } from '../exchange/exchangeCapabilities';
import { getMarketCatalog } from '../markets/markets.service';
import {
  countOpenPositionsForBotAndSymbolsRaw,
  createRuntimeSignalRecord,
  listActiveRuntimeBotsRaw,
  listRuntimeManagedExternalPositionsRaw,
} from './runtimeSignalLoop.repository';

export type ActiveBotStrategy = {
  strategyId: string;
  strategyInterval: string | null;
  strategyConfig: Record<string, unknown> | null;
  strategyLeverage: number;
  walletRisk: number;
  priority: number;
  weight: number;
};

export type ActiveBotMarketGroup = {
  id: string;
  symbolGroupId: string;
  executionOrder: number;
  maxOpenPositions: number;
  symbols: string[];
  strategies: ActiveBotStrategy[];
};

export type ActiveBot = {
  id: string;
  userId: string;
  walletId: string | null;
  mode: 'PAPER' | 'LIVE';
  exchange: Exchange;
  paperStartBalance: number;
  marketType: 'FUTURES' | 'SPOT';
  marketGroups: ActiveBotMarketGroup[];
};

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

const toPositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

const extractStrategyMaxOpenPositions = (
  strategyConfig: Record<string, unknown> | null | undefined
) => {
  if (!strategyConfig || typeof strategyConfig !== 'object') return null;
  const additional =
    strategyConfig.additional && typeof strategyConfig.additional === 'object'
      ? (strategyConfig.additional as Record<string, unknown>)
      : null;
  if (!additional) return null;
  return toPositiveInteger(additional.maxPositions ?? additional.maxOpenPositions);
};

export const deriveRuntimeGroupMaxOpenPositions = (input: {
  configuredGroupMaxOpenPositions: number;
  strategies: Array<{ strategyConfig: Record<string, unknown> | null }>;
}) => {
  const strategyCaps = input.strategies
    .map((strategy) => extractStrategyMaxOpenPositions(strategy.strategyConfig))
    .filter((value): value is number => Number.isFinite(value as number) && (value as number) > 0);

  if (strategyCaps.length > 0) {
    return Math.max(1, Math.min(...strategyCaps));
  }

  return toPositiveInteger(input.configuredGroupMaxOpenPositions) ?? 1;
};

export const supportsRuntimeSignalLoopExchange = (bot: Pick<ActiveBot, 'exchange' | 'mode'>) =>
  supportsExchangeCapability(
    bot.exchange,
    bot.mode === 'LIVE' ? 'LIVE_EXECUTION' : 'PAPER_PRICING_FEED'
  );

export const listActiveRuntimeBots = async (): Promise<ActiveBot[]> => {
  const bots = await listActiveRuntimeBotsRaw();
  const activeBots = bots.filter(supportsRuntimeSignalLoopExchange);
  const catalogSymbolsCache = new Map<string, string[]>();

  return Promise.all(
    activeBots.map(async (bot) => {
      const marketGroupsFromNewModel: ActiveBotMarketGroup[] = [];
      for (const group of bot.botMarketGroups) {
        const strategies = group.strategyLinks.map((link) => ({
          strategyId: link.strategyId,
          strategyInterval: link.strategy.interval,
          strategyConfig: (link.strategy.config as Record<string, unknown> | undefined) ?? null,
          strategyLeverage: link.strategy.leverage,
          walletRisk: normalizeWalletRiskPercent(link.strategy.walletRisk, 1),
          priority: link.priority,
          weight: link.weight,
        }));

        const symbolGroupSymbols = normalizeSymbols(group.symbolGroup.symbols ?? []);
        const universeSymbols = group.symbolGroup.marketUniverse
          ? resolveUniverseSymbols(
              group.symbolGroup.marketUniverse.whitelist ?? [],
              group.symbolGroup.marketUniverse.blacklist ?? []
            )
          : [];
        const catalogFallbackSymbols =
          group.symbolGroup.marketUniverse &&
          symbolGroupSymbols.length === 0 &&
          universeSymbols.length === 0
            ? await resolveCatalogSymbolsForUniverse(
                {
                  exchange: group.symbolGroup.marketUniverse.exchange,
                  marketType: group.symbolGroup.marketUniverse.marketType,
                  baseCurrency: group.symbolGroup.marketUniverse.baseCurrency,
                  filterRules: group.symbolGroup.marketUniverse.filterRules,
                  blacklist: group.symbolGroup.marketUniverse.blacklist ?? [],
                },
                catalogSymbolsCache
              )
            : [];
        const symbols =
          universeSymbols.length > 0
            ? universeSymbols
            : symbolGroupSymbols.length > 0
              ? symbolGroupSymbols
              : catalogFallbackSymbols;

        marketGroupsFromNewModel.push({
          id: group.id,
          symbolGroupId: group.symbolGroupId,
          executionOrder: group.executionOrder,
          maxOpenPositions: deriveRuntimeGroupMaxOpenPositions({
            configuredGroupMaxOpenPositions: group.maxOpenPositions,
            strategies,
          }),
          symbols,
          strategies,
        });
      }

      return {
        id: bot.id,
        userId: bot.userId,
        walletId: bot.walletId ?? null,
        mode: bot.mode as 'PAPER' | 'LIVE',
        exchange: bot.exchange,
        paperStartBalance: Number.isFinite(bot.paperStartBalance) ? Math.max(0, bot.paperStartBalance) : 10_000,
        marketType: bot.marketType,
        marketGroups: [...marketGroupsFromNewModel].sort(
          (left, right) => left.executionOrder - right.executionOrder
        ),
      };
    })
  );
};

export const listRuntimeManagedExternalPositions = async () => {
  const positions = await listRuntimeManagedExternalPositionsRaw();
  return positions.map((position) => ({
    userId: position.userId,
    symbol: position.symbol,
  }));
};

export const countOpenPositionsForBotAndSymbols = async ({
  userId,
  botId,
  symbols,
}: {
  userId: string;
  botId: string;
  symbols: string[];
}) => {
  const normalizedSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  return countOpenPositionsForBotAndSymbolsRaw({
    userId,
    botId,
    normalizedSymbols,
  });
};

export const createRuntimeSignal = async (params: {
  userId: string;
  botId?: string;
  strategyId?: string;
  symbol: string;
  direction: SignalDirection;
  confidence: number;
  payload: Record<string, unknown>;
}) => {
  await createRuntimeSignalRecord(params);
};

export const resolveRuntimeOrderQuantity = (input: {
  strategy: ActiveBotStrategy | undefined;
  price: number;
  marketType: 'FUTURES' | 'SPOT';
  referenceBalance: number;
  runtimeSignalQuantity: number;
}) => {
  const strategy = input.strategy;
  if (!strategy) return input.runtimeSignalQuantity;
  return computeRiskBasedOrderQuantity({
    price: input.price,
    walletRiskPercent: strategy.walletRisk,
    referenceBalance: input.referenceBalance,
    leverage: input.marketType === 'SPOT' ? 1 : Math.max(1, strategy.strategyLeverage),
    minQuantity: input.runtimeSignalQuantity,
  });
};

export const normalizeInterval = (value?: string | null) => {
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

export const formatIndicatorValue = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return 'X';
  return Number(value.toFixed(4)).toString();
};

export const formatRuleTarget = (value: number) => Number(value.toFixed(6)).toString();

export const resolvePatternParams = (params: Record<string, unknown>): CandlePatternParams => {
  const asFinite = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const dojiBodyToRangeMax = asFinite(params.dojiBodyToRangeMax ?? params.bodyToRangeMax);
  const hammerBodyToRangeMax = asFinite(params.hammerBodyToRangeMax);
  const hammerLowerShadowToBodyMin = asFinite(params.hammerLowerShadowToBodyMin);
  const hammerUpperShadowToBodyMax = asFinite(params.hammerUpperShadowToBodyMax);
  const shootingStarBodyToRangeMax = asFinite(params.shootingStarBodyToRangeMax);
  const shootingStarUpperShadowToBodyMin = asFinite(params.shootingStarUpperShadowToBodyMin);
  const shootingStarLowerShadowToBodyMax = asFinite(params.shootingStarLowerShadowToBodyMax);

  return {
    ...(dojiBodyToRangeMax !== null ? { dojiBodyToRangeMax } : {}),
    ...(hammerBodyToRangeMax !== null ? { hammerBodyToRangeMax } : {}),
    ...(hammerLowerShadowToBodyMin !== null ? { hammerLowerShadowToBodyMin } : {}),
    ...(hammerUpperShadowToBodyMax !== null ? { hammerUpperShadowToBodyMax } : {}),
    ...(shootingStarBodyToRangeMax !== null ? { shootingStarBodyToRangeMax } : {}),
    ...(shootingStarUpperShadowToBodyMin !== null ? { shootingStarUpperShadowToBodyMin } : {}),
    ...(shootingStarLowerShadowToBodyMax !== null ? { shootingStarLowerShadowToBodyMax } : {}),
  };
};
