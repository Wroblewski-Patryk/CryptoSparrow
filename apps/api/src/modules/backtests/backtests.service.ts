import { PositionSide, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { getMarketCatalog } from '../markets/markets.service';
import { decideExecutionAction } from '../engine/sharedExecutionCore';
import { evaluatePositionManagement } from '../engine/positionManagement.service';
import { PositionManagementInput } from '../engine/positionManagement.types';
import {
  evaluateStrategySignalAtIndex,
  parseStrategySignalRules,
} from '../engine/strategySignalEvaluator';
import {
  computeRiskBasedOrderQuantity,
  normalizeWalletRiskPercent,
} from '../engine/positionSizing';
import {
  type ReplayEventDraft,
  type ReplayParityDecisionTrace,
  type ReplayEventType,
  simulateTradesForSymbolReplay,
} from './backtestReplayCore';
import {
  BacktestFillModelConfig,
  createHistoricalBacktestFillModel,
} from './backtestFillModel';
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

type FundingRatePoint = {
  timestamp: number;
  fundingRate: number;
};

type OpenInterestPoint = {
  timestamp: number;
  openInterest: number;
};

type SupplementalSeries = {
  fundingRates: FundingRatePoint[];
  openInterest: OpenInterestPoint[];
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
  exitReason: 'SIGNAL_EXIT' | 'FINAL_CANDLE' | 'LIQUIDATION';
  liquidated: boolean;
};

type SymbolSimulationResult = {
  trades: TradeDraft[];
  liquidations: number;
  events: ReplayEventDraft[];
  eventCounts: Record<ReplayEventType, number>;
  decisionTrace: ReplayParityDecisionTrace[];
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

type LifecycleEventCounts = {
  ENTRY: number;
  EXIT: number;
  DCA: number;
  TP: number;
  TTP: number;
  SL: number;
  TRAILING: number;
  LIQUIDATION: number;
};

type IndicatorSpec = {
  key: string;
  name: string;
  period: number;
  panel: 'price' | 'oscillator';
};

type TtpLevel = {
  arm: number;
  percent: number;
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
const useDbCandleCache = (process.env.BACKTEST_USE_DB_CANDLE_CACHE ?? 'true').toLowerCase() !== 'false';
const candleCache = new Map<
  string,
  {
    cachedAt: number;
    candles: KlineCandle[];
  }
>();
const supplementalCache = new Map<
  string,
  {
    cachedAt: number;
    data: SupplementalSeries;
  }
>();

const getDbCandleDelegate = () =>
  (prisma as unknown as {
    marketCandleCache?: {
      findMany: (args: unknown) => Promise<
        Array<{
          openTime: bigint;
          closeTime: bigint;
          open: number;
          high: number;
          low: number;
          close: number;
          volume: number;
        }>
      >;
      createMany: (args: unknown) => Promise<unknown>;
    };
  }).marketCandleCache;

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

const computeSourceWindowMs = (timeframe: string, maxCandles: number) => {
  const intervalMs = getIntervalMs(timeframe);
  const requestedWindowMs = intervalMs * Math.max(1, maxCandles);
  const bufferedWindowMs = Math.ceil(requestedWindowMs * 1.15);
  return Math.max(TWO_WEEKS_MS, bufferedWindowMs);
};

const computeTrailingTakeProfitTriggerPrice = (input: {
  side: PositionSide;
  entryPrice: number;
  anchorPrice: number;
  leverage: number;
  levels: TtpLevel[];
}): number | null => {
  const effectiveLeverage = Math.max(1, input.leverage);
  const peakFavorableMove =
    input.side === 'LONG'
      ? ((input.anchorPrice - input.entryPrice) / Math.max(input.entryPrice, 1e-8)) * effectiveLeverage
      : ((input.entryPrice - input.anchorPrice) / Math.max(input.entryPrice, 1e-8)) * effectiveLeverage;
  if (!Number.isFinite(peakFavorableMove) || peakFavorableMove <= 0) return null;

  const sorted = [...input.levels]
    .filter((level) => Number.isFinite(level.arm) && Number.isFinite(level.percent) && level.arm > 0 && level.percent > 0)
    .sort((left, right) => left.arm - right.arm);
  let active: TtpLevel | null = null;
  for (const level of sorted) {
    if (peakFavorableMove >= level.arm) active = level;
  }
  if (!active) return null;

  const floorMove = Math.max(0, peakFavorableMove - active.percent);
  if (floorMove <= 0) return null;
  const trigger =
    input.side === 'LONG'
      ? input.entryPrice * (1 + floorMove / effectiveLeverage)
      : input.entryPrice * (1 - floorMove / effectiveLeverage);
  return Number.isFinite(trigger) ? trigger : null;
};

const getDefaultCandlesForTimeframe = (timeframe: string) =>
  timeframeDefaultCandles[normalizeTimeframe(timeframe)] ?? 1000;

const computeAdaptiveMaxCandles = (timeframe: string, symbolCount: number, requested?: number) => {
  const base = requested && Number.isFinite(requested) ? requested : getDefaultCandlesForTimeframe(timeframe);
  const safeBase = clamp(Math.floor(base), 100, 10_000);

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

const toKlineFromDb = (row: {
  openTime: bigint;
  closeTime: bigint;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}): KlineCandle => ({
  openTime: Number(row.openTime),
  closeTime: Number(row.closeTime),
  open: row.open,
  high: row.high,
  low: row.low,
  close: row.close,
  volume: row.volume,
});

const cacheKeyForCandles = (
  symbol: string,
  timeframe: string,
  marketType: MarketType,
  maxCandles: number,
  endTimeMs?: number,
) =>
  `${marketType}:${symbol}:${normalizeTimeframe(timeframe)}:${maxCandles}:${
    Number.isFinite(endTimeMs) ? Math.floor(endTimeMs as number) : 'latest'
  }`;
const cacheKeyForSupplemental = (
  symbol: string,
  timeframe: string,
  marketType: MarketType,
  maxCandles: number,
  endTimeMs?: number,
) =>
  `supp:${marketType}:${symbol}:${normalizeTimeframe(timeframe)}:${maxCandles}:${
    Number.isFinite(endTimeMs) ? Math.floor(endTimeMs as number) : 'latest'
  }`;

const pruneCandleCache = () => {
  const now = Date.now();
  for (const [key, value] of candleCache.entries()) {
    if (now - value.cachedAt > CANDLE_CACHE_TTL_MS) candleCache.delete(key);
  }
  for (const [key, value] of supplementalCache.entries()) {
    if (now - value.cachedAt > CANDLE_CACHE_TTL_MS) supplementalCache.delete(key);
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
  endTimeMs?: number,
): Promise<KlineCandle[]> => {
  pruneCandleCache();
  const key = cacheKeyForCandles(symbol, timeframe, marketType, maxCandles, endTimeMs);
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.cachedAt <= CANDLE_CACHE_TTL_MS) {
    return cached.candles;
  }

  const normalizedTimeframe = normalizeTimeframe(timeframe);
  const endTime = Number.isFinite(endTimeMs) ? Math.floor(endTimeMs as number) : Date.now();
  const sourceWindowMs = computeSourceWindowMs(timeframe, maxCandles);
  const startTimeByRange = endTime - sourceWindowMs;
  const dbDelegate = useDbCandleCache ? getDbCandleDelegate() : undefined;
  if (dbDelegate) {
    try {
      const dbCandlesRaw = await dbDelegate.findMany({
        where: {
          marketType,
          symbol,
          timeframe: normalizedTimeframe,
          openTime: {
            gte: BigInt(startTimeByRange),
            lte: BigInt(endTime),
          },
        },
        orderBy: { openTime: 'desc' },
        take: maxCandles,
      });
      if (dbCandlesRaw.length >= maxCandles) {
        const dbCandles = dbCandlesRaw
          .map(toKlineFromDb)
          .sort((a, b) => a.openTime - b.openTime)
          .slice(-maxCandles);
        candleCache.set(key, { cachedAt: Date.now(), candles: dbCandles });
        return dbCandles;
      }
    } catch {
      // DB candle cache is a performance optimization; network fetch remains source of truth fallback.
    }
  }

  const endpoint =
    marketType === 'FUTURES'
      ? 'https://fapi.binance.com/fapi/v1/klines'
      : 'https://api.binance.com/api/v3/klines';

  const intervalMs = getIntervalMs(timeframe);

  const candles: KlineCandle[] = [];
  let nextStartTime = startTimeByRange;
  let remaining = clamp(maxCandles, 1, 10_000);
  let guard = 0;
  const maxIterations = Math.ceil(remaining / 1000) + 2;

  while (remaining > 0 && guard < maxIterations) {
    guard += 1;
    const chunkLimit = Math.min(1000, remaining);
    const query = new URLSearchParams({
      symbol,
      interval: normalizedTimeframe,
      limit: String(chunkLimit),
      startTime: String(nextStartTime),
      endTime: String(endTime),
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
    if (nextStartTime >= endTime) break;
  }

  const result = candles
    .sort((a, b) => a.openTime - b.openTime)
    .slice(-maxCandles);

  if (dbDelegate && result.length > 0) {
    try {
      await dbDelegate.createMany({
        data: result.map((item) => ({
          marketType,
          symbol,
          timeframe: normalizedTimeframe,
          openTime: BigInt(item.openTime),
          closeTime: BigInt(item.closeTime),
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume,
          source: 'BINANCE',
        })),
        skipDuplicates: true,
      });
    } catch {
      // ignore cache write errors; fetch already succeeded
    }
  }

  candleCache.set(key, { cachedAt: Date.now(), candles: result });
  return result;
};

const openInterestPeriodForTimeframe = (timeframe: string) => {
  const normalized = normalizeTimeframe(timeframe);
  const supported = new Set(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']);
  if (supported.has(normalized)) return normalized;
  return '5m';
};

const fetchSupplementalSeries = async (
  symbol: string,
  timeframe: string,
  marketType: MarketType,
  maxCandles: number,
  endTimeMs?: number,
): Promise<SupplementalSeries> => {
  if (marketType !== 'FUTURES') {
    return { fundingRates: [], openInterest: [] };
  }

  pruneCandleCache();
  const key = cacheKeyForSupplemental(symbol, timeframe, marketType, maxCandles, endTimeMs);
  const cached = supplementalCache.get(key);
  if (cached && Date.now() - cached.cachedAt <= CANDLE_CACHE_TTL_MS) {
    return cached.data;
  }

  const endTime = Number.isFinite(endTimeMs) ? Math.floor(endTimeMs as number) : Date.now();
  const sourceWindowMs = computeSourceWindowMs(timeframe, maxCandles);
  const startTime = endTime - sourceWindowMs;
  const limit = clamp(maxCandles, 50, 1000);

  const fundingQuery = new URLSearchParams({
    symbol,
    startTime: String(startTime),
    endTime: String(endTime),
    limit: String(limit),
  });
  const oiQuery = new URLSearchParams({
    symbol,
    period: openInterestPeriodForTimeframe(timeframe),
    startTime: String(startTime),
    endTime: String(endTime),
    limit: String(limit),
  });

  let fundingResponse: Response | null = null;
  let openInterestResponse: Response | null = null;
  try {
    [fundingResponse, openInterestResponse] = await Promise.all([
      fetch(`https://fapi.binance.com/fapi/v1/fundingRate?${fundingQuery.toString()}`),
      fetch(`https://fapi.binance.com/futures/data/openInterestHist?${oiQuery.toString()}`),
    ]);
  } catch {
    const empty = { fundingRates: [], openInterest: [] };
    supplementalCache.set(key, { cachedAt: Date.now(), data: empty });
    return empty;
  }

  const fundingRates: FundingRatePoint[] = fundingResponse?.ok
    ? (((await fundingResponse.json()) as unknown[]) ?? [])
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as { fundingTime?: unknown; fundingRate?: unknown };
        const timestamp = safeFloat(row.fundingTime);
        const fundingRate = safeFloat(row.fundingRate);
        if (timestamp <= 0 || !Number.isFinite(fundingRate)) return null;
        return { timestamp, fundingRate } satisfies FundingRatePoint;
      })
      .filter((item): item is FundingRatePoint => Boolean(item))
      .sort((a, b) => a.timestamp - b.timestamp)
    : [];

  const openInterest: OpenInterestPoint[] = openInterestResponse?.ok
    ? (((await openInterestResponse.json()) as unknown[]) ?? [])
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as { timestamp?: unknown; sumOpenInterest?: unknown };
        const timestamp = safeFloat(row.timestamp);
        const oi = safeFloat(row.sumOpenInterest);
        if (timestamp <= 0 || !Number.isFinite(oi)) return null;
        return { timestamp, openInterest: oi } satisfies OpenInterestPoint;
      })
      .filter((item): item is OpenInterestPoint => Boolean(item))
      .sort((a, b) => a.timestamp - b.timestamp)
    : [];

  const result: SupplementalSeries = {
    fundingRates,
    openInterest,
  };
  supplementalCache.set(key, {
    cachedAt: Date.now(),
    data: result,
  });
  return result;
};

const simulateTradesForSymbol = (
  symbol: string,
  candles: KlineCandle[],
  marketType: MarketType,
  leverage: number,
  marginMode: MarginMode | 'NONE',
  strategyConfig?: Record<string, unknown> | null,
  fillModelConfig?: BacktestFillModelConfig,
  positionSizing?: {
    mode: 'fixed' | 'wallet_risk';
    walletRiskPercent?: number;
    referenceBalance?: number;
  },
): SymbolSimulationResult => {
  const replay = simulateTradesForSymbolReplay({
    symbol,
    candles,
    marketType,
    leverage,
    marginMode,
    strategyConfig,
    fillModelConfig,
    positionSizing,
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
      exitReason: trade.exitReason,
      liquidated: trade.liquidated,
    })),
    liquidations: replay.liquidations,
    events: replay.events,
    eventCounts: replay.eventCounts,
    decisionTrace: replay.decisionTrace,
  };
};

type StrategyRiskConfig = {
  takeProfitPct: number;
  trailingTakeProfitLevels: Array<{ arm: number; percent: number }>;
  stopLossPct: number;
  trailingStopLevels: Array<{ arm: number; percent: number }>;
  trailingLoss: { start: number; step: number } | null;
  maxDcaPerTrade: number;
  dcaLevels: number[];
  dcaMultipliers: number[];
};

const computeRiskPriceFromPercent = (
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  percent: number,
  kind: 'tp' | 'sl',
  leverage = 1
) => {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(percent) || percent <= 0) return undefined;
  const adjusted = percent / Math.max(1, leverage);
  if (kind === 'tp') {
    return side === 'LONG' ? entryPrice * (1 + adjusted) : entryPrice * (1 - adjusted);
  }
  return side === 'LONG' ? entryPrice * (1 - adjusted) : entryPrice * (1 + adjusted);
};

const closeReasonToEventType = (reason?: 'take_profit' | 'trailing_take_profit' | 'stop_loss' | 'trailing_stop'): ReplayEventType => {
  switch (reason) {
    case 'take_profit':
      return 'TP';
    case 'trailing_take_profit':
      return 'TTP';
    case 'stop_loss':
      return 'SL';
    case 'trailing_stop':
      return 'TRAILING';
    default:
      return 'EXIT';
  }
};

const buildReplayPositionManagementInput = (args: {
  side: 'LONG' | 'SHORT';
  currentPrice: number;
  entryPrice: number;
  leverage: number;
  riskConfig: StrategyRiskConfig;
}): PositionManagementInput => {
  const { side, currentPrice, entryPrice, leverage, riskConfig } = args;

  return {
    side,
    currentPrice,
    leverage,
    takeProfitPrice: Number.isFinite(riskConfig.takeProfitPct)
      ? computeRiskPriceFromPercent(side, entryPrice, riskConfig.takeProfitPct, 'tp', leverage)
      : undefined,
    stopLossPrice: Number.isFinite(riskConfig.stopLossPct)
      ? computeRiskPriceFromPercent(side, entryPrice, riskConfig.stopLossPct, 'sl', leverage)
      : undefined,
    trailingTakeProfitLevels:
      riskConfig.trailingTakeProfitLevels.length > 0
        ? riskConfig.trailingTakeProfitLevels.map((level) => ({
            armPercent: level.arm,
            trailPercent: level.percent,
          }))
        : undefined,
    trailingStopLevels:
      riskConfig.trailingStopLevels.length > 0
        ? riskConfig.trailingStopLevels.map((level) => ({
            armPercent: level.arm,
            type: 'percent' as const,
            value: level.percent,
          }))
        : undefined,
    trailingLoss: riskConfig.trailingLoss
      ? {
          enabled: true,
          startPercent: riskConfig.trailingLoss.start,
          stepPercent: riskConfig.trailingLoss.step,
        }
      : undefined,
    dca:
      riskConfig.maxDcaPerTrade > 0
        ? {
            enabled: true,
            maxAdds: riskConfig.maxDcaPerTrade,
            stepPercent: Math.max(0.0001, Math.abs(riskConfig.dcaLevels[0] ?? 0.01)),
            addSizeFraction: Math.max(0.01, riskConfig.dcaMultipliers[0] ?? 1),
            levelPercents: riskConfig.dcaLevels,
            addSizeFractions: riskConfig.dcaMultipliers,
          }
        : undefined,
  };
};

type InterleavedPortfolioSimulationResult = {
  perSymbol: Record<string, SymbolSimulationResult>;
  finalBalance: number;
};

const parseReplayRiskConfig = (strategyConfig?: Record<string, unknown> | null): StrategyRiskConfig => {
  const fallback: StrategyRiskConfig = {
    takeProfitPct: 0.012,
    trailingTakeProfitLevels: [],
    stopLossPct: 0.01,
    trailingStopLevels: [{ arm: 0.006, percent: 0.0075 }],
    trailingLoss: null,
    maxDcaPerTrade: 1,
    dcaLevels: [-0.008],
    dcaMultipliers: [1],
  };
  if (!strategyConfig || typeof strategyConfig !== 'object') return fallback;

  const asPercent = (value: unknown, fallbackPercent: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallbackPercent;
    return Math.abs(parsed) / 100;
  };
  const asSignedPercent = (value: unknown, fallbackPercent: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallbackPercent;
    return parsed / 100;
  };

  const close = (strategyConfig.close as {
    mode?: unknown;
    tp?: unknown;
    ttp?: Array<{ percent?: unknown; arm?: unknown }>;
    sl?: unknown;
    tsl?: Array<{ percent?: unknown; arm?: unknown }>;
  } | undefined) ?? {};
  const additional = (strategyConfig.additional as {
    dcaEnabled?: unknown;
    dcaMode?: unknown;
    dcaTimes?: unknown;
    dcaLevels?: Array<{ percent?: unknown; multiplier?: unknown }>;
  } | undefined) ?? {};

  const closeMode = close.mode === 'advanced' ? 'advanced' : 'basic';
  const takeProfitPct = Math.max(0.0001, asPercent(close.tp, fallback.takeProfitPct * 100));
  const stopLossPct = Math.max(0.0001, asPercent(close.sl, fallback.stopLossPct * 100));
  const trailingTakeProfitLevels = (Array.isArray(close.ttp) ? close.ttp : [])
    .map((level) => ({
      // UI contract: `percent` = activation threshold (start), `arm` = trailing step.
      arm: asPercent(level?.percent, Number.NaN),
      percent: asPercent(level?.arm, Number.NaN),
    }))
    .filter((level) => Number.isFinite(level.arm) && Number.isFinite(level.percent) && level.arm > 0 && level.percent > 0)
    .sort((left, right) => left.arm - right.arm);
  const parsedTrailingStopLevels = (Array.isArray(close.tsl) ? close.tsl : [])
    .map((level) => ({
      arm: asPercent(level?.arm, 0),
      percent: asPercent(level?.percent, Number.NaN),
    }))
    .filter((level) => Number.isFinite(level.percent) && level.percent > 0)
    .sort((left, right) => left.arm - right.arm);
  const trailingStopLevels = parsedTrailingStopLevels.length > 0 ? parsedTrailingStopLevels : fallback.trailingStopLevels;
  const trailingLossRawPercent = Number((Array.isArray(close.tsl) ? close.tsl : [])[0]?.percent);
  const trailingLossRawStep = Number((Array.isArray(close.tsl) ? close.tsl : [])[0]?.arm);
  const trailingLoss =
    Number.isFinite(trailingLossRawPercent) &&
    Number.isFinite(trailingLossRawStep) &&
    trailingLossRawPercent < 0 &&
    trailingLossRawStep > 0
      ? { start: trailingLossRawPercent / 100, step: Math.abs(trailingLossRawStep) / 100 }
      : null;

  const dcaMode = additional.dcaMode === 'advanced' ? 'advanced' : 'basic';
  const dcaEnabled = Boolean(additional.dcaEnabled ?? true);
  const maxDcaRaw = Number(additional.dcaTimes);
  const configuredMaxDcaPerTrade = dcaEnabled
    ? Number.isFinite(maxDcaRaw)
      ? Math.max(0, Math.floor(maxDcaRaw))
      : fallback.maxDcaPerTrade
    : 0;
  const rawDcaLevels = Array.isArray(additional.dcaLevels) ? additional.dcaLevels : [];
  const configuredDcaLevels = rawDcaLevels
    .map((level) => asSignedPercent(level?.percent, Number.NaN))
    .filter((value) => Number.isFinite(value) && value !== 0);
  const configuredDcaMultipliers = rawDcaLevels
    .map((level) => Number(level?.multiplier))
    .filter((value) => Number.isFinite(value) && value > 0);
  const normalizedDcaLevels =
    !dcaEnabled
      ? []
      : dcaMode === 'advanced'
        ? (configuredDcaLevels.length > 0
          ? configuredDcaLevels
          : Array.from(
              { length: Math.max(1, configuredMaxDcaPerTrade || fallback.maxDcaPerTrade) },
              () => fallback.dcaLevels[0],
            ))
        : configuredMaxDcaPerTrade > 0
          ? Array.from(
              { length: Math.max(1, configuredMaxDcaPerTrade) },
              () => configuredDcaLevels[0] ?? fallback.dcaLevels[0],
            )
          : [];
  const normalizedDcaMultipliers =
    normalizedDcaLevels.length === 0
      ? []
      : dcaMode === 'advanced'
        ? (configuredDcaMultipliers.length > 0
          ? configuredDcaMultipliers.slice(0, normalizedDcaLevels.length)
          : Array.from({ length: normalizedDcaLevels.length }, () => fallback.dcaMultipliers[0]))
        : Array.from(
            { length: normalizedDcaLevels.length },
            () => configuredDcaMultipliers[0] ?? fallback.dcaMultipliers[0],
          );

  return {
    takeProfitPct: closeMode === 'basic' ? takeProfitPct : Number.POSITIVE_INFINITY,
    trailingTakeProfitLevels: closeMode === 'advanced' ? trailingTakeProfitLevels : [],
    stopLossPct: closeMode === 'basic' ? stopLossPct : Number.POSITIVE_INFINITY,
    trailingStopLevels: closeMode === 'advanced' ? trailingStopLevels : [],
    trailingLoss: closeMode === 'advanced' ? trailingLoss : null,
    maxDcaPerTrade: normalizedDcaLevels.length,
    dcaLevels: normalizedDcaLevels,
    dcaMultipliers: normalizedDcaMultipliers,
  };
};

const simulateInterleavedPortfolio = (input: {
  symbols: string[];
  candlesBySymbol: Map<string, KlineCandle[]>;
  marketType: MarketType;
  leverage: number;
  marginMode: MarginMode | 'NONE';
  strategyConfig?: Record<string, unknown> | null;
  fillModelConfig?: BacktestFillModelConfig;
  walletRiskPercent: number;
  initialBalance: number;
}): InterleavedPortfolioSimulationResult => {
  const effectiveLeverage = input.marketType === 'SPOT' ? 1 : Math.max(1, input.leverage);
  const rules = parseStrategySignalRules(input.strategyConfig);
  const strategyModeEnabled = Boolean(input.strategyConfig && typeof input.strategyConfig === 'object');
  const riskConfig = parseReplayRiskConfig(input.strategyConfig);
  const fillModel = createHistoricalBacktestFillModel(input.fillModelConfig);

  const perSymbol: Record<string, SymbolSimulationResult> = Object.fromEntries(
    input.symbols.map((symbol) => [
      symbol,
      {
        trades: [],
        liquidations: 0,
        events: [],
        eventCounts: {
          ENTRY: 0,
          EXIT: 0,
          DCA: 0,
          TP: 0,
          TTP: 0,
          SL: 0,
          TRAILING: 0,
          LIQUIDATION: 0,
        },
        decisionTrace: [],
      } satisfies SymbolSimulationResult,
    ]),
  );

  const indicatorCacheBySymbol = new Map<string, Map<string, Array<number | null>>>();
  const tradeSequenceBySymbol = new Map<string, number>(input.symbols.map((symbol) => [symbol, 0]));
  const cursorBySymbol = new Map<string, number>(
    input.symbols.map((symbol) => [symbol, 1]),
  );
  const openPositions = new Map<string, {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    quantity: number;
    openedAt: Date;
    dcaCount: number;
    lastDcaPrice: number;
    bestPrice: number;
    marginUsed: number;
    trailingLossLimit?: number;
  }>();

  let cashBalance = Math.max(0, input.initialBalance);
  const calcReservedMargin = () =>
    [...openPositions.values()].reduce((sum, position) => sum + position.marginUsed, 0);
  const calcReferenceBalance = () => Math.max(0, cashBalance + calcReservedMargin());

  const pickNextSymbol = () => {
    let selected: { symbol: string; openTime: number } | null = null;
    for (const symbol of input.symbols) {
      const candles = input.candlesBySymbol.get(symbol) ?? [];
      const cursor = cursorBySymbol.get(symbol) ?? 1;
      if (cursor >= candles.length) continue;
      const openTime = candles[cursor].openTime;
      if (!selected || openTime < selected.openTime || (openTime === selected.openTime && symbol.localeCompare(selected.symbol) < 0)) {
        selected = { symbol, openTime };
      }
    }
    return selected?.symbol ?? null;
  };

  const pushEvent = (
    symbol: string,
    type: ReplayEventType,
    side: PositionSide,
    timestamp: Date,
    price: number,
    pnl: number | null,
    candleIndex: number,
    tradeSequence: number,
  ) => {
    const bucket = perSymbol[symbol];
    bucket.events.push({
      symbol,
      type,
      side,
      timestamp,
      price,
      pnl,
      candleIndex,
      tradeSequence,
    });
    bucket.eventCounts[type] += 1;
  };

  while (true) {
    const symbol = pickNextSymbol();
    if (!symbol) break;
    const candles = input.candlesBySymbol.get(symbol) ?? [];
    const index = cursorBySymbol.get(symbol) ?? 1;
    const current = candles[index];
    const previous = candles[index - 1];
    const bucket = perSymbol[symbol];
    const indicatorCache = indicatorCacheBySymbol.get(symbol) ?? new Map<string, Array<number | null>>();
    indicatorCacheBySymbol.set(symbol, indicatorCache);
    const direction = strategyModeEnabled
      ? rules
        ? evaluateStrategySignalAtIndex(rules, candles, index, indicatorCache)
        : null
      : (() => {
        const base = previous.close > 0 ? previous.close : 1;
        const changePct = ((current.close - previous.close) / base) * 100;
        if (changePct >= 1) return 'LONG';
        if (changePct <= -1) return 'SHORT';
        if (Math.abs(changePct) <= 0.2) return 'EXIT';
        return null;
      })();
    const open = openPositions.get(symbol);
    const decision = direction
      ? decideExecutionAction(
        direction,
        open
          ? { side: open.side, quantity: open.quantity, managementMode: 'BOT_MANAGED' }
          : null,
      )
      : null;

    if (direction && decision) {
      const traceSide: PositionSide | null =
        decision.kind === 'open'
          ? (decision.positionSide as PositionSide)
          : open
            ? (open.side as PositionSide)
            : direction === 'LONG' || direction === 'SHORT'
              ? (direction as PositionSide)
              : null;
      bucket.decisionTrace.push({
        symbol,
        timestamp: new Date(current.openTime),
        candleIndex: index,
        signal: direction,
        side: traceSide,
        trigger: strategyModeEnabled ? 'STRATEGY' : 'THRESHOLD',
        mismatchReason: decision.kind === 'ignore' ? decision.reason : null,
      });
    }

    if (decision?.kind === 'open') {
      const entryPrice = fillModel.entryPrice(current.close, decision.positionSide as PositionSide);
      const quantity = computeRiskBasedOrderQuantity({
        price: entryPrice,
        walletRiskPercent: input.walletRiskPercent,
        referenceBalance: calcReferenceBalance(),
        leverage: effectiveLeverage,
        minQuantity: 0.000001,
      });
      const marginRequired = (entryPrice * quantity) / Math.max(1, effectiveLeverage);
      if (marginRequired <= cashBalance && quantity > 0) {
        cashBalance -= marginRequired;
        const sequence = (tradeSequenceBySymbol.get(symbol) ?? 0) + 1;
        tradeSequenceBySymbol.set(symbol, sequence);
        openPositions.set(symbol, {
          side: decision.positionSide,
          entryPrice,
          quantity,
          openedAt: new Date(current.openTime),
          dcaCount: 0,
          lastDcaPrice: entryPrice,
          bestPrice: entryPrice,
          marginUsed: marginRequired,
        });
        pushEvent(symbol, 'ENTRY', decision.positionSide as PositionSide, new Date(current.openTime), entryPrice, null, index, sequence);
      }
      cursorBySymbol.set(symbol, index + 1);
      continue;
    }

    if (!open) {
      cursorBySymbol.set(symbol, index + 1);
      continue;
    }

    const position = open;
    if (position.side === 'LONG') position.bestPrice = Math.max(position.bestPrice, current.high);
    else position.bestPrice = Math.min(position.bestPrice, current.low);

    const baseState = {
      averageEntryPrice: position.entryPrice,
      quantity: position.quantity,
      currentAdds: position.dcaCount,
      trailingAnchorPrice: position.bestPrice,
      trailingLossLimitPercent: position.trailingLossLimit,
      lastDcaPrice: position.lastDcaPrice,
    };

    const dcaProbeInput: PositionManagementInput = {
      ...buildReplayPositionManagementInput({
        side: position.side,
        currentPrice: position.side === 'LONG' ? current.low : current.high,
        entryPrice: position.entryPrice,
        leverage: effectiveLeverage,
        riskConfig,
      }),
      takeProfitPrice: undefined,
      stopLossPrice: undefined,
      trailingTakeProfit: undefined,
      trailingTakeProfitLevels: undefined,
      trailingStop: undefined,
      trailingStopLevels: undefined,
      trailingLoss: undefined,
    };
    const dcaProbeResult = evaluatePositionManagement(dcaProbeInput, baseState);
    const hasPendingDcaLevels = position.dcaCount < riskConfig.maxDcaPerTrade;
    const nextDcaMultiplier =
      riskConfig.dcaMultipliers[position.dcaCount] ??
      riskConfig.dcaMultipliers[riskConfig.dcaMultipliers.length - 1] ??
      1;
    const estimatedNextDcaAddedQty = Math.max(0, position.quantity * Math.max(0, nextDcaMultiplier));
    const estimatedNextDcaMargin = (current.close * estimatedNextDcaAddedQty) / Math.max(1, effectiveLeverage);
    const dcaFundsExhausted =
      hasPendingDcaLevels && estimatedNextDcaAddedQty > 0
        ? estimatedNextDcaMargin > cashBalance
        : false;
    const lockTrailingByPendingDca = hasPendingDcaLevels && !dcaFundsExhausted;

    if (dcaProbeResult.dcaExecuted) {
      const addedQty = Math.max(0, dcaProbeResult.nextState.quantity - position.quantity);
      const addMargin = (current.close * addedQty) / Math.max(1, effectiveLeverage);
      if (addMargin > cashBalance) {
        // Legacy parity: no DCA add when wallet cannot cover extra margin.
        const managementWithoutDca: PositionManagementInput = {
          ...dcaProbeInput,
          dca: undefined,
        };
        const noDcaProbe = evaluatePositionManagement(managementWithoutDca, baseState);
        position.trailingLossLimit = noDcaProbe.nextState.trailingLossLimitPercent;
        position.bestPrice = noDcaProbe.nextState.trailingAnchorPrice ?? position.bestPrice;
      } else {
        cashBalance -= addMargin;
        position.marginUsed += addMargin;
        position.quantity = dcaProbeResult.nextState.quantity;
        position.entryPrice = dcaProbeResult.nextState.averageEntryPrice;
        position.dcaCount = dcaProbeResult.nextState.currentAdds;
        position.lastDcaPrice = current.close;
        pushEvent(
          symbol,
          'DCA',
          position.side as PositionSide,
          new Date(current.openTime),
          current.close,
          null,
          index,
          tradeSequenceBySymbol.get(symbol) ?? 1,
        );
      }
    }

    const managementInput = {
      ...buildReplayPositionManagementInput({
        side: position.side,
        currentPrice: current.close,
        entryPrice: position.entryPrice,
        leverage: effectiveLeverage,
        riskConfig,
      }),
      dca: undefined,
      dcaFundsExhausted,
    } satisfies PositionManagementInput;
    let managementResult = evaluatePositionManagement(managementInput, {
      averageEntryPrice: position.entryPrice,
      quantity: position.quantity,
      currentAdds: position.dcaCount,
      trailingAnchorPrice: dcaProbeResult.nextState.trailingAnchorPrice ?? position.bestPrice,
      trailingLossLimitPercent: dcaProbeResult.nextState.trailingLossLimitPercent,
      lastDcaPrice: position.lastDcaPrice,
    });

    position.trailingLossLimit = managementResult.nextState.trailingLossLimitPercent;
    position.bestPrice = managementResult.nextState.trailingAnchorPrice ?? position.bestPrice;

    if (
      lockTrailingByPendingDca &&
      managementResult.shouldClose &&
      ['trailing_take_profit', 'trailing_stop', 'stop_loss'].includes(
        managementResult.closeReason ?? '',
      )
    ) {
      managementResult = {
        ...managementResult,
        shouldClose: false,
        closeReason: undefined,
      };
    }

    let exitMarkPrice = current.close;
    if (!managementResult.shouldClose && !lockTrailingByPendingDca) {
      const ttpTriggerPrice = computeTrailingTakeProfitTriggerPrice({
        side: position.side as PositionSide,
        entryPrice: position.entryPrice,
        anchorPrice: position.bestPrice,
        leverage: effectiveLeverage,
        levels: riskConfig.trailingTakeProfitLevels,
      });
      if (typeof ttpTriggerPrice === 'number') {
        const crossedIntrabar =
          position.side === 'LONG' ? current.low <= ttpTriggerPrice : current.high >= ttpTriggerPrice;
        if (crossedIntrabar) {
          managementResult = {
            ...managementResult,
            shouldClose: true,
            closeReason: 'trailing_take_profit',
          };
          exitMarkPrice = ttpTriggerPrice;
        }
      }
    } else if (managementResult.closeReason === 'trailing_take_profit') {
      const ttpTriggerPrice = computeTrailingTakeProfitTriggerPrice({
        side: position.side as PositionSide,
        entryPrice: position.entryPrice,
        anchorPrice: position.bestPrice,
        leverage: effectiveLeverage,
        levels: riskConfig.trailingTakeProfitLevels,
      });
      if (typeof ttpTriggerPrice === 'number') {
        exitMarkPrice = ttpTriggerPrice;
      }
    }

    const adverseMove =
      position.side === 'LONG'
        ? (position.entryPrice - current.low) / Math.max(position.entryPrice, 1e-8)
        : (current.high - position.entryPrice) / Math.max(position.entryPrice, 1e-8);

    const isolatedThreshold = 1 / Math.max(1, effectiveLeverage);
    const isIsolatedLiquidated =
      input.marketType === 'FUTURES' &&
      input.marginMode === 'ISOLATED' &&
      adverseMove >= isolatedThreshold;
    if (
      !isIsolatedLiquidated &&
      !managementResult.shouldClose
    ) {
      cursorBySymbol.set(symbol, index + 1);
      continue;
    }

    const clampedExitMarkPrice =
      position.side === 'LONG'
        ? clamp(exitMarkPrice, current.low, current.high)
        : clamp(exitMarkPrice, current.low, current.high);
    const exitPrice = fillModel.exitPrice(clampedExitMarkPrice, position.side as PositionSide);
    const settlement = fillModel.settle({
      side: position.side as PositionSide,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      leverage: effectiveLeverage,
    });
    const rawPnl = settlement.grossPnl - settlement.fees;
    let pnl = isIsolatedLiquidated ? -position.marginUsed : rawPnl;
    if (input.marginMode === 'ISOLATED') {
      pnl = Math.max(-position.marginUsed, pnl);
    }
    let nextCash = cashBalance + position.marginUsed + pnl;
    if (nextCash < 0) {
      pnl = -(cashBalance + position.marginUsed);
      nextCash = 0;
    }
    cashBalance = nextCash;

    const closeType: ReplayEventType = isIsolatedLiquidated
      ? 'LIQUIDATION'
      : managementResult.shouldClose
        ? closeReasonToEventType(managementResult.closeReason)
        : 'EXIT';
    if (isIsolatedLiquidated) {
      bucket.liquidations += 1;
    }
    bucket.trades.push({
      symbol,
      side: position.side as PositionSide,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      openedAt: position.openedAt,
      closedAt: new Date(current.closeTime),
      pnl,
      fee: settlement.fees,
      exitReason: isIsolatedLiquidated ? 'LIQUIDATION' : 'SIGNAL_EXIT',
      liquidated: isIsolatedLiquidated,
    });
    pushEvent(
      symbol,
      closeType,
      position.side as PositionSide,
      new Date(current.closeTime),
      exitPrice,
      pnl,
      index,
      tradeSequenceBySymbol.get(symbol) ?? 1,
    );
    openPositions.delete(symbol);
    cursorBySymbol.set(symbol, index + 1);
  }

  for (const [symbol, position] of openPositions.entries()) {
    const candles = input.candlesBySymbol.get(symbol) ?? [];
    if (candles.length === 0) continue;
    const last = candles[candles.length - 1];
    const exitPrice = fillModel.exitPrice(last.close, position.side as PositionSide);
    const settlement = fillModel.settle({
      side: position.side as PositionSide,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      leverage: effectiveLeverage,
    });
    let pnl = settlement.grossPnl - settlement.fees;
    if (input.marginMode === 'ISOLATED') {
      pnl = Math.max(-position.marginUsed, pnl);
    }
    let nextCash = cashBalance + position.marginUsed + pnl;
    if (nextCash < 0) {
      pnl = -(cashBalance + position.marginUsed);
      nextCash = 0;
    }
    cashBalance = nextCash;
    const bucket = perSymbol[symbol];
    bucket.trades.push({
      symbol,
      side: position.side as PositionSide,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      openedAt: position.openedAt,
      closedAt: new Date(last.closeTime),
      pnl,
      fee: settlement.fees,
      exitReason: 'FINAL_CANDLE',
      liquidated: false,
    });
    pushEvent(
      symbol,
      'EXIT',
      position.side as PositionSide,
      new Date(last.closeTime),
      exitPrice,
      pnl,
      candles.length - 1,
      tradeSequenceBySymbol.get(symbol) ?? 1,
    );
    bucket.decisionTrace.push({
      symbol,
      timestamp: new Date(last.closeTime),
      candleIndex: candles.length - 1,
      signal: 'EXIT',
      side: position.side as PositionSide,
      trigger: 'FINAL_CANDLE',
      mismatchReason: null,
    });
  }

  return {
    perSymbol,
    finalBalance: cashBalance + calcReservedMargin(),
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

const emptyLifecycleEventCounts = (): LifecycleEventCounts => ({
  ENTRY: 0,
  EXIT: 0,
  DCA: 0,
  TP: 0,
  TTP: 0,
  SL: 0,
  TRAILING: 0,
  LIQUIDATION: 0,
});

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
  const lifecycleEventCounts = emptyLifecycleEventCounts();
  const strategy = run.strategyId
    ? await prisma.strategy.findFirst({
      where: { id: run.strategyId, userId: run.userId },
      select: { config: true, walletRisk: true },
    })
    : null;
  const strategyConfig = (strategy?.config as Record<string, unknown> | undefined) ?? null;
  const strategyWalletRisk = normalizeWalletRiskPercent(strategy?.walletRisk ?? 1, 1);
  const strategyRulesActive = Boolean(parseStrategySignalRules(strategyConfig));
  const fillModelConfig: BacktestFillModelConfig = {
    feeRate:
      typeof (seed as { feeRate?: unknown }).feeRate === 'number'
        ? Number((seed as { feeRate?: unknown }).feeRate)
        : undefined,
    slippageRate:
      typeof (seed as { slippageRate?: unknown }).slippageRate === 'number'
        ? Number((seed as { slippageRate?: unknown }).slippageRate)
        : undefined,
    fundingRate:
      typeof (seed as { fundingRate?: unknown }).fundingRate === 'number'
        ? Number((seed as { fundingRate?: unknown }).fundingRate)
        : undefined,
  };
  const symbolInputCoverage: Array<{
    symbol: string;
    candles: number;
    fundingPoints: number;
    openInterestPoints: number;
  }> = [];
  const parityDiagnostics: Array<{
    symbol: string;
    status: 'PROCESSED' | 'FAILED';
    strategyRulesActive: boolean;
    entryEvents: number;
    closeEvents: number;
    liquidationEvents: number;
    mismatchCount: number;
    mismatchSamples: Array<{
      timestamp: string;
      side: PositionSide | null;
      trigger: 'STRATEGY' | 'THRESHOLD' | 'FINAL_CANDLE';
      mismatchReason:
        | 'no_open_position'
        | 'no_flip_with_open_position'
        | 'already_open_same_side'
        | 'manual_managed_symbol';
    }>;
    fundingPoints: number;
    openInterestPoints: number;
    error: string | null;
  }> = [];

  try {
    const candlesBySymbol = new Map<string, KlineCandle[]>();
    const supplementalBySymbol = new Map<string, SupplementalSeries>();

    for (const [index, symbol] of symbols.entries()) {
      progress.currentSymbol = symbol;
      progress.lastUpdate = `loading_${symbol}`;
      progress.updatedAt = new Date().toISOString();
      await updateRunProgress(runId, seed, progress);

      try {
        const candles = await fetchKlines(symbol, run.timeframe, marketType, maxCandlesPerSymbol);
        if (candles.length === 0) {
          throw new Error('NO_CANDLES_AVAILABLE_FOR_SYMBOL');
        }
        const supplemental = await fetchSupplementalSeries(symbol, run.timeframe, marketType, maxCandlesPerSymbol);
        candlesBySymbol.set(symbol, candles);
        supplementalBySymbol.set(symbol, supplemental);
        symbolInputCoverage.push({
          symbol,
          candles: candles.length,
          fundingPoints: supplemental.fundingRates.length,
          openInterestPoints: supplemental.openInterest.length,
        });
        progress.totalCandlesForSymbol = candles.length;
        progress.currentCandleIndex = candles.length > 0 ? candles.length - 1 : 0;
        progress.currentCandleTime = candles.length > 0 ? new Date(candles[candles.length - 1].openTime).toISOString() : null;
        progress.updatedAt = new Date().toISOString();
        await updateRunProgress(runId, seed, progress);
      } catch (error) {
        progress.failedSymbols.push(symbol);
        parityDiagnostics.push({
          symbol,
          status: 'FAILED',
          strategyRulesActive,
          entryEvents: 0,
          closeEvents: 0,
          liquidationEvents: 0,
          mismatchCount: 0,
          mismatchSamples: [],
          fundingPoints: 0,
          openInterestPoints: 0,
          error: error instanceof Error ? error.message : 'UNKNOWN_SYMBOL_PROCESSING_ERROR',
        });
      }

      progress.processedSymbols = index + 1;
      progress.lastUpdate = `processed_${symbol}`;
      progress.updatedAt = new Date().toISOString();
      await updateRunProgress(runId, seed, progress);
    }

    const loadedSymbols = symbols.filter((symbol) => candlesBySymbol.has(symbol));
    if (loadedSymbols.length > 0) {
      progress.currentSymbol = 'INTERLEAVED_PORTFOLIO_CLOCK';
      progress.lastUpdate = 'simulating_interleaved_portfolio';
      progress.updatedAt = new Date().toISOString();
      await updateRunProgress(runId, seed, progress);

      const simulation = simulateInterleavedPortfolio({
        symbols: loadedSymbols,
        candlesBySymbol,
        marketType,
        leverage: progress.leverage,
        marginMode: progress.marginMode,
        strategyConfig,
        fillModelConfig,
        walletRiskPercent: strategyWalletRisk,
        initialBalance,
      });

      for (const symbol of loadedSymbols) {
        const symbolSimulation = simulation.perSymbol[symbol];
        if (!symbolSimulation) continue;
        const supplemental = supplementalBySymbol.get(symbol) ?? { fundingRates: [], openInterest: [] };
        const decisionTrace = Array.isArray(symbolSimulation.decisionTrace)
          ? symbolSimulation.decisionTrace
          : [];
        for (const [key, value] of Object.entries(symbolSimulation.eventCounts)) {
          lifecycleEventCounts[key as keyof LifecycleEventCounts] += value;
        }
        parityDiagnostics.push({
          symbol,
          status: 'PROCESSED',
          strategyRulesActive,
          entryEvents: symbolSimulation.eventCounts.ENTRY,
          closeEvents:
            symbolSimulation.eventCounts.EXIT +
            symbolSimulation.eventCounts.TP +
            symbolSimulation.eventCounts.TTP +
            symbolSimulation.eventCounts.SL +
            symbolSimulation.eventCounts.TRAILING,
          liquidationEvents: symbolSimulation.eventCounts.LIQUIDATION,
          mismatchCount: decisionTrace.filter((entry) => entry.mismatchReason !== null).length,
          mismatchSamples: decisionTrace
            .filter((entry) => entry.mismatchReason !== null)
            .slice(0, 25)
            .map((entry) => ({
              timestamp: entry.timestamp.toISOString(),
              side: entry.side,
              trigger: entry.trigger,
              mismatchReason: entry.mismatchReason as
                | 'no_open_position'
                | 'no_flip_with_open_position'
                | 'already_open_same_side'
                | 'manual_managed_symbol',
            })),
          fundingPoints: supplemental.fundingRates.length,
          openInterestPoints: supplemental.openInterest.length,
          error: null,
        });

        const trades = symbolSimulation.trades;
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
              exitReason: trade.exitReason,
              liquidated: trade.liquidated,
            })),
          });

          for (const trade of trades) {
            progress.totalTrades += 1;
            progress.netPnl += trade.pnl;
            if (trade.pnl > 0) progress.grossProfit += trade.pnl;
            if (trade.pnl < 0) progress.grossLoss += Math.abs(trade.pnl);
            pnlSeries.push(trade.pnl);
          }
        }
        progress.liquidations += symbolSimulation.liquidations;
      }
      progress.maxDrawdown = maxDrawdownFromPnlSeries(pnlSeries);
    }

    const totalTrades = progress.totalTrades;
    const winningTrades = await prisma.backtestTrade.count({
      where: { backtestRunId: run.id, userId: run.userId, pnl: { gt: 0 } },
    });
    const losingTrades = await prisma.backtestTrade.count({
      where: { backtestRunId: run.id, userId: run.userId, pnl: { lt: 0 } },
    });

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : null;
    const sourceWindowDays = Math.max(
      14,
      Math.ceil(computeSourceWindowMs(run.timeframe, maxCandlesPerSymbol) / (24 * 60 * 60 * 1000)),
    );

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
          historicalInputs: {
            sourceWindowDays,
            symbolCoverage: symbolInputCoverage,
          },
          parityDiagnostics,
          leverage: progress.leverage,
          marginMode: progress.marginMode,
          liquidations: progress.liquidations,
          lifecycleEventCounts,
          initialBalance,
          endBalance: Math.max(0, initialBalance + progress.netPnl),
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
          historicalInputs: {
            sourceWindowDays,
            symbolCoverage: symbolInputCoverage,
          },
          parityDiagnostics,
          leverage: progress.leverage,
          marginMode: progress.marginMode,
          liquidations: progress.liquidations,
          lifecycleEventCounts,
          initialBalance,
          endBalance: Math.max(0, initialBalance + progress.netPnl),
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
        executionMode: 'interleaved_multi_market_portfolio_clock',
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
      finishedAt: true,
    },
  });
  if (!run) return null;

  const seed = ((run.seedConfig ?? {}) as Record<string, unknown>) ?? {};
  const runSymbols = Array.isArray(seed.symbols)
    ? uniqueSorted((seed.symbols as string[]).map((item) => item.trim().toUpperCase()))
    : [];
  const marketType = (seed.marketType === 'SPOT' ? 'SPOT' : 'FUTURES') as MarketType;
  const maxCandles = typeof seed.maxCandles === 'number'
    ? clamp(Math.floor(seed.maxCandles), 100, 10_000)
    : computeAdaptiveMaxCandles(run.timeframe, 1, undefined);

  const symbol = query.symbol.trim().toUpperCase();
  if (runSymbols.length > 0 && !runSymbols.includes(symbol)) {
    return null;
  }
  const replaySymbols = runSymbols.length > 0 ? runSymbols : [symbol];
  const liveProgress = (seed.liveProgress ?? {}) as {
    currentCandleTime?: string | null;
  };
  const timelineEndTimeMsRaw =
    typeof liveProgress.currentCandleTime === 'string'
      ? Date.parse(liveProgress.currentCandleTime)
      : Number.NaN;
  const timelineEndTimeMs = Number.isFinite(timelineEndTimeMsRaw)
    ? timelineEndTimeMsRaw
    : run.finishedAt
      ? run.finishedAt.getTime()
      : undefined;
  const candlesBySymbol = new Map<string, KlineCandle[]>();
  for (const replaySymbol of replaySymbols) {
    candlesBySymbol.set(
      replaySymbol,
      await fetchKlines(replaySymbol, run.timeframe, marketType, maxCandles, timelineEndTimeMs),
    );
  }
  const candles = candlesBySymbol.get(symbol) ?? [];
  const supplemental = await fetchSupplementalSeries(
    symbol,
    run.timeframe,
    marketType,
    maxCandles,
    timelineEndTimeMs,
  );
  const total = candles.length;
  const requestedCursor = clamp(query.cursor, 0, total);
  const start =
    requestedCursor >= total && total > 0
      ? Math.max(0, total - query.chunkSize)
      : requestedCursor;
  const end = clamp(start + query.chunkSize, 0, total);
  const chunk = candles.slice(start, end);

  const strategy = run.strategyId
    ? await prisma.strategy.findFirst({
      where: { id: run.strategyId, userId },
      select: { config: true, walletRisk: true },
    })
    : null;
  const strategyWalletRisk = normalizeWalletRiskPercent(strategy?.walletRisk ?? 1, 1);

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

  const leverageCandidate = Number((seed as { leverage?: unknown }).leverage);
  const leverage = Number.isFinite(leverageCandidate) ? leverageCandidate : 1;
  const marginMode = seed.marginMode === 'ISOLATED' ? 'ISOLATED' : (seed.marginMode === 'CROSSED' ? 'CROSSED' : 'NONE');
  const replay = simulateInterleavedPortfolio({
    symbols: replaySymbols,
    candlesBySymbol,
    marketType,
    leverage: marketType === 'SPOT' ? 1 : leverage,
    marginMode,
    strategyConfig: (strategy?.config as Record<string, unknown> | undefined) ?? null,
    fillModelConfig: {
      feeRate:
        typeof (seed as { feeRate?: unknown }).feeRate === 'number'
          ? Number((seed as { feeRate?: unknown }).feeRate)
          : undefined,
      slippageRate:
        typeof (seed as { slippageRate?: unknown }).slippageRate === 'number'
          ? Number((seed as { slippageRate?: unknown }).slippageRate)
          : undefined,
      fundingRate:
        typeof (seed as { fundingRate?: unknown }).fundingRate === 'number'
          ? Number((seed as { fundingRate?: unknown }).fundingRate)
          : undefined,
    },
    walletRiskPercent: strategyWalletRisk,
    initialBalance:
      typeof (seed as { initialBalance?: unknown }).initialBalance === 'number'
        ? Number((seed as { initialBalance?: number }).initialBalance)
        : 10_000,
  });
  const symbolReplay = replay.perSymbol[symbol] ?? {
    trades: [],
    liquidations: 0,
    events: [],
    eventCounts: {
      ENTRY: 0,
      EXIT: 0,
      DCA: 0,
      TP: 0,
      TTP: 0,
      SL: 0,
      TRAILING: 0,
      LIQUIDATION: 0,
    } as Record<ReplayEventType, number>,
    decisionTrace: [],
  };

  const events = symbolReplay.events
    .filter((event) => event.candleIndex >= start && event.candleIndex < end)
    .map((event) => {
      const eventId = `${runId}_${symbol}_${event.tradeSequence}_${event.type}_${event.candleIndex}`;
      const isCloseLike = event.type !== 'ENTRY' && event.type !== 'DCA';
      return {
        id: eventId,
        tradeId: `${runId}_${symbol}_${event.tradeSequence}`,
        type: event.type,
        side: event.side,
        timestamp: event.timestamp.toISOString(),
        price: event.price,
        pnl: event.pnl,
        candleIndex: event.candleIndex,
        reason: isCloseLike ? event.type : null,
      };
    });

  const liveProgressPlayback = (seed.liveProgress ?? {}) as {
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
    previousCursor: start > 0 ? Math.max(0, start - query.chunkSize) : null,
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
    parityDiagnostics: {
      strategyRulesActive: Boolean(
        parseStrategySignalRules((strategy?.config as Record<string, unknown> | undefined) ?? null),
      ),
      eventCounts: symbolReplay.eventCounts,
      mismatchCount: symbolReplay.decisionTrace.filter((entry) => entry.mismatchReason !== null).length,
      mismatchSamples: symbolReplay.decisionTrace
        .filter(
          (entry) =>
            entry.mismatchReason !== null && entry.candleIndex >= start && entry.candleIndex < end,
        )
        .slice(0, 50)
        .map((entry) => ({
          timestamp: entry.timestamp.toISOString(),
          side: entry.side,
          trigger: entry.trigger,
          mismatchReason: entry.mismatchReason,
        })),
      fundingPoints: supplemental.fundingRates.length,
      openInterestPoints: supplemental.openInterest.length,
    },
    positionStats: {
      closedOnFinalCandleCount: symbolReplay.trades.filter((trade) => trade.exitReason === 'FINAL_CANDLE').length,
      liquidationsCount: symbolReplay.trades.filter((trade) => trade.exitReason === 'LIQUIDATION' || trade.liquidated).length,
      tradeCount: symbolReplay.trades.length,
    },
    marketInputs: {
      fundingRates: supplemental.fundingRates
        .map((point) => {
          const candleIndex = candles.findIndex((candle) => candle.openTime >= point.timestamp);
          if (candleIndex < start || candleIndex >= end || candleIndex < 0) return null;
          return {
            candleIndex,
            timestamp: new Date(point.timestamp).toISOString(),
            value: point.fundingRate,
          };
        })
        .filter((point): point is { candleIndex: number; timestamp: string; value: number } => Boolean(point)),
      openInterest: supplemental.openInterest
        .map((point) => {
          const candleIndex = candles.findIndex((candle) => candle.openTime >= point.timestamp);
          if (candleIndex < start || candleIndex >= end || candleIndex < 0) return null;
          return {
            candleIndex,
            timestamp: new Date(point.timestamp).toISOString(),
            value: point.openInterest,
          };
        })
        .filter((point): point is { candleIndex: number; timestamp: string; value: number } => Boolean(point)),
    },
        supportedEventTypes: ['ENTRY', 'EXIT', 'DCA', 'TP', 'TTP', 'SL', 'TRAILING', 'LIQUIDATION'],
    unsupportedEventTypes: [],
    playbackCursor:
      liveProgressPlayback.currentSymbol === symbol && typeof liveProgressPlayback.currentCandleIndex === 'number'
        ? liveProgressPlayback.currentCandleIndex
        : null,
  };
};
