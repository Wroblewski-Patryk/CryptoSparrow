import { BinanceMarketStreamWorker } from '../modules/market-stream/binanceStream.service';
import { publishMarketStreamEvent } from '../modules/market-stream/marketStreamFanout';
import { prisma } from '../prisma/client';
import { bootstrapWorker } from './workerBootstrap';
import { normalizeSymbol, normalizeSymbols, resolveUniverseSymbols } from '../lib/symbols';
import { resolveCatalogSymbolsForUniverse } from '../modules/markets/marketCatalogSymbolResolver.service';
import { createModuleLogger } from '../lib/logger';

const logger = createModuleLogger('market-stream.bootstrap');

const parseCsv = (value: string | undefined, fallback: string[]) => {
  const items = value
    ?.split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items && items.length > 0 ? items : fallback;
};

const parseRefreshMs = (value: string | undefined, fallbackMs: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return parsed;
};

const normalizeInterval = (value: string | null | undefined) => {
  if (!value) return null;
  return value.trim().toLowerCase();
};

const allowEmptyGroupCatalogFallback =
  process.env.MARKET_STREAM_ALLOW_EMPTY_GROUP_CATALOG_FALLBACK === 'true';

type StreamSubscriptions = {
  symbols: string[];
  candleIntervals: string[];
};

const marketType = process.env.MARKET_STREAM_MARKET_TYPE === 'SPOT' ? 'SPOT' : 'FUTURES';
const envSymbols = parseCsv(process.env.MARKET_STREAM_SYMBOLS, ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']);
const envIntervals = parseCsv(process.env.MARKET_STREAM_INTERVALS, ['1m', '5m']).map((interval) =>
  interval.trim().toLowerCase()
);
const refreshMs = parseRefreshMs(process.env.MARKET_STREAM_SUBSCRIPTIONS_REFRESH_MS, 30_000);

const resolveDynamicSubscriptions = async (): Promise<StreamSubscriptions> => {
  const bots = await prisma.bot.findMany({
    where: {
      isActive: true,
      mode: { in: ['PAPER', 'LIVE'] },
      marketType,
      botMarketGroups: {
        some: {
          isEnabled: true,
          lifecycleStatus: { in: ['ACTIVE', 'PAUSED'] },
        },
      },
    },
    select: {
      botMarketGroups: {
        where: {
          isEnabled: true,
          lifecycleStatus: { in: ['ACTIVE', 'PAUSED'] },
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
          strategyLinks: {
            where: {
              isEnabled: true,
            },
            select: {
              strategy: {
                select: {
                  interval: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const symbols = new Set<string>(normalizeSymbols(envSymbols));
  const intervals = new Set<string>(envIntervals);
  const catalogSymbolsCache = new Map<string, string[]>();

  for (const bot of bots) {
    for (const group of bot.botMarketGroups) {
      const symbolGroupSymbols = normalizeSymbols(group.symbolGroup.symbols ?? []);
      const universeSymbols =
        group.symbolGroup.marketUniverse != null
          ? resolveUniverseSymbols(
              group.symbolGroup.marketUniverse.whitelist ?? [],
              group.symbolGroup.marketUniverse.blacklist ?? []
            )
          : [];
      const catalogFallbackSymbols =
        group.symbolGroup.marketUniverse != null &&
        symbolGroupSymbols.length === 0 &&
        universeSymbols.length === 0 &&
        allowEmptyGroupCatalogFallback
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
      const groupSymbols =
        universeSymbols.length > 0
          ? universeSymbols
          : symbolGroupSymbols.length > 0
            ? symbolGroupSymbols
            : catalogFallbackSymbols;
      if (
        groupSymbols.length === 0 &&
        symbolGroupSymbols.length === 0 &&
        universeSymbols.length === 0 &&
        group.symbolGroup.marketUniverse != null
      ) {
        logger.warn('market_stream.group_skipped_empty_symbols', {
          reason: 'empty_symbol_group_or_whitelist',
          fallbackAllowed: allowEmptyGroupCatalogFallback,
        });
      }
      for (const symbol of groupSymbols) {
        if (typeof symbol !== 'string' || symbol.trim().length === 0) continue;
        symbols.add(normalizeSymbol(symbol));
      }
      for (const link of group.strategyLinks) {
        const interval = normalizeInterval(link.strategy.interval);
        if (!interval) continue;
        intervals.add(interval);
      }
    }
  }

  return {
    symbols: [...symbols].sort(),
    candleIntervals: [...intervals].sort(),
  };
};

const buildSubscriptionFingerprint = (subscriptions: StreamSubscriptions) =>
  `${subscriptions.symbols.join(',')}|${subscriptions.candleIntervals.join(',')}`;

bootstrapWorker({
  workerName: 'market-stream',
});

let worker: BinanceMarketStreamWorker | null = null;
let subscriptionFingerprint = '';
let refreshTimer: NodeJS.Timeout | null = null;

const logSubscriptionsRefreshFailure = (error: unknown) => {
  logger.error('market_stream.subscriptions_refresh_failed', {
    error: error instanceof Error ? error.message : 'unknown_error',
  });
};

const startOrReloadWorker = async () => {
  const subscriptions = await resolveDynamicSubscriptions();
  const nextFingerprint = buildSubscriptionFingerprint(subscriptions);
  if (subscriptionFingerprint === nextFingerprint && worker) {
    // Keep trying to reconnect when socket was closed but subscriptions did not change.
    worker.start();
    return;
  }

  worker?.stop();
  worker = new BinanceMarketStreamWorker({
    streamUrl: process.env.BINANCE_STREAM_URL,
    marketType,
    symbols: subscriptions.symbols,
    candleIntervals: subscriptions.candleIntervals,
    onEvent: publishMarketStreamEvent,
  });
  worker.start();
  subscriptionFingerprint = nextFingerprint;

  logger.info('market_stream.subscriptions_updated', {
    marketType,
    symbolsCount: subscriptions.symbols.length,
    intervalsCount: subscriptions.candleIntervals.length,
    symbols: subscriptions.symbols,
    intervals: subscriptions.candleIntervals,
  });
};

const shutdown = async () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  worker?.stop();
  worker = null;
  await prisma.$disconnect().catch(() => undefined);
};

refreshTimer = setInterval(() => {
  void startOrReloadWorker().catch(logSubscriptionsRefreshFailure);
}, refreshMs);

void startOrReloadWorker().catch(logSubscriptionsRefreshFailure);

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
