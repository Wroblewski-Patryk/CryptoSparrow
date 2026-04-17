import { prisma } from '../../prisma/client';
import { getTimeframeIntervalMs, normalizeTimeframe } from './backtestTimeframe';

export type BacktestMarketType = 'SPOT' | 'FUTURES';

export type BacktestKlineCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type BacktestFundingRatePoint = {
  timestamp: number;
  fundingRate: number;
};

export type BacktestOpenInterestPoint = {
  timestamp: number;
  openInterest: number;
};

export type BacktestOrderBookPoint = {
  timestamp: number;
  imbalance: number;
  spreadBps: number;
  depthRatio: number;
};

export type BacktestSupplementalSeries = {
  fundingRates: BacktestFundingRatePoint[];
  openInterest: BacktestOpenInterestPoint[];
  orderBook: BacktestOrderBookPoint[];
};

type DbCandleCacheRow = {
  openTime: bigint;
  closeTime: bigint;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type DbCandleDelegate = {
  findMany: (args: unknown) => Promise<DbCandleCacheRow[]>;
  createMany: (args: unknown) => Promise<unknown>;
};

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const CANDLE_CACHE_TTL_MS = 20 * 60 * 1000;
const useDbCandleCache = (process.env.BACKTEST_USE_DB_CANDLE_CACHE ?? 'true').toLowerCase() !== 'false';

const candleCache = new Map<
  string,
  {
    cachedAt: number;
    candles: BacktestKlineCandle[];
  }
>();

const supplementalCache = new Map<
  string,
  {
    cachedAt: number;
    data: BacktestSupplementalSeries;
  }
>();

let dbCandleDelegateOverride: DbCandleDelegate | null = null;

const getDbCandleDelegate = () =>
  dbCandleDelegateOverride ??
  (prisma as unknown as {
    marketCandleCache?: DbCandleDelegate;
  }).marketCandleCache;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const computeSourceWindowMs = (timeframe: string, maxCandles: number) => {
  const intervalMs = getTimeframeIntervalMs(timeframe);
  const requestedWindowMs = intervalMs * Math.max(1, maxCandles);
  const bufferedWindowMs = Math.ceil(requestedWindowMs * 1.15);
  return Math.max(TWO_WEEKS_MS, bufferedWindowMs);
};

const safeFloat = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toKlineFromDb = (row: DbCandleCacheRow): BacktestKlineCandle => ({
  openTime: Number(row.openTime),
  closeTime: Number(row.closeTime),
  open: row.open,
  high: row.high,
  low: row.low,
  close: row.close,
  volume: row.volume,
});

export const hasContinuousCandleIntervals = (
  candles: BacktestKlineCandle[],
  timeframe: string,
) => {
  if (candles.length <= 1) return true;

  const intervalMs = getTimeframeIntervalMs(timeframe);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return false;

  for (let index = 1; index < candles.length; index += 1) {
    const previousOpen = candles[index - 1]?.openTime;
    const currentOpen = candles[index]?.openTime;
    if (!Number.isFinite(previousOpen) || !Number.isFinite(currentOpen)) {
      return false;
    }
    if (currentOpen <= previousOpen) return false;
    if (currentOpen - previousOpen !== intervalMs) return false;
  }

  return true;
};

export const setDbCandleDelegateForTests = (delegate: DbCandleDelegate | null) => {
  dbCandleDelegateOverride = delegate;
};

export const resetBacktestDataGatewayCacheForTests = () => {
  candleCache.clear();
  supplementalCache.clear();
  dbCandleDelegateOverride = null;
};

const cacheKeyForCandles = (
  symbol: string,
  timeframe: string,
  marketType: BacktestMarketType,
  maxCandles: number,
  endTimeMs?: number,
) =>
  `${marketType}:${symbol}:${normalizeTimeframe(timeframe)}:${maxCandles}:${
    Number.isFinite(endTimeMs) ? Math.floor(endTimeMs as number) : 'latest'
  }`;

const cacheKeyForSupplemental = (
  symbol: string,
  timeframe: string,
  marketType: BacktestMarketType,
  maxCandles: number,
  endTimeMs?: number,
) =>
  `supp:${marketType}:${symbol}:${normalizeTimeframe(timeframe)}:${maxCandles}:${
    Number.isFinite(endTimeMs) ? Math.floor(endTimeMs as number) : 'latest'
  }`;

const pruneGatewayCache = () => {
  const now = Date.now();
  for (const [key, value] of candleCache.entries()) {
    if (now - value.cachedAt > CANDLE_CACHE_TTL_MS) candleCache.delete(key);
  }
  for (const [key, value] of supplementalCache.entries()) {
    if (now - value.cachedAt > CANDLE_CACHE_TTL_MS) supplementalCache.delete(key);
  }
};

const openInterestPeriodForTimeframe = (timeframe: string) => {
  const normalized = normalizeTimeframe(timeframe);
  const supported = new Set(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']);
  if (supported.has(normalized)) return normalized;
  return '5m';
};

export const fetchKlines = async (
  symbol: string,
  timeframe: string,
  marketType: BacktestMarketType,
  maxCandles: number,
  endTimeMs?: number,
): Promise<BacktestKlineCandle[]> => {
  pruneGatewayCache();
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
        if (hasContinuousCandleIntervals(dbCandles, normalizedTimeframe)) {
          candleCache.set(key, { cachedAt: Date.now(), candles: dbCandles });
          return dbCandles;
        }
      }
    } catch {
      // Database candle cache is an optimization only; network fetch remains source of truth.
    }
  }

  const endpoint =
    marketType === 'FUTURES'
      ? 'https://fapi.binance.com/fapi/v1/klines'
      : 'https://api.binance.com/api/v3/klines';

  const intervalMs = getTimeframeIntervalMs(timeframe);
  const candles: BacktestKlineCandle[] = [];
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
        if (
          openTime <= 0 ||
          closeTime <= 0 ||
          closePrice <= 0 ||
          open <= 0 ||
          high <= 0 ||
          low <= 0
        ) {
          return null;
        }
        return {
          openTime,
          closeTime,
          open,
          high,
          low,
          close: closePrice,
          volume,
        } satisfies BacktestKlineCandle;
      })
      .filter((row): row is BacktestKlineCandle => Boolean(row));

    if (parsed.length === 0) break;

    candles.push(...parsed);
    remaining -= parsed.length;
    const last = parsed[parsed.length - 1];
    nextStartTime = last.openTime + intervalMs;
    if (nextStartTime >= endTime) break;
  }

  const result = candles.sort((a, b) => a.openTime - b.openTime).slice(-maxCandles);

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
      // Ignore cache write errors; candle fetch already succeeded.
    }
  }

  candleCache.set(key, { cachedAt: Date.now(), candles: result });
  return result;
};

export const fetchSupplementalSeries = async (
  symbol: string,
  timeframe: string,
  marketType: BacktestMarketType,
  maxCandles: number,
  endTimeMs?: number,
): Promise<BacktestSupplementalSeries> => {
  if (marketType !== 'FUTURES') {
    return { fundingRates: [], openInterest: [], orderBook: [] };
  }

  pruneGatewayCache();
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
    const empty = { fundingRates: [], openInterest: [], orderBook: [] };
    supplementalCache.set(key, { cachedAt: Date.now(), data: empty });
    return empty;
  }

  const fundingRates: BacktestFundingRatePoint[] = fundingResponse?.ok
    ? (((await fundingResponse.json()) as unknown[]) ?? [])
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as { fundingTime?: unknown; fundingRate?: unknown };
          const timestamp = safeFloat(row.fundingTime);
          const fundingRate = safeFloat(row.fundingRate);
          if (timestamp <= 0 || !Number.isFinite(fundingRate)) return null;
          return { timestamp, fundingRate } satisfies BacktestFundingRatePoint;
        })
        .filter((item): item is BacktestFundingRatePoint => Boolean(item))
        .sort((a, b) => a.timestamp - b.timestamp)
    : [];

  const openInterest: BacktestOpenInterestPoint[] = openInterestResponse?.ok
    ? (((await openInterestResponse.json()) as unknown[]) ?? [])
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as { timestamp?: unknown; sumOpenInterest?: unknown };
          const timestamp = safeFloat(row.timestamp);
          const oi = safeFloat(row.sumOpenInterest);
          if (timestamp <= 0 || !Number.isFinite(oi)) return null;
          return { timestamp, openInterest: oi } satisfies BacktestOpenInterestPoint;
        })
        .filter((item): item is BacktestOpenInterestPoint => Boolean(item))
        .sort((a, b) => a.timestamp - b.timestamp)
    : [];

  const result: BacktestSupplementalSeries = {
    fundingRates,
    openInterest,
    orderBook: [],
  };
  supplementalCache.set(key, { cachedAt: Date.now(), data: result });
  return result;
};
