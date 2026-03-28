import { describe, expect, it } from 'vitest';
import { buildNonOverlappingTradeSegments } from './nonOverlappingTradeSegments';
import { BacktestTimelineCandle, BacktestTrade } from '../types/backtest.type';

const mkIso = (hour: number, minute = 0) =>
  `2026-03-18T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;

const candles: BacktestTimelineCandle[] = Array.from({ length: 6 }, (_, index) => ({
  candleIndex: index,
  openTime: mkIso(index),
  closeTime: mkIso(index + 1),
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100 + index,
  volume: 1000 + index,
}));

const mkTrade = (id: string, openedHour: number, closedHour: number): BacktestTrade => ({
  id,
  symbol: 'BTCUSDT',
  side: 'LONG',
  entryPrice: 100,
  exitPrice: 101,
  quantity: 1,
  openedAt: mkIso(openedHour, 30),
  closedAt: mkIso(closedHour, 30),
  pnl: 1,
  fee: 0,
  exitReason: 'SIGNAL_EXIT',
  liquidated: false,
});

describe('buildNonOverlappingTradeSegments', () => {
  it('enforces strictly non-overlapping inclusive intervals', () => {
    const trades = [
      mkTrade('t1', 1, 3),
      mkTrade('t2', 3, 4),
    ];

    const segments = buildNonOverlappingTradeSegments(trades, candles);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ tradeId: 't1', start: 1, end: 3 });
    expect(segments[1]).toMatchObject({ tradeId: 't2', start: 4, end: 4 });
  });

  it('drops segments fully covered by previous interval after normalization', () => {
    const trades = [
      mkTrade('outer', 1, 4),
      mkTrade('nested', 2, 3),
    ];

    const segments = buildNonOverlappingTradeSegments(trades, candles);
    expect(segments).toHaveLength(1);
    expect(segments[0].tradeId).toBe('outer');
  });
});
