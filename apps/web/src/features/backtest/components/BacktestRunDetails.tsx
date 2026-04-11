'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LuChartLine, LuCircleDot, LuDatabase, LuListChecks, LuLoaderCircle, LuShieldCheck, LuSquare } from 'react-icons/lu';
import {
  getBacktestRunTimeline,
} from '../services/backtests.service';
import { BacktestRun, BacktestTimeline, BacktestTimelineEvent, BacktestTrade } from '../types/backtest.type';
import { EmptyState, ErrorState } from '@/ui/components/ViewState';
import { SkeletonCardBlock, SkeletonKpiRow, SkeletonTableRows } from '@/ui/components/loading';
import { useLocaleFormatting } from '@/i18n/useLocaleFormatting';
import { StrategyDto } from '../../strategies/types/StrategyForm.type';
import { buildNonOverlappingTradeSegments } from '../utils/nonOverlappingTradeSegments';
import { buildPairStatsMetricDisplay } from '../utils/pairStatsMetricDisplay';
import { getPatternMarkerBias, splitTimelineIndicatorSeriesForRendering } from '../utils/timelineIndicatorOverlays';
import { I18nContext } from '../../../i18n/I18nProvider';
import { useBacktestRunCoreData } from '../hooks/useBacktestRunCoreData';
import BacktestRunHeaderSection from './BacktestRunHeaderSection';
import { getAxiosMessage } from '@/lib/getAxiosMessage';

const pnlClass = (value: number | null) => {
  if (value == null) return '';
  if (value > 0) return 'text-success';
  if (value < 0) return 'text-error';
  return '';
};

const runStatusBadgeClass = (status: BacktestRun['status']) => {
  if (status === 'COMPLETED') return 'badge-success';
  if (status === 'RUNNING') return 'badge-info';
  if (status === 'PENDING') return 'badge-warning';
  if (status === 'FAILED' || status === 'CANCELED') return 'badge-error';
  return 'badge-outline';
};

const runStatusLabel = (status: BacktestRun['status'], locale: 'pl' | 'en') => {
  if (status === 'COMPLETED') return locale === 'en' ? 'Completed' : 'Zakonczony';
  if (status === 'RUNNING') return locale === 'en' ? 'Running' : 'W toku';
  if (status === 'PENDING') return locale === 'en' ? 'Pending' : 'Oczekuje';
  if (status === 'FAILED') return locale === 'en' ? 'Failed' : 'Niepowodzenie';
  if (status === 'CANCELED') return locale === 'en' ? 'Canceled' : 'Anulowany';
  return status;
};

const runProgressClass = (status: BacktestRun['status']) => {
  if (status === 'COMPLETED') return 'progress-success';
  if (status === 'FAILED' || status === 'CANCELED') return 'progress-error';
  if (status === 'RUNNING') return 'progress-info';
  return 'progress-primary';
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
  loadingPhase: 'candles' | 'events' | null;
  candlesNextCursor: number | null;
  eventsNextCursor: number | null;
  candlesLoaded: boolean;
  eventsLoaded: boolean;
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

const formatHoldDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = Math.round(minutes % 60);
  if (restMinutes === 0) return `${hours}h`;
  return `${hours}h ${restMinutes}m`;
};

const getExitReasonLabel = (
  reason: 'SIGNAL_EXIT' | 'FINAL_CANDLE' | 'LIQUIDATION',
  locale: 'pl' | 'en',
) => {
  if (reason === 'SIGNAL_EXIT') return locale === 'en' ? 'Signal' : 'Sygnal';
  if (reason === 'FINAL_CANDLE') return locale === 'en' ? 'Final candle' : 'Ostatnia swieca';
  return locale === 'en' ? 'Liquidation' : 'Likwidacja';
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

const CLOSE_LIKE_TIMELINE_EVENT_TYPES = new Set<BacktestTimelineEvent['type']>([
  'EXIT',
  'TP',
  'TTP',
  'SL',
  'TRAILING',
  'LIQUIDATION',
]);

const buildSyntheticTradesFromTimelineEvents = (
  events: BacktestTimelineEvent[],
  symbol: string,
): BacktestTrade[] => {
  if (!Array.isArray(events) || events.length === 0) return [];

  const grouped = new Map<
    string,
    {
      entry?: BacktestTimelineEvent;
      close?: BacktestTimelineEvent;
    }
  >();

  const ordered = [...events].sort((a, b) => {
    const byIndex = a.candleIndex - b.candleIndex;
    if (byIndex !== 0) return byIndex;
    return safeDateMs(a.timestamp) - safeDateMs(b.timestamp);
  });

  for (const event of ordered) {
    const bucket = grouped.get(event.tradeId) ?? {};
    if (event.type === 'ENTRY') {
      if (!bucket.entry || event.candleIndex <= bucket.entry.candleIndex) {
        bucket.entry = event;
      }
    } else if (CLOSE_LIKE_TIMELINE_EVENT_TYPES.has(event.type)) {
      if (!bucket.close || event.candleIndex >= bucket.close.candleIndex) {
        bucket.close = event;
      }
    }
    grouped.set(event.tradeId, bucket);
  }

  const result: BacktestTrade[] = [];
  for (const [tradeId, pair] of grouped.entries()) {
    if (!pair.entry || !pair.close) continue;
    result.push({
      id: tradeId,
      symbol,
      side: pair.entry.side,
      entryPrice: pair.entry.price,
      exitPrice: pair.close.price,
      quantity: 0,
      openedAt: pair.entry.timestamp,
      closedAt: pair.close.timestamp,
      pnl: pair.close.pnl ?? 0,
      fee: null,
      exitReason: pair.close.type === 'LIQUIDATION' ? 'LIQUIDATION' : 'SIGNAL_EXIT',
      liquidated: pair.close.type === 'LIQUIDATION',
    });
  }

  return result.sort((a, b) => safeDateMs(a.openedAt) - safeDateMs(b.openedAt));
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
  emptyText,
}: {
  points: DailyPerformancePoint[];
  formatCurrency: (value: number) => string;
  emptyText: string;
}) {
  if (points.length === 0) {
    return <p className='mt-2 text-sm opacity-70'>{emptyText}</p>;
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
  emptyText,
}: {
  points: DailyPerformancePoint[];
  formatCurrency: (value: number) => string;
  emptyText: string;
}) {
  if (points.length === 0) {
    return <p className='mt-2 text-sm opacity-70'>{emptyText}</p>;
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
  symbol,
  netPnl,
  formatCurrency,
  formatNumber,
  rsiLongLevel,
  rsiShortLevel,
  eventsLoaded,
  noCandlesText,
  zoomLabel,
}: {
  timeline: BacktestTimeline;
  trades: BacktestTrade[];
  symbol: string;
  netPnl: number;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
  rsiLongLevel: number | null;
  rsiShortLevel: number | null;
  eventsLoaded: boolean;
  noCandlesText: string;
  zoomLabel: string;
}) {
  const zoomSteps = [1, 1.25, 1.5, 2, 3, 4, 6, 8, 10];
  const [zoomIndex, setZoomIndex] = useState(0);
  const sharedScrollRef = useRef<HTMLDivElement | null>(null);
  const zoom = zoomSteps[zoomIndex] ?? 1;
  const candles = timeline.candles;
  if (candles.length === 0) {
    return <p className='text-sm opacity-70'>{noCandlesText}</p>;
  }

  const width = Math.round(900 * zoom);
  const pricePanelHeight = 320;
  const oscillatorPanelHeight = 100;
  const xAxisHeight = 24;
  const axisOverlayWidth = 72;
  const padding = { top: 12, right: 8, bottom: 2, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = pricePanelHeight - padding.top - padding.bottom;

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
  const desiredTickCount = Math.max(4, Math.min(16, Math.round(4 + zoom * 1.25)));
  const tickStep = Math.max(1, Math.floor(Math.max(1, candles.length - 1) / Math.max(1, desiredTickCount - 1)));
  const xTickIndexes = (() => {
    const indexes: number[] = [];
    for (let index = 0; index < candles.length; index += tickStep) {
      indexes.push(index);
    }
    if (candles.length > 0 && indexes[indexes.length - 1] !== candles.length - 1) {
      indexes.push(candles.length - 1);
    }
    return indexes.filter((idx, index, array) => idx >= 0 && idx < candles.length && array.indexOf(idx) === index);
  })();

  const xAt = (index: number) => padding.left + (index + 0.5) * barWidth;
  const yAt = (price: number) => padding.top + (1 - (price - min) / range) * innerHeight;
  const playbackX =
    typeof timeline.playbackCursor === 'number' &&
    timeline.playbackCursor >= timeline.cursor &&
    timeline.playbackCursor < timeline.cursor + candles.length
      ? xAt(timeline.playbackCursor - timeline.cursor)
      : null;

  const rawTimelineEvents = Array.isArray(timeline.events) ? timeline.events : [];
  const symbolEventKey = `_${symbol}_`;
  const timelineEvents = rawTimelineEvents.filter((event) => event.tradeId.includes(symbolEventKey));
  const lifecycleEvents = timelineEvents.filter((event) => event.type === 'DCA');
  const timelineIndicatorSeries = Array.isArray(timeline.indicatorSeries) ? timeline.indicatorSeries : [];
  const {
    priceSeries: priceIndicators,
    oscillatorPanels: oscillatorOverlayPanels,
    patternSeries: patternIndicatorSeries,
  } = splitTimelineIndicatorSeriesForRendering(timelineIndicatorSeries);
  const tradeSegmentsFromEvents = (() => {
    if (timelineEvents.length === 0) return [] as ReturnType<typeof buildNonOverlappingTradeSegments>;
    const closeLike = new Set(['EXIT', 'TP', 'TTP', 'SL', 'TRAILING', 'LIQUIDATION']);
    const grouped = new Map<
      string,
      {
        entry?: (typeof timelineEvents)[number];
        close?: (typeof timelineEvents)[number];
      }
    >();

    for (const event of [...timelineEvents].sort((a, b) => a.candleIndex - b.candleIndex)) {
      const bucket = grouped.get(event.tradeId) ?? {};
      if (event.type === 'ENTRY') {
        bucket.entry = event;
      } else if (closeLike.has(event.type)) {
        if (!bucket.close || event.candleIndex >= bucket.close.candleIndex) {
          bucket.close = event;
        }
      }
      grouped.set(event.tradeId, bucket);
    }

    const firstCandleIndex = candles[0]?.candleIndex ?? timeline.cursor;
    const lastLocalIndex = candles.length - 1;

    const segments = [...grouped.entries()]
      .map(([tradeId, pair]) => {
        if (!pair.entry || !pair.close) return null;
        const startLocal = pair.entry.candleIndex - firstCandleIndex;
        const endLocal = pair.close.candleIndex - firstCandleIndex;
        if (!Number.isFinite(startLocal) || !Number.isFinite(endLocal)) return null;
        const start = Math.max(0, Math.min(lastLocalIndex, Math.min(startLocal, endLocal)));
        const end = Math.max(0, Math.min(lastLocalIndex, Math.max(startLocal, endLocal)));
        return {
          tradeId,
          start,
          end,
          side: pair.entry.side,
          entryPrice: pair.entry.price,
          exitPrice: pair.close.price,
          profit: (pair.close.pnl ?? 0) >= 0,
        };
      })
      .filter((segment): segment is NonNullable<typeof segment> => Boolean(segment))
      .sort((a, b) => a.start - b.start || a.end - b.end);

    return segments;
  })();

  const tradeSegments =
    tradeSegmentsFromEvents.length > 0
      ? tradeSegmentsFromEvents
      : eventsLoaded
        ? buildNonOverlappingTradeSegments(trades, candles)
        : [];

  const oscillatorPanels = oscillatorOverlayPanels.flatMap((overlayPanel) => {
    const values = overlayPanel.series
      .flatMap((series) => series.points.map((point) => point.value))
      .filter((value): value is number => typeof value === 'number');
    if (values.length === 0) return [];

    const localMin = Math.min(...values);
    const localMax = Math.max(...values);
    const localRange = localMax - localMin || 1;
    const localYTicks = Array.from({ length: 4 }, (_, idx) => {
      const ratio = idx / 3;
      const value = localMax - ratio * localRange;
      const y = ratio * oscillatorPanelHeight;
      return { y, value };
    });
    const levelToY = (value: number) =>
      Math.max(0, Math.min(oscillatorPanelHeight, oscillatorPanelHeight - ((value - localMin) / localRange) * oscillatorPanelHeight));
    const palette = ['text-info', 'text-warning', 'text-secondary', 'text-accent'];
    const lines = overlayPanel.series
      .map((series, seriesIndex) => {
        const points = series.points
          .map((point) => {
            if (typeof point.value !== 'number') return null;
            const localIndex = point.candleIndex - timeline.cursor;
            if (localIndex < 0 || localIndex >= candles.length) return null;
            const x = xAt(localIndex);
            const y = oscillatorPanelHeight - ((point.value - localMin) / localRange) * oscillatorPanelHeight;
            return `${x},${y}`;
          })
          .filter((point): point is string => Boolean(point))
          .join(' ');
        if (!points) return null;
        const label = series.name.startsWith(overlayPanel.title)
          ? series.name.slice(overlayPanel.title.length).trim() || overlayPanel.title
          : series.name;
        return {
          key: series.key,
          label,
          className: palette[seriesIndex % palette.length],
          points,
        };
      })
      .filter((line): line is { key: string; label: string; className: string; points: string } => Boolean(line));
    if (lines.length === 0) return [];

    return [
      {
        key: overlayPanel.key,
        title: overlayPanel.title,
        localYTicks,
        levelToY,
        lines,
      },
    ];
  });

  const patternMarkers = patternIndicatorSeries.flatMap((series, seriesIndex) =>
    series.points
      .map((point) => {
        if (point.value !== 1) return null;
        const localIndex = point.candleIndex - timeline.cursor;
        if (localIndex < 0 || localIndex >= candles.length) return null;
        const candle = candles[localIndex];
        if (!candle) return null;
        const bias = getPatternMarkerBias(series.name);
        const stackOffset = (seriesIndex % 3) * 5;
        const y =
          bias === 'bullish'
            ? yAt(candle.low) + 8 + stackOffset
            : bias === 'bearish'
              ? yAt(candle.high) - 8 - stackOffset
              : yAt((candle.high + candle.low) / 2);
        return {
          key: `${series.key}-${point.candleIndex}`,
          label: series.name,
          x: xAt(localIndex),
          y,
          bias,
        };
      })
      .filter((marker): marker is { key: string; label: string; x: number; y: number; bias: 'bullish' | 'bearish' | 'neutral' } => Boolean(marker)),
  );

  const formatXAxisLabel = (index: number) => {
    const labelDate = new Date(candles[index].openTime);
    const sameDayAsStart =
      candles.length > 0 &&
      labelDate.toDateString() === new Date(candles[0].openTime).toDateString();
    if (sameDayAsStart) {
      return labelDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return labelDate.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base-300/70 bg-base-100/60 px-2 py-1.5'>
        <div className='flex min-w-0 items-center gap-2'>
          <h4 className='truncate text-sm font-semibold uppercase tracking-wide'>{symbol}</h4>
          <span className={`badge ${netPnl >= 0 ? 'badge-success' : 'badge-error'} badge-outline`}>
            {formatCurrency(netPnl)}
          </span>
        </div>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            className='btn btn-xs btn-outline'
            onClick={() => setZoomIndex((prev) => Math.max(0, prev - 1))}
            disabled={zoomIndex === 0}
            title='Oddal (wiecej swiec)'
          >
            -
          </button>
          <span className='text-xs opacity-70'>
            {zoomLabel} x{zoom.toFixed(2)}
          </span>
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
      </div>

      <div
        className='grid overflow-hidden rounded-lg border border-base-300 bg-base-200/60'
        style={{ gridTemplateColumns: `minmax(0,1fr) ${axisOverlayWidth}px` }}
      >
        <div
          ref={sharedScrollRef}
          className='overflow-x-auto'
        >
          <div style={{ width: `${width}px` }}>
            <svg className='h-[320px] w-full' viewBox={`0 0 ${width} ${pricePanelHeight}`} preserveAspectRatio='none'>
              {yTicks.map((tick) => (
                <line
                  key={`y-${tick.y}`}
                  x1={padding.left}
                  x2={padding.left + innerWidth}
                  y1={tick.y}
                  y2={tick.y}
                  className='stroke-base-300/30'
                />
              ))}

              {xTickIndexes.map((index) => {
                const x = xAt(index);
                return <line key={`x-grid-${candles[index].candleIndex}`} x1={x} x2={x} y1={padding.top} y2={padding.top + innerHeight} className='stroke-base-300/20' />;
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

              {patternMarkers.map((marker) => {
                if (marker.bias === 'bullish') {
                  return (
                    <polygon
                      key={marker.key}
                      points={`${marker.x},${marker.y - 5} ${marker.x - 4},${marker.y + 3} ${marker.x + 4},${marker.y + 3}`}
                      fill='currentColor'
                      className='text-success'
                    >
                      <title>{marker.label}</title>
                    </polygon>
                  );
                }
                if (marker.bias === 'bearish') {
                  return (
                    <polygon
                      key={marker.key}
                      points={`${marker.x},${marker.y + 5} ${marker.x - 4},${marker.y - 3} ${marker.x + 4},${marker.y - 3}`}
                      fill='currentColor'
                      className='text-error'
                    >
                      <title>{marker.label}</title>
                    </polygon>
                  );
                }
                return (
                  <circle key={marker.key} cx={marker.x} cy={marker.y} r={3.2} className='fill-warning' stroke='currentColor'>
                    <title>{marker.label}</title>
                  </circle>
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

                return null;
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

            {oscillatorPanels.map((panel) => (
              <svg
                key={panel.key}
                className='h-[100px] w-full border-t border-base-300/50'
                viewBox={`0 0 ${width} ${oscillatorPanelHeight}`}
                preserveAspectRatio='none'
              >
                {panel.localYTicks.map((tick) => (
                  <line
                    key={`${panel.key}-y-${tick.y}`}
                    x1={padding.left}
                    x2={padding.left + innerWidth}
                    y1={tick.y}
                    y2={tick.y}
                    className='stroke-base-300/30'
                  />
                ))}
                {xTickIndexes.map((index) => {
                  const x = xAt(index);
                  return (
                    <line
                      key={`${panel.key}-x-grid-${candles[index].candleIndex}`}
                      x1={x}
                      x2={x}
                      y1={0}
                      y2={oscillatorPanelHeight}
                      className='stroke-base-300/20'
                    />
                  );
                })}
                <text x={padding.left + 2} y={10} textAnchor='start' className='fill-base-content/70 text-[9px] font-medium'>
                  {panel.title}
                </text>

                {tradeSegments.map((segment, index) => {
                  const xStart = xAt(segment.start) - barWidth / 2;
                  const xEnd = xAt(segment.end) + barWidth / 2;
                  return (
                    <rect
                      key={`osc-bg-${panel.key}-${index}`}
                      x={xStart}
                      y={0}
                      width={Math.max(1, xEnd - xStart)}
                      height={oscillatorPanelHeight}
                      className={segment.profit ? 'fill-success/10' : 'fill-error/10'}
                    />
                  );
                })}

                {panel.title.includes('RSI') && rsiLongLevel != null ? (
                  <line
                    x1={padding.left}
                    x2={padding.left + innerWidth}
                    y1={panel.levelToY(rsiLongLevel)}
                    y2={panel.levelToY(rsiLongLevel)}
                    className='stroke-success/70'
                    strokeDasharray='3 3'
                  />
                ) : null}
                {panel.title.includes('RSI') && rsiShortLevel != null ? (
                  <line
                    x1={padding.left}
                    x2={padding.left + innerWidth}
                    y1={panel.levelToY(rsiShortLevel)}
                    y2={panel.levelToY(rsiShortLevel)}
                    className='stroke-error/70'
                    strokeDasharray='3 3'
                  />
                ) : null}

                {panel.lines.map((line) => (
                  <polyline
                    key={line.key}
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='1.6'
                    className={line.className}
                    points={line.points}
                  />
                ))}

                {playbackX != null ? (
                  <line
                    x1={playbackX}
                    x2={playbackX}
                    y1={0}
                    y2={oscillatorPanelHeight}
                    className='stroke-primary/70'
                    strokeDasharray='4 4'
                  />
                ) : null}
              </svg>
            ))}

            <svg className='h-[24px] w-full border-t border-base-300/50 bg-base-100/40' viewBox={`0 0 ${width} ${xAxisHeight}`} preserveAspectRatio='none'>
              {xTickIndexes.map((index) => {
                const isFirst = index === 0;
                const isLast = index === candles.length - 1;
                const x = isFirst ? padding.left : isLast ? padding.left + innerWidth : xAt(index);
                const anchor: 'start' | 'middle' | 'end' = isFirst ? 'start' : isLast ? 'end' : 'middle';

                return (
                  <g key={`x-label-${candles[index].candleIndex}`}>
                    <line x1={x} x2={x} y1={0} y2={4} className='stroke-base-300/40' />
                    <text x={x} y={xAxisHeight - 6} textAnchor={anchor} className='fill-base-content/60 text-[9px]'>
                      {formatXAxisLabel(index)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className='pointer-events-none border-l border-base-300 bg-base-100/95'>
          <svg className='h-[320px] w-full' viewBox={`0 0 ${axisOverlayWidth} ${pricePanelHeight}`} preserveAspectRatio='none'>
            {yTicks.map((tick) => (
              <g key={`price-axis-${tick.y}`}>
                <line x1={0} x2={8} y1={tick.y} y2={tick.y} className='stroke-base-300/50' />
                <text x={10} y={tick.y + 3} textAnchor='start' className='fill-base-content/70 text-[9px]'>
                  {formatNumber(tick.value)}
                </text>
              </g>
            ))}
          </svg>

          {oscillatorPanels.map((panel) => (
            <svg
              key={`axis-${panel.key}`}
              className='h-[100px] w-full border-t border-base-300/50'
              viewBox={`0 0 ${axisOverlayWidth} ${oscillatorPanelHeight}`}
              preserveAspectRatio='none'
            >
              {panel.localYTicks.map((tick) => (
                <g key={`axis-${panel.key}-y-${tick.y}`}>
                  <line x1={0} x2={8} y1={tick.y} y2={tick.y} className='stroke-base-300/50' />
                  <text x={10} y={tick.y + 3} textAnchor='start' className='fill-base-content/65 text-[9px]'>
                    {formatNumber(tick.value)}
                  </text>
                </g>
              ))}
            </svg>
          ))}

          <div className='h-[24px] border-t border-base-300/50' />
        </div>
      </div>
    </div>
  );
}

export default function BacktestRunDetails({ runId }: BacktestRunDetailsProps) {
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale === 'en' ? 'en' : 'pl';
  const { formatCurrency, formatDateTime, formatNumber, formatPercent } = useLocaleFormatting();
  const copy =
    locale === 'en'
      ? {
          loadingTitle: 'Loading backtest details',
          loadErrorTitle: 'Failed to load backtest details',
          loadErrorDefault: 'Could not fetch backtest details.',
          retry: 'Try again',
          notFoundTitle: 'Run not found',
          notFoundDescription: 'Selected run does not exist or you do not have access.',
          statusInProgress: 'in progress',
          runPreview: 'Backtest run preview',
          marketGroup: 'Market group:',
          strategy: 'Strategy:',
          calcStart: 'Calculation start:',
          calcEnd: 'Calculation end:',
          progressTitle: 'Run progress',
          stageRunCreated: 'Run created',
          stageEngineRunning: 'Engine is calculating',
          stageTradesReady: 'Trades ready',
          stageReportReady: 'Report and chart',
          stageRunFinished: 'Backtest finished',
          trades: 'Trades',
          netPnl: 'Net PnL',
          winRate: 'Win rate',
          maxDrawdown: 'Max drawdown',
          stagesTitle: 'Stages:',
          tabSummary: 'Summary',
          tabMarkets: 'Markets',
          tabTrades: 'Trades',
          tabRaw: 'Raw',
          reportNotReadyTitle: 'Report is not ready yet',
          reportNotReadyDescription: 'After run completion the report will appear automatically.',
          summaryNetPnl: 'Net PnL',
          summaryWinRate: 'Win Rate',
          summaryTrades: 'Trades',
          summaryMaxDrawdown: 'Max Drawdown',
          summaryStartBalance: 'Start Balance',
          summaryEndBalance: 'End Balance',
          summaryDailyPnlTitle: 'Daily PnL',
          summaryBalanceTitle: 'Portfolio balance from start to end',
          summaryDailyPnlNoData: 'No daily data to draw the chart.',
          summaryBalanceNoData: 'No balance data to draw the chart.',
          marketsEmptyTitle: 'No market data',
          marketsEmptyDescription: 'Per-market results appear after at least one trade.',
          globalLegendTitle: 'Global chart legend',
          legendEntryLong: 'Entry LONG',
          legendEntryShort: 'Entry SHORT',
          legendExitProfit: 'Exit profit',
          legendExitLoss: 'Exit loss',
          legendDca: 'DCA',
          timelineLoading: 'Loading timeline...',
          timelineLoadingPhaseEvents: 'position markers',
          timelineLoadingPhaseCandles: 'candles and indicators',
          timelineLoadingPrefix: 'Loading more',
          timelineNoCandles: 'No candles for selected range.',
          timelineLoadErrorDefault: 'Failed to load market timeline.',
          timelineParityFailedDefault: 'Symbol processing failed during backtest run.',
          zoom: 'Zoom',
          pairStatsTitle: 'Pair stats',
          parityFailed: 'Parity FAILED',
          chartWindowValue: 'Chart window',
          avgHold: 'Avg hold',
          pnl: 'PnL',
          dca: 'DCA',
          executionTitle: 'Execution',
          avgEntry: 'Average entry',
          avgExit: 'Average exit',
          closedOnLastCandle: 'Closed on last candle',
          liquidations: 'Liquidations',
          dataRangeTitle: 'Data range',
          tradesRange: 'Trades range:',
          candlesRange: 'Candles range:',
          chartMinMax: 'Chart min/max:',
          indicatorsTitle: 'Strategy indicators',
          noIndicators: 'No indicator metadata in strategy config.',
          noTradesTitle: 'No trades',
          noTradesDescription: 'There are no trades for this run.',
          totalProfit: 'Gross profit',
          totalLoss: 'Gross loss',
          extremes: 'Extremes',
          biggestWin: 'Largest win',
          biggestLoss: 'Largest loss',
          colSymbol: 'Symbol',
          colSide: 'Side',
          colOpen: 'Open',
          colClose: 'Close',
          colDuration: 'Duration',
          colQty: 'Qty',
          colDca: 'DCA',
          colEntry: 'Entry',
          colExit: 'Exit',
          colNotionalEntry: 'Entry notional',
          colNotionalExit: 'Exit notional',
          colMarginEntry: 'Entry margin',
          colMarginExit: 'Exit margin',
          colMoveSide: 'Move % (side)',
          colPnlNotional: 'PnL % (notional)',
          colPnlMargin: 'PnL % (margin)',
          colFee: 'Fee',
          colExitReason: 'Exit reason',
          colPnl: 'PnL',
          colCumPnl: 'Cumulative PnL',
          dash: '-',
          custom: 'Custom',
        }
      : {
          loadingTitle: 'Ladowanie szczegolow backtestu',
          loadErrorTitle: 'Nie udalo sie pobrac szczegolow backtestu',
          loadErrorDefault: 'Nie udalo sie pobrac danych backtestu.',
          retry: 'Sprobuj ponownie',
          notFoundTitle: 'Nie znaleziono runa',
          notFoundDescription: 'Wybrany run nie istnieje albo nie masz do niego dostepu.',
          statusInProgress: 'w toku',
          runPreview: 'Podglad uruchomienia backtestu',
          marketGroup: 'Grupa rynkow:',
          strategy: 'Strategia:',
          calcStart: 'Start obliczen:',
          calcEnd: 'Koniec obliczen:',
          progressTitle: 'Postep runa',
          stageRunCreated: 'Run utworzony',
          stageEngineRunning: 'Silnik liczy wynik',
          stageTradesReady: 'Lista transakcji gotowa',
          stageReportReady: 'Raport i wykres',
          stageRunFinished: 'Backtest zakonczony',
          trades: 'Transakcje',
          netPnl: 'Net PnL',
          winRate: 'Skutecznosc',
          maxDrawdown: 'Maks. drawdown',
          stagesTitle: 'Etapy:',
          tabSummary: 'Podsumowanie',
          tabMarkets: 'Rynki',
          tabTrades: 'Transakcje',
          tabRaw: 'Raw',
          reportNotReadyTitle: 'Raport nie jest jeszcze gotowy',
          reportNotReadyDescription: 'Po zakonczeniu runa raport pojawi sie automatycznie.',
          summaryNetPnl: 'Net PnL',
          summaryWinRate: 'Skutecznosc',
          summaryTrades: 'Transakcje',
          summaryMaxDrawdown: 'Maks. drawdown',
          summaryStartBalance: 'Saldo startowe',
          summaryEndBalance: 'Saldo koncowe',
          summaryDailyPnlTitle: 'Dzienny wynik (zysk/strata)',
          summaryBalanceTitle: 'Saldo portfela od startu do konca',
          summaryDailyPnlNoData: 'Brak danych dziennych do narysowania wykresu.',
          summaryBalanceNoData: 'Brak danych salda do narysowania wykresu.',
          marketsEmptyTitle: 'Brak danych per rynek',
          marketsEmptyDescription: 'Wyniki per para pojawia sie po wygenerowaniu przynajmniej jednej transakcji.',
          globalLegendTitle: 'Legenda globalna wykresow',
          legendEntryLong: 'Wejscie LONG',
          legendEntryShort: 'Wejscie SHORT',
          legendExitProfit: 'Wyjscie zysk',
          legendExitLoss: 'Wyjscie strata',
          legendDca: 'DCA',
          timelineLoading: 'Ladowanie timeline...',
          timelineLoadingPhaseEvents: 'znacznikow pozycji',
          timelineLoadingPhaseCandles: 'swiec i wskaznikow',
          timelineLoadingPrefix: 'Doladowywanie',
          timelineNoCandles: 'Brak swiec dla wybranego zakresu.',
          timelineLoadErrorDefault: 'Nie udalo sie pobrac timeline dla rynku.',
          timelineParityFailedDefault: 'Przetwarzanie symbolu nie powiodlo sie podczas backtestu.',
          zoom: 'Zoom',
          pairStatsTitle: 'Statystyki pary',
          parityFailed: 'Przetwarzanie pary nie powiodlo sie',
          chartWindowValue: 'Zakres wykresu',
          avgHold: 'Sredni hold',
          pnl: 'PnL',
          dca: 'DCA',
          executionTitle: 'Egzekucja',
          avgEntry: 'Srednie wejscie',
          avgExit: 'Srednie wyjscie',
          closedOnLastCandle: 'Zamkniete na ostatniej swiecy',
          liquidations: 'Likwidacje',
          dataRangeTitle: 'Zakres danych',
          tradesRange: 'Zakres transakcji:',
          candlesRange: 'Zakres swiec:',
          chartMinMax: 'Cena min/max (wykres):',
          indicatorsTitle: 'Wskazniki strategii',
          noIndicators: 'Brak danych o wskaznikach w konfiguracji strategii.',
          noTradesTitle: 'Brak transakcji',
          noTradesDescription: 'Dla tego runa nie ma jeszcze transakcji.',
          totalProfit: 'Suma zyskow',
          totalLoss: 'Suma strat',
          extremes: 'Ekstrema',
          biggestWin: 'Najwiekszy zysk',
          biggestLoss: 'Najwieksza strata',
          colSymbol: 'Symbol',
          colSide: 'Strona',
          colOpen: 'Otwarcie',
          colClose: 'Zamkniecie',
          colDuration: 'Czas',
          colQty: 'Ilosc',
          colDca: 'DCA',
          colEntry: 'Wejscie',
          colExit: 'Wyjscie',
          colNotionalEntry: 'Notional wej.',
          colNotionalExit: 'Notional wyj.',
          colMarginEntry: 'Margin wej.',
          colMarginExit: 'Margin wyj.',
          colMoveSide: 'Ruch % (side)',
          colPnlNotional: 'PnL % (notional)',
          colPnlMargin: 'PnL % (margin)',
          colFee: 'Prowizja',
          colExitReason: 'Powod wyjscia',
          colPnl: 'PnL',
          colCumPnl: 'Skumulowany PnL',
          dash: '-',
          custom: 'Niestandardowa',
        };
  const [timelines, setTimelines] = useState<Record<string, TimelineState>>({});
  const [activeTab, setActiveTab] = useState<'summary' | 'markets' | 'trades' | 'raw'>('markets');
  const symbolSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const timelinesRef = useRef<Record<string, TimelineState>>({});
  const inFlightTimelineRequestsRef = useRef<Map<string, Promise<BacktestTimeline | undefined>>>(new Map());
  const {
    run,
    report,
    trades,
    strategy,
    marketUniverseName,
    loading,
    error,
    retry,
  } = useBacktestRunCoreData({
    runId,
    loadErrorDefault: copy.loadErrorDefault,
  });

  useEffect(() => {
    timelinesRef.current = timelines;
  }, [timelines]);

  useEffect(() => {
    // When navigating between runs with the same symbols, clear cached timeline cards
    // to avoid rendering stale market charts from a previous run.
    inFlightTimelineRequestsRef.current.clear();
    timelinesRef.current = {};
    setTimelines({});
  }, [runId]);

  const liveProgress = ((run?.seedConfig as { liveProgress?: LiveProgress } | null)?.liveProgress ?? null) as LiveProgress | null;
  const seedConfig = (run?.seedConfig as {
    leverage?: unknown;
    marketType?: unknown;
  } | null) ?? null;
  const runMarketType = seedConfig?.marketType === 'SPOT' ? 'SPOT' : 'FUTURES';
  const leverageFromSeed = Number(seedConfig?.leverage);
  const leverageFromProgress = Number(liveProgress?.leverage);
  const effectiveLeverage =
    runMarketType === 'SPOT'
      ? 1
      : Math.max(
          1,
          Number.isFinite(leverageFromSeed)
            ? leverageFromSeed
            : Number.isFinite(leverageFromProgress)
              ? leverageFromProgress
              : 1,
        );
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
  const timelineTradeEventMeta = useMemo(() => {
    const dcaCountByTradeId = new Map<string, number>();
    const knownTradeIds = new Set<string>();

    for (const state of Object.values(timelines)) {
      const events = state.data?.events ?? [];
      for (const event of events) {
        knownTradeIds.add(event.tradeId);
        if (event.type !== 'DCA') continue;
        dcaCountByTradeId.set(event.tradeId, (dcaCountByTradeId.get(event.tradeId) ?? 0) + 1);
      }
    }

    return {
      dcaCountByTradeId,
      knownTradeIds,
    };
  }, [timelines]);
  const tradeDcaMetaByTradeId = useMemo(() => {
    const byTradeId = new Map<
      string,
      {
        syntheticTradeId: string;
        dcaCount: number;
        knownFromTimeline: boolean;
      }
    >();

    const orderedBySymbol = [...trades].sort((a, b) => {
      const bySymbol = a.symbol.localeCompare(b.symbol);
      if (bySymbol !== 0) return bySymbol;
      const byOpen = safeDateMs(a.openedAt) - safeDateMs(b.openedAt);
      if (byOpen !== 0) return byOpen;
      return safeDateMs(a.closedAt) - safeDateMs(b.closedAt);
    });

    const sequenceBySymbol = new Map<string, number>();
    for (const trade of orderedBySymbol) {
      const sequence = (sequenceBySymbol.get(trade.symbol) ?? 0) + 1;
      sequenceBySymbol.set(trade.symbol, sequence);
      const syntheticTradeId = `${runId}_${trade.symbol}_${sequence}`;

      byTradeId.set(trade.id, {
        syntheticTradeId,
        dcaCount: timelineTradeEventMeta.dcaCountByTradeId.get(syntheticTradeId) ?? 0,
        knownFromTimeline: timelineTradeEventMeta.knownTradeIds.has(syntheticTradeId),
      });
    }

    return byTradeId;
  }, [runId, timelineTradeEventMeta.dcaCountByTradeId, timelineTradeEventMeta.knownTradeIds, trades]);
  const summaryMetrics = ((report?.metrics ?? null) as {
    initialBalance?: number;
    endBalance?: number;
    lifecycleEventCounts?: {
      DCA?: number;
    };
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
  const tradesTimelineRows = useMemo(() => {
    const ordered = [...trades].sort((a, b) => {
      const byClose = safeDateMs(a.closedAt) - safeDateMs(b.closedAt);
      if (byClose !== 0) return byClose;
      return safeDateMs(a.openedAt) - safeDateMs(b.openedAt);
    });

    let cumulativePnl = 0;
    return ordered.map((trade, index) => {
      const entryNotional = trade.entryPrice * trade.quantity;
      const exitNotional = trade.exitPrice * trade.quantity;
      const holdMinutes = Math.max(0, safeDateMs(trade.closedAt) - safeDateMs(trade.openedAt)) / 60_000;
      const rawPriceMovePct =
        trade.entryPrice !== 0 ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100 : null;
      const sidePriceMovePct = rawPriceMovePct == null ? null : trade.side === 'LONG' ? rawPriceMovePct : -rawPriceMovePct;
      const entryMargin = effectiveLeverage > 0 ? entryNotional / effectiveLeverage : entryNotional;
      const exitMargin = effectiveLeverage > 0 ? exitNotional / effectiveLeverage : exitNotional;
      const pnlPctOnNotional = entryNotional > 0 ? (trade.pnl / entryNotional) * 100 : null;
      const pnlPctOnMargin = entryMargin > 0 ? (trade.pnl / entryMargin) * 100 : null;
      const dcaMeta = tradeDcaMetaByTradeId.get(trade.id);
      cumulativePnl += trade.pnl;

      return {
        index: index + 1,
        trade,
        holdMinutes,
        entryNotional,
        exitNotional,
        entryMargin,
        exitMargin,
        sidePriceMovePct,
        pnlPctOnNotional,
        pnlPctOnMargin,
        dcaCount: dcaMeta?.dcaCount ?? 0,
        dcaKnownFromTimeline: dcaMeta?.knownFromTimeline ?? false,
        cumulativePnl,
      };
    });
  }, [effectiveLeverage, tradeDcaMetaByTradeId, trades]);
  const tradeInsights = useMemo(() => {
    if (tradesTimelineRows.length === 0) return null;
    const pnls = tradesTimelineRows.map((row) => row.trade.pnl);
    const positivePnls = pnls.filter((value) => value > 0);
    const negativePnls = pnls.filter((value) => value < 0);
    const grossProfit = positivePnls.reduce((sum, value) => sum + value, 0);
    const grossLoss = negativePnls.reduce((sum, value) => sum + value, 0);
    const maxWin = positivePnls.length > 0 ? Math.max(...positivePnls) : 0;
    const maxLoss = negativePnls.length > 0 ? Math.min(...negativePnls) : 0;
    return {
      finalCumulative: tradesTimelineRows[tradesTimelineRows.length - 1]?.cumulativePnl ?? 0,
      grossProfit,
      grossLoss,
      maxWin,
      maxLoss,
      hasWins: positivePnls.length > 0,
      hasLosses: negativePnls.length > 0,
    };
  }, [tradesTimelineRows]);

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

  const TIMELINE_CHUNK_SIZE = 600;
  const loadSymbolTimelineChunk = useCallback(
    async ({
      symbol,
      cursor = 0,
      append = false,
      scope,
    }: {
      symbol: string;
      cursor?: number;
      append?: boolean;
      scope: 'candles' | 'events';
    }) => {
      const lockKey = `${symbol}:${scope}:${cursor}:${append ? 'append' : 'replace'}`;
      const existingRequest = inFlightTimelineRequestsRef.current.get(lockKey);
      if (existingRequest) return existingRequest;

      const requestPromise = (async () => {
        setTimelines((prev) => ({
          ...prev,
        [symbol]: {
          data: prev[symbol]?.data ?? null,
          loading: true,
          loadingPhase: scope,
          candlesNextCursor: prev[symbol]?.candlesNextCursor ?? null,
          eventsNextCursor: prev[symbol]?.eventsNextCursor ?? null,
          candlesLoaded: prev[symbol]?.candlesLoaded ?? false,
          eventsLoaded: prev[symbol]?.eventsLoaded ?? false,
          error: null,
        },
      }));

        try {
          const data = await getBacktestRunTimeline(runId, {
            symbol,
            cursor,
            chunkSize: TIMELINE_CHUNK_SIZE,
            includeCandles: scope === 'candles',
            includeIndicators: scope === 'candles',
            includeEvents: scope === 'events',
          });

          const normalizedData: BacktestTimeline = {
            ...data,
            candles: Array.isArray(data.candles) ? data.candles : [],
            events: Array.isArray(data.events) ? data.events : [],
            indicatorSeries: Array.isArray(data.indicatorSeries) ? data.indicatorSeries : [],
          };

          setTimelines((prev) => {
            const existing = prev[symbol]?.data;
            let prepared: BacktestTimeline;

            if (!existing) {
              prepared = normalizedData;
            } else if (!append) {
              if (scope === 'candles') {
                prepared = {
                  ...normalizedData,
                  events: existing.events,
                };
              } else {
                prepared = {
                  ...existing,
                  ...normalizedData,
                  candles: existing.candles,
                  indicatorSeries: existing.indicatorSeries,
                  events: normalizedData.events,
                  cursor: existing.cursor,
                  previousCursor: existing.previousCursor,
                };
              }
            } else if (scope === 'candles') {
              prepared = {
                ...existing,
                ...normalizedData,
                candles: mergeByKey(existing.candles, normalizedData.candles, (candle) => candle.candleIndex),
                events: existing.events,
                indicatorSeries: normalizedData.indicatorSeries.map((series) => {
                  const existingSeries = existing.indicatorSeries.find((item) => item.key === series.key);
                  return {
                    ...series,
                    points: mergeByKey(existingSeries?.points ?? [], series.points, (point) => point.candleIndex),
                  };
                }),
                cursor: 0,
                previousCursor: null,
              };
            } else {
              prepared = {
                ...existing,
                ...normalizedData,
                candles: existing.candles,
                indicatorSeries: existing.indicatorSeries,
                events: mergeByKey(existing.events, normalizedData.events, (event) => event.id),
                cursor: existing.cursor,
                previousCursor: existing.previousCursor,
              };
            }

            prepared = {
              ...prepared,
              candles: [...prepared.candles].sort((a, b) => a.candleIndex - b.candleIndex),
              events: [...prepared.events].sort((a, b) => a.candleIndex - b.candleIndex),
              indicatorSeries: prepared.indicatorSeries.map((series) => ({
                ...series,
                points: [...series.points].sort((a, b) => a.candleIndex - b.candleIndex),
              })),
            };

            return {
              ...prev,
              [symbol]: {
                data: prepared,
                loading: false,
                loadingPhase: null,
                candlesNextCursor:
                  scope === 'candles'
                    ? (typeof normalizedData.nextCursor === 'number' ? normalizedData.nextCursor : null)
                    : (prev[symbol]?.candlesNextCursor ?? null),
                eventsNextCursor:
                  scope === 'events'
                    ? (typeof normalizedData.nextCursor === 'number' ? normalizedData.nextCursor : null)
                    : (prev[symbol]?.eventsNextCursor ?? null),
                candlesLoaded:
                  scope === 'candles'
                    ? normalizedData.nextCursor == null
                    : (prev[symbol]?.candlesLoaded ?? false),
                eventsLoaded:
                  scope === 'events'
                    ? normalizedData.nextCursor == null
                    : (prev[symbol]?.eventsLoaded ?? false),
                error: null,
              },
            };
          });

          return normalizedData;
        } catch (err: unknown) {
        setTimelines((prev) => ({
          ...prev,
          [symbol]: {
            data: prev[symbol]?.data ?? null,
            loading: false,
            loadingPhase: null,
            candlesNextCursor: prev[symbol]?.candlesNextCursor ?? null,
            eventsNextCursor: prev[symbol]?.eventsNextCursor ?? null,
            candlesLoaded: prev[symbol]?.candlesLoaded ?? false,
            eventsLoaded: prev[symbol]?.eventsLoaded ?? false,
            error: getAxiosMessage(err) ?? copy.timelineLoadErrorDefault,
          },
        }));
          return undefined;
        } finally {
          inFlightTimelineRequestsRef.current.delete(lockKey);
        }
      })();

      inFlightTimelineRequestsRef.current.set(lockKey, requestPromise);
      return requestPromise;
    },
    [copy.timelineLoadErrorDefault, runId],
  );

  useEffect(() => {
    if (activeTab !== 'markets' && activeTab !== 'trades') return;
    if (symbolStats.length === 0) return;
    let cancelled = false;
    const shouldLoadCandles = activeTab === 'markets';

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
              loadingPhase: null,
              candlesNextCursor: prev[symbol]?.candlesNextCursor ?? null,
              eventsNextCursor: prev[symbol]?.eventsNextCursor ?? null,
              candlesLoaded: prev[symbol]?.candlesLoaded ?? false,
              eventsLoaded: prev[symbol]?.eventsLoaded ?? false,
              error: parity.error ?? copy.timelineParityFailedDefault,
            },
          }));
          continue;
        }
        let candlesCursor: number | null = null;
        let firstCandlesChunk = false;

        if (shouldLoadCandles) {
          const timelineState = timelinesRef.current[symbol];
          const existingTimeline = timelineState?.data;
          const hasExistingCandles = Boolean(existingTimeline && existingTimeline.candles.length > 0);

          candlesCursor =
            timelineState?.candlesLoaded
              ? null
              : timelineState?.candlesNextCursor ??
                (hasExistingCandles && existingTimeline
                  ? Math.min(existingTimeline.candles.length, existingTimeline.totalCandles)
                  : 0);
          firstCandlesChunk = !hasExistingCandles;

          // Zaladuj najpierw pierwszy chunk ceny, aby wykres pojawil sie szybko,
          // a eventy pozycji mogly dociagac sie niezaleznie.
          if (!cancelled && candlesCursor != null && firstCandlesChunk) {
            const firstChunk = await loadSymbolTimelineChunk({
              symbol,
              cursor: candlesCursor,
              append: false,
              scope: 'candles',
            });
            if (!firstChunk) continue;
            candlesCursor = firstChunk.nextCursor;
            firstCandlesChunk = false;
          }
        }

        const refreshedTimelineState = timelinesRef.current[symbol];
        const hasExistingEvents = Boolean(refreshedTimelineState?.data && refreshedTimelineState.data.events.length > 0);
        let eventsCursor: number | null =
          refreshedTimelineState?.eventsLoaded
            ? null
            : refreshedTimelineState?.eventsNextCursor ?? 0;
        let firstEventsChunk = !hasExistingEvents;

        while (!cancelled && eventsCursor != null) {
          const eventsChunk = await loadSymbolTimelineChunk({
            symbol,
            cursor: eventsCursor,
            append: !firstEventsChunk,
            scope: 'events',
          });
          if (!eventsChunk) break;
          eventsCursor = eventsChunk.nextCursor;
          firstEventsChunk = false;
        }

        if (!shouldLoadCandles) continue;

        while (!cancelled && candlesCursor != null) {
          const candlesChunk = await loadSymbolTimelineChunk({
            symbol,
            cursor: candlesCursor,
            append: true,
            scope: 'candles',
          });
          if (!candlesChunk) break;
          candlesCursor = candlesChunk.nextCursor;
        }
      }
    };

    void runQueue();
    return () => {
      cancelled = true;
    };
  }, [activeTab, copy.timelineParityFailedDefault, loadSymbolTimelineChunk, parityDiagnosticsBySymbol, symbolStats]);

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
        label: copy.stageRunCreated,
        icon: <LuListChecks className='h-4 w-4' />,
        done: Boolean(run),
        active: !run,
      },
      {
        label: copy.stageEngineRunning,
        icon: <LuLoaderCircle className='h-4 w-4' />,
        done: run?.status === 'RUNNING' || run?.status === 'COMPLETED' || run?.status === 'FAILED' || run?.status === 'CANCELED',
        active: run?.status === 'PENDING',
      },
      {
        label: copy.stageTradesReady,
        icon: <LuDatabase className='h-4 w-4' />,
        done: trades.length > 0 || run?.status === 'FAILED' || run?.status === 'CANCELED' || run?.status === 'COMPLETED',
        active: run?.status === 'RUNNING' && trades.length === 0,
      },
      {
        label: copy.stageReportReady,
        icon: <LuChartLine className='h-4 w-4' />,
        done: Boolean(report) || run?.status === 'FAILED' || run?.status === 'CANCELED',
        active: run?.status === 'COMPLETED' && !report,
      },
      {
        label: copy.stageRunFinished,
        icon: <LuShieldCheck className='h-4 w-4' />,
        done: run?.status === 'COMPLETED' || run?.status === 'FAILED' || run?.status === 'CANCELED',
        active: run?.status === 'RUNNING',
      },
    ],
    [copy.stageEngineRunning, copy.stageReportReady, copy.stageRunCreated, copy.stageRunFinished, copy.stageTradesReady, report, run, trades.length]
  );

  if (loading) {
    return (
      <div className='space-y-4'>
        <span className='sr-only'>{copy.loadingTitle}</span>
        <SkeletonKpiRow items={4} />
        <SkeletonCardBlock cards={2} linesPerCard={4} title={false} className='border-base-300/40 bg-base-100/60 p-3' />
        <SkeletonTableRows columns={8} rows={6} title={false} toolbar={false} className='border-base-300/40 bg-base-100/60 p-3' />
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title={copy.loadErrorTitle}
        description={error}
        retryLabel={copy.retry}
        onRetry={retry}
      />
    );
  }
  if (!run) return <EmptyState title={copy.notFoundTitle} description={copy.notFoundDescription} />;

  const runEndLabel =
    run.finishedAt != null
      ? formatDateTime(run.finishedAt)
      : run.status === 'RUNNING' || run.status === 'PENDING'
        ? copy.statusInProgress
        : copy.dash;
  const showProgress = progress > 0 && progress < 100;
  const marketGroupLabel = marketUniverseName ?? copy.custom;
  const preferReportMetrics = run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'CANCELED';
  const headlineTrades =
    (preferReportMetrics ? report?.totalTrades : liveProgress?.totalTrades) ??
    (preferReportMetrics ? liveProgress?.totalTrades : report?.totalTrades) ??
    trades.length;
  const headlineNetPnl =
    (preferReportMetrics ? report?.netPnl : liveProgress?.netPnl) ??
    (preferReportMetrics ? liveProgress?.netPnl : report?.netPnl) ??
    null;
  const headlineMetrics = [
    {
      key: 'trades',
      label: copy.trades,
      value: formatNumber(headlineTrades),
      valueClass: '',
    },
    {
      key: 'net',
      label: copy.netPnl,
      value: headlineNetPnl == null ? '-' : formatCurrency(headlineNetPnl),
      valueClass: pnlClass(headlineNetPnl),
    },
    {
      key: 'winrate',
      label: copy.winRate,
      value: report ? formatPercent(report.winRate) : '-',
      valueClass: '',
    },
    {
      key: 'drawdown',
      label: copy.maxDrawdown,
      value: report ? formatPercent(report.maxDrawdown) : '-',
      valueClass: '',
    },
  ];
  return (
    <div className='space-y-4'>
      <BacktestRunHeaderSection
        runName={run.name}
        runPreviewLabel={copy.runPreview}
        runStatusClassName={runStatusBadgeClass(run.status)}
        runStatusLabel={runStatusLabel(run.status, locale)}
        marketGroupLabelText={copy.marketGroup}
        marketGroupValue={marketGroupLabel}
        strategyLabelText={copy.strategy}
        strategyValue={strategy?.name ?? copy.dash}
        calcStartLabelText={copy.calcStart}
        calcStartValue={formatDateTime(run.startedAt)}
        calcEndLabelText={copy.calcEnd}
        calcEndValue={runEndLabel}
        showProgress={showProgress}
        progressLabel={copy.progressTitle}
        progressValue={progress}
        progressClassName={runProgressClass(run.status)}
        headlineMetrics={liveProgress || report ? headlineMetrics : []}
        stagesLabel={copy.stagesTitle}
        stages={stages}
      />

      <section className='rounded-box border border-base-300/60 bg-base-100/80 p-4'>
        <div role='tablist' className='tabs tabs-boxed'>
          <button
            type='button'
            className={`tab ${activeTab === 'summary' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            {copy.tabSummary}
          </button>
          <button
            type='button'
            className={`tab ${activeTab === 'markets' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('markets')}
          >
            {copy.tabMarkets}
          </button>
          <button
            type='button'
            className={`tab ${activeTab === 'trades' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('trades')}
          >
            {copy.tabTrades}
          </button>
          <button
            type='button'
            className={`tab ${activeTab === 'raw' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('raw')}
          >
            {copy.tabRaw}
          </button>
        </div>

        {activeTab === 'summary' ? (
          <div className='mt-4 space-y-3'>
            {!report ? (
              <EmptyState
                title={copy.reportNotReadyTitle}
                description={copy.reportNotReadyDescription}
              />
            ) : (
              <>
                <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-6'>
                  <div className='rounded-box border border-base-300/60 bg-base-200/55 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>{copy.summaryNetPnl}</p>
                    <p className={`mt-1 text-2xl font-semibold ${pnlClass(report.netPnl)}`}>{formatCurrency(report.netPnl)}</p>
                  </div>
                  <div className='rounded-box border border-base-300/60 bg-base-200/55 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>{copy.summaryWinRate}</p>
                    <p className='mt-1 text-2xl font-semibold'>{formatPercent(report.winRate)}</p>
                  </div>
                  <div className='rounded-box border border-base-300/60 bg-base-200/55 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>{copy.summaryTrades}</p>
                    <p className='mt-1 text-2xl font-semibold'>{formatNumber(report.totalTrades)}</p>
                  </div>
                  <div className='rounded-box border border-base-300/60 bg-base-200/55 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>{copy.summaryMaxDrawdown}</p>
                    <p className='mt-1 text-2xl font-semibold'>{formatPercent(report.maxDrawdown)}</p>
                  </div>
                  <div className='rounded-box border border-base-300/60 bg-base-200/55 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>{copy.summaryStartBalance}</p>
                    <p className='mt-1 text-2xl font-semibold'>{formatCurrency(summaryMetrics?.initialBalance ?? 0)}</p>
                  </div>
                  <div className='rounded-box border border-base-300/60 bg-base-200/55 p-3'>
                    <p className='text-xs uppercase tracking-wide opacity-70'>{copy.summaryEndBalance}</p>
                    <p className='mt-1 text-2xl font-semibold'>{formatCurrency(summaryMetrics?.endBalance ?? 0)}</p>
                  </div>
                </div>

                <div className='grid gap-3 xl:grid-cols-2'>
                  <div className='rounded-box border border-base-300/60 bg-base-200/55 p-3'>
                    <p className='text-sm font-medium'>{copy.summaryDailyPnlTitle}</p>
                    <SummaryDailyPnlChart
                      points={dailyPerformance}
                      formatCurrency={formatCurrency}
                      emptyText={copy.summaryDailyPnlNoData}
                    />
                  </div>
                  <div className='rounded-box border border-base-300/60 bg-base-200/55 p-3'>
                    <p className='text-sm font-medium'>{copy.summaryBalanceTitle}</p>
                    <SummaryBalanceChart
                      points={dailyPerformance}
                      formatCurrency={formatCurrency}
                      emptyText={copy.summaryBalanceNoData}
                    />
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
                title={copy.marketsEmptyTitle}
                description={copy.marketsEmptyDescription}
              />
            ) : (
              <>
                <div className='rounded-box border border-base-300/60 bg-base-200/55 p-3'>
                  <h4 className='mb-2 text-sm font-semibold'>{copy.globalLegendTitle}</h4>
                  <div className='flex flex-wrap items-center gap-4 text-xs text-base-content/75'>
                    <span className='inline-flex items-center gap-1'>
                      <span className='inline-block h-0 w-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-success' />
                      {copy.legendEntryLong}
                    </span>
                    <span className='inline-flex items-center gap-1'>
                      <span className='inline-block h-0 w-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-error' />
                      {copy.legendEntryShort}
                    </span>
                    <span className='inline-flex items-center gap-1'>
                      <LuSquare className='h-3.5 w-3.5 text-success' />
                      {copy.legendExitProfit}
                    </span>
                    <span className='inline-flex items-center gap-1'>
                      <LuSquare className='h-3.5 w-3.5 text-error' />
                      {copy.legendExitLoss}
                    </span>
                    <span className='inline-flex items-center gap-1'>
                      <LuCircleDot className='h-3.5 w-3.5 text-info' />
                      {copy.legendDca}
                    </span>
                  </div>
                </div>

                {symbolStats.map((stats) => (
                  <article
                    key={stats.symbol}
                    ref={(node) => {
                      symbolSectionRefs.current[stats.symbol] = node;
                    }}
                    className='rounded-xl border border-base-300 bg-base-100 p-3'
                  >
                    {(() => {
                      const timelineState = timelines[stats.symbol] ?? {
                        data: null,
                        loading: false,
                        loadingPhase: null,
                        candlesNextCursor: null,
                        eventsNextCursor: null,
                        candlesLoaded: false,
                        eventsLoaded: false,
                        error: null,
                      };
                      const timeline = timelineState.data;
                      const symbolTrades = tradesBySymbol.get(stats.symbol) ?? [];
                      const visibleTrades = timeline ? filterTradesByTimelineWindow(symbolTrades, timeline) : symbolTrades;
                      const timelineDerivedTrades =
                        timeline && timelineState.eventsLoaded
                          ? buildSyntheticTradesFromTimelineEvents(
                              (Array.isArray(timeline.events) ? timeline.events : []).filter((event) =>
                                event.tradeId.includes(`_${stats.symbol}_`),
                              ),
                              stats.symbol,
                            )
                          : [];
                      const visibleTradesForStats = timelineDerivedTrades.length > 0 ? timelineDerivedTrades : visibleTrades;
                      const visibleStats = buildSymbolStats(visibleTradesForStats, [stats.symbol])[0] ?? stats;
                      const tradesMetricDisplay = buildPairStatsMetricDisplay({
                        visibleValue: visibleStats.tradesCount,
                        totalValue: stats.tradesCount,
                        formatValue: formatNumber,
                        differenceTolerance: 0,
                      });
                      const pnlMetricDisplay = buildPairStatsMetricDisplay({
                        visibleValue: visibleStats.netPnl,
                        totalValue: stats.netPnl,
                        formatValue: formatCurrency,
                        differenceTolerance: 0.000001,
                      });
                      const visibleFinalCandleClosures = visibleTradesForStats.filter((trade) => trade.exitReason === 'FINAL_CANDLE').length;
                      const visibleLiquidations = visibleTradesForStats.filter(
                        (trade) => trade.exitReason === 'LIQUIDATION' || trade.liquidated,
                      ).length;
                      const visibleLifecycleCounts = (Array.isArray(timeline?.events) ? timeline.events : []).reduce<Record<string, number>>((acc, event) => {
                        acc[event.type] = (acc[event.type] ?? 0) + 1;
                        return acc;
                      }, {});
                      const timelineCandles = Array.isArray(timeline?.candles) ? timeline.candles : [];
                      const candlePrices = timelineCandles.flatMap((candle) => [candle.low, candle.high]);
                      const timelineMinPrice = candlePrices.length > 0 ? Math.min(...candlePrices) : null;
                      const timelineMaxPrice = candlePrices.length > 0 ? Math.max(...candlePrices) : null;
                      const timelineWindowStart = timelineCandles.length > 0 ? timelineCandles[0].openTime : null;
                      const timelineWindowEnd = timelineCandles.length > 0 ? timelineCandles[timelineCandles.length - 1].closeTime : null;
                      const parity = parityDiagnosticsBySymbol.get(stats.symbol.toUpperCase());
                      const parityFailed = Boolean(parity && parity.status !== 'PROCESSED');
                      return (
                        <>
                          <div className='grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]'>
                            <div className='space-y-3'>
                              {timelineState.loading && !timeline ? <p className='text-sm opacity-70'>{copy.timelineLoading}</p> : null}
                              {timelineState.loading && timeline ? (
                                <p className='text-xs opacity-70'>
                                  {copy.timelineLoadingPrefix}{' '}
                                  {timelineState.loadingPhase === 'events' ? copy.timelineLoadingPhaseEvents : copy.timelineLoadingPhaseCandles}
                                  ...
                                </p>
                              ) : null}
                              {timelineState.error ? <p className='text-sm text-error'>{timelineState.error}</p> : null}
                              {timeline ? (
                                <TimelineCandlesChart
                                  timeline={timeline}
                                  trades={visibleTrades}
                                  symbol={stats.symbol}
                                  netPnl={stats.netPnl}
                                  formatCurrency={formatCurrency}
                                  formatNumber={formatNumber}
                                  rsiLongLevel={indicatorMeta.rsiLongLevel}
                                  rsiShortLevel={indicatorMeta.rsiShortLevel}
                                  eventsLoaded={timelineState.eventsLoaded}
                                  noCandlesText={copy.timelineNoCandles}
                                  zoomLabel={copy.zoom}
                                />
                              ) : (
                                <div className='h-[320px] w-full animate-pulse rounded-lg bg-base-200/60' />
                              )}
                            </div>

                            <aside className='rounded-box border border-base-300/60 bg-base-200/55 p-3 text-sm'>
                              <h4 className='font-semibold'>{copy.pairStatsTitle}</h4>
                              {parityFailed ? (
                                <div className='mt-2 rounded-md border border-error/40 bg-error/10 p-2'>
                                  <p className='text-xs font-medium text-error'>{copy.parityFailed}</p>
                                  {parity?.error ? <p className='mt-1 text-xs text-error/90'>{parity.error}</p> : null}
                                </div>
                              ) : null}

                              <div className='mt-3 grid grid-cols-2 gap-2'>
                                <div className='rounded-md border border-base-300 bg-base-100/70 p-2'>
                                  <p className='text-[10px] uppercase tracking-wide opacity-65'>{copy.trades}</p>
                                  <p className='mt-1 text-base font-semibold'>{tradesMetricDisplay.primary}</p>
                                  {tradesMetricDisplay.chartWindow ? (
                                    <p className='mt-0.5 text-[10px] opacity-60'>
                                      {copy.chartWindowValue}: {tradesMetricDisplay.chartWindow}
                                    </p>
                                  ) : null}
                                </div>
                                <div className='rounded-md border border-base-300 bg-base-100/70 p-2'>
                                  <p className='text-[10px] uppercase tracking-wide opacity-65'>{copy.winRate}</p>
                                  <p className='mt-1 text-base font-semibold'>{formatPercent(visibleStats.winRate)}</p>
                                  <p className='mt-0.5 text-[10px] opacity-60'>{visibleStats.wins}/{visibleStats.losses} W/L</p>
                                </div>
                                <div className='rounded-md border border-base-300 bg-base-100/70 p-2'>
                                  <p className='text-[10px] uppercase tracking-wide opacity-65'>{copy.pnl}</p>
                                  <p className={`mt-1 text-base font-semibold ${pnlClass(stats.netPnl)}`}>
                                    {pnlMetricDisplay.primary}
                                  </p>
                                  {pnlMetricDisplay.chartWindow ? (
                                    <p className='mt-0.5 text-[10px] opacity-60'>
                                      {copy.chartWindowValue}: {pnlMetricDisplay.chartWindow}
                                    </p>
                                  ) : null}
                                </div>
                                <div className='rounded-md border border-base-300 bg-base-100/70 p-2'>
                                  <p className='text-[10px] uppercase tracking-wide opacity-65'>{copy.avgHold}</p>
                                  <p className='mt-1 text-base font-semibold'>{formatNumber(visibleStats.avgHoldMinutes)} min</p>
                                </div>
                              </div>

                              <div className='mt-3 space-y-3'>
                                <section className='rounded-md border border-base-300 bg-base-100/60 p-2'>
                                  <h5 className='text-xs font-semibold uppercase tracking-wide opacity-70'>{copy.executionTitle}</h5>
                                  <div className='mt-1 space-y-1 text-xs'>
                                    <p className='flex items-center justify-between gap-2'>
                                      <span className='opacity-70'>{copy.avgEntry}</span>
                                      <span className='font-medium'>{formatNumber(visibleStats.avgEntry)}</span>
                                    </p>
                                    <p className='flex items-center justify-between gap-2'>
                                      <span className='opacity-70'>{copy.avgExit}</span>
                                      <span className='font-medium'>{formatNumber(visibleStats.avgExit)}</span>
                                    </p>
                                    <p className='flex items-center justify-between gap-2'>
                                      <span className='opacity-70'>{copy.dca}</span>
                                      <span className='font-medium'>{formatNumber(visibleLifecycleCounts.DCA ?? 0)}</span>
                                    </p>
                                    <p className='flex items-center justify-between gap-2'>
                                      <span className='opacity-70'>{copy.closedOnLastCandle}</span>
                                      <span className='font-medium'>{formatNumber(visibleFinalCandleClosures)}</span>
                                    </p>
                                    <p className='flex items-center justify-between gap-2'>
                                      <span className='opacity-70'>{copy.liquidations}</span>
                                      <span className='font-medium'>{formatNumber(visibleLiquidations)}</span>
                                    </p>
                                  </div>
                                </section>

                                <section className='rounded-md border border-base-300 bg-base-100/60 p-2'>
                                  <h5 className='text-xs font-semibold uppercase tracking-wide opacity-70'>{copy.dataRangeTitle}</h5>
                                  <div className='mt-1 space-y-1 text-xs'>
                                    <p>
                                      <span className='opacity-70'>{copy.tradesRange}</span>{' '}
                                      <span className='font-medium'>
                                        {visibleStats.firstAt ? formatDateTime(new Date(visibleStats.firstAt).toISOString()) : copy.dash} -{' '}
                                        {visibleStats.lastAt ? formatDateTime(new Date(visibleStats.lastAt).toISOString()) : copy.dash}
                                      </span>
                                    </p>
                                    <p>
                                      <span className='opacity-70'>{copy.candlesRange}</span>{' '}
                                      <span className='font-medium'>
                                        {timelineWindowStart ? formatDateTime(new Date(timelineWindowStart).toISOString()) : copy.dash} -{' '}
                                        {timelineWindowEnd ? formatDateTime(new Date(timelineWindowEnd).toISOString()) : copy.dash}
                                      </span>
                                    </p>
                                    <p>
                                      <span className='opacity-70'>{copy.chartMinMax}</span>{' '}
                                      <span className='font-medium'>
                                        {timelineMinPrice != null && timelineMaxPrice != null
                                          ? `${formatNumber(timelineMinPrice)} / ${formatNumber(timelineMaxPrice)}`
                                          : copy.dash}
                                      </span>
                                    </p>
                                  </div>
                                </section>
                              </div>

                              <div className='divider my-2' />
                              <h5 className='font-semibold'>{copy.indicatorsTitle}</h5>
                              {indicatorMeta.names.length > 0 ? (
                                <div className='mt-2 flex flex-wrap gap-1.5'>
                                  {indicatorMeta.names.map((name) => (
                                    <span key={`${stats.symbol}-${name}`} className='badge badge-outline badge-sm'>
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className='mt-1 text-xs opacity-70'>{copy.noIndicators}</p>
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
              <EmptyState title={copy.noTradesTitle} description={copy.noTradesDescription} />
            ) : (
              <div className='space-y-3'>
                {tradeInsights ? (
                  <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
                    <div className='rounded-md border border-base-300 bg-base-200 p-2'>
                      <p className='text-[10px] uppercase tracking-wide opacity-65'>{copy.netPnl}</p>
                      <p className={`mt-1 text-sm font-semibold ${pnlClass(tradeInsights.finalCumulative)}`}>
                        {formatCurrency(tradeInsights.finalCumulative)}
                      </p>
                    </div>
                    <div className='rounded-md border border-base-300 bg-base-200 p-2'>
                      <p className='text-[10px] uppercase tracking-wide opacity-65'>{copy.totalProfit}</p>
                      <p className='mt-1 text-sm font-semibold text-success'>{formatCurrency(tradeInsights.grossProfit)}</p>
                    </div>
                    <div className='rounded-md border border-base-300 bg-base-200 p-2'>
                      <p className='text-[10px] uppercase tracking-wide opacity-65'>{copy.totalLoss}</p>
                      <p className='mt-1 text-sm font-semibold text-error'>{formatCurrency(tradeInsights.grossLoss)}</p>
                    </div>
                    <div className='rounded-md border border-base-300 bg-base-200 p-2'>
                      <p className='text-[10px] uppercase tracking-wide opacity-65'>{copy.extremes}</p>
                      <div className='mt-1 space-y-0.5 text-xs'>
                        <p className='flex items-center justify-between gap-2'>
                          <span className='opacity-70'>{copy.biggestWin}</span>
                          <span className='font-semibold text-success'>
                            {tradeInsights.hasWins ? formatCurrency(tradeInsights.maxWin) : copy.dash}
                          </span>
                        </p>
                        <p className='flex items-center justify-between gap-2'>
                          <span className='opacity-70'>{copy.biggestLoss}</span>
                          <span className='font-semibold text-error'>
                            {tradeInsights.hasLosses ? formatCurrency(tradeInsights.maxLoss) : copy.dash}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className='overflow-x-auto rounded-lg border border-base-300'>
                  <table className='table table-zebra table-sm'>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{copy.colSymbol}</th>
                        <th>{copy.colSide}</th>
                        <th>{copy.colOpen}</th>
                        <th>{copy.colClose}</th>
                        <th>{copy.colDuration}</th>
                        <th>{copy.colQty}</th>
                        <th>{copy.colDca}</th>
                        <th>{copy.colEntry}</th>
                        <th>{copy.colExit}</th>
                        <th>{copy.colNotionalEntry}</th>
                        <th>{copy.colNotionalExit}</th>
                        <th>{copy.colMarginEntry}</th>
                        <th>{copy.colMarginExit}</th>
                        <th>{copy.colMoveSide}</th>
                        <th>{copy.colPnlNotional}</th>
                        <th>{copy.colPnlMargin}</th>
                        <th>{copy.colFee}</th>
                        <th>{copy.colExitReason}</th>
                        <th>{copy.colPnl}</th>
                        <th>{copy.colCumPnl}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradesTimelineRows.map((row) => (
                        <tr key={row.trade.id} className={row.trade.pnl < 0 && Math.abs(row.trade.pnl) > Math.abs(row.cumulativePnl) * 0.25 ? 'bg-error/5' : ''}>
                          <td className='opacity-70'>{row.index}</td>
                          <td className='font-medium'>{row.trade.symbol}</td>
                          <td>
                            <span className={`badge badge-xs ${row.trade.side === 'LONG' ? 'badge-success' : 'badge-error'} badge-outline`}>
                              {row.trade.side}
                            </span>
                          </td>
                          <td>{formatDateTime(new Date(row.trade.openedAt).toISOString())}</td>
                          <td>{formatDateTime(new Date(row.trade.closedAt).toISOString())}</td>
                          <td>{formatHoldDuration(row.holdMinutes)}</td>
                          <td>{formatNumber(row.trade.quantity)}</td>
                          <td>
                            {row.dcaKnownFromTimeline ? (
                              <span className={`badge badge-xs ${row.dcaCount > 0 ? 'badge-info' : 'badge-ghost'}`}>
                                {row.dcaCount}
                              </span>
                            ) : (
                              <span className='opacity-60'>-</span>
                            )}
                          </td>
                          <td>{formatNumber(row.trade.entryPrice)}</td>
                          <td>{formatNumber(row.trade.exitPrice)}</td>
                          <td>{formatCurrency(row.entryNotional)}</td>
                          <td>{formatCurrency(row.exitNotional)}</td>
                          <td>{formatCurrency(row.entryMargin)}</td>
                          <td>{formatCurrency(row.exitMargin)}</td>
                          <td className={pnlClass(row.sidePriceMovePct)}>
                            {row.sidePriceMovePct == null ? '-' : formatPercent(row.sidePriceMovePct)}
                          </td>
                          <td className={pnlClass(row.pnlPctOnNotional)}>
                            {row.pnlPctOnNotional == null ? '-' : formatPercent(row.pnlPctOnNotional)}
                          </td>
                          <td className={pnlClass(row.pnlPctOnMargin)}>
                            {row.pnlPctOnMargin == null ? '-' : formatPercent(row.pnlPctOnMargin)}
                          </td>
                          <td>{row.trade.fee == null ? '-' : formatCurrency(row.trade.fee)}</td>
                          <td>
                            <span
                              className={`badge badge-xs ${
                                row.trade.exitReason === 'LIQUIDATION'
                                  ? 'badge-error'
                                  : row.trade.exitReason === 'FINAL_CANDLE'
                                    ? 'badge-warning'
                                    : 'badge-ghost'
                              }`}
                            >
                              {getExitReasonLabel(row.trade.exitReason ?? 'SIGNAL_EXIT', locale)}
                            </span>
                          </td>
                          <td className={pnlClass(row.trade.pnl)}>{formatCurrency(row.trade.pnl)}</td>
                          <td className={pnlClass(row.cumulativePnl)}>{formatCurrency(row.cumulativePnl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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


