import { BinanceMarketStreamWorker } from '../modules/market-stream/binanceStream.service';
import { publishMarketStreamEvent } from '../modules/market-stream/marketStreamFanout';
import { prisma } from '../prisma/client';
import { bootstrapWorker } from './workerBootstrap';

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

  const symbols = new Set<string>(envSymbols.map((symbol) => symbol.toUpperCase()));
  const intervals = new Set<string>(envIntervals);

  for (const bot of bots) {
    for (const group of bot.botMarketGroups) {
      for (const symbol of group.symbolGroup.symbols ?? []) {
        if (typeof symbol !== 'string' || symbol.trim().length === 0) continue;
        symbols.add(symbol.trim().toUpperCase());
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

const startOrReloadWorker = async () => {
  const subscriptions = await resolveDynamicSubscriptions();
  const nextFingerprint = buildSubscriptionFingerprint(subscriptions);
  if (subscriptionFingerprint === nextFingerprint && worker) return;

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

  console.log(
    JSON.stringify({
      level: 'info',
      module: 'market-stream.bootstrap',
      event: 'market_stream.subscriptions_updated',
      marketType,
      symbolsCount: subscriptions.symbols.length,
      intervalsCount: subscriptions.candleIntervals.length,
      symbols: subscriptions.symbols,
      intervals: subscriptions.candleIntervals,
    })
  );
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

void (async () => {
  await startOrReloadWorker();
  refreshTimer = setInterval(() => {
    void startOrReloadWorker().catch((error) => {
      console.error(
        JSON.stringify({
          level: 'error',
          module: 'market-stream.bootstrap',
          event: 'market_stream.subscriptions_refresh_failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        })
      );
    });
  }, refreshMs);
})();

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
