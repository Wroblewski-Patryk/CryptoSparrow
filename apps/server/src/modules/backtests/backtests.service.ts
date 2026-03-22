import { PositionSide, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { getMarketCatalog } from '../markets/markets.service';
import {
  CreateBacktestRunDto,
  ListBacktestRunsQuery,
  ListBacktestTradesQuery,
} from './backtests.types';

type MarketType = 'SPOT' | 'FUTURES';
type MarginMode = 'CROSSED' | 'ISOLATED';

type KlineCandle = {
  openTime: number;
  closeTime: number;
  close: number;
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
  startedAt: string;
  updatedAt: string;
  lastUpdate: string;
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
        const closePrice = safeFloat(row[4]);
        const closeTime = safeFloat(row[6]);
        if (openTime <= 0 || closeTime <= 0 || closePrice <= 0) return null;
        return {
          openTime,
          closeTime,
          close: closePrice,
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

  return candles
    .sort((a, b) => a.openTime - b.openTime)
    .slice(-maxCandles);
};

const simulateTradesForSymbol = (
  symbol: string,
  candles: KlineCandle[],
  marketType: MarketType,
  leverage: number,
  marginMode: MarginMode | 'NONE',
): SymbolSimulationResult => {
  if (candles.length < 40) return { trades: [], liquidations: 0 };

  const trades: TradeDraft[] = [];
  let liquidations = 0;
  for (let index = 25; index < candles.length - 6; index += 18) {
    const anchor = candles[index];
    const lookback = candles[index - 5];
    const exit = candles[index + 5];

    const side: PositionSide = anchor.close >= lookback.close ? 'LONG' : 'SHORT';
    const quantity = 1;
    const effectiveLeverage = marketType === 'SPOT' ? 1 : Math.max(1, leverage);
    const fee = (anchor.close + exit.close) * 0.0004 * effectiveLeverage;
    const priceDiff = side === 'LONG' ? exit.close - anchor.close : anchor.close - exit.close;
    const rawPnl = priceDiff * quantity * effectiveLeverage;

    const adverseMoveRatio =
      side === 'LONG'
        ? (anchor.close - exit.close) / anchor.close
        : (exit.close - anchor.close) / anchor.close;

    const isolatedLiquidationThreshold = 1 / Math.max(1, effectiveLeverage);
    const isIsolatedLiquidated =
      marketType === 'FUTURES' &&
      marginMode === 'ISOLATED' &&
      adverseMoveRatio >= isolatedLiquidationThreshold;

    if (isIsolatedLiquidated) {
      liquidations += 1;
    }

    const pnl = isIsolatedLiquidated
      ? -(anchor.close * quantity) / Math.max(1, effectiveLeverage)
      : rawPnl - fee;

    trades.push({
      symbol,
      side,
      entryPrice: anchor.close,
      exitPrice: exit.close,
      quantity,
      openedAt: new Date(anchor.openTime),
      closedAt: new Date(exit.closeTime),
      pnl,
      fee,
    });
  }

  return { trades, liquidations };
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
