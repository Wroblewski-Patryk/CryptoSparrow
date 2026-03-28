'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { LuChartLine, LuCircleDot, LuDatabase, LuListChecks, LuLoaderCircle, LuShieldCheck, LuSquare } from 'react-icons/lu';
import {
  getBacktestRun,
  getBacktestRunReport,
  getBacktestRunTimeline,
  listBacktestRunTrades,
} from '../services/backtests.service';
import { BacktestReport, BacktestRun, BacktestTimeline, BacktestTrade } from '../types/backtest.type';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/ViewState';
import { useLocaleFormatting } from '@/i18n/useLocaleFormatting';
import { getStrategy } from '../../strategies/api/strategies.api';
import { StrategyDto } from '../../strategies/types/StrategyForm.type';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

const pnlClass = (value: number | null) => {
  if (value == null) return '';
  if (value > 0) return 'text-success';
  if (value < 0) return 'text-error';
  return '';
};

type DailyPerformancePoint = {
  dayKey: string;
  label: string;
  pnl: number;
  balance: number;
};

type BacktestRunDetailsProps = {
  runId: string;
};

type PricePoint = {
  id: string;
  kind: 'entry' | 'exit';
  side: 'LONG' | 'SHORT';
  timestamp: number;
  price: number;
  pnl?: number;
};

type SymbolStats = {
  symbol: string;
  tradesCount: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPnl: number;
  avgEntry: number;
  avgExit: number;
  avgHoldMinutes: number;
  points: PricePoint[];
  firstAt: number | null;
  lastAt: number | null;
};

type TimelineState = {
  data: BacktestTimeline | null;
  loading: boolean;
  error: string | null;
};

type LiveProgress = {
  leverage?: number;
  marginMode?: 'CROSSED' | 'ISOLATED' | 'NONE';
  totalSymbols?: number;
  processedSymbols?: number;
  failedSymbols?: string[];
  liquidations?: number;
  currentSymbol?: string | null;
  totalTrades?: number;
  netPnl?: number;
  grossProfit?: number;
  grossLoss?: number;
  maxDrawdown?: number;
  maxCandlesPerSymbol?: number;
  totalCandlesForSymbol?: number;
  currentCandleIndex?: number;
  currentCandleTime?: string | null;
  lastUpdate?: string;
};

type StrategyIndicatorMeta = {
  names: string[];
  rsiLongLevel: number | null;
  rsiShortLevel: number | null;
};

const safeDateMs = (value: string) => {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

const filterTradesByTimelineWindow = (items: BacktestTrade[], timeline: BacktestTimeline) => {
  const candles = Array.isArray(timeline.candles) ? timeline.candles : [];
  if (candles.length === 0) return [];
  const windowStartMs = safeDateMs(candles[0].openTime);
  const windowEndMs = safeDateMs(candles[candles.length - 1].closeTime);
  if (windowStartMs <= 0 || windowEndMs <= 0) return items;

  return items.filter((trade) => {
    const openedAt = safeDateMs(trade.openedAt);
    const closedAt = safeDateMs(trade.closedAt);
    if (openedAt <= 0 || closedAt <= 0) return false;
    return closedAt >= windowStartMs && openedAt <= windowEndMs;
  });
};

const countTradesVisibleInTimeline = (items: BacktestTrade[], timeline: BacktestTimeline | null) => {
  if (!timeline) return 0;
  return filterTradesByTimelineWindow(items, timeline).length;
};

const extractStrategyIndicatorMeta = (strategy: StrategyDto | null): StrategyIndicatorMeta => {
  if (!strategy?.config || typeof strategy.config !== 'object') {
    return {
      names: [],
      rsiLongLevel: null,
      rsiShortLevel: null,
    };
  }

  const config = strategy.config as {
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

  const longItems = [
    ...(config.open?.long ?? []),
    ...(config.open?.indicatorsLong ?? []),
    ...(config.openConditions?.indicatorsLong ?? []),
  ];
  const shortItems = [
    ...(config.open?.short ?? []),
    ...(config.open?.indicatorsShort ?? []),
    ...(config.openConditions?.indicatorsShort ?? []),
  ];

  const names = new Set<string>();
  let rsiLongLevel: number | null = null;
  let rsiShortLevel: number | null = null;

  const readItem = (item: unknown, side: 'long' | 'short') => {
    if (!item || typeof item !== 'object') return;
    const obj = item as {
      name?: unknown;
      params?: Record<string, unknown>;
      value?: unknown;
    };
    const rawName = typeof obj.name === 'string' ? obj.name.trim().toUpperCase() : '';
    if (!rawName) return;

    if (rawName.includes('EMA') && obj.params) {
      const fast = Number(obj.params.fast);
      const slow = Number(obj.params.slow);
      if (Number.isFinite(fast)) names.add(`EMA FAST (${Math.floor(fast)})`);
      if (Number.isFinite(slow)) names.add(`EMA SLOW (${Math.floor(slow)})`);
      if (!Number.isFinite(fast) && !Number.isFinite(slow)) names.add('EMA');
    } else {
      const period = Number(obj.params?.period ?? obj.params?.length);
      if (Number.isFinite(period)) names.add(`${rawName} (${Math.floor(period)})`);
      else names.add(rawName);
    }

    if (rawName.includes('RSI')) {
      const level = Number(obj.value);
      if (Number.isFinite(level)) {
        if (side === 'long' && rsiLongLevel == null) rsiLongLevel = level;
        if (side === 'short' && rsiShortLevel == null) rsiShortLevel = level;
      }
    }
  };

  for (const item of longItems) readItem(item, 'long');
  for (const item of shortItems) readItem(item, 'short');

  return {
    names: [...names],
    rsiLongLevel,
    rsiShortLevel,
  };
};

const buildSymbolStats = (items: BacktestTrade[], configuredSymbols: string[] = []): SymbolStats[] => {
  const grouped = new Map<string, BacktestTrade[]>();
  for (const trade of items) {
    if (!grouped.has(trade.symbol)) grouped.set(trade.symbol, []);
    grouped.get(trade.symbol)?.push(trade);
  }

  const stats = [...grouped.entries()].map(([symbol, trades]) => {
    const ordered = [...trades].sort((a, b) => safeDateMs(a.openedAt) - safeDateMs(b.openedAt));
    const wins = ordered.filter((trade) => trade.pnl > 0).length;
    const losses = ordered.filter((trade) => trade.pnl < 0).length;
    const netPnl = ordered.reduce((sum, trade) => sum + trade.pnl, 0);
    const avgEntry = ordered.reduce((sum, trade) => sum + trade.entryPrice, 0) / ordered.length;
    const avgExit = ordered.reduce((sum, trade) => sum + trade.exitPrice, 0) / ordered.length;
    const avgHoldMinutes =
      ordered.reduce((sum, trade) => sum + Math.max(0, safeDateMs(trade.closedAt) - safeDateMs(trade.openedAt)), 0) /
      ordered.length /
      60_000;

    const points = ordered.flatMap((trade) => {
      const openedAt = safeDateMs(trade.openedAt);
      const closedAt = safeDateMs(trade.closedAt);
      return [
        {
          id: `${trade.id}-entry`,
          kind: 'entry' as const,
          side: trade.side,
          timestamp: openedAt,
          price: trade.entryPrice,
        },
        {
          id: `${trade.id}-exit`,
          kind: 'exit' as const,
          side: trade.side,
          timestamp: closedAt,
          price: trade.exitPrice,
          pnl: trade.pnl,
        },
      ];
    });

    return {
      symbol,
      tradesCount: ordered.length,
      wins,
      losses,
      winRate: ordered.length > 0 ? (wins / ordered.length) * 100 : null,
      netPnl,
      avgEntry,
      avgExit,
      avgHoldMinutes,
      points: points.sort((a, b) => a.timestamp - b.timestamp),
      firstAt: ordered[0] ? safeDateMs(ordered[0].openedAt) : null,
      lastAt: ordered[ordered.length - 1] ? safeDateMs(ordered[ordered.length - 1].closedAt) : null,
    };
  });

  const withMissing = [...stats];
  for (const symbol of configuredSymbols) {
    if (withMissing.some((item) => item.symbol === symbol)) continue;
    withMissing.push({
      symbol,
      tradesCount: 0,
      wins: 0,
      losses: 0,
      winRate: null,
      netPnl: 0,
      avgEntry: 0,
      avgExit: 0,
      avgHoldMinutes: 0,
      points: [],
      firstAt: null,
      lastAt: null,
    });
  }

  return withMissing.sort((a, b) => a.symbol.localeCompare(b.symbol));
};

const buildDailyPerformance = (items: BacktestTrade[], initialBalance: number): DailyPerformancePoint[] => {
  const dailyPnl = new Map<string, number>();

  for (const trade of items) {
    const dayKey = trade.closedAt.slice(0, 10);
    dailyPnl.set(dayKey, (dailyPnl.get(dayKey) ?? 0) + trade.pnl);
  }

  const sortedDays = [...dailyPnl.keys()].sort((a, b) => a.localeCompare(b));
  let balance = initialBalance;
  return sortedDays.map((dayKey) => {
    const pnl = dailyPnl.get(dayKey) ?? 0;
    balance += pnl;
    const date = new Date(`${dayKey}T00:00:00`);
    return {
      dayKey,
      label: date.toLocaleDateString(),
      pnl,
      balance,
    };
  });
};

function SummaryDailyPnlChart({
  points,
  formatCurrency,
}: {
  points: DailyPerformancePoint[];
  formatCurrency: (value: number) => string;
}) {
  if (points.length === 0) {
    return <p className='mt-2 text-sm opacity-70'>Brak danych dziennych do narysowania wykresu.</p>;
  }

  const width = 920;
  const height = 280;
  const padding = { top: 14, right: 56, bottom: 26, left: 56 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const pnlValues = points.map((point) => point.pnl);
  const pnlMin = Math.min(...pnlValues, 0);
  const pnlMax = Math.max(...pnlValues, 0);
  const pnlRange = pnlMax - pnlMin || 1;

  const yPnl = (value: number) => padding.top + (1 - (value - pnlMin) / pnlRange) * innerHeight;
  const stepX = innerWidth / Math.max(points.length, 1);
  const xAt = (index: number) => padding.left + stepX * index + stepX / 2;
  const zeroY = yPnl(0);
  const barWidth = Math.max(3, stepX * 0.62);

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const pnlValue = pnlMax - ratio * pnlRange;
    const y = padding.top + ratio * innerHeight;
    return { y, pnlValue };
  });

  const xTickIndexes = [0, Math.floor(points.length * 0.33), Math.floor(points.length * 0.66), points.length - 1]
    .filter((idx, index, array) => idx >= 0 && idx < points.length && array.indexOf(idx) === index);

  return (
    <div className='space-y-2'>
      <svg className='mt-2 h-[280px] w-full' viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none'>
        {yTicks.map((tick) => (
          <g key={`tick-${tick.y}`}>
            <line
              x1={padding.left}
              x2={padding.left + innerWidth}
              y1={tick.y}
              y2={tick.y}
              className='stroke-base-300/35'
            />
            <text x={padding.left - 6} y={tick.y + 3} textAnchor='end' className='fill-base-content/65 text-[10px]'>
              {formatCurrency(tick.pnlValue)}
            </text>
          </g>
        ))}

        <line
          x1={padding.left}
          x2={padding.left + innerWidth}
          y1={zeroY}
          y2={zeroY}
          className='stroke-base-content/45'
          strokeDasharray='3 4'
        />

        {points.map((point, index) => {
          const x = xAt(index);
          const y = yPnl(point.pnl);
          const heightAbs = Math.max(1, Math.abs(y - zeroY));
          return (
            <rect
              key={point.dayKey}
              x={x - barWidth / 2}
              y={Math.min(y, zeroY)}
              width={barWidth}
              height={heightAbs}
              className={point.pnl >= 0 ? 'fill-success/70' : 'fill-error/70'}
            />
          );
        })}

        {xTickIndexes.map((index) => {
          const x = xAt(index);
          return (
            <text key={`x-${points[index].dayKey}`} x={x} y={padding.top + innerHeight + 14} textAnchor='middle' className='fill-base-content/60 text-[10px]'>
              {points[index].label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function SummaryBalanceChart({
  points,
  formatCurrency,
}: {
  points: DailyPerformancePoint[];
  formatCurrency: (value: number) => string;
}) {
  if (points.length === 0) {
    return <p className='mt-2 text-sm opacity-70'>Brak danych salda do narysowania wykresu.</p>;
  }

  const width = 920;
  const height = 240;
  const padding = { top: 14, right: 20, bottom: 24, left: 56 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const balanceValues = points.map((point) => point.balance);
  const min = Math.min(...balanceValues);
  const max = Math.max(...balanceValues);
  const range = max - min || 1;
  const xAt = (index: number) => padding.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
  const yAt = (value: number) => padding.top + (1 - (value - min) / range) * innerHeight;
  const polyline = points.map((point, index) => `${xAt(index)},${yAt(point.balance)}`).join(' ');

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = max - ratio * range;
    const y = padding.top + ratio * innerHeight;
    return { y, value };
  });

  return (
    <div className='space-y-2'>
      <svg className='mt-2 h-[240px] w-full' viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none'>
        {yTicks.map((tick) => (
          <g key={`balance-${tick.y}`}>
            <line
              x1={padding.left}
              x2={padding.left + innerWidth}
              y1={tick.y}
              y2={tick.y}
              className='stroke-base-300/35'
            />
            <text x={padding.left - 6} y={tick.y + 3} textAnchor='end' className='fill-base-content/65 text-[10px]'>
              {formatCurrency(tick.value)}
            </text>
          </g>
        ))}
        <polyline fill='none' stroke='currentColor' strokeWidth='2.2' className='text-primary' points={polyline} />
      </svg>
    </div>
  );
}

function TimelineCandlesChart({
  timeline,
  trades,
  formatNumber,
  rsiLongLevel,
  rsiShortLevel,
}: {
  timeline: BacktestTimeline;
  trades: BacktestTrade[];
  formatNumber: (value: number) => string;
  rsiLongLevel: number | null;
  rsiShortLevel: number | null;
}) {
  const zoomSteps = [1, 1.25, 1.5, 2, 3, 4, 6, 8, 10];
  const [zoomIndex, setZoomIndex] = useState(0);
  const zoom = zoomSteps[zoomIndex] ?? 1;
  const candles = timeline.candles;
  if (candles.length === 0) {
    return <p className='text-sm opacity-70'>Brak swiec dla wybranego zakresu.</p>;
  }

  const width = Math.round(900 * zoom);
  const height = 320;
  const padding = { top: 12, right: 8, bottom: 20, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const prices = candles.flatMap((candle) => [candle.low, candle.high]);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const barWidth = innerWidth / candles.length;
  const yTicks = Array.from({ length: 5 }, (_, idx) => {
    const ratio = idx / 4;
    const value = max - ratio * range;
    const y = padding.top + ratio * innerHeight;
    return { y, value };
  });
  const xTickIndexes = [0, Math.floor(candles.length * 0.33), Math.floor(candles.length * 0.66), candles.length - 1]
    .filter((idx, index, array) => idx >= 0 && idx < candles.length && array.indexOf(idx) === index);

  const xAt = (index: number) => padding.left + (index + 0.5) * barWidth;
  const yAt = (price: number) => padding.top + (1 - (price - min) / range) * innerHeight;
  const playbackX =
    typeof timeline.playbackCursor === 'number' &&
    timeline.playbackCursor >= timeline.cursor &&
    timeline.playbackCursor < timeline.cursor + candles.length
      ? xAt(timeline.playbackCursor - timeline.cursor)
      : null;

  const timelineEvents = Array.isArray(timeline.events) ? timeline.events : [];
  const timelineIndicatorSeries = Array.isArray(timeline.indicatorSeries) ? timeline.indicatorSeries : [];
  const priceIndicators = timelineIndicatorSeries.filter((series) => series.panel === 'price');
  const oscillatorIndicators = timelineIndicatorSeries.filter((series) => series.panel === 'oscillator');
  const candleRanges = candles.map((candle) => {
    const open = Date.parse(candle.openTime);
    const close = Date.parse(candle.closeTime);
    return {
      open: Number.isFinite(open) ? open : 0,
      close: Number.isFinite(close) ? close : 0,
    };
  });

  const mapTimestampToCandleIndex = (timestampMs: number, mode: 'entry' | 'exit') => {
    if (candles.length === 0 || !Number.isFinite(timestampMs)) return -1;

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

  const rawTradeSegments = trades
    .map((trade) => {
      const entryTs = Date.parse(trade.openedAt);
      const exitTs = Date.parse(trade.closedAt);
      if (!Number.isFinite(entryTs) || !Number.isFinite(exitTs)) return null;
      const startIdx = mapTimestampToCandleIndex(entryTs, 'entry');
      const endIdx = mapTimestampToCandleIndex(exitTs, 'exit');
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
      };
    })
    .filter((segment): segment is NonNullable<typeof segment> => Boolean(segment));

  const tradeSegments = rawTradeSegments
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .map((segment, index, array) => {
      if (index === 0) return segment;
      const previous = array[index - 1];
      if (segment.start >= previous.end) return segment;
      const adjustedStart = previous.end;
      return {
        ...segment,
        start: adjustedStart,
        end: Math.max(adjustedStart, segment.end),
      };
    });

  const lifecycleEvents = timelineEvents.filter((event) =>
    ['DCA', 'TP', 'TTP', 'SL', 'TRAILING', 'LIQUIDATION'].includes(event.type),
  );
  const visibleLifecycleCounts = lifecycleEvents.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});
  const sharedScrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-end gap-2'>
        <button
          type='button'
          className='btn btn-xs btn-outline'
          onClick={() => setZoomIndex((prev) => Math.max(0, prev - 1))}
          disabled={zoomIndex === 0}
          title='Oddal (wiecej swiec)'
        >
          -
        </button>
        <span className='text-xs opacity-70'>Zoom x{zoom.toFixed(2)}</span>
        <button
          type='button'
          className='btn btn-xs btn-outline'
          onClick={() => setZoomIndex((prev) => Math.min(zoomSteps.length - 1, prev + 1))}
          disabled={zoomIndex === zoomSteps.length - 1}
          title='Przybliz (mniej swiec)'
        >
          +
        </button>
      </div>

      <div
        ref={sharedScrollRef}
        className='overflow-x-auto pb-1'
      >
        <div style={{ width: `${width}px` }} className='space-y-2'>
          <svg className='h-[320px] w-full rounded-lg bg-base-200/60' viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none'>
            <line
              x1={padding.left}
              x2={padding.left + innerWidth}
              y1={padding.top + innerHeight}
              y2={padding.top + innerHeight}
              className='stroke-base-300'
            />
            {yTicks.map((tick) => (
              <g key={`y-${tick.y}`}>
                <line
                  x1={padding.left}
                  x2={padding.left + innerWidth}
                  y1={tick.y}
                  y2={tick.y}
                  className='stroke-base-300/30'
                />
                <text x={padding.left + innerWidth - 2} y={tick.y - 2} textAnchor='end' className='fill-base-content/60 text-[9px]'>
                  {formatNumber(tick.value)}
                </text>
              </g>
            ))}

            {xTickIndexes.map((index) => {
              const x = xAt(index);
              const label = new Date(candles[index].openTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <g key={`x-${candles[index].candleIndex}`}>
                  <line x1={x} x2={x} y1={padding.top} y2={padding.top + innerHeight} className='stroke-base-300/20' />
                  <text x={x} y={padding.top + innerHeight + 12} textAnchor='middle' className='fill-base-content/55 text-[9px]'>
                    {label}
                  </text>
                </g>
              );
            })}

            {tradeSegments.map((segment, index) => {
              const xStart = xAt(segment.start) - barWidth / 2;
              const xEnd = xAt(segment.end) + barWidth / 2;
              return (
                <rect
                  key={`trade-bg-${index}`}
                  x={xStart}
                  y={padding.top}
                  width={Math.max(1, xEnd - xStart)}
                  height={innerHeight}
                  className={segment.profit ? 'fill-success/10' : 'fill-error/10'}
                />
              );
            })}

            {candles.map((candle, index) => {
              const x = xAt(index);
              const yOpen = yAt(candle.open);
              const yClose = yAt(candle.close);
              const yHigh = yAt(candle.high);
              const yLow = yAt(candle.low);
              const bodyTop = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(1, Math.abs(yOpen - yClose));
              const bullish = candle.close >= candle.open;
              const bodyWidth = Math.max(1.4, barWidth * 0.55);

              return (
                <g key={`candle-${candle.candleIndex}`}>
                  <line x1={x} x2={x} y1={yHigh} y2={yLow} className={bullish ? 'stroke-success/70' : 'stroke-error/70'} />
                  <rect
                    x={x - bodyWidth / 2}
                    y={bodyTop}
                    width={bodyWidth}
                    height={bodyHeight}
                    className={bullish ? 'fill-success/70' : 'fill-error/70'}
                  />
                </g>
              );
            })}

            {priceIndicators.map((series, seriesIndex) => {
              const palette = ['text-info', 'text-warning', 'text-secondary', 'text-accent'];
              const points = series.points
                .map((point) => {
                  if (typeof point.value !== 'number') return null;
                  const localIndex = point.candleIndex - timeline.cursor;
                  if (localIndex < 0 || localIndex >= candles.length) return null;
                  return `${xAt(localIndex)},${yAt(point.value)}`;
                })
                .filter((point): point is string => Boolean(point))
                .join(' ');

              if (!points) return null;
              return (
                <polyline
                  key={series.key}
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='1.6'
                  className={palette[seriesIndex % palette.length]}
                  points={points}
                />
              );
            })}

            {tradeSegments.map((segment, index) => {
              const x1 = xAt(segment.start);
              const y1 = yAt(segment.entryPrice);
              const x2 = xAt(segment.end);
              const y2 = yAt(segment.exitPrice);
              return (
                <line
                  key={`segment-${index}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={segment.profit ? 'stroke-success/70' : 'stroke-error/70'}
                  strokeDasharray='2 3'
                />
              );
            })}

            {tradeSegments.map((segment, index) => {
              const xStart = xAt(segment.start);
              const yStart = yAt(segment.entryPrice);
              const xEnd = xAt(segment.end);
              const yEnd = yAt(segment.exitPrice);
              const exitColor = segment.profit ? 'text-success' : 'text-error';
              const entryColor = segment.side === 'LONG' ? 'text-success' : 'text-error';
              return (
                <g key={`trade-markers-${index}`}>
                  {segment.side === 'LONG' ? (
                    <polygon
                      points={`${xStart},${yStart - 5} ${xStart - 4},${yStart + 3} ${xStart + 4},${yStart + 3}`}
                      fill='currentColor'
                      className={entryColor}
                    />
                  ) : (
                    <polygon
                      points={`${xStart},${yStart + 5} ${xStart - 4},${yStart - 3} ${xStart + 4},${yStart - 3}`}
                      fill='currentColor'
                      className={entryColor}
                    />
                  )}
                  <rect x={xEnd - 3.5} y={yEnd - 3.5} width={7} height={7} fill='currentColor' className={exitColor} />
                </g>
              );
            })}

            {lifecycleEvents.map((event) => {
              const localIndex = event.candleIndex - timeline.cursor;
              if (localIndex < 0 || localIndex >= candles.length) return null;
              const x = xAt(localIndex);
              const y = yAt(event.price);

              if (event.type === 'DCA') {
                return (
                  <polygon
                    key={event.id}
                    points={`${x},${y - 6} ${x - 5},${y + 4} ${x + 5},${y + 4}`}
                    fill='currentColor'
                    className='text-info'
                  />
                );
              }

              if (event.type === 'SL' || event.type === 'LIQUIDATION') {
                return (
                  <g key={event.id} className='text-error'>
                    <line x1={x - 4.5} y1={y - 4.5} x2={x + 4.5} y2={y + 4.5} stroke='currentColor' strokeWidth='1.7' />
                    <line x1={x - 4.5} y1={y + 4.5} x2={x + 4.5} y2={y - 4.5} stroke='currentColor' strokeWidth='1.7' />
                  </g>
                );
              }

              const colorClass =
                event.type === 'TP'
                  ? 'text-success'
                  : event.type === 'TTP'
                    ? 'text-accent'
                    : event.type === 'TRAILING'
                      ? 'text-warning'
                      : 'text-secondary';

              return (
                <circle
                  key={event.id}
                  cx={x}
                  cy={y}
                  r={3.4}
                  fill='currentColor'
                  className={colorClass}
                  stroke='white'
                  strokeWidth='0.65'
                />
              );
            })}

            {playbackX != null ? (
              <line
                x1={playbackX}
                x2={playbackX}
                y1={padding.top}
                y2={padding.top + innerHeight}
                className='stroke-primary/80'
                strokeDasharray='4 4'
              />
            ) : null}
          </svg>
          {oscillatorIndicators.length > 0 ? (
            <div className='space-y-2'>
              {oscillatorIndicators.map((series) => {
                const values = series.points
                  .map((point) => point.value)
                  .filter((value): value is number => typeof value === 'number');
                if (values.length === 0) return null;
                const localMin = Math.min(...values);
                const localMax = Math.max(...values);
                const localRange = localMax - localMin || 1;
                const levelToY = (value: number) =>
                  Math.max(0, Math.min(100, 100 - ((value - localMin) / localRange) * 100));
                const points = series.points
                  .map((point) => {
                    if (typeof point.value !== 'number') return null;
                    const localIndex = point.candleIndex - timeline.cursor;
                    if (localIndex < 0 || localIndex >= candles.length) return null;
                    const x = xAt(localIndex);
                    const y = 100 - ((point.value - localMin) / localRange) * 100;
                    return `${x},${y}`;
                  })
                  .filter((point): point is string => Boolean(point))
                  .join(' ');

                return (
                  <div key={series.key} className='rounded-lg border border-base-300 bg-base-200 p-2'>
                    <p className='mb-1 text-xs font-medium'>{series.name}({series.period})</p>
                    <svg className='h-[100px] w-full' viewBox={`0 0 ${width} 100`} preserveAspectRatio='none'>
                      {tradeSegments.map((segment, index) => {
                        const xStart = xAt(segment.start) - barWidth / 2;
                        const xEnd = xAt(segment.end) + barWidth / 2;
                        return (
                          <rect
                            key={`rsi-bg-${series.key}-${index}`}
                            x={xStart}
                            y={0}
                            width={Math.max(1, xEnd - xStart)}
                            height={100}
                            className={segment.profit ? 'fill-success/10' : 'fill-error/10'}
                          />
                        );
                      })}
                      {series.name.includes('RSI') && rsiLongLevel != null ? (
                        <>
                          <line
                            x1={padding.left}
                            x2={padding.left + innerWidth}
                            y1={levelToY(rsiLongLevel)}
                            y2={levelToY(rsiLongLevel)}
                            className='stroke-success/70'
                            strokeDasharray='3 3'
                          />
                          <text x={padding.left + innerWidth - 2} y={levelToY(rsiLongLevel) - 2} textAnchor='end' className='fill-success text-[9px]'>
                            LONG {rsiLongLevel}
                          </text>
                        </>
                      ) : null}
                      {series.name.includes('RSI') && rsiShortLevel != null ? (
                        <>
                          <line
                            x1={padding.left}
                            x2={padding.left + innerWidth}
                            y1={levelToY(rsiShortLevel)}
                            y2={levelToY(rsiShortLevel)}
                            className='stroke-error/70'
                            strokeDasharray='3 3'
                          />
                          <text x={padding.left + innerWidth - 2} y={levelToY(rsiShortLevel) - 2} textAnchor='end' className='fill-error text-[9px]'>
                            SHORT {rsiShortLevel}
                          </text>
                        </>
                      ) : null}
                      <polyline fill='none' stroke='currentColor' strokeWidth='1.6' className='text-info' points={points} />
                      {playbackX != null ? (
                        <line
                          x1={playbackX}
                          x2={playbackX}
                          y1={0}
                          y2={100}
                          className='stroke-primary/70'
                          strokeDasharray='4 4'
                        />
                      ) : null}
                    </svg>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

      </div>

      <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-base-content/70'>
        <span>Cena min: {formatNumber(min)} | max: {formatNumber(max)}</span>
        <span>
          Zakres: {candles.length > 0 ? new Date(candles[0].openTime).toLocaleString() : '-'} -{' '}
          {candles.length > 0 ? new Date(candles[candles.length - 1].closeTime).toLocaleString() : '-'}
        </span>
      </div>
    </div>
  );
}

export default function BacktestRunDetails({ runId }: BacktestRunDetailsProps) {
  const { formatCurrency, formatDateTime, formatNumber, formatPercent } = useLocaleFormatting();
  const [run, setRun] = useState<BacktestRun | null>(null);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [strategy, setStrategy] = useState<StrategyDto | null>(null);
  const [timelines, setTimelines] = useState<Record<string, TimelineState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'markets' | 'trades' | 'raw'>('markets');
  const symbolSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const timelinesRef = useRef<Record<string, TimelineState>>({});
  const inFlightSymbolsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    timelinesRef.current = timelines;
  }, [timelines]);

  const loadData = useCallback(async () => {
    try {
      const runData = await getBacktestRun(runId);
      setRun(runData);

      const [tradesData, reportData] = await Promise.all([
        listBacktestRunTrades(runId),
        getBacktestRunReport(runId),
      ]);

      setTrades(tradesData);
      setReport(reportData);
      if (runData.strategyId) {
        try {
          const strategyData = await getStrategy(runData.strategyId);
          setStrategy(strategyData);
        } catch {
          setStrategy(null);
        }
      } else {
        setStrategy(null);
      }
      setError(null);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? 'Nie udalo sie pobrac danych backtestu.');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    setLoading(true);
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!run || (run.status !== 'PENDING' && run.status !== 'RUNNING')) return;

    const timer = setInterval(() => {
      void loadData();
    }, 4000);

    return () => clearInterval(timer);
  }, [loadData, run]);

  const liveProgress = ((run?.seedConfig as { liveProgress?: LiveProgress } | null)?.liveProgress ?? null) as LiveProgress | null;
  const indicatorMeta = useMemo(() => extractStrategyIndicatorMeta(strategy), [strategy]);
  const configuredRunSymbols = useMemo(() => {
    const symbols = ((run?.seedConfig as { symbols?: unknown } | null)?.symbols ?? null) as string[] | null;
    if (!Array.isArray(symbols)) return [];
    return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [run?.seedConfig]);
  const symbolStats = useMemo(() => buildSymbolStats(trades, configuredRunSymbols), [configuredRunSymbols, trades]);
  const tradesBySymbol = useMemo(() => {
    const grouped = new Map<string, BacktestTrade[]>();
    for (const trade of trades) {
      const bucket = grouped.get(trade.symbol) ?? [];
      bucket.push(trade);
      grouped.set(trade.symbol, bucket);
    }
    for (const [symbol, items] of grouped.entries()) {
      grouped.set(
        symbol,
        [...items].sort((a, b) => safeDateMs(a.openedAt) - safeDateMs(b.openedAt)),
      );
    }
    return grouped;
  }, [trades]);
  const summaryMetrics = ((report?.metrics ?? null) as {
    initialBalance?: number;
    endBalance?: number;
    parityDiagnostics?: Array<{
      symbol?: string;
      status?: 'PROCESSED' | 'FAILED';
      error?: string | null;
    }>;
  } | null) ?? null;
  const parityDiagnosticsBySymbol = useMemo(() => {
    const map = new Map<string, { status: 'PROCESSED' | 'FAILED'; error: string | null }>();
    for (const item of summaryMetrics?.parityDiagnostics ?? []) {
      if (!item?.symbol || !item?.status) continue;
      map.set(item.symbol.toUpperCase(), {
        status: item.status,
        error: item.error ?? null,
      });
    }
    return map;
  }, [summaryMetrics?.parityDiagnostics]);
  const initialBalance = summaryMetrics?.initialBalance ?? 0;
  const dailyPerformance = useMemo(() => buildDailyPerformance(trades, initialBalance), [initialBalance, trades]);

  const mergeByKey = <T, K extends string | number>(current: T[], incoming: T[], getKey: (value: T) => K) => {
    const map = new Map<K, T>();
    for (const item of current) {
      map.set(getKey(item), item);
    }
    for (const item of incoming) {
      map.set(getKey(item), item);
    }
    return [...map.values()];
  };

  const loadSymbolTimeline = useCallback(
    async (symbol: string, cursor = 0, append = false) => {
      const lockKey = `${symbol}:${cursor}:${append ? 'append' : 'replace'}`;
      if (inFlightSymbolsRef.current.has(lockKey)) return timelinesRef.current[symbol]?.data ?? undefined;
      inFlightSymbolsRef.current.add(lockKey);

      setTimelines((prev) => ({
        ...prev,
        [symbol]: {
          data: prev[symbol]?.data ?? null,
          loading: true,
          error: null,
        },
      }));

      try {
        let data: BacktestTimeline;
        try {
          data = await getBacktestRunTimeline(runId, {
            symbol,
            cursor,
            chunkSize: 10000,
          });
        } catch (error) {
          // Backward-compat fallback for older backend validators.
          data = await getBacktestRunTimeline(runId, {
            symbol,
            cursor,
            chunkSize: 800,
          });
        }
        const normalizedData: BacktestTimeline = {
          ...data,
          candles: Array.isArray(data.candles) ? data.candles : [],
          events: Array.isArray(data.events) ? data.events : [],
          indicatorSeries: Array.isArray(data.indicatorSeries) ? data.indicatorSeries : [],
        };

        let mergedForReturn: BacktestTimeline | null = null;
        setTimelines((prev) => {
          const existing = prev[symbol]?.data;
          const merged = append && existing
            ? {
                ...normalizedData,
                candles: mergeByKey(existing.candles, normalizedData.candles, (candle) => candle.candleIndex),
                events: mergeByKey(existing.events, normalizedData.events, (event) => event.id),
                indicatorSeries: normalizedData.indicatorSeries.map((series) => {
                  const existingSeries = existing.indicatorSeries.find((item) => item.key === series.key);
                  return {
                    ...series,
                    points: mergeByKey(existingSeries?.points ?? [], series.points, (point) => point.candleIndex),
                  };
                }),
                cursor: 0,
              }
            : normalizedData;

          const prepared: BacktestTimeline = {
            ...merged,
            candles: [...merged.candles].sort((a, b) => a.candleIndex - b.candleIndex),
            events: [...merged.events].sort((a, b) => a.candleIndex - b.candleIndex),
            indicatorSeries: merged.indicatorSeries.map((series) => ({
              ...series,
              points: [...series.points].sort((a, b) => a.candleIndex - b.candleIndex),
            })),
          };
          mergedForReturn = prepared;

          return {
            ...prev,
            [symbol]: {
              data: prepared,
              loading: false,
              error: null,
            },
          };
        });
        return mergedForReturn ?? normalizedData;
      } catch (err: unknown) {
        setTimelines((prev) => ({
          ...prev,
          [symbol]: {
            data: prev[symbol]?.data ?? null,
            loading: false,
            error: getAxiosMessage(err) ?? 'Nie udalo sie pobrac timeline dla rynku.',
          },
        }));
        return undefined;
      } finally {
        inFlightSymbolsRef.current.delete(lockKey);
      }
    },
    [runId],
  );

  useEffect(() => {
    if (activeTab !== 'markets') return;
    if (symbolStats.length === 0) return;
    let cancelled = false;

    const runQueue = async () => {
      for (const stats of symbolStats) {
        if (cancelled) return;
        const symbol = stats.symbol;
        const parity = parityDiagnosticsBySymbol.get(symbol.toUpperCase());
        if (parity?.status === 'FAILED') {
          setTimelines((prev) => ({
            ...prev,
            [symbol]: {
              data: prev[symbol]?.data ?? null,
              loading: false,
              error: parity.error ?? 'Symbol processing failed during backtest run.',
            },
          }));
          continue;
        }
        const timelineState = timelinesRef.current[symbol];

        if (!timelineState?.data && !timelineState?.loading) {
          let currentTimeline = await loadSymbolTimeline(symbol, 0, false);
          if (cancelled) return;
          if (!currentTimeline) continue;

          const symbolTrades = tradesBySymbol.get(symbol) ?? [];
          let safety = 0;
          while (
            !cancelled &&
            currentTimeline.nextCursor != null &&
            countTradesVisibleInTimeline(symbolTrades, currentTimeline) < symbolTrades.length &&
            safety < 20
          ) {
            safety += 1;
            const mergedTimeline = await loadSymbolTimeline(symbol, currentTimeline.nextCursor, true);
            if (!mergedTimeline) break;
            currentTimeline = mergedTimeline;
          }
        }

        // PERF: keep only first chunk auto-loaded per symbol to avoid loading
        // full history for every market card at once; users can load more on demand.
      }
    };

    void runQueue();
    return () => {
      cancelled = true;
    };
  }, [activeTab, loadSymbolTimeline, parityDiagnosticsBySymbol, symbolStats, tradesBySymbol]);

  const progress = useMemo(() => {
    if (!run) return 0;
    if (liveProgress?.totalSymbols && liveProgress.totalSymbols > 0) {
      const bySymbols = Math.floor(((liveProgress.processedSymbols ?? 0) / liveProgress.totalSymbols) * 85);
      if (run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'CANCELED') return 100;
      return Math.max(5, bySymbols);
    }
    if (run.status === 'PENDING') return 20;
    if (run.status === 'RUNNING') return 60;
    if (run.status === 'COMPLETED') return report ? 100 : 85;
    return 100;
  }, [liveProgress, report, run]);

  const stages = useMemo(
    () => [
      {
        label: 'Run utworzony',
        icon: <LuListChecks className='h-4 w-4' />,
        done: Boolean(run),
        active: !run,
      },
      {
        label: 'Silnik liczy wynik',
        icon: <LuLoaderCircle className='h-4 w-4' />,
        done: run?.status === 'RUNNING' || run?.status === 'COMPLETED' || run?.status === 'FAILED' || run?.status === 'CANCELED',
        active: run?.status === 'PENDING',
      },
      {
        label: 'Trade list gotowa',
        icon: <LuDatabase className='h-4 w-4' />,
        done: trades.length > 0 || run?.status === 'FAILED' || run?.status === 'CANCELED' || run?.status === 'COMPLETED',
        active: run?.status === 'RUNNING' && trades.length === 0,
      },
      {
        label: 'Raport i wykres',
        icon: <LuChartLine className='h-4 w-4' />,
        done: Boolean(report) || run?.status === 'FAILED' || run?.status === 'CANCELED',
        active: run?.status === 'COMPLETED' && !report,
      },
      {
        label: 'Backtest zakonczony',
        icon: <LuShieldCheck className='h-4 w-4' />,
        done: run?.status === 'COMPLETED' || run?.status === 'FAILED' || run?.status === 'CANCELED',
        active: run?.status === 'RUNNING',
      },
    ],
    [report, run, trades.length]
  );

  if (loading) return <LoadingState title='Ladowanie szczegolow backtestu' />;
  if (error) {
    return (
      <ErrorState
        title='Nie udalo sie pobrac szczegolow backtestu'
        description={error}
        retryLabel='Sprobuj ponownie'
        onRetry={() => {
          setLoading(true);
          void loadData();
        }}
      />
    );
  }
  if (!run) return <EmptyState title='Nie znaleziono runa' description='Wybrany run nie istnieje albo nie masz do niego dostepu.' />;

  return (
    <div className='space-y-4'>
      <section className='rounded-xl border border-base-300 bg-base-100 p-4 space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h2 className='text-lg font-semibold'>{run.name}</h2>
          <span className='badge badge-outline'>{run.status}</span>
        </div>

        <div className='text-sm opacity-80 flex flex-wrap gap-x-4 gap-y-1'>
          <p>Symbol: <span className='font-medium'>{run.symbol}</span></p>
          <p>Interwal: <span className='font-medium'>{run.timeframe}</span></p>
          <p>Start: <span className='font-medium'>{formatDateTime(run.startedAt)}</span></p>
        </div>

        <progress className='progress progress-primary w-full' value={progress} max={100} />

        {liveProgress ? (
          <div className='rounded-lg border border-base-300 bg-base-200 p-3 text-sm'>
            <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
              <p>Symboli: <span className='font-medium'>{liveProgress.processedSymbols ?? 0}/{liveProgress.totalSymbols ?? 0}</span></p>
              <p>Aktualny: <span className='font-medium'>{liveProgress.currentSymbol ?? '-'}</span></p>
              <p>Transakcji: <span className='font-medium'>{formatNumber(liveProgress.totalTrades ?? 0)}</span></p>
              <p>Net PnL (live): <span className={`font-medium ${pnlClass(liveProgress.netPnl ?? null)}`}>{formatCurrency(liveProgress.netPnl ?? 0)}</span></p>
            </div>
            <p className='mt-1 opacity-70'>
              Leverage: {liveProgress.leverage ?? 1}x | Margin: {liveProgress.marginMode ?? 'NONE'} | Liquidations: {liveProgress.liquidations ?? 0}
            </p>
            <p className='opacity-70'>
              Candle cursor: {(liveProgress.currentCandleIndex ?? 0) + 1}/{liveProgress.totalCandlesForSymbol ?? '-'} | Max candles/rynek: {liveProgress.maxCandlesPerSymbol ?? '-'} | Fail symboli: {(liveProgress.failedSymbols ?? []).length}
            </p>
          </div>
        ) : null}

        <ul className='steps steps-vertical lg:steps-horizontal w-full'>
          {stages.map((stage) => (
            <li key={stage.label} className={`step ${stage.done ? 'step-primary' : ''}`}>
              <span className={`inline-flex items-center gap-2 ${stage.active ? 'animate-pulse' : ''}`}>
                {stage.icon}
                {stage.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className='rounded-xl border border-base-300 bg-base-100 p-4'>
        <div role='tablist' className='tabs tabs-boxed'>
          <button
            type='button'
            className={`tab ${activeTab === 'summary' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            type='button'
            className={`tab ${activeTab === 'markets' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('markets')}
          >
            Markets
          </button>
          <button
            type='button'
            className={`tab ${activeTab === 'trades' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('trades')}
          >
            Trades
          </button>
          <button
            type='button'
            className={`tab ${activeTab === 'raw' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('raw')}
          >
            Raw
          </button>
        </div>

        {activeTab === 'summary' ? (
          <div className='mt-4 space-y-3'>
            {!report ? (
              <EmptyState
                title='Raport nie jest jeszcze gotowy'
                description='Po zakonczeniu runa raport pojawi sie automatycznie.'
              />
            ) : (
              <>
                <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-6'>
                  <div className='rounded-lg border border-base-300 bg-base-200 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>Net PnL</p>
                    <p className={`mt-1 text-2xl font-semibold ${pnlClass(report.netPnl)}`}>{formatCurrency(report.netPnl)}</p>
                  </div>
                  <div className='rounded-lg border border-base-300 bg-base-200 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>Win Rate</p>
                    <p className='mt-1 text-2xl font-semibold'>{formatPercent(report.winRate)}</p>
                  </div>
                  <div className='rounded-lg border border-base-300 bg-base-200 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>Transakcje</p>
                    <p className='mt-1 text-2xl font-semibold'>{formatNumber(report.totalTrades)}</p>
                  </div>
                  <div className='rounded-lg border border-base-300 bg-base-200 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>Max Drawdown</p>
                    <p className='mt-1 text-2xl font-semibold'>{formatPercent(report.maxDrawdown)}</p>
                  </div>
                  <div className='rounded-lg border border-base-300 bg-base-200 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>Start Balance</p>
                    <p className='mt-1 text-2xl font-semibold'>{formatCurrency(summaryMetrics?.initialBalance ?? 0)}</p>
                  </div>
                  <div className='rounded-lg border border-base-300 bg-base-200 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>End Balance</p>
                    <p className='mt-1 text-2xl font-semibold'>{formatCurrency(summaryMetrics?.endBalance ?? 0)}</p>
                  </div>
                </div>

                <div className='grid gap-3 xl:grid-cols-2'>
                  <div className='rounded-lg border border-base-300 bg-base-200 p-3'>
                    <p className='text-sm font-medium'>Dzienny wynik (zysk/strata)</p>
                    <SummaryDailyPnlChart points={dailyPerformance} formatCurrency={formatCurrency} />
                  </div>
                  <div className='rounded-lg border border-base-300 bg-base-200 p-3'>
                    <p className='text-sm font-medium'>Saldo portfela od startu do konca</p>
                    <SummaryBalanceChart points={dailyPerformance} formatCurrency={formatCurrency} />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}

        {activeTab === 'markets' ? (
          <div className='mt-4 space-y-4'>
            {symbolStats.length === 0 ? (
              <EmptyState
                title='Brak danych per rynek'
                description='Wyniki per para pojawia sie po wygenerowaniu przynajmniej jednej transakcji.'
              />
            ) : (
              <>
                {symbolStats.map((stats) => (
                  <article
                    key={stats.symbol}
                    ref={(node) => {
                      symbolSectionRefs.current[stats.symbol] = node;
                    }}
                    className='rounded-xl border border-base-300 bg-base-100 p-3'
                  >
                    {(() => {
                      const timelineState = timelines[stats.symbol] ?? { data: null, loading: false, error: null };
                      const timeline = timelineState.data;
                      const symbolTrades = tradesBySymbol.get(stats.symbol) ?? [];
                      const visibleTrades = timeline ? filterTradesByTimelineWindow(symbolTrades, timeline) : symbolTrades;
                      const visibleStats = buildSymbolStats(visibleTrades, [stats.symbol])[0] ?? stats;
                      const showVisibleSubset = visibleStats.tradesCount !== stats.tradesCount;
                      const visibleFinalCandleClosures = visibleTrades.filter((trade) => trade.exitReason === 'FINAL_CANDLE').length;
                      const visibleLiquidations = visibleTrades.filter(
                        (trade) => trade.exitReason === 'LIQUIDATION' || trade.liquidated,
                      ).length;
                      const visibleLifecycleCounts = (Array.isArray(timeline?.events) ? timeline.events : []).reduce<Record<string, number>>((acc, event) => {
                        acc[event.type] = (acc[event.type] ?? 0) + 1;
                        return acc;
                      }, {});
                      return (
                        <>
                          <div className='mb-3 flex items-center justify-between gap-2'>
                            <h3 className='text-base font-semibold'>{stats.symbol}</h3>
                            <div className='flex items-center gap-2'>
                              <span className={`badge ${stats.netPnl >= 0 ? 'badge-success' : 'badge-error'} badge-outline`}>
                                {formatCurrency(stats.netPnl)}
                              </span>
                            </div>
                          </div>

                          <div className='grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]'>
                            <div className='space-y-3'>
                              {timelineState.loading && !timeline ? <p className='text-sm opacity-70'>Ladowanie timeline...</p> : null}
                              {timelineState.error ? <p className='text-sm text-error'>{timelineState.error}</p> : null}
                              {timeline ? (
                                <TimelineCandlesChart
                                  timeline={timeline}
                                  trades={visibleTrades}
                                  formatNumber={formatNumber}
                                  rsiLongLevel={indicatorMeta.rsiLongLevel}
                                  rsiShortLevel={indicatorMeta.rsiShortLevel}
                                />
                              ) : (
                                <div className='h-[320px] w-full animate-pulse rounded-lg bg-base-200/60' />
                              )}

                              {timeline?.nextCursor != null ? (
                                <button
                                  type='button'
                                  className='btn btn-sm btn-outline'
                                  onClick={() => void loadSymbolTimeline(stats.symbol, timeline.nextCursor ?? 0, true)}
                                  disabled={timelineState.loading}
                                >
                                  {timelineState.loading ? 'Ladowanie...' : 'Doloaduj kolejne swiece'}
                                </button>
                              ) : null}

                              <div className='flex flex-wrap items-center gap-4 text-xs text-base-content/75'>
                                <span className='inline-flex items-center gap-1'>
                                  <span className='inline-block h-0 w-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-success' />
                                  Entry LONG
                                </span>
                                <span className='inline-flex items-center gap-1'>
                                  <span className='inline-block h-0 w-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-error' />
                                  Entry SHORT
                                </span>
                                <span className='inline-flex items-center gap-1'>
                                  <LuSquare className='h-3.5 w-3.5 text-success' />
                                  Exit zysk
                                </span>
                                <span className='inline-flex items-center gap-1'>
                                  <LuSquare className='h-3.5 w-3.5 text-error' />
                                  Exit strata
                                </span>
                                <span className='inline-flex items-center gap-1'>
                                  <LuCircleDot className='h-3.5 w-3.5 text-info' />
                                  DCA
                                </span>
                                <span className='inline-flex items-center gap-1'>
                                  <LuCircleDot className='h-3.5 w-3.5 text-accent' />
                                  TTP
                                </span>
                                <span className='inline-flex items-center gap-1'>
                                  DCA {visibleLifecycleCounts.DCA ?? 0} | TP {visibleLifecycleCounts.TP ?? 0} | TTP {visibleLifecycleCounts.TTP ?? 0} | SL {visibleLifecycleCounts.SL ?? 0} | TSL {visibleLifecycleCounts.TRAILING ?? 0} | LIQ {visibleLifecycleCounts.LIQUIDATION ?? 0}
                                </span>
                              </div>
                            </div>

                            <aside className='rounded-lg border border-base-300 bg-base-200 p-3 text-sm'>
                              <h4 className='mb-2 font-semibold'>Statystyki pary</h4>
                              {(() => {
                                const parity = parityDiagnosticsBySymbol.get(stats.symbol.toUpperCase());
                                if (!parity) return null;
                                return (
                                  <div className='mb-2'>
                                    <span className={`badge badge-sm ${parity.status === 'PROCESSED' ? 'badge-success' : 'badge-error'}`}>
                                      {parity.status === 'PROCESSED' ? 'Parity: PROCESSED' : 'Parity: FAILED'}
                                    </span>
                                    {parity.error ? <p className='mt-1 text-xs text-error'>{parity.error}</p> : null}
                                  </div>
                                );
                              })()}
                              <div className='space-y-1'>
                                <p>
                                  Transakcji:{' '}
                                  <span className='font-medium'>
                                    {formatNumber(visibleStats.tradesCount)}
                                    {showVisibleSubset ? ` / ${formatNumber(stats.tradesCount)}` : ''}
                                  </span>
                                </p>
                                {showVisibleSubset ? (
                                  <p className='text-xs opacity-70'>w zakresie wykresu / lacznie</p>
                                ) : null}
                                <p>Win rate: <span className='font-medium'>{formatPercent(visibleStats.winRate)}</span></p>
                                <p>Wygrane/Przegrane: <span className='font-medium'>{visibleStats.wins}/{visibleStats.losses}</span></p>
                                <p>Srednie wejscie: <span className='font-medium'>{formatNumber(visibleStats.avgEntry)}</span></p>
                                <p>Srednie wyjscie: <span className='font-medium'>{formatNumber(visibleStats.avgExit)}</span></p>
                                <p>Sredni czas pozycji: <span className='font-medium'>{formatNumber(visibleStats.avgHoldMinutes)} min</span></p>
                                <p>
                                  Zakres:{' '}
                                  <span className='font-medium'>
                                    {visibleStats.firstAt ? formatDateTime(new Date(visibleStats.firstAt).toISOString()) : '-'} -{' '}
                                    {visibleStats.lastAt ? formatDateTime(new Date(visibleStats.lastAt).toISOString()) : '-'}
                                  </span>
                                </p>
                                <p>Zamkniete na ostatniej swiecy: <span className='font-medium'>{formatNumber(visibleFinalCandleClosures)}</span></p>
                                <p>Likwidacje: <span className='font-medium'>{formatNumber(visibleLiquidations)}</span></p>
                              </div>
                              <div className='divider my-2' />
                              <h5 className='font-semibold'>Wskazniki strategii</h5>
                              {indicatorMeta.names.length > 0 ? (
                                <div className='mt-2 flex flex-wrap gap-1.5'>
                                  {indicatorMeta.names.map((name) => (
                                    <span key={`${stats.symbol}-${name}`} className='badge badge-outline badge-sm'>
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className='mt-1 text-xs opacity-70'>Brak danych o wskaznikach w konfiguracji strategii.</p>
                              )}
                            </aside>
                          </div>
                        </>
                      );
                    })()}
                  </article>
                ))}
              </>
            )}
          </div>
        ) : null}

        {activeTab === 'trades' ? (
          <div className='mt-4'>
            {trades.length === 0 ? (
              <EmptyState title='Brak trades' description='Dla tego runa nie ma jeszcze transakcji.' />
            ) : (
              <div className='overflow-x-auto'>
                <table className='table table-zebra table-sm'>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Side</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id}>
                        <td>{trade.symbol}</td>
                        <td>{trade.side}</td>
                        <td>{formatNumber(trade.entryPrice)}</td>
                        <td>{formatNumber(trade.exitPrice)}</td>
                        <td className={trade.pnl >= 0 ? 'text-success' : 'text-error'}>{formatCurrency(trade.pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'raw' ? (
          <pre className='mockup-code mt-4 whitespace-pre-wrap text-xs'>
            {JSON.stringify({ run, report, trades: trades.slice(0, 50), timelines }, null, 2)}
          </pre>
        ) : null}
      </section>
    </div>
  );
}

