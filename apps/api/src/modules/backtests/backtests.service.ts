import { PositionSide, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { getMarketCatalog } from '../markets/markets.service';
import { simulateTradesForSymbolReplay } from './backtestReplayCore';
import {
  CreateBacktestRunDto,
  GetBacktestTimelineQuery,
  ListBacktestRunsQuery,
  ListBacktestTradesQuery,
} from './backtests.types';

type MarketType = 'SPOT' | 'FUTURES';
type MarginMode = 'CROSSED' | 'ISOLATED';

type KlineCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TradeDraft = {
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  openedAt: Date;
  closedAt: Date;
  pnl: number;
  fee: number;
};

type SymbolSimulationResult = {
  trades: TradeDraft[];
  liquidations: number;
};

type ProgressState = {
  marketType: MarketType;
  leverage: number;
  marginMode: MarginMode | 'NONE';
  marketUniverseId: string | null;
  totalSymbols: number;
  processedSymbols: number;
  failedSymbols: string[];
  liquidations: number;
  currentSymbol: string | null;
  totalTrades: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  maxDrawdown: number;
  maxCandlesPerSymbol: number;
  totalCandlesForSymbol?: number;
  currentCandleIndex?: number;
  currentCandleTime?: string | null;
  startedAt: string;
  updatedAt: string;
  lastUpdate: string;
};

type IndicatorSpec = {
  key: string;
  name: string;
  period: number;
  panel: 'price' | 'oscillator';
};

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const timeframeIntervalMs: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
};

const timeframeDefaultCandles: Record<string, number> = {
  '1m': 2000,
  '3m': 1800,
  '5m': 1600,
  '15m': 1200,
  '30m': 900,
  '1h': 700,
  '2h': 500,
  '4h': 350,
  '6h': 250,
  '8h': 200,
  '12h': 150,
  '1d': 60,
};

const CANDLE_CACHE_TTL_MS = 20 * 60 * 1000;
const candleCache = new Map<
  string,
  {
    cachedAt: number;
    candles: KlineCandle[];
  }
>();

const normalizeTimeframe = (value: string) => {
  const raw = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    '1 min': '1m',
    '3 min': '3m',
    '5 min': '5m',
    '10 min': '10m',
    '15 min': '15m',
    '30 min': '30m',
    '60 min': '1h',
  };

  return aliases[raw] ?? raw;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const uniqueSorted = (values: string[]) =>
  [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

const getIntervalMs = (timeframe: string) => timeframeIntervalMs[normalizeTimeframe(timeframe)] ?? timeframeIntervalMs['5m'];

const getDefaultCandlesForTimeframe = (timeframe: string) =>
  timeframeDefaultCandles[normalizeTimeframe(timeframe)] ?? 1000;

const computeAdaptiveMaxCandles = (timeframe: string, symbolCount: number, requested?: number) => {
  const base = requested && Number.isFinite(requested) ? requested : getDefaultCandlesForTimeframe(timeframe);
  const safeBase = clamp(Math.floor(base), 100, 2500);

  if (symbolCount <= 25) return safeBase;
  if (symbolCount <= 100) return clamp(Math.floor(safeBase * 0.65), 100, safeBase);
  if (symbolCount <= 250) return clamp(Math.floor(safeBase * 0.45), 80, safeBase);
  return clamp(Math.floor(safeBase * 0.3), 60, safeBase);
};

const safeFloat = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const maxDrawdownFromPnlSeries = (pnls: number[]) => {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const pnl of pnls) {
    equity += pnl;
    if (equity > peak) peak = equity;
    const drawdown = peak > 0 ? (peak - equity) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown;
};

const cacheKeyForCandles = (symbol: string, timeframe: string, marketType: MarketType, maxCandles: number) =>
  `${marketType}:${symbol}:${normalizeTimeframe(timeframe)}:${maxCandles}`;

const pruneCandleCache = () => {
  const now = Date.now();
  for (const [key, value] of candleCache.entries()) {
    if (now - value.cachedAt > CANDLE_CACHE_TTL_MS) candleCache.delete(key);
  }
};

const isMissingRunUpdateError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

const safeUpdateRun = async (runId: string, data: Prisma.BacktestRunUpdateInput) => {
  try {
    await prisma.backtestRun.update({
      where: { id: runId },
      data,
    });
    return true;
  } catch (error) {
    if (isMissingRunUpdateError(error)) return false;
    throw error;
  }
};

const fetchKlines = async (
  symbol: string,
  timeframe: string,
  marketType: MarketType,
  maxCandles: number,
): Promise<KlineCandle[]> => {
  pruneCandleCache();
  const key = cacheKeyForCandles(symbol, timeframe, marketType, maxCandles);
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.cachedAt <= CANDLE_CACHE_TTL_MS) {
    return cached.candles;
  }

  const normalizedTimeframe = normalizeTimeframe(timeframe);
  const endpoint =
    marketType === 'FUTURES'
      ? 'https://fapi.binance.com/fapi/v1/klines'
      : 'https://api.binance.com/api/v3/klines';

  const intervalMs = getIntervalMs(timeframe);
  const now = Date.now();
  const startTimeByRange = now - TWO_WEEKS_MS;

  const candles: KlineCandle[] = [];
  let nextStartTime = startTimeByRange;
  let remaining = clamp(maxCandles, 1, 2500);
  let guard = 0;

  while (remaining > 0 && guard < 8) {
    guard += 1;
    const chunkLimit = Math.min(1000, remaining);
    const query = new URLSearchParams({
      symbol,
      interval: normalizedTimeframe,
      limit: String(chunkLimit),
      startTime: String(nextStartTime),
    });

    const response = await fetch(`${endpoint}?${query.toString()}`);
    if (!response.ok) break;

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload) || payload.length === 0) break;

    const parsed = payload
      .map((row) => {
        if (!Array.isArray(row) || row.length < 7) return null;
        const openTime = safeFloat(row[0]);
        const open = safeFloat(row[1]);
        const high = safeFloat(row[2]);
        const low = safeFloat(row[3]);
        const closePrice = safeFloat(row[4]);
        const volume = safeFloat(row[5]);
        const closeTime = safeFloat(row[6]);
        if (openTime <= 0 || closeTime <= 0 || closePrice <= 0 || open <= 0 || high <= 0 || low <= 0) return null;
        return {
          openTime,
          closeTime,
          open,
          high,
          low,
          close: closePrice,
          volume,
        } satisfies KlineCandle;
      })
      .filter((row): row is KlineCandle => Boolean(row));

    if (parsed.length === 0) break;

    candles.push(...parsed);
    remaining -= parsed.length;

    const last = parsed[parsed.length - 1];
    nextStartTime = last.openTime + intervalMs;
    if (nextStartTime >= now) break;
  }

  const result = candles
    .sort((a, b) => a.openTime - b.openTime)
    .slice(-maxCandles);
  candleCache.set(key, { cachedAt: Date.now(), candles: result });
  return result;
};

const simulateTradesForSymbol = (
  symbol: string,
  candles: KlineCandle[],
  marketType: MarketType,
  leverage: number,
  marginMode: MarginMode | 'NONE',
): SymbolSimulationResult => {
  const replay = simulateTradesForSymbolReplay({
    symbol,
    candles,
    marketType,
    leverage,
    marginMode,
  });

  return {
    trades: replay.trades.map((trade) => ({
      symbol: trade.symbol,
      side: trade.side as PositionSide,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      quantity: trade.quantity,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt,
      pnl: trade.pnl,
      fee: trade.fee,
    })),
    liquidations: replay.liquidations,
  };
};

const updateRunProgress = async (
  runId: string,
  existingSeed: Record<string, unknown> | null,
  progress: ProgressState,
) => {
  await safeUpdateRun(runId, {
    seedConfig: {
      ...(existingSeed ?? {}),
      liveProgress: progress,
    },
  });
};

const parseStrategyIndicators = (strategyConfig: unknown): IndicatorSpec[] => {
  if (!strategyConfig || typeof strategyConfig !== 'object') return [];

  const config = strategyConfig as {
    open?: {
      long?: unknown[];
      short?: unknown[];
      indicatorsLong?: unknown[];
      indicatorsShort?: unknown[];
    };
    openConditions?: {
      indicatorsLong?: unknown[];
      indicatorsShort?: unknown[];
    };
  };

  const flatten = [
    ...(config.open?.long ?? []),
    ...(config.open?.short ?? []),
    ...(config.open?.indicatorsLong ?? []),
    ...(config.open?.indicatorsShort ?? []),
    ...(config.openConditions?.indicatorsLong ?? []),
    ...(config.openConditions?.indicatorsShort ?? []),
  ];

  const specs = flatten.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const rawName = (item as { name?: unknown }).name;
    const params = (item as { params?: Record<string, unknown> }).params;
    if (typeof rawName !== 'string') return [];
    const name = rawName.trim().toUpperCase();

    const asPeriod = (value: unknown, fallback: number) => {
      const candidate = Number(value);
      return clamp(Number.isFinite(candidate) ? Math.floor(candidate) : fallback, 2, 300);
    };

    if (name.includes('EMA') && params) {
      const fast = asPeriod(params.fast, 9);
      const slow = asPeriod(params.slow, 21);
      return [
        {
          key: `${name}_FAST_${fast}`,
          name: `${name} FAST`,
          period: fast,
          panel: 'price' as const,
        },
        {
          key: `${name}_SLOW_${slow}`,
          name: `${name} SLOW`,
          period: slow,
          panel: 'price' as const,
        },
      ];
    }

    const periodCandidate = params && typeof params.period !== 'undefined'
      ? Number(params.period)
      : params && typeof params.length !== 'undefined'
        ? Number(params.length)
        : 14;
    const period = clamp(Number.isFinite(periodCandidate) ? Math.floor(periodCandidate) : 14, 2, 300);
    const panel: 'price' | 'oscillator' = name.includes('EMA') || name.includes('SMA') ? 'price' : 'oscillator';
    return [{
      key: `${name}_${period}`,
      name,
      period,
      panel,
    } satisfies IndicatorSpec];
  });

  const unique = new Map<string, IndicatorSpec>();
  for (const spec of specs) {
    if (!unique.has(spec.key)) unique.set(spec.key, spec);
  }
  return [...unique.values()];
};

const buildEmaSeries = (candles: KlineCandle[], period: number) => {
  const alpha = 2 / (period + 1);
  const series: Array<number | null> = [];
  let ema: number | null = null;
  for (let index = 0; index < candles.length; index += 1) {
    const price = candles[index].close;
    if (ema === null) ema = price;
    else ema = alpha * price + (1 - alpha) * ema;
    series.push(index + 1 >= period ? ema : null);
  }
  return series;
};

const buildRsiSeries = (candles: KlineCandle[], period: number) => {
  const series: Array<number | null> = Array.from({ length: candles.length }, () => null);
  if (candles.length <= period) return series;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = candles[index].close - candles[index - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  series[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let index = period + 1; index < candles.length; index += 1) {
    const diff = candles[index].close - candles[index - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    series[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return series;
};

const buildMomentumSeries = (candles: KlineCandle[], period: number) => {
  const series: Array<number | null> = [];
  for (let index = 0; index < candles.length; index += 1) {
    if (index < period) {
      series.push(null);
      continue;
    }
    series.push(candles[index].close - candles[index - period].close);
  }
  return series;
};

const buildIndicatorSeries = (candles: KlineCandle[], specs: IndicatorSpec[]) => {
  return specs.map((spec) => {
    const values =
      spec.name.includes('EMA')
        ? buildEmaSeries(candles, spec.period)
        : spec.name.includes('RSI')
          ? buildRsiSeries(candles, spec.period)
          : buildMomentumSeries(candles, spec.period);
    return {
      key: spec.key,
      name: spec.name,
      period: spec.period,
      panel: spec.panel,
      values,
    };
  });
};

const findNearestCandleIndex = (candles: KlineCandle[], timestamp: number) => {
  if (candles.length === 0) return -1;
  let left = 0;
  let right = candles.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const value = candles[mid].openTime;
    if (value === timestamp) return mid;
    if (value < timestamp) left = mid + 1;
    else right = mid - 1;
  }

  const candidateA = Math.max(0, right);
  const candidateB = Math.min(candles.length - 1, left);
  const distanceA = Math.abs(candles[candidateA].openTime - timestamp);
  const distanceB = Math.abs(candles[candidateB].openTime - timestamp);
  return distanceA <= distanceB ? candidateA : candidateB;
};

const runBacktestAsync = async (runId: string) => {
  const run = await prisma.backtestRun.findUnique({ where: { id: runId } });
  if (!run) return;

  const seed = ((run.seedConfig ?? {}) as Record<string, unknown>) ?? {};
  const symbolListRaw = Array.isArray(seed.symbols) ? (seed.symbols as string[]) : [run.symbol];
  const symbols = uniqueSorted(symbolListRaw);
  const marketType = (seed.marketType === 'SPOT' ? 'SPOT' : 'FUTURES') as MarketType;
  const leverageCandidate = Number((seed as { leverage?: unknown }).leverage);
  const leverage = Number.isFinite(leverageCandidate) ? leverageCandidate : 1;
  const marginMode = seed.marginMode === 'ISOLATED' ? 'ISOLATED' : (seed.marginMode === 'CROSSED' ? 'CROSSED' : 'NONE');
  const initialBalanceCandidate = Number((seed as { initialBalance?: unknown }).initialBalance);
  const initialBalance = Number.isFinite(initialBalanceCandidate) ? Math.max(0, initialBalanceCandidate) : 10_000;
  const maxCandlesPerSymbol = computeAdaptiveMaxCandles(
    run.timeframe,
    symbols.length,
    typeof seed.maxCandles === 'number' ? seed.maxCandles : undefined,
  );

  const progress: ProgressState = {
    marketType,
    leverage: marketType === 'SPOT' ? 1 : Math.max(1, leverage),
    marginMode: marketType === 'SPOT' ? 'NONE' : marginMode,
    marketUniverseId: typeof seed.marketUniverseId === 'string' ? seed.marketUniverseId : null,
    totalSymbols: symbols.length,
    processedSymbols: 0,
    failedSymbols: [],
    liquidations: 0,
    currentSymbol: symbols[0] ?? null,
    totalTrades: 0,
    netPnl: 0,
    grossProfit: 0,
    grossLoss: 0,
    maxDrawdown: 0,
    maxCandlesPerSymbol,
    totalCandlesForSymbol: 0,
    currentCandleIndex: 0,
    currentCandleTime: null,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUpdate: 'starting',
  };

  const runExists = await safeUpdateRun(runId, {
    status: 'RUNNING',
    seedConfig: {
      ...seed,
      liveProgress: progress,
    },
  });
  if (!runExists) return;

  const pnlSeries: number[] = [];

  try {
    for (const [index, symbol] of symbols.entries()) {
      progress.currentSymbol = symbol;
      progress.lastUpdate = `processing_${symbol}`;
      progress.updatedAt = new Date().toISOString();
      await updateRunProgress(runId, seed, progress);

      try {
        const candles = await fetchKlines(symbol, run.timeframe, marketType, maxCandlesPerSymbol);
        progress.totalCandlesForSymbol = candles.length;
        progress.currentCandleIndex = candles.length > 0 ? candles.length - 1 : 0;
        progress.currentCandleTime = candles.length > 0 ? new Date(candles[candles.length - 1].openTime).toISOString() : null;
        progress.updatedAt = new Date().toISOString();
        await updateRunProgress(runId, seed, progress);
        const simulation = simulateTradesForSymbol(symbol, candles, marketType, progress.leverage, progress.marginMode);
        const trades = simulation.trades;

        if (trades.length > 0) {
          await prisma.backtestTrade.createMany({
            data: trades.map((trade) => ({
              userId: run.userId,
              strategyId: run.strategyId,
              backtestRunId: run.id,
              symbol: trade.symbol,
              side: trade.side,
              entryPrice: trade.entryPrice,
              exitPrice: trade.exitPrice,
              quantity: trade.quantity,
              openedAt: trade.openedAt,
              closedAt: trade.closedAt,
              pnl: trade.pnl,
              fee: trade.fee,
            })),
          });

          for (const trade of trades) {
            progress.totalTrades += 1;
            progress.netPnl += trade.pnl;
            if (trade.pnl > 0) progress.grossProfit += trade.pnl;
            if (trade.pnl < 0) progress.grossLoss += Math.abs(trade.pnl);
            pnlSeries.push(trade.pnl);
          }
          progress.liquidations += simulation.liquidations;

          progress.maxDrawdown = maxDrawdownFromPnlSeries(pnlSeries);
        }
      } catch {
        progress.failedSymbols.push(symbol);
      }

      progress.processedSymbols = index + 1;
      progress.lastUpdate = `processed_${symbol}`;
      progress.updatedAt = new Date().toISOString();
      await updateRunProgress(runId, seed, progress);
    }

    const totalTrades = progress.totalTrades;
    const winningTrades = await prisma.backtestTrade.count({
      where: { backtestRunId: run.id, userId: run.userId, pnl: { gt: 0 } },
    });
    const losingTrades = await prisma.backtestTrade.count({
      where: { backtestRunId: run.id, userId: run.userId, pnl: { lt: 0 } },
    });

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : null;

    await prisma.backtestReport.upsert({
      where: { backtestRunId: run.id },
      create: {
        userId: run.userId,
        backtestRunId: run.id,
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        netPnl: progress.netPnl,
        grossProfit: progress.grossProfit,
        grossLoss: progress.grossLoss,
        maxDrawdown: progress.maxDrawdown,
        sharpe: null,
        metrics: {
          symbolsProcessed: progress.processedSymbols,
          symbolsFailed: progress.failedSymbols,
          maxCandlesPerSymbol,
          leverage: progress.leverage,
          marginMode: progress.marginMode,
          liquidations: progress.liquidations,
          initialBalance,
          endBalance: initialBalance + progress.netPnl,
        },
      },
      update: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        netPnl: progress.netPnl,
        grossProfit: progress.grossProfit,
        grossLoss: progress.grossLoss,
        maxDrawdown: progress.maxDrawdown,
        metrics: {
          symbolsProcessed: progress.processedSymbols,
          symbolsFailed: progress.failedSymbols,
          maxCandlesPerSymbol,
          leverage: progress.leverage,
          marginMode: progress.marginMode,
          liquidations: progress.liquidations,
          initialBalance,
          endBalance: initialBalance + progress.netPnl,
        },
      },
    });

    await safeUpdateRun(run.id, {
      status: progress.failedSymbols.length === symbols.length ? 'FAILED' : 'COMPLETED',
      finishedAt: new Date(),
      seedConfig: {
        ...seed,
        liveProgress: {
          ...progress,
          currentSymbol: null,
          lastUpdate: 'completed',
          updatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    await safeUpdateRun(run.id, {
      status: 'FAILED',
      finishedAt: new Date(),
      seedConfig: {
        ...seed,
        liveProgress: {
          ...progress,
          lastUpdate: 'failed',
          updatedAt: new Date().toISOString(),
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
};

const resolveSymbolsForRun = async (userId: string, data: CreateBacktestRunDto) => {
  if (!data.marketUniverseId) {
    return {
      symbols: uniqueSorted([data.symbol ?? 'BTCUSDT']),
      marketType: 'FUTURES' as MarketType,
      marketUniverseId: null,
    };
  }

  const universe = await prisma.marketUniverse.findFirst({
    where: {
      id: data.marketUniverseId,
      userId,
    },
  });

  if (!universe) return null;

  const catalog = await getMarketCatalog(universe.baseCurrency, universe.marketType);
  const rules = ((universe.filterRules ?? {}) as { minQuoteVolumeEnabled?: boolean; minQuoteVolume24h?: number }) ?? {};
  const minVolume = typeof rules.minQuoteVolume24h === 'number' ? rules.minQuoteVolume24h : 0;
  const minVolumeEnabled = Boolean(rules.minQuoteVolumeEnabled);

  const availableByRules = catalog.markets
    .filter((market) => (minVolumeEnabled ? market.quoteVolume24h >= minVolume : true))
    .map((market) => market.symbol);

  const availableSet = new Set(availableByRules);
  const include = universe.whitelist.length > 0
    ? universe.whitelist.filter((symbol) => availableSet.has(symbol))
    : availableByRules;
  const blacklist = new Set(universe.blacklist);

  const resolved = uniqueSorted(include).filter((symbol) => !blacklist.has(symbol));
  if (resolved.length === 0 && data.symbol) {
    resolved.push(data.symbol.trim().toUpperCase());
  }

  return {
    symbols: uniqueSorted(resolved),
    marketType: universe.marketType as MarketType,
    marketUniverseId: universe.id,
  };
};

export const listRuns = async (userId: string, query: ListBacktestRunsQuery) => {
  return prisma.backtestRun.findMany({
    where: {
      userId,
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });
};

export const getRun = async (userId: string, id: string) => {
  return prisma.backtestRun.findFirst({
    where: { id, userId },
  });
};

export const createRun = async (userId: string, data: CreateBacktestRunDto) => {
  let strategyDefaults: { leverage: number; marginMode: MarginMode } | null = null;
  if (data.strategyId) {
    const strategy = await prisma.strategy.findFirst({
      where: { id: data.strategyId, userId },
      select: { id: true, leverage: true, config: true },
    });
    if (!strategy) return null;

    const config = (strategy.config ?? {}) as { additional?: { marginMode?: unknown } };
    strategyDefaults = {
      leverage: strategy.leverage,
      marginMode: config.additional?.marginMode === 'ISOLATED' ? 'ISOLATED' : 'CROSSED',
    };
  }

  const resolved = await resolveSymbolsForRun(userId, data);
  if (!resolved || resolved.symbols.length === 0) return null;

  const maxCandles = computeAdaptiveMaxCandles(
    data.timeframe,
    resolved.symbols.length,
    typeof data.seedConfig === 'object' && data.seedConfig && 'maxCandles' in data.seedConfig
      ? Number((data.seedConfig as { maxCandles?: number }).maxCandles)
      : undefined,
  );

  const created = await prisma.backtestRun.create({
    data: {
      userId,
      name: data.name,
      symbol: resolved.symbols[0],
      timeframe: data.timeframe,
      strategyId: data.strategyId,
      seedConfig: {
        ...(typeof data.seedConfig === 'object' && data.seedConfig ? data.seedConfig : {}),
        initialBalance:
          typeof data.seedConfig === 'object' &&
          data.seedConfig &&
          typeof (data.seedConfig as { initialBalance?: unknown }).initialBalance === 'number'
            ? (data.seedConfig as { initialBalance: number }).initialBalance
            : 10_000,
        symbols: resolved.symbols,
        marketType: resolved.marketType,
        marketUniverseId: resolved.marketUniverseId,
        leverage: resolved.marketType === 'SPOT' ? 1 : (strategyDefaults?.leverage ?? 1),
        marginMode: resolved.marketType === 'SPOT' ? 'NONE' : (strategyDefaults?.marginMode ?? 'CROSSED'),
        maxCandles,
        executionMode: 'sequential_symbol_by_symbol',
      },
      notes: data.notes,
      status: 'PENDING',
    },
  });

  setTimeout(() => {
    void runBacktestAsync(created.id);
  }, 0);

  return created;
};

export const listRunTrades = async (
  userId: string,
  runId: string,
  query: ListBacktestTradesQuery,
) => {
  const run = await prisma.backtestRun.findFirst({
    where: { id: runId, userId },
    select: { id: true },
  });
  if (!run) return null;

  return prisma.backtestTrade.findMany({
    where: { userId, backtestRunId: runId },
    orderBy: { closedAt: 'desc' },
    take: query.limit,
  });
};

export const getRunReport = async (userId: string, runId: string) => {
  const run = await prisma.backtestRun.findFirst({
    where: { id: runId, userId },
    select: { id: true },
  });
  if (!run) return undefined;

  const report = await prisma.backtestReport.findFirst({
    where: { userId, backtestRunId: runId },
  });

  return report ?? null;
};

export const getRunTimeline = async (
  userId: string,
  runId: string,
  query: GetBacktestTimelineQuery,
) => {
  const run = await prisma.backtestRun.findFirst({
    where: { id: runId, userId },
    select: {
      id: true,
      strategyId: true,
      timeframe: true,
      symbol: true,
      seedConfig: true,
      status: true,
    },
  });
  if (!run) return null;

  const seed = ((run.seedConfig ?? {}) as Record<string, unknown>) ?? {};
  const marketType = (seed.marketType === 'SPOT' ? 'SPOT' : 'FUTURES') as MarketType;
  const maxCandles = typeof seed.maxCandles === 'number'
    ? clamp(Math.floor(seed.maxCandles), 100, 2500)
    : computeAdaptiveMaxCandles(run.timeframe, 1, undefined);

  const symbol = query.symbol.trim().toUpperCase();
  const candles = await fetchKlines(symbol, run.timeframe, marketType, maxCandles);
  const total = candles.length;
  const start = clamp(query.cursor, 0, total);
  const end = clamp(start + query.chunkSize, 0, total);
  const chunk = candles.slice(start, end);

  const trades = await prisma.backtestTrade.findMany({
    where: {
      userId,
      backtestRunId: runId,
      symbol,
    },
    orderBy: { openedAt: 'asc' },
  });

  const strategy = run.strategyId
    ? await prisma.strategy.findFirst({
      where: { id: run.strategyId, userId },
      select: { config: true },
    })
    : null;

  const indicatorSpecs = parseStrategyIndicators(strategy?.config);
  const indicatorSeries = buildIndicatorSeries(candles, indicatorSpecs).map((series) => ({
    key: series.key,
    name: series.name,
    period: series.period,
    panel: series.panel,
    points: series.values
      .slice(start, end)
      .map((value, index) => ({
        candleIndex: start + index,
        value,
      })),
  }));

  const events = trades.flatMap((trade) => {
    const entryTs = trade.openedAt.getTime();
    const exitTs = trade.closedAt.getTime();
    const entryIndex = findNearestCandleIndex(candles, entryTs);
    const exitIndex = findNearestCandleIndex(candles, exitTs);

    return [
      {
        id: `${trade.id}_entry`,
        tradeId: trade.id,
        type: 'ENTRY',
        side: trade.side,
        timestamp: trade.openedAt.toISOString(),
        price: trade.entryPrice,
        pnl: null as number | null,
        candleIndex: entryIndex,
      },
      {
        id: `${trade.id}_exit`,
        tradeId: trade.id,
        type: 'EXIT',
        side: trade.side,
        timestamp: trade.closedAt.toISOString(),
        price: trade.exitPrice,
        pnl: trade.pnl,
        candleIndex: exitIndex,
      },
    ];
  }).filter((event) => event.candleIndex >= start && event.candleIndex < end);

  const liveProgress = (seed.liveProgress ?? {}) as {
    currentSymbol?: string | null;
    currentCandleIndex?: number;
    totalCandlesForSymbol?: number;
  };

  return {
    runId,
    symbol,
    timeframe: run.timeframe,
    marketType,
    status: run.status,
    cursor: start,
    nextCursor: end < total ? end : null,
    totalCandles: total,
    candles: chunk.map((candle, index) => ({
      candleIndex: start + index,
      openTime: new Date(candle.openTime).toISOString(),
      closeTime: new Date(candle.closeTime).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    })),
    events,
    indicatorSeries,
    supportedEventTypes: ['ENTRY', 'EXIT'],
    unsupportedEventTypes: ['DCA', 'TP', 'SL'],
    playbackCursor:
      liveProgress.currentSymbol === symbol && typeof liveProgress.currentCandleIndex === 'number'
        ? liveProgress.currentCandleIndex
        : null,
  };
};

