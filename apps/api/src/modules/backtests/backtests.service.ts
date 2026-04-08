import { Exchange, PositionSide, Prisma } from '@prisma/client';
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
  computeEmaSeriesFromCloses,
  computeMacdSeriesFromCloses,
  computeMomentumSeriesFromCloses,
  computeRocSeriesFromCloses,
  computeRsiSeriesFromCloses,
  computeSmaSeriesFromCloses,
  computeStochRsiSeriesFromCloses,
} from '../engine/sharedIndicatorSeries';
import {
  computeRiskBasedOrderQuantity,
  normalizeWalletRiskPercent,
} from '../engine/positionSizing';
import {
  type ReplayEventDraft,
  type ReplayParityDecisionTrace,
  type ReplayEventType,
  type StrategyRiskConfig,
  buildReplayPositionManagementInput,
  closeReasonToEventType,
  parseStrategyRiskConfig,
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
  source: 'EMA' | 'SMA' | 'RSI' | 'MOMENTUM' | 'MACD' | 'ROC' | 'STOCHRSI';
  params: Record<string, number>;
  channel?: 'LINE' | 'SIGNAL' | 'HISTOGRAM' | 'K' | 'D';
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

const inferBaseCurrencyFromSymbol = (symbol: string): string =>
  (symbol.match(/(USDT|USDC|BUSD|FDUSD|BTC|ETH|EUR|USD)$/)?.[1] ?? 'USDT').toUpperCase();

const getIntervalMs = (timeframe: string) => timeframeIntervalMs[normalizeTimeframe(timeframe)] ?? timeframeIntervalMs['5m'];

const computeSourceWindowMs = (timeframe: string, maxCandles: number) => {
  const intervalMs = getIntervalMs(timeframe);
  const requestedWindowMs = intervalMs * Math.max(1, maxCandles);
  const bufferedWindowMs = Math.ceil(requestedWindowMs * 1.15);
  return Math.max(TWO_WEEKS_MS, bufferedWindowMs);
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

type InterleavedPortfolioSimulationResult = {
  perSymbol: Record<string, SymbolSimulationResult>;
  finalBalance: number;
};

const simulateInterleavedPortfolio = (input: {
  symbols: string[];
  candlesBySymbol: Map<string, KlineCandle[]>;
  analysisStartIndexBySymbol?: Map<string, number>;
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
  const riskConfig = parseStrategyRiskConfig(input.strategyConfig);
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
  const resolveStartIndex = (symbol: string) => {
    const candles = input.candlesBySymbol.get(symbol) ?? [];
    if (candles.length <= 1) return 1;
    const configuredStart = input.analysisStartIndexBySymbol?.get(symbol);
    if (typeof configuredStart !== 'number' || !Number.isFinite(configuredStart)) return 1;
    return clamp(Math.floor(configuredStart), 1, candles.length - 1);
  };
  const cursorBySymbol = new Map<string, number>(input.symbols.map((symbol) => [symbol, resolveStartIndex(symbol)]));
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
    trailingTakeProfitHigh?: number;
    trailingTakeProfitStep?: number;
  }>();

  let cashBalance = Math.max(0, input.initialBalance);
  const calcReservedMargin = () =>
    [...openPositions.values()].reduce((sum, position) => sum + position.marginUsed, 0);
  const calcReferenceBalance = () => Math.max(0, cashBalance + calcReservedMargin());

  const pickNextSymbol = () => {
    let selected: { symbol: string; openTime: number } | null = null;
    for (const symbol of input.symbols) {
      const candles = input.candlesBySymbol.get(symbol) ?? [];
      const cursor = cursorBySymbol.get(symbol) ?? resolveStartIndex(symbol);
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
    const index = cursorBySymbol.get(symbol) ?? resolveStartIndex(symbol);
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
      trailingTakeProfitHighPercent: position.trailingTakeProfitHigh,
      trailingTakeProfitStepPercent: position.trailingTakeProfitStep,
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
        position.trailingTakeProfitHigh = noDcaProbe.nextState.trailingTakeProfitHighPercent;
        position.trailingTakeProfitStep = noDcaProbe.nextState.trailingTakeProfitStepPercent;
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
      // Keep trailing memory from runtime state; DCA probe runs with trailing
      // disabled and cannot be allowed to wipe active trailing tracking.
      trailingAnchorPrice: position.bestPrice,
      trailingLossLimitPercent: position.trailingLossLimit,
      trailingTakeProfitHighPercent: position.trailingTakeProfitHigh,
      trailingTakeProfitStepPercent: position.trailingTakeProfitStep,
      lastDcaPrice: position.lastDcaPrice,
    });

    position.trailingLossLimit = managementResult.nextState.trailingLossLimitPercent;
    position.trailingTakeProfitHigh = managementResult.nextState.trailingTakeProfitHighPercent;
    position.trailingTakeProfitStep = managementResult.nextState.trailingTakeProfitStepPercent;
    position.bestPrice = managementResult.nextState.trailingAnchorPrice ?? position.bestPrice;

    if (
      lockTrailingByPendingDca &&
      managementResult.shouldClose &&
      ['trailing_stop', 'stop_loss'].includes(
        managementResult.closeReason ?? '',
      )
    ) {
      managementResult = {
        ...managementResult,
        shouldClose: false,
        closeReason: undefined,
      };
    }

    const exitMarkPrice = current.close;

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

  const specs: IndicatorSpec[] = flatten.flatMap((item): IndicatorSpec[] => {
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
          source: 'EMA' as const,
          params: { period: fast },
        },
        {
          key: `${name}_SLOW_${slow}`,
          name: `${name} SLOW`,
          period: slow,
          panel: 'price' as const,
          source: 'EMA' as const,
          params: { period: slow },
        },
      ];
    }

    if (name.includes('MACD') && params) {
      const fast = asPeriod(params.fast, 12);
      const slow = asPeriod(params.slow, 26);
      const signal = asPeriod(params.signal, 9);
      const warmup = slow + signal;
      return [
        {
          key: `${name}_LINE_${fast}_${slow}_${signal}`,
          name: `${name} LINE`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'MACD' as const,
          params: { fast, slow, signal },
          channel: 'LINE' as const,
        },
        {
          key: `${name}_SIGNAL_${fast}_${slow}_${signal}`,
          name: `${name} SIGNAL`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'MACD' as const,
          params: { fast, slow, signal },
          channel: 'SIGNAL' as const,
        },
        {
          key: `${name}_HISTOGRAM_${fast}_${slow}_${signal}`,
          name: `${name} HISTOGRAM`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'MACD' as const,
          params: { fast, slow, signal },
          channel: 'HISTOGRAM' as const,
        },
      ];
    }

    if (name.includes('STOCHRSI') && params) {
      const period = asPeriod(params.period ?? params.rsiPeriod, 14);
      const stochPeriod = asPeriod(params.stochPeriod, period);
      const smoothK = asPeriod(params.smoothK, 3);
      const smoothD = asPeriod(params.smoothD, 3);
      const warmup = period + stochPeriod + smoothK + smoothD;
      return [
        {
          key: `${name}_K_${period}_${stochPeriod}_${smoothK}_${smoothD}`,
          name: `${name} K`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'STOCHRSI' as const,
          params: { period, stochPeriod, smoothK, smoothD },
          channel: 'K' as const,
        },
        {
          key: `${name}_D_${period}_${stochPeriod}_${smoothK}_${smoothD}`,
          name: `${name} D`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'STOCHRSI' as const,
          params: { period, stochPeriod, smoothK, smoothD },
          channel: 'D' as const,
        },
      ];
    }

    const periodCandidate = params && typeof params.period !== 'undefined'
      ? Number(params.period)
      : params && typeof params.length !== 'undefined'
        ? Number(params.length)
        : 14;
    const period = clamp(Number.isFinite(periodCandidate) ? Math.floor(periodCandidate) : 14, 2, 300);
    const source: IndicatorSpec['source'] =
      name.includes('SMA')
        ? 'SMA'
        : name.includes('STOCHRSI')
          ? 'STOCHRSI'
        : name.includes('ROC')
          ? 'ROC'
        : name.includes('RSI')
          ? 'RSI'
          : name.includes('MOMENTUM')
            ? 'MOMENTUM'
            : 'MOMENTUM';
    const panel: 'price' | 'oscillator' = source === 'SMA' ? 'price' : 'oscillator';
    return [{
      key: `${name}_${period}`,
      name,
      period,
      panel,
      source,
      params: { period },
    } satisfies IndicatorSpec];
  });

  const unique = new Map<string, IndicatorSpec>();
  for (const spec of specs) {
    if (!unique.has(spec.key)) unique.set(spec.key, spec);
  }
  return [...unique.values()];
};

const resolveIndicatorWarmupCandles = (strategyConfig: unknown) => {
  const specs = parseStrategyIndicators(strategyConfig);
  if (specs.length === 0) return 0;
  return specs.reduce((maxPeriod, spec) => Math.max(maxPeriod, spec.period), 0);
};

const buildIndicatorSeries = (candles: KlineCandle[], specs: IndicatorSpec[]) => {
  const closes = candles.map((candle) => candle.close);
  const macdCache = new Map<
    string,
    {
      line: Array<number | null>;
      signal: Array<number | null>;
      histogram: Array<number | null>;
    }
  >();
  return specs.map((spec) => {
    const values = (() => {
      if (spec.source === 'EMA') {
        const period = spec.params.period ?? spec.period;
        return computeEmaSeriesFromCloses(closes, period);
      }

      if (spec.source === 'SMA') {
        const period = spec.params.period ?? spec.period;
        return computeSmaSeriesFromCloses(closes, period);
      }

      if (spec.source === 'RSI') {
        const period = spec.params.period ?? spec.period;
        return computeRsiSeriesFromCloses(closes, period);
      }

      if (spec.source === 'ROC') {
        const period = spec.params.period ?? spec.period;
        return computeRocSeriesFromCloses(closes, period);
      }

      if (spec.source === 'MACD') {
        const fast = spec.params.fast ?? 12;
        const slow = spec.params.slow ?? 26;
        const signal = spec.params.signal ?? 9;
        const key = `${fast}_${slow}_${signal}`;
        if (!macdCache.has(key)) {
          macdCache.set(key, computeMacdSeriesFromCloses(closes, fast, slow, signal));
        }
        const macd = macdCache.get(key)!;
        if (spec.channel === 'SIGNAL') return macd.signal;
        if (spec.channel === 'HISTOGRAM') return macd.histogram;
        return macd.line;
      }

      if (spec.source === 'STOCHRSI') {
        const period = spec.params.period ?? 14;
        const stochPeriod = spec.params.stochPeriod ?? period;
        const smoothK = spec.params.smoothK ?? 3;
        const smoothD = spec.params.smoothD ?? 3;
        const key = `${period}_${stochPeriod}_${smoothK}_${smoothD}`;
        if (!macdCache.has(`STOCHRSI_${key}`)) {
          const stochRsi = computeStochRsiSeriesFromCloses(closes, period, stochPeriod, smoothK, smoothD);
          macdCache.set(`STOCHRSI_${key}`, {
            line: stochRsi.k,
            signal: stochRsi.d,
            histogram: [],
          });
        }
        const stochRsi = macdCache.get(`STOCHRSI_${key}`)!;
        return spec.channel === 'D' ? stochRsi.signal : stochRsi.line;
      }

      const period = spec.params.period ?? spec.period;
      return computeMomentumSeriesFromCloses(closes, period);
    })();
    return {
      key: spec.key,
      name: spec.name,
      period: spec.period,
      panel: spec.panel,
      values,
    };
  });
};

export const parseStrategyIndicatorsForTests = (strategyConfig: unknown) =>
  parseStrategyIndicators(strategyConfig);

export const buildIndicatorSeriesForTests = (
  candles: Array<{
    openTime: number;
    closeTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>,
  specs: Array<{
    key: string;
    name: string;
    period: number;
    panel: 'price' | 'oscillator';
    source: 'EMA' | 'SMA' | 'RSI' | 'MOMENTUM' | 'MACD' | 'ROC' | 'STOCHRSI';
    params: Record<string, number>;
    channel?: 'LINE' | 'SIGNAL' | 'HISTOGRAM' | 'K' | 'D';
  }>,
) => buildIndicatorSeries(candles as KlineCandle[], specs as IndicatorSpec[]);

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
  const indicatorWarmupCandles = resolveIndicatorWarmupCandles(strategyConfig);
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
        const candles = await fetchKlines(
          symbol,
          run.timeframe,
          marketType,
          maxCandlesPerSymbol + indicatorWarmupCandles,
        );
        if (candles.length === 0) {
          throw new Error('NO_CANDLES_AVAILABLE_FOR_SYMBOL');
        }
        const supplemental = await fetchSupplementalSeries(
          symbol,
          run.timeframe,
          marketType,
          maxCandlesPerSymbol + indicatorWarmupCandles,
        );
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
        analysisStartIndexBySymbol: new Map(
          loadedSymbols.map((symbol) => {
            const symbolCandles = candlesBySymbol.get(symbol) ?? [];
            const startIndex = Math.max(1, symbolCandles.length - maxCandlesPerSymbol);
            return [symbol, startIndex];
          }),
        ),
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

type ResolvedRunContext = {
  symbols: string[];
  exchange: Exchange;
  marketType: MarketType;
  baseCurrency: string;
  marketUniverseId: string | null;
};

const resolveSymbolsForRun = async (userId: string, data: CreateBacktestRunDto): Promise<ResolvedRunContext | null> => {
  if (!data.marketUniverseId) {
    const symbols = uniqueSorted([data.symbol ?? 'BTCUSDT']);
    return {
      symbols,
      exchange: 'BINANCE',
      marketType: 'FUTURES' as MarketType,
      baseCurrency: inferBaseCurrencyFromSymbol(symbols[0] ?? 'BTCUSDT'),
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

  const catalog = await getMarketCatalog(universe.baseCurrency, universe.marketType, universe.exchange);
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
    exchange: universe.exchange,
    marketType: universe.marketType as MarketType,
    baseCurrency: universe.baseCurrency,
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

export const deleteRun = async (userId: string, id: string) => {
  const existing = await prisma.backtestRun.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.$transaction([
    prisma.backtestReport.deleteMany({
      where: {
        userId,
        backtestRunId: existing.id,
      },
    }),
    prisma.backtestTrade.deleteMany({
      where: {
        userId,
        backtestRunId: existing.id,
      },
    }),
    prisma.backtestRun.delete({
      where: { id: existing.id },
    }),
  ]);

  return true;
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
        exchange: resolved.exchange,
        marketType: resolved.marketType,
        baseCurrency: resolved.baseCurrency,
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
  const strategy = run.strategyId
    ? await prisma.strategy.findFirst({
      where: { id: run.strategyId, userId },
      select: { config: true, walletRisk: true },
    })
    : null;
  const strategyConfig = (strategy?.config as Record<string, unknown> | undefined) ?? null;
  const indicatorSpecs = parseStrategyIndicators(strategyConfig);
  const indicatorWarmupCandles = indicatorSpecs.reduce((maxPeriod, spec) => Math.max(maxPeriod, spec.period), 0);

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
      await fetchKlines(
        replaySymbol,
        run.timeframe,
        marketType,
        maxCandles + indicatorWarmupCandles,
        timelineEndTimeMs,
      ),
    );
  }
  const visibleStartBySymbol = new Map<string, number>();
  for (const replaySymbol of replaySymbols) {
    const symbolCandles = candlesBySymbol.get(replaySymbol) ?? [];
    visibleStartBySymbol.set(replaySymbol, Math.max(0, symbolCandles.length - maxCandles));
  }
  const fullCandles = candlesBySymbol.get(symbol) ?? [];
  const visibleStart = visibleStartBySymbol.get(symbol) ?? 0;
  const candles = fullCandles.slice(visibleStart);
  const supplemental = await fetchSupplementalSeries(
    symbol,
    run.timeframe,
    marketType,
    maxCandles + indicatorWarmupCandles,
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

  const strategyWalletRisk = normalizeWalletRiskPercent(strategy?.walletRisk ?? 1, 1);
  const indicatorSeries = query.includeIndicators
    ? buildIndicatorSeries(fullCandles, indicatorSpecs).map((series) => ({
      key: series.key,
      name: series.name,
      period: series.period,
      panel: series.panel,
      points: series.values
        .slice(visibleStart + start, visibleStart + end)
        .map((value, index) => ({
          candleIndex: start + index,
          value,
        })),
    }))
    : [];

  const leverageCandidate = Number((seed as { leverage?: unknown }).leverage);
  const leverage = Number.isFinite(leverageCandidate) ? leverageCandidate : 1;
  const marginMode = seed.marginMode === 'ISOLATED' ? 'ISOLATED' : (seed.marginMode === 'CROSSED' ? 'CROSSED' : 'NONE');
  const replay = simulateInterleavedPortfolio({
    symbols: replaySymbols,
    candlesBySymbol,
    analysisStartIndexBySymbol: new Map(
      replaySymbols.map((replaySymbol) => {
        const symbolVisibleStart = visibleStartBySymbol.get(replaySymbol) ?? 0;
        return [replaySymbol, Math.max(1, symbolVisibleStart)];
      }),
    ),
    marketType,
    leverage: marketType === 'SPOT' ? 1 : leverage,
    marginMode,
    strategyConfig,
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

  const chunkGlobalStart = visibleStart + start;
  const chunkGlobalEnd = visibleStart + end;
  const events = (query.includeEvents
    ? symbolReplay.events.filter(
      (event) => event.candleIndex >= chunkGlobalStart && event.candleIndex < chunkGlobalEnd,
    )
    : []
  ).map((event) => {
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
        candleIndex: event.candleIndex - visibleStart,
        reason: isCloseLike ? event.type : null,
      };
    });

  const liveProgressPlayback = (seed.liveProgress ?? {}) as {
    currentSymbol?: string | null;
    currentCandleIndex?: number;
    totalCandlesForSymbol?: number;
  };
  const shouldExposePlaybackCursor = run.status === 'PENDING' || run.status === 'RUNNING';
  const playbackCursorRelative =
    typeof liveProgressPlayback.currentCandleIndex === 'number'
      ? liveProgressPlayback.currentCandleIndex - visibleStart
      : null;

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
    candles: query.includeCandles
      ? chunk.map((candle, index) => ({
        candleIndex: start + index,
        openTime: new Date(candle.openTime).toISOString(),
        closeTime: new Date(candle.closeTime).toISOString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      }))
      : [],
    events,
    indicatorSeries: query.includeIndicators ? indicatorSeries : [],
    parityDiagnostics: {
      strategyRulesActive: Boolean(
        parseStrategySignalRules(strategyConfig),
      ),
      eventCounts: symbolReplay.eventCounts,
      mismatchCount: symbolReplay.decisionTrace.filter((entry) => entry.mismatchReason !== null).length,
      mismatchSamples: symbolReplay.decisionTrace
        .filter(
          (entry) =>
            entry.mismatchReason !== null &&
            entry.candleIndex >= chunkGlobalStart &&
            entry.candleIndex < chunkGlobalEnd,
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
      shouldExposePlaybackCursor &&
      liveProgressPlayback.currentSymbol === symbol &&
      typeof playbackCursorRelative === 'number' &&
      playbackCursorRelative >= 0
        ? playbackCursorRelative
        : null,
  };
};
