import { Exchange, TradeMarket } from '@prisma/client';
import { prisma } from '../src/prisma/client';

type CliOptions = {
  dryRun: boolean;
  help: boolean;
  limit: number | null;
  userId: string | null;
};

type UniverseContext = {
  userId: string;
  exchange: Exchange;
  marketType: TradeMarket;
  baseCurrency: string;
};

const EXCHANGE_SET = new Set<Exchange>([
  Exchange.BINANCE,
  Exchange.BYBIT,
  Exchange.OKX,
  Exchange.KRAKEN,
  Exchange.COINBASE,
]);

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    dryRun: false,
    help: false,
    limit: null,
    userId: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--limit') {
      const raw = args[index + 1];
      const parsed = raw ? Number(raw) : Number.NaN;
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('INVALID_LIMIT');
      }
      options.limit = Math.floor(parsed);
      index += 1;
      continue;
    }
    if (arg === '--user-id') {
      options.userId = args[index + 1] ?? null;
      index += 1;
    }
  }

  return options;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeExchange = (value: unknown): Exchange | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase() as Exchange;
  return EXCHANGE_SET.has(normalized) ? normalized : null;
};

const normalizeMarketType = (value: unknown): TradeMarket | null => {
  if (value === 'SPOT') return TradeMarket.SPOT;
  if (value === 'FUTURES') return TradeMarket.FUTURES;
  return null;
};

const normalizeBaseCurrency = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized.length === 0) return null;
  return normalized;
};

const inferBaseCurrencyFromSymbol = (symbol: string): string =>
  (symbol.match(/(USDT|USDC|BUSD|FDUSD|BTC|ETH|EUR|USD)$/)?.[1] ?? 'USDT').toUpperCase();

const run = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log(
      [
        'Usage: pnpm --filter api exec tsx scripts/backfillBacktestVenueContext.ts [options]',
        '',
        'Options:',
        '  --dry-run           Print summary without persisting changes',
        '  --limit <n>         Process at most n backtest runs',
        '  --user-id <id>      Process only one user',
        '  --help, -h          Show usage',
      ].join('\n')
    );
    return;
  }

  const universes = await prisma.marketUniverse.findMany({
    select: {
      id: true,
      userId: true,
      exchange: true,
      marketType: true,
      baseCurrency: true,
    },
  });

  const universeById = new Map<string, UniverseContext>(
    universes.map((item) => [
      item.id,
      {
        userId: item.userId,
        exchange: item.exchange,
        marketType: item.marketType,
        baseCurrency: item.baseCurrency,
      },
    ])
  );

  const take = 300;
  let processed = 0;
  let scannedRuns = 0;
  let updatedRuns = 0;
  let cursor: string | null = null;

  while (true) {
    const runs = await prisma.backtestRun.findMany({
      where: {
        ...(options.userId ? { userId: options.userId } : {}),
      },
      select: {
        id: true,
        userId: true,
        symbol: true,
        seedConfig: true,
      },
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (runs.length === 0) break;

    for (const runItem of runs) {
      if (options.limit !== null && processed >= options.limit) break;

      scannedRuns += 1;
      processed += 1;

      const rawSeed = isRecord(runItem.seedConfig) ? runItem.seedConfig : {};
      const universeId =
        typeof rawSeed.marketUniverseId === 'string' && rawSeed.marketUniverseId.trim().length > 0
          ? rawSeed.marketUniverseId
          : null;
      const universe = universeId ? universeById.get(universeId) : undefined;
      const universeMatchesUser = universe ? universe.userId === runItem.userId : false;

      const exchange = normalizeExchange(rawSeed.exchange) ?? (universeMatchesUser ? universe?.exchange : null) ?? Exchange.BINANCE;
      const marketType =
        normalizeMarketType(rawSeed.marketType) ?? (universeMatchesUser ? universe?.marketType : null) ?? TradeMarket.FUTURES;
      const baseCurrency =
        normalizeBaseCurrency(rawSeed.baseCurrency) ??
        (universeMatchesUser ? normalizeBaseCurrency(universe?.baseCurrency) : null) ??
        inferBaseCurrencyFromSymbol(runItem.symbol);

      const shouldUpdate =
        !isRecord(runItem.seedConfig) ||
        normalizeExchange(rawSeed.exchange) !== exchange ||
        normalizeMarketType(rawSeed.marketType) !== marketType ||
        normalizeBaseCurrency(rawSeed.baseCurrency) !== baseCurrency;

      if (!shouldUpdate) continue;

      if (!options.dryRun) {
        await prisma.backtestRun.update({
          where: { id: runItem.id },
          data: {
            seedConfig: {
              ...rawSeed,
              exchange,
              marketType,
              baseCurrency,
            },
          },
        });
      }

      updatedRuns += 1;
    }

    if (options.limit !== null && processed >= options.limit) break;
    cursor = runs[runs.length - 1]?.id ?? null;
  }

  const summary = {
    dryRun: options.dryRun,
    userId: options.userId,
    limit: options.limit,
    universesScanned: universes.length,
    runsScanned: scannedRuns,
    runsUpdated: updatedRuns,
    runsUnchanged: scannedRuns - updatedRuns,
  };

  console.log(JSON.stringify(summary, null, 2));
};

run()
  .catch((error) => {
    console.error('[backfillBacktestVenueContext] failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
