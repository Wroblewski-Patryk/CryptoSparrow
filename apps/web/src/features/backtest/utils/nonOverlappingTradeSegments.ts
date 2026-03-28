import { BacktestTimelineCandle, BacktestTrade } from '../types/backtest.type';

export type TradeSegment = {
  tradeId: string;
  start: number;
  end: number;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  profit: boolean;
};

type CandleRange = {
  open: number;
  close: number;
};

const mapTimestampToCandleIndex = (
  timestampMs: number,
  candleRanges: CandleRange[],
  mode: 'entry' | 'exit',
) => {
  if (!Number.isFinite(timestampMs) || candleRanges.length === 0) return -1;

  for (let index = 0; index < candleRanges.length; index += 1) {
    const range = candleRanges[index];
    if (timestampMs >= range.open && timestampMs <= range.close) return index;
  }

  const firstOpen = candleRanges[0]?.open ?? 0;
  const lastClose = candleRanges[candleRanges.length - 1]?.close ?? 0;
  if (timestampMs < firstOpen) return 0;
  if (timestampMs > lastClose) return candleRanges.length - 1;

  if (mode === 'entry') {
    for (let index = 0; index < candleRanges.length; index += 1) {
      if (timestampMs <= candleRanges[index].open) return index;
    }
    return candleRanges.length - 1;
  }

  for (let index = candleRanges.length - 1; index >= 0; index -= 1) {
    if (timestampMs >= candleRanges[index].close) return index;
  }
  return 0;
};

export const buildNonOverlappingTradeSegments = (
  trades: BacktestTrade[],
  candles: BacktestTimelineCandle[],
): TradeSegment[] => {
  if (!Array.isArray(trades) || trades.length === 0 || !Array.isArray(candles) || candles.length === 0) {
    return [];
  }

  const candleRanges = candles.map((candle) => {
    const open = Date.parse(candle.openTime);
    const close = Date.parse(candle.closeTime);
    return {
      open: Number.isFinite(open) ? open : 0,
      close: Number.isFinite(close) ? close : 0,
    };
  });

  const rawSegments = trades
    .map((trade) => {
      const entryTs = Date.parse(trade.openedAt);
      const exitTs = Date.parse(trade.closedAt);
      if (!Number.isFinite(entryTs) || !Number.isFinite(exitTs)) return null;

      const startIdx = mapTimestampToCandleIndex(entryTs, candleRanges, 'entry');
      const endIdx = mapTimestampToCandleIndex(exitTs, candleRanges, 'exit');
      if (startIdx < 0 || endIdx < 0) return null;

      const start = Math.min(startIdx, endIdx);
      const end = Math.max(startIdx, endIdx);
      return {
        tradeId: trade.id,
        start,
        end,
        side: trade.side,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        profit: trade.pnl >= 0,
      } satisfies TradeSegment;
    })
    .filter((segment): segment is TradeSegment => Boolean(segment))
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const normalized: TradeSegment[] = [];
  for (const segment of rawSegments) {
    const previous = normalized[normalized.length - 1];
    const normalizedStart = previous ? Math.max(segment.start, previous.end + 1) : segment.start;
    if (normalizedStart > segment.end) continue;
    normalized.push({
      ...segment,
      start: normalizedStart,
    });
  }

  return normalized;
};

