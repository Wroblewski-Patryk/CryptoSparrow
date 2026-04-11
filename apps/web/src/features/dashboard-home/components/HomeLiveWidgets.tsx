'use client';

import { useCallback, useMemo, useState } from "react";
import { LuBot, LuChartCandlestick, LuChartLine, LuChevronDown, LuListChecks, LuPackageOpen } from "react-icons/lu";
import { toast } from "sonner";

import { ErrorState } from "../../../ui/components/ViewState";
import { SkeletonCardBlock, SkeletonKpiRow, SkeletonTableRows } from "../../../ui/components/loading";
import { DataTableColumn } from "../../../ui/components/DataTable";
import AssetSymbol from "../../../ui/components/AssetSymbol";
import { useI18n } from "../../../i18n/I18nProvider";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { createMarketStreamEventSource } from "../../../lib/marketStream";
import {
  BotRuntimePositionItem,
  BotRuntimePositionsResponse,
  BotRuntimeSymbolStatsResponse,
  BotRuntimeTrade,
} from "../../../features/bots/types/bot.type";
import {
  getBotRuntimeGraph,
  closeBotRuntimeSessionPosition,
  listBots,
  listBotRuntimeSessionPositions,
  listBotRuntimeSessionSymbolStats,
  listBotRuntimeSessionTrades,
  listBotRuntimeSessions,
} from "../../../features/bots/services/bots.service";
import { supportsExchangeCapability } from "../../../features/exchanges/exchangeCapabilities";
import { useCoinIconLookup } from "../../../features/icons/hooks/useCoinIconLookup";
import {
  pruneStickyFavorableMoveMap,
  resolveFallbackTtpProtectedPercent,
  toProtectedPnlPercentFromStopPrice,
} from "../../../features/bots/utils/trailingStopDisplay";
import RuntimeDataSection from "./home-live-widgets/RuntimeDataSection";
import RuntimeOnboardingSection from "./home-live-widgets/RuntimeOnboardingSection";
import RuntimeSidebarSection from "./home-live-widgets/RuntimeSidebarSection";
import RuntimeSignalsSection from "./home-live-widgets/RuntimeSignalsSection";
import { useHomeLiveWidgetsController } from "../hooks/useHomeLiveWidgetsController";
import type {
  OpenPositionWithLive,
  RuntimeDataTab,
  RuntimeSelectedData,
  RuntimeSnapshot,
  RuntimeSummary,
  RuntimeTabItem,
  RuntimeSymbolWithLive,
} from "./home-live-widgets/types";
type DirectionPillValue = "LONG" | "SHORT" | "BUY" | "SELL";

const CARD = "rounded-box bg-base-100/80";
const CARD_ASIDE = "rounded-box bg-base-100/85 h-fit xl:sticky xl:top-4";
const BTN_PRIMARY = "btn btn-primary btn-sm";
const BTN_SECONDARY = "btn btn-outline btn-sm";
const RUNTIME_DATA_STALE_WARNING_AFTER_MS = 20_000;
const DASHBOARD_OPEN_POSITIONS_SORT_STORAGE_KEY = "dashboard.home.openPositions.sort.v1";
const DASHBOARD_OPEN_POSITIONS_COLUMNS_STORAGE_KEY = "dashboard.home.openPositions.columns.v1";
const DASHBOARD_TRADE_HISTORY_COLUMNS_STORAGE_KEY = "dashboard.home.tradeHistory.columns.v1";
const TRADE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const OPEN_POSITIONS_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const SIGNAL_CARDS_DENSITY_BREAKPOINTS = {
  desktopMinWidth: 1280,
  tabletMinWidth: 768,
} as const;
const normalizeSymbol = (value: string) => value.trim().toUpperCase();
const KNOWN_QUOTE_CURRENCIES = [
  "USDT",
  "USDC",
  "BUSD",
  "FDUSD",
  "TUSD",
  "USDP",
  "DAI",
  "USD",
  "BTC",
  "ETH",
  "BNB",
  "EUR",
  "TRY",
  "BRL",
  "GBP",
  "AUD",
  "JPY",
] as const;

const resolveQuoteCurrency = (symbol: string) => {
  const normalized = normalizeSymbol(symbol);
  for (const quote of KNOWN_QUOTE_CURRENCIES) {
    if (normalized.endsWith(quote) && normalized.length > quote.length) return quote;
  }
  return null;
};

const formatDateTimeYearToSecond = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  const second = String(parsed.getSeconds()).padStart(2, "0");

  return `${year}.${month}.${day} ${hour}.${minute}.${second}`;
};

const resolveSignalCardsPerView = (width: number) => {
  if (width >= SIGNAL_CARDS_DENSITY_BREAKPOINTS.desktopMinWidth) return 4;
  if (width >= SIGNAL_CARDS_DENSITY_BREAKPOINTS.tabletMinWidth) return 3;
  return 2;
};

const formatAgeCompact = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1_000))}s`;
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

const readFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const RUNTIME_DATA_TABS: {
  key: RuntimeDataTab;
  hash: string;
  labelKey:
    | "dashboard.home.runtime.openPositionsTitle"
    | "dashboard.home.runtime.openOrdersTitle"
    | "dashboard.home.runtime.tradesHistoryTitlePaper";
}[] = [
  { key: "OPEN_POSITIONS", hash: "positions", labelKey: "dashboard.home.runtime.openPositionsTitle" },
  { key: "OPEN_ORDERS", hash: "orders", labelKey: "dashboard.home.runtime.openOrdersTitle" },
  { key: "TRADE_HISTORY", hash: "history", labelKey: "dashboard.home.runtime.tradesHistoryTitlePaper" },
];

const toTs = (v?: string | null) => {
  if (!v) return 0;
  const ts = new Date(v).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const interpolateTemplate = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, token) => String(values[token] ?? ""));

const sessionBadge = (status?: string | null) => {
  if (status === "RUNNING") return "badge-info";
  if (status === "COMPLETED") return "badge-success";
  if (status === "FAILED") return "badge-error";
  if (status === "CANCELED") return "badge-warning";
  return "badge-ghost";
};

const normalizeDcaLevels = (levels?: number[] | null) =>
  (levels ?? []).filter((level) => Number.isFinite(level));

const resolveDcaExecutedLevels = (position: BotRuntimePositionItem) => {
  const dcaCount = Number.isFinite(position.dcaCount) ? Math.max(0, Math.trunc(position.dcaCount)) : 0;
  if (dcaCount <= 0) return [];

  const executed = normalizeDcaLevels(position.dcaExecutedLevels);
  if (executed.length >= dcaCount) return executed.slice(0, dcaCount);
  if (executed.length > 0) {
    return [
      ...executed,
      ...Array.from({ length: dcaCount - executed.length }, () => executed[executed.length - 1]!),
    ];
  }

  const planned = normalizeDcaLevels(position.dcaPlannedLevels);
  if (planned.length === 0) return [];
  if (planned.length >= dcaCount) return planned.slice(0, dcaCount);

  return [
    ...planned,
    ...Array.from({ length: dcaCount - planned.length }, () => planned[planned.length - 1]!),
  ];
};

const renderDcaLadderCell = (params: {
  position: BotRuntimePositionItem;
  formatPercent: (value: number) => string;
}) => {
  const dcaCount = Number.isFinite(params.position.dcaCount)
    ? Math.max(0, Math.trunc(params.position.dcaCount))
    : 0;
  if (dcaCount <= 0) return <span className="text-xs opacity-70">0</span>;

  const executedLevels = resolveDcaExecutedLevels(params.position);
  if (executedLevels.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
        {dcaCount}
      </span>
    );
  }

  const ladderPreview = executedLevels
    .map((level, index) => `${index + 1}:${params.formatPercent(level)}`)
    .join(", ");

  return (
    <details className="group inline-block align-middle">
      <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
        <span
          className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning"
          title={ladderPreview}
        >
          {dcaCount}
          <LuChevronDown className="h-3 w-3 transition-transform duration-150 group-open:rotate-180" />
        </span>
      </summary>
      <div className="mt-1 w-max rounded-box border border-base-300/70 bg-base-200/60 px-2 py-1.5 text-[11px] shadow-sm">
        <ul className="space-y-1">
          {executedLevels.map((level, index) => (
            <li
              key={`${params.position.id}-dca-${index}`}
              className="grid grid-cols-[auto_auto] items-center gap-x-1.5 whitespace-nowrap"
            >
              <span className="font-medium opacity-70">{index + 1}</span>
              <span className="font-semibold">{params.formatPercent(level)}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
};

const directionPillClass = (value: DirectionPillValue) => {
  if (value === "LONG" || value === "BUY") return "border-success/40 bg-success/10 text-success";
  return "border-error/40 bg-error/10 text-error";
};

const DirectionPillIcon = ({ value }: { value: DirectionPillValue }) => {
  if (value === "LONG" || value === "BUY") {
    return (
      <svg
        stroke="currentColor"
        fill="none"
        strokeWidth="2"
        viewBox="0 0 24 24"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    );
  }

  return (
    <svg
      stroke="currentColor"
      fill="none"
      strokeWidth="2"
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
};

const DirectionPill = ({ value }: { value: DirectionPillValue }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${directionPillClass(value)}`}>
    <DirectionPillIcon value={value} />
    <span className="font-medium">{value}</span>
  </span>
);

type TradeActionValue = "OPEN" | "DCA" | "CLOSE" | "UNKNOWN";
type TradeActionReasonValue =
  | "SIGNAL_ENTRY"
  | "DCA_LEVEL"
  | "TAKE_PROFIT"
  | "STOP_LOSS"
  | "TRAILING_TAKE_PROFIT"
  | "TRAILING_STOP"
  | "SIGNAL_EXIT"
  | "MANUAL"
  | "UNKNOWN";

const tradeActionPillClass = (value: TradeActionValue) => {
  if (value === "OPEN") return "border-success/40 bg-success/10 text-success";
  if (value === "DCA") return "border-warning/40 bg-warning/10 text-warning";
  if (value === "CLOSE") return "border-primary/40 bg-primary/10 text-primary";
  return "border-base-300 bg-base-100 text-base-content/70";
};

const tradeActionLabel = (value: TradeActionValue) => {
  if (value === "OPEN") return "Otwarcie";
  if (value === "DCA") return "DCA";
  if (value === "CLOSE") return "Zamkniecie";
  return "Nieznane";
};

const TradeActionPill = ({ value }: { value: TradeActionValue }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tradeActionPillClass(value)}`}>
    {tradeActionLabel(value)}
  </span>
);

const tradeReasonPillClass = (value: TradeActionReasonValue) => {
  if (value === "TAKE_PROFIT" || value === "TRAILING_TAKE_PROFIT") return "border-success/40 bg-success/10 text-success";
  if (value === "STOP_LOSS" || value === "TRAILING_STOP") return "border-error/40 bg-error/10 text-error";
  if (value === "SIGNAL_ENTRY" || value === "SIGNAL_EXIT") return "border-info/40 bg-info/10 text-info";
  if (value === "DCA_LEVEL") return "border-warning/40 bg-warning/10 text-warning";
  if (value === "MANUAL") return "border-secondary/40 bg-secondary/10 text-secondary";
  return "border-base-300 bg-base-100 text-base-content/70";
};

const tradeReasonLabelKey = (value: TradeActionReasonValue) => {
  if (value === "SIGNAL_ENTRY") return "dashboard.home.runtime.reasonSignalEntry";
  if (value === "DCA_LEVEL") return "dashboard.home.runtime.reasonDcaLevel";
  if (value === "TAKE_PROFIT") return "dashboard.home.runtime.reasonTakeProfit";
  if (value === "STOP_LOSS") return "dashboard.home.runtime.reasonStopLoss";
  if (value === "TRAILING_TAKE_PROFIT") return "dashboard.home.runtime.reasonTrailingTakeProfit";
  if (value === "TRAILING_STOP") return "dashboard.home.runtime.reasonTrailingStop";
  if (value === "SIGNAL_EXIT") return "dashboard.home.runtime.reasonSignalExit";
  if (value === "MANUAL") return "dashboard.home.runtime.reasonManual";
  return "dashboard.home.runtime.reasonUnknown";
};

const resolveUsedMargin = (positions: BotRuntimePositionsResponse | null) =>
  (positions?.openItems ?? []).reduce((sum, p) => {
    const lev = Number.isFinite(p.leverage) && p.leverage > 0 ? p.leverage : 1;
    return sum + p.entryNotional / lev;
  }, 0);

const resolveDynamicTtpDisplay = (position: OpenPositionWithLive) =>
  toProtectedPnlPercentFromStopPrice({
    side: position.side,
    entryPrice: position.entryPrice,
    leverage: position.leverage,
    stopPrice: position.dynamicTtpStopLoss,
  }) ?? position.fallbackTtpProtectedPercent ?? null;

const resolveDynamicTslDisplay = (position: OpenPositionWithLive) => {
  if (resolveDynamicTtpDisplay(position) != null) return null;
  return toProtectedPnlPercentFromStopPrice({
    side: position.side,
    entryPrice: position.entryPrice,
    leverage: position.leverage,
    stopPrice: position.dynamicTslStopLoss,
  });
};

const buildLiveOpenPositions = (
  positions: BotRuntimePositionsResponse | null,
  symbolStats: BotRuntimeSymbolStatsResponse | null,
  streamPrices: Map<string, number>
): OpenPositionWithLive[] => {
  const priceBySymbol = new Map<string, number>();
  for (const item of symbolStats?.items ?? []) {
    if (typeof item.lastPrice === "number" && Number.isFinite(item.lastPrice) && item.lastPrice > 0) {
      priceBySymbol.set(normalizeSymbol(item.symbol), item.lastPrice);
    }
  }

  return (positions?.openItems ?? []).map((position) => {
    const symbolKey = normalizeSymbol(position.symbol);
    const lev = Number.isFinite(position.leverage) && position.leverage > 0 ? position.leverage : 1;
    const marginNotional = position.entryNotional / lev;
    const candidateMark =
      streamPrices.get(symbolKey) ?? priceBySymbol.get(symbolKey) ?? position.markPrice ?? null;
    const liveMarkPrice = typeof candidateMark === "number" && Number.isFinite(candidateMark) ? candidateMark : null;
    const hasPriceContext = liveMarkPrice != null || position.unrealizedPnl != null;
    const grossLiveUnrealizedPnl =
      liveMarkPrice == null
        ? (position.unrealizedPnl ?? 0)
        : position.side === "LONG"
          ? (liveMarkPrice - position.entryPrice) * position.quantity
          : (position.entryPrice - liveMarkPrice) * position.quantity;
    // Keep dashboard PnL model aligned with bots runtime view (gross unrealized move).
    // If neither live mark nor runtime unrealized is available yet, keep neutral 0.
    const liveUnrealizedPnl = hasPriceContext ? grossLiveUnrealizedPnl : 0;
    const livePnlPct = marginNotional > 0 ? (liveUnrealizedPnl / marginNotional) * 100 : 0;

    return {
      ...position,
      liveMarkPrice,
      liveUnrealizedPnl,
      livePnlPct,
      marginNotional,
    };
  });
};

const resolveUnrealized = (item: RuntimeSnapshot | null) => {
  if (!item) return 0;
  const liveOpen = buildLiveOpenPositions(item.positions, item.symbolStats, new Map<string, number>());
  if (liveOpen.length > 0) {
    return liveOpen.reduce((sum, row) => sum + row.liveUnrealizedPnl, 0);
  }
  if (typeof item.symbolStats?.summary.unrealizedPnl === "number") return item.symbolStats.summary.unrealizedPnl;
  return item.positions?.summary.unrealizedPnl ?? 0;
};

const maxDrawdown = (trades: BotRuntimeTrade[]) => {
  if (trades.length === 0) return { abs: 0, pct: null as number | null };
  const sorted = [...trades].sort((a, b) => toTs(a.executedAt) - toTs(b.executedAt));
  let running = 0;
  let peak = 0;
  let dd = 0;
  for (const t of sorted) {
    running += t.realizedPnl;
    peak = Math.max(peak, running);
    dd = Math.min(dd, running - peak);
  }
  const abs = Math.abs(dd);
  return { abs, pct: peak > 0 ? (abs / peak) * 100 : null };
};

export default function HomeLiveWidgets() {
  const { t } = useI18n();
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const { formatCurrency, formatDateTime, formatNumber, formatPercent, formatTime } = useLocaleFormatting();
  const formatDcaPercent = useCallback(
    (value: number) => `${formatNumber(value, { maximumFractionDigits: 2 })}%`,
    [formatNumber]
  );
  const {
    applyTradeFilters,
    bots,
    error,
    handleTradeSortChange,
    lastUpdatedAt,
    liveTickerPrices,
    load,
    loading,
    patchTradeDraftFilters,
    resetTradeFilters,
    runtimeDataTab,
    runtimeStaleWatchNowMs,
    selected,
    selectedTrades,
    selectedTradesLoading,
    setRuntimeDataTab,
    setSelectedBotId,
    setTradePage,
    setTradePageSize,
    signalRailRef,
    snapshots,
    ttpStickyFavorableMoveByPositionRef,
    tradeDraftFilters,
    tradePage,
    tradePageSize,
    tradeSortBy,
    tradeSortDir,
    viewportWidth,
  } = useHomeLiveWidgetsController({
    createMarketStreamEventSource,
    getBotRuntimeGraph,
    listBotRuntimeSessionPositions,
    listBotRuntimeSessionSymbolStats,
    listBotRuntimeSessionTrades,
    listBotRuntimeSessions,
    listBots,
    t,
  });
  const runtimeOnboardingSteps = useMemo(
    () => [
      {
        key: "markets",
        icon: <LuChartCandlestick className="h-4 w-4" aria-hidden />,
        toneClass: "border-primary/35 bg-primary/10 text-primary",
        title: t("dashboard.home.runtime.onboardingStepMarketsTitle"),
        description: t("dashboard.home.runtime.onboardingStepMarketsDescription"),
        cta: t("dashboard.home.runtime.onboardingStepMarketsCta"),
        href: "/dashboard/markets/list",
      },
      {
        key: "strategy",
        icon: <LuListChecks className="h-4 w-4" aria-hidden />,
        toneClass: "border-secondary/35 bg-secondary/10 text-secondary",
        title: t("dashboard.home.runtime.onboardingStepStrategyTitle"),
        description: t("dashboard.home.runtime.onboardingStepStrategyDescription"),
        cta: t("dashboard.home.runtime.onboardingStepStrategyCta"),
        href: "/dashboard/strategies/list",
      },
      {
        key: "backtest",
        icon: <LuChartLine className="h-4 w-4" aria-hidden />,
        toneClass: "border-accent/35 bg-accent/10 text-accent",
        title: t("dashboard.home.runtime.onboardingStepBacktestTitle"),
        description: t("dashboard.home.runtime.onboardingStepBacktestDescription"),
        cta: t("dashboard.home.runtime.onboardingStepBacktestCta"),
        href: "/dashboard/backtests/list",
      },
      {
        key: "bot",
        icon: <LuBot className="h-4 w-4" aria-hidden />,
        toneClass: "border-info/35 bg-info/10 text-info",
        title: t("dashboard.home.runtime.onboardingStepBotTitle"),
        description: t("dashboard.home.runtime.onboardingStepBotDescription"),
        cta: t("dashboard.home.runtime.onboardingStepBotCta"),
        href: "/dashboard/bots/create",
      },
    ],
    [t]
  );

  const summary = useMemo<RuntimeSummary>(() => {
    const openPositions = snapshots.reduce((acc, x) => acc + (x.positions?.openCount ?? 0), 0);
    const usedMargin = snapshots.reduce((acc, x) => acc + resolveUsedMargin(x.positions), 0);
    const realized = snapshots.reduce((acc, x) => acc + (x.session?.summary.realizedPnl ?? 0), 0);
    const streamMap = new Map<string, number>(Object.entries(liveTickerPrices));
    const unrealized = snapshots.reduce((acc, x) => {
      const openRows = buildLiveOpenPositions(
        x.positions,
        x.symbolStats,
        x.bot.id === selected?.bot.id ? streamMap : new Map<string, number>()
      );
      if (openRows.length > 0) {
        return acc + openRows.reduce((sum, row) => sum + row.liveUnrealizedPnl, 0);
      }
      return acc + resolveUnrealized(x);
    }, 0);
    const totalSignals = snapshots.reduce((acc, x) => acc + (x.session?.summary.totalSignals ?? 0), 0);
    const dcaCount = snapshots.reduce((acc, x) => acc + (x.session?.summary.dcaCount ?? 0), 0);

    const paper = snapshots.filter((x) => x.bot.mode === "PAPER");
    const paperStart = paper.reduce((acc, x) => acc + x.bot.paperStartBalance, 0);
    const paperDelta = paper.reduce((acc, x) => acc + (x.session?.summary.realizedPnl ?? 0) + resolveUnrealized(x), 0);
    const paperEquity = paperStart + paperDelta;
    return { openPositions, usedMargin, realized, unrealized, totalSignals, dcaCount, paperStart, paperDelta, paperEquity };
  }, [snapshots, liveTickerPrices, selected?.bot.id]);

  const selectedData = useMemo<RuntimeSelectedData | null>(() => {
    if (!selected) return null;
    const session = selected.session;
    const symbolsBase = [...(selected.symbolStats?.items ?? [])].sort(
      (a, b) => Math.max(toTs(b.lastSignalDecisionAt), toTs(b.lastSignalAt)) - Math.max(toTs(a.lastSignalDecisionAt), toTs(a.lastSignalAt))
    );
    const streamPrices = new Map<string, number>(Object.entries(liveTickerPrices));
    const open = buildLiveOpenPositions(selected.positions, selected.symbolStats, streamPrices);
    const stickyFavorableMoveByPosition = ttpStickyFavorableMoveByPositionRef.current;
    pruneStickyFavorableMoveMap(
      stickyFavorableMoveByPosition,
      new Set(open.map((position) => position.id))
    );
    const openWithProtectedFallback = open.map((position) => ({
      ...position,
      fallbackTtpProtectedPercent: resolveFallbackTtpProtectedPercent({
        positionId: position.id,
        livePnlPercent: position.livePnlPct,
        trailingTakeProfitLevels: position.trailingTakeProfitLevels,
        stickyFavorableMoveByPosition,
      }),
      runtimeBotId: selected.bot.id,
      runtimeSessionId: selected.session?.id ?? null,
    }));
    const openQtyBySymbol = new Map<string, number>();
    const openUnrealizedBySymbol = new Map<string, number>();
    for (const row of openWithProtectedFallback) {
      const key = normalizeSymbol(row.symbol);
      openQtyBySymbol.set(key, (openQtyBySymbol.get(key) ?? 0) + row.quantity);
      openUnrealizedBySymbol.set(key, (openUnrealizedBySymbol.get(key) ?? 0) + row.liveUnrealizedPnl);
    }
    const symbols: RuntimeSymbolWithLive[] = symbolsBase.map((item) => {
      const symbolKey = normalizeSymbol(item.symbol);
      return {
        ...item,
        liveLastPrice:
          streamPrices.get(symbolKey) ??
          (typeof item.lastPrice === "number" && Number.isFinite(item.lastPrice) ? item.lastPrice : null),
        liveOpenPositionQty: openQtyBySymbol.get(symbolKey) ?? item.openPositionQty,
        liveUnrealizedPnl: openUnrealizedBySymbol.get(symbolKey) ?? (item.unrealizedPnl ?? 0),
      };
    });
    const usedMargin = resolveUsedMargin(selected.positions);
    const unrealized =
      openWithProtectedFallback.length > 0
        ? openWithProtectedFallback.reduce((sum, row) => sum + row.liveUnrealizedPnl, 0)
        : resolveUnrealized(selected);
    const realized = session?.summary.realizedPnl ?? 0;
    const net = realized + unrealized;
    const wins = selected.symbolStats?.summary.winningTrades ?? 0;
    const losses = selected.symbolStats?.summary.losingTrades ?? 0;
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : null;
    const paperInit = selected.bot.mode === "PAPER" ? selected.bot.paperStartBalance : null;
    const paperEquity = paperInit != null ? paperInit + net : null;
    const runtimeCapitalSummary = (selected.positions?.summary ?? {}) as Record<string, unknown>;
    const liveReferenceBalanceRaw =
      readFiniteNumber(runtimeCapitalSummary.referenceBalance) ??
      readFiniteNumber(runtimeCapitalSummary.allocatedBalance) ??
      readFiniteNumber(runtimeCapitalSummary.accountBalance) ??
      readFiniteNumber(runtimeCapitalSummary.walletBalance);
    const liveReferenceBalance =
      selected.bot.mode === "LIVE" &&
      liveReferenceBalanceRaw != null &&
      Number.isFinite(liveReferenceBalanceRaw)
        ? Math.max(0, liveReferenceBalanceRaw)
        : null;
    const liveFreeCashRaw =
      readFiniteNumber(runtimeCapitalSummary.freeCash) ??
      readFiniteNumber(runtimeCapitalSummary.availableBalance) ??
      readFiniteNumber(runtimeCapitalSummary.freeBalance);
    const liveFreeCash =
      selected.bot.mode === "LIVE" && liveFreeCashRaw != null && Number.isFinite(liveFreeCashRaw)
        ? Math.max(0, liveFreeCashRaw)
        : null;
    const equityFromFreeAndUsedMargin =
      selected.bot.mode === "LIVE" && liveReferenceBalance == null && liveFreeCash != null
        ? Math.max(0, liveFreeCash + usedMargin)
        : null;
    const equity = selected.bot.mode === "LIVE" ? (liveReferenceBalance ?? equityFromFreeAndUsedMargin) : paperEquity;
    const free = liveFreeCash ?? (equity != null ? Math.max(0, equity - usedMargin) : null);
    const exposurePct = equity && equity > 0 ? (usedMargin / equity) * 100 : null;
    const trades = selectedTrades?.items ?? [];
    return {
      session,
      symbols,
      open: openWithProtectedFallback,
      usedMargin,
      unrealized,
      realized,
      net,
      wins,
      losses,
      winRate,
      paperInit,
      equity,
      free,
      exposurePct,
      trades,
      drawdown: maxDrawdown(trades),
    };
  }, [liveTickerPrices, selected, selectedTrades, ttpStickyFavorableMoveByPositionRef]);

  const showDynamicStopColumns = useMemo(() => {
    const fromStrategyMode = selected?.positions?.showDynamicStopColumns;
    if (typeof fromStrategyMode === "boolean") return fromStrategyMode;
    return (selectedData?.open ?? []).some(
      (row) => row.dynamicTtpStopLoss != null || row.dynamicTslStopLoss != null
    );
  }, [selected?.positions?.showDynamicStopColumns, selectedData?.open]);

  const selectedRuntimeCapabilityAvailable = useMemo(() => {
    if (!selected) return true;
    if (!selected.bot.exchange) return true;
    return selected.bot.mode === "LIVE"
      ? supportsExchangeCapability(selected.bot.exchange, "LIVE_EXECUTION")
      : supportsExchangeCapability(selected.bot.exchange, "PAPER_PRICING_FEED");
  }, [selected]);

  const runtimeDataAgeMs = useMemo(() => {
    if (!lastUpdatedAt) return null;
    const timestamp = Date.parse(lastUpdatedAt);
    if (!Number.isFinite(timestamp)) return null;
    return Math.max(0, runtimeStaleWatchNowMs - timestamp);
  }, [lastUpdatedAt, runtimeStaleWatchNowMs]);

  const runtimeDataIsStale = useMemo(
    () => runtimeDataAgeMs != null && runtimeDataAgeMs >= RUNTIME_DATA_STALE_WARNING_AFTER_MS,
    [runtimeDataAgeMs]
  );

  const selectedPlaceholderHint = useMemo(() => {
    if (!selected || !selected.bot.exchange) return "";
    return `${selected.bot.exchange}: ${t("dashboard.bots.create.placeholderActivationHint").replace("{mode}", selected.bot.mode)}`;
  }, [selected, t]);

  const signalCardsPerView = resolveSignalCardsPerView(
    viewportWidth > 0 ? viewportWidth : SIGNAL_CARDS_DENSITY_BREAKPOINTS.desktopMinWidth
  );
  const signalSymbols = useMemo(() => selectedData?.symbols ?? [], [selectedData?.symbols]);
  const signalHeaderStats = useMemo(() => {
    const actionableSignalsCount = signalSymbols.reduce((count, item) => {
      return item.lastSignalDirection === "LONG" || item.lastSignalDirection === "SHORT" ? count + 1 : count;
    }, 0);

    const quoteCounts = new Map<string, number>();
    for (const item of signalSymbols) {
      const quote = resolveQuoteCurrency(item.symbol);
      if (!quote) continue;
      quoteCounts.set(quote, (quoteCounts.get(quote) ?? 0) + 1);
    }

    const baseCurrencyCode =
      [...quoteCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

    return {
      marketsCount: signalSymbols.length,
      actionableSignalsCount,
      baseCurrencyCode,
    };
  }, [signalSymbols]);
  const runtimeAmountUnit = signalHeaderStats.baseCurrencyCode?.toUpperCase() ?? null;
  const formatRuntimeAmount = useCallback(
    (value: number) =>
      formatNumber(value, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [formatNumber]
  );
  const formatRuntimeAmountWithUnit = useCallback(
    (value: number) => (runtimeAmountUnit ? `${formatRuntimeAmount(value)} ${runtimeAmountUnit}` : formatRuntimeAmount(value)),
    [formatRuntimeAmount, runtimeAmountUnit]
  );
  const withRuntimeUnit = useCallback(
    (label: string) => (runtimeAmountUnit ? `${label} [${runtimeAmountUnit}]` : label),
    [runtimeAmountUnit]
  );
  const runtimeIconSymbols = useMemo(() => {
    const symbols = new Set<string>();
    for (const item of signalSymbols) symbols.add(normalizeSymbol(item.symbol));
    for (const item of selectedData?.open ?? []) symbols.add(normalizeSymbol(item.symbol));
    for (const item of selectedData?.trades ?? []) symbols.add(normalizeSymbol(item.symbol));
    if (signalHeaderStats.baseCurrencyCode) symbols.add(signalHeaderStats.baseCurrencyCode);
    return [...symbols];
  }, [selectedData?.open, selectedData?.trades, signalHeaderStats.baseCurrencyCode, signalSymbols]);
  const { iconMap: runtimeIconMap, loading: runtimeIconsLoading, error: runtimeIconsError } =
    useCoinIconLookup(runtimeIconSymbols);
  const resolveRuntimeIcon = useCallback(
    (symbol: string) => runtimeIconMap[normalizeSymbol(symbol)] ?? null,
    [runtimeIconMap]
  );
  const renderRuntimeSymbol = useCallback(
    (symbol: string) => {
      const icon = resolveRuntimeIcon(symbol);
      return (
        <AssetSymbol
          symbol={symbol}
          iconUrl={icon?.iconUrl ?? null}
          loading={runtimeIconsLoading && !icon}
          hasError={Boolean(runtimeIconsError)}
          className="font-[100]"
          iconClassName="h-5 w-5"
          labelClassName="leading-none"
        />
      );
    },
    [resolveRuntimeIcon, runtimeIconsError, runtimeIconsLoading]
  );
  const hasSignalOverflow = signalSymbols.length > signalCardsPerView;

  const scrollSignalRail = (direction: "prev" | "next") => {
    const node = signalRailRef.current;
    if (!node) return;
    const delta = Math.max(node.clientWidth * 0.9, 240);
    node.scrollBy({ left: direction === "next" ? delta : -delta, behavior: "smooth" });
  };

  const tradeMeta = selectedTrades?.meta ?? {
    page: tradePage,
    pageSize: tradePageSize,
    total: selectedData?.trades.length ?? 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  };
  const closeActionBaseLabel = t("dashboard.home.runtime.actionClose");
  const closePositionButtonLabel = closeActionBaseLabel === "Close" ? "Close position" : "Zamknij pozycje";
  const closePositionPendingLabel = closeActionBaseLabel === "Close" ? "Closing..." : "Zamykanie...";
  const closePositionNoSessionLabel =
    closeActionBaseLabel === "Close" ? "No active runtime session selected." : "Brak aktywnej sesji runtime.";
  const closePositionSuccessLabel = closeActionBaseLabel === "Close" ? "Position closed." : "Pozycja zamknieta.";
  const closePositionIgnoredLabel =
    closeActionBaseLabel === "Close"
      ? "Position was not closed (already closed or not eligible)."
      : "Pozycja nie zostala zamknieta (jest juz zamknieta lub nie kwalifikuje sie).";
  const closePositionErrorLabel = closeActionBaseLabel === "Close" ? "Failed to close position." : "Nie udalo sie zamknac pozycji.";

  const handleCloseRuntimePosition = useCallback(
    async (position: OpenPositionWithLive) => {
      const botId = position.runtimeBotId ?? selected?.bot.id;
      const sessionId = position.runtimeSessionId ?? selected?.session?.id;
      if (!botId || !sessionId) {
        toast.error(closePositionNoSessionLabel);
        return;
      }

      setClosingPositionId(position.id);
      try {
        const result = await closeBotRuntimeSessionPosition(botId, sessionId, position.id, { riskAck: true });
        if (result.status === "closed") {
          toast.success(closePositionSuccessLabel);
        } else {
          toast.error(closePositionIgnoredLabel);
        }
        await load({ silent: true });
      } catch {
        toast.error(closePositionErrorLabel);
      } finally {
        setClosingPositionId((current) => (current === position.id ? null : current));
      }
    },
    [
      closePositionErrorLabel,
      closePositionIgnoredLabel,
      closePositionNoSessionLabel,
      closePositionSuccessLabel,
      load,
      selected?.bot.id,
      selected?.session?.id,
    ]
  );

  const openPositionsColumns = useMemo<DataTableColumn<OpenPositionWithLive>[]>(() => {
    const columns: DataTableColumn<OpenPositionWithLive>[] = [
      {
        key: "openedAt",
        label: t("dashboard.home.runtime.timeOpened"),
        sortable: true,
        accessor: (row) => row.openedAt ?? "",
        render: (row) => formatDateTimeYearToSecond(row.openedAt),
      },
      {
        key: "symbol",
        label: t("dashboard.home.runtime.symbol"),
        sortable: true,
        accessor: (row) => row.symbol,
        render: (row) => {
          const icon = resolveRuntimeIcon(row.symbol);
          return (
            <AssetSymbol
              symbol={row.symbol}
              iconUrl={icon?.iconUrl ?? null}
              loading={runtimeIconsLoading && !icon}
              hasError={Boolean(runtimeIconsError)}
              className="font-medium"
            />
          );
        },
      },
      {
        key: "side",
        label: t("dashboard.home.runtime.side"),
        sortable: true,
        accessor: (row) => row.side,
        render: (row) => <DirectionPill value={row.side} />,
      },
      {
        key: "margin",
        label: withRuntimeUnit(t("dashboard.home.runtime.margin")),
        sortable: true,
        accessor: (row) => row.marginNotional,
        render: (row) => formatRuntimeAmount(row.marginNotional),
      },
      {
        key: "pnl",
        label: withRuntimeUnit(t("dashboard.home.runtime.pnl")),
        sortable: true,
        accessor: (row) => row.liveUnrealizedPnl,
        render: (row) => (
          <span className={row.liveUnrealizedPnl >= 0 ? "text-success" : "text-error"}>
            {formatRuntimeAmount(row.liveUnrealizedPnl)}
          </span>
        ),
      },
      {
        key: "pnlPercent",
        label: t("dashboard.home.runtime.pnlPercent"),
        sortable: true,
        accessor: (row) => row.livePnlPct ?? null,
        render: (row) => (
          <span className={row.liveUnrealizedPnl >= 0 ? "text-success" : "text-error"}>
            {row.livePnlPct == null ? "-" : formatPercent(row.livePnlPct)}
          </span>
        ),
      },
      {
        key: "dca",
        label: t("dashboard.home.runtime.dca"),
        sortable: true,
        accessor: (row) => row.dcaCount,
        className: "text-[11px]",
        render: (row) => renderDcaLadderCell({ position: row, formatPercent: formatDcaPercent }),
      },
      {
        key: "actionClosePosition",
        label: closePositionButtonLabel,
        className: "text-right",
        render: (row) => (
          <button
            type="button"
            className="btn btn-error btn-outline btn-xs whitespace-nowrap"
            onClick={() => void handleCloseRuntimePosition(row)}
            disabled={closingPositionId === row.id}
          >
            {closingPositionId === row.id ? closePositionPendingLabel : closePositionButtonLabel}
          </button>
        ),
      },
    ];

    if (showDynamicStopColumns) {
      columns.push(
        {
          key: "ttp",
          label: t("dashboard.home.runtime.slTtp"),
          sortable: true,
          accessor: (row) => resolveDynamicTtpDisplay(row) ?? null,
          render: (row) => {
            const ttpDisplay = resolveDynamicTtpDisplay(row);
            return ttpDisplay == null ? "-" : formatPercent(ttpDisplay);
          },
        },
        {
          key: "tsl",
          label: t("dashboard.home.runtime.slTsl"),
          sortable: true,
          accessor: (row) => resolveDynamicTslDisplay(row) ?? null,
          render: (row) => {
            const tslDisplay = resolveDynamicTslDisplay(row);
            return tslDisplay == null ? "-" : formatPercent(tslDisplay);
          },
        }
      );
    }

    return columns;
  }, [
    closePositionButtonLabel,
    closePositionPendingLabel,
    closingPositionId,
    formatDcaPercent,
    formatPercent,
    formatRuntimeAmount,
    handleCloseRuntimePosition,
    resolveRuntimeIcon,
    runtimeIconsError,
    runtimeIconsLoading,
    showDynamicStopColumns,
    t,
    withRuntimeUnit,
  ]);

  const tradesColumns = useMemo<DataTableColumn<BotRuntimeTrade>[]>(() => [
    {
      key: "executedAt",
      label: t("dashboard.home.runtime.time"),
      sortable: true,
      accessor: (row) => row.executedAt ?? "",
      render: (row) => formatDateTime(row.executedAt),
    },
    {
      key: "symbol",
      label: t("dashboard.home.runtime.symbol"),
      sortable: true,
      accessor: (row) => row.symbol,
      render: (row) => {
        const icon = resolveRuntimeIcon(row.symbol);
        return (
          <AssetSymbol
            symbol={row.symbol}
            iconUrl={icon?.iconUrl ?? null}
            loading={runtimeIconsLoading && !icon}
            hasError={Boolean(runtimeIconsError)}
            className="font-medium"
          />
        );
      },
    },
    {
      key: "side",
      label: t("dashboard.home.runtime.side"),
      sortable: true,
      accessor: (row) => row.side,
      render: (row) => <DirectionPill value={row.side === "BUY" ? "BUY" : "SELL"} />,
    },
    {
      key: "lifecycleAction",
      label: t("dashboard.home.runtime.filterAction"),
      sortable: true,
      accessor: (row) => row.lifecycleAction,
      render: (row) => <TradeActionPill value={row.lifecycleAction} />,
    },
    {
      key: "actionReason",
      label: t("dashboard.home.runtime.reason"),
      sortable: false,
      accessor: (row) => row.actionReason ?? "UNKNOWN",
      render: (row) => {
        const reason = (row.actionReason ?? "UNKNOWN") as TradeActionReasonValue;
        return (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tradeReasonPillClass(reason)}`}>
            {t(tradeReasonLabelKey(reason))}
          </span>
        );
      },
    },
    {
      key: "qty",
      label: t("dashboard.home.runtime.qty"),
      sortable: false,
      accessor: (row) => row.quantity,
      render: (row) => formatNumber(row.quantity, { maximumFractionDigits: 6 }),
    },
    {
      key: "price",
      label: t("dashboard.home.runtime.price"),
      sortable: false,
      accessor: (row) => row.price,
      render: (row) => formatNumber(row.price, { maximumFractionDigits: 4 }),
    },
    {
      key: "margin",
      label: withRuntimeUnit(t("dashboard.home.runtime.margin")),
      sortable: true,
      accessor: (row) => row.margin,
      render: (row) => formatRuntimeAmount(row.margin),
    },
    {
      key: "realizedPnl",
      label: withRuntimeUnit(t("dashboard.home.runtime.realizedPnl")),
      sortable: true,
      accessor: (row) => row.realizedPnl,
      render: (row) => (
        <span className={row.realizedPnl >= 0 ? "text-success" : "text-error"}>
          {formatRuntimeAmount(row.realizedPnl)}
        </span>
      ),
    },
  ], [
    formatDateTime,
    formatNumber,
    formatRuntimeAmount,
    resolveRuntimeIcon,
    runtimeIconsError,
    runtimeIconsLoading,
    t,
    withRuntimeUnit,
  ]);

  const runtimeTabItems = useMemo<RuntimeTabItem[]>(
    () =>
      RUNTIME_DATA_TABS.map((tab) => ({
        key: tab.key,
        hash: tab.hash,
        icon: tab.key === "TRADE_HISTORY"
          ? (
            <LuChartCandlestick className="h-4 w-4" aria-hidden />
          )
          : tab.key === "OPEN_ORDERS"
            ? (
              <LuListChecks className="h-4 w-4" aria-hidden />
            )
            : (
              <LuPackageOpen className="h-4 w-4" aria-hidden />
            ),
        label:
          tab.key === "TRADE_HISTORY"
            ? (selected?.bot.mode === "LIVE"
              ? t("dashboard.home.runtime.tradesHistoryTitleLive")
              : t("dashboard.home.runtime.tradesHistoryTitlePaper"))
            : t(tab.labelKey),
      })),
    [selected?.bot.mode, t]
  );

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t("dashboard.home.runtime.loadingTitle")}>
        <div className="hidden md:block">
          <SkeletonKpiRow items={3} />
        </div>
        <div className="space-y-3 md:hidden">
          <SkeletonKpiRow items={2} />
          <SkeletonKpiRow items={1} />
        </div>
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="order-2 space-y-3 xl:order-1">
            <div className="hidden md:block">
              <SkeletonCardBlock cards={4} linesPerCard={4} title={false} className="border-base-300/40 bg-base-100/60 p-3" />
              <SkeletonTableRows columns={8} rows={5} title={false} toolbar={false} className="border-base-300/40 bg-base-100/60 p-3" />
            </div>
            <div className="space-y-3 md:hidden">
              <SkeletonCardBlock cards={2} linesPerCard={3} title={false} className="border-base-300/40 bg-base-100/60 p-3" />
              <SkeletonTableRows columns={4} rows={4} title={false} toolbar={false} className="border-base-300/40 bg-base-100/60 p-3" />
            </div>
          </div>
          <div className="order-1 space-y-3 xl:order-2">
            <div className="hidden md:block">
              <SkeletonCardBlock cards={1} linesPerCard={6} title={false} className="border-base-300/40 bg-base-100/60 p-3" />
              <SkeletonCardBlock cards={1} linesPerCard={7} title={false} className="border-base-300/40 bg-base-100/60 p-3" />
            </div>
            <div className="space-y-3 md:hidden">
              <SkeletonCardBlock cards={1} linesPerCard={4} title={false} className="border-base-300/40 bg-base-100/60 p-3" />
              <SkeletonCardBlock cards={1} linesPerCard={5} title={false} className="border-base-300/40 bg-base-100/60 p-3" />
            </div>
          </div>
        </section>
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title={t("dashboard.home.runtime.errorTitle")}
        description={error}
        retryLabel={t("dashboard.home.runtime.errorRetry")}
        onRetry={() => void load()}
      />
    );
  }
  if (bots.length === 0) {
    return (
      <div className="space-y-4">
        <RuntimeOnboardingSection
          cardClassName={CARD}
          title={t("dashboard.home.runtime.noBotsTitle")}
          description={t("dashboard.home.runtime.noBotsDescription")}
          badgeLabel={t("dashboard.home.runtime.onboardingBadge")}
          steps={runtimeOnboardingSteps}
          primaryCtaLabel={t("dashboard.home.runtime.onboardingPrimaryCta")}
          secondaryCtaLabel={t("dashboard.home.runtime.onboardingSecondaryCta")}
          primaryHref="/dashboard/bots/create"
          secondaryHref="/dashboard/bots"
          primaryButtonClassName={BTN_PRIMARY}
          secondaryButtonClassName={BTN_SECONDARY}
        />
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="space-y-4">
        <RuntimeOnboardingSection
          cardClassName={CARD}
          title={t("dashboard.home.runtime.noActiveBotsTitle")}
          description={t("dashboard.home.runtime.noActiveBotsDescription")}
          badgeLabel={t("dashboard.home.runtime.onboardingBadge")}
          steps={runtimeOnboardingSteps}
          primaryCtaLabel={t("dashboard.home.runtime.onboardingPrimaryCta")}
          secondaryCtaLabel={t("dashboard.home.runtime.onboardingSecondaryCta")}
          primaryHref="/dashboard/bots/create"
          secondaryHref="/dashboard/bots"
          primaryButtonClassName={BTN_PRIMARY}
          secondaryButtonClassName={BTN_SECONDARY}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 min-w-0 xl:order-1">
          <section className={CARD}>
            <div className="space-y-6">
              {!selectedRuntimeCapabilityAvailable ? (
                <div className="rounded-box border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                  <div className="mb-1">
                    <span className="badge badge-xs badge-warning badge-outline">
                      {t("dashboard.bots.list.placeholderBadge")}
                    </span>
                  </div>
                  <p>{selectedPlaceholderHint}</p>
                </div>
              ) : null}

              <RuntimeDataSection
                runtimeDataTab={runtimeDataTab}
                onRuntimeDataTabChange={setRuntimeDataTab}
                tabItems={runtimeTabItems}
                openRows={selectedData?.open ?? []}
                openPositionsColumns={openPositionsColumns}
                openPositionsSortStorageKey={DASHBOARD_OPEN_POSITIONS_SORT_STORAGE_KEY}
                openPositionsColumnVisibilityKey={DASHBOARD_OPEN_POSITIONS_COLUMNS_STORAGE_KEY}
                openPositionsPageSizeOptions={OPEN_POSITIONS_PAGE_SIZE_OPTIONS}
                rowsPerPageLabel={t("dashboard.home.runtime.rows")}
                previousLabel={t("dashboard.home.runtime.previous")}
                nextLabel={t("dashboard.home.runtime.next")}
                noOpenPositionsLabel={t("dashboard.home.runtime.noOpenPositions")}
                openOrdersPlaceholderLabel={t("dashboard.home.runtime.openOrdersPlaceholder")}
                tradesLoading={selectedTradesLoading}
                loadingLabel={t("dashboard.home.loadWidgets")}
                tradesRows={selectedData?.trades ?? []}
                tradesColumns={tradesColumns}
                tradeDraftFilters={tradeDraftFilters}
                onTradeDraftFiltersPatch={patchTradeDraftFilters}
                onApplyTradeFilters={applyTradeFilters}
                onResetTradeFilters={resetTradeFilters}
                tradeSortBy={tradeSortBy}
                tradeSortDir={tradeSortDir}
                onTradeSortChange={handleTradeSortChange}
                advancedOptionsLabel={t("dashboard.bots.monitoring.advancedOptions")}
                allLabel={t("dashboard.home.runtime.all")}
                openActionLabel={t("dashboard.home.runtime.actionOpen")}
                dcaActionLabel="DCA"
                closeActionLabel={t("dashboard.home.runtime.actionClose")}
                filterSideLabel={t("dashboard.home.runtime.filterSide")}
                filterActionLabel={t("dashboard.home.runtime.filterAction")}
                filterFromLabel={t("dashboard.home.runtime.filterFrom")}
                filterToLabel={t("dashboard.home.runtime.filterTo")}
                applyLabel={t("dashboard.home.runtime.apply")}
                resetLabel={t("dashboard.home.runtime.reset")}
                tradeMeta={tradeMeta}
                tradePageSize={tradePageSize}
                onTradePageChange={(nextPage) => setTradePage(nextPage)}
                onTradePageSizeChange={(nextPageSize) => {
                  setTradePageSize(nextPageSize);
                  setTradePage(1);
                }}
                tradePageSizeOptions={TRADE_PAGE_SIZE_OPTIONS}
                tradesColumnVisibilityKey={DASHBOARD_TRADE_HISTORY_COLUMNS_STORAGE_KEY}
                noTradeHistoryLabel={t("dashboard.home.runtime.noTradeHistory")}
              />
              <RuntimeSignalsSection
                signalSymbols={signalSymbols}
                hasSignalOverflow={hasSignalOverflow}
                signalRailRef={signalRailRef}
                onScrollPrevious={() => scrollSignalRail("prev")}
                onScrollNext={() => scrollSignalRail("next")}
                previousLabel={t("dashboard.home.runtime.signalRailPrev")}
                nextLabel={t("dashboard.home.runtime.signalRailNext")}
                longLabel={t("dashboard.home.runtime.long")}
                shortLabel={t("dashboard.home.runtime.short")}
                noSignalDataLabel={t("dashboard.home.runtime.noSignalData")}
                marketsLabel={t("dashboard.home.runtime.markets")}
                signalsLabel={t("dashboard.home.runtime.signals")}
                marketsCount={signalHeaderStats.marketsCount}
                actionableSignalsCount={signalHeaderStats.actionableSignalsCount}
                renderSymbolLabel={renderRuntimeSymbol}
              />
              {runtimeDataIsStale ? (
                <p
                  className="rounded-box border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-content/85"
                  aria-live="polite"
                >
                  {interpolateTemplate(t("dashboard.home.runtime.staleDataWarning"), {
                    age: formatAgeCompact(runtimeDataAgeMs ?? 0),
                  })}
                </p>
              ) : null}
              <p className="text-[11px] opacity-60">
                {interpolateTemplate(t("dashboard.home.runtime.updatedAt"), {
                  value: lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "-",
                })}
              </p>
            </div>
          </section>

        </div>

        <RuntimeSidebarSection
          asideClassName={`${CARD_ASIDE} order-1 xl:order-2`}
          snapshots={snapshots}
          selected={selected}
          selectedData={selectedData}
          selectedRuntimeCapabilityAvailable={selectedRuntimeCapabilityAvailable}
          placeholderBadgeLabel={t("dashboard.bots.list.placeholderBadge")}
          summary={summary}
          lastUpdatedAt={lastUpdatedAt}
          onSelectedBotIdChange={setSelectedBotId}
          formatTime={formatTime}
          formatNumber={formatNumber}
          formatCurrency={formatCurrency}
          formatAmountWithUnit={formatRuntimeAmountWithUnit}
          formatPercent={formatPercent}
          formatDateTime={formatDateTime}
          sessionBadgeClassName={sessionBadge}
          text={{
            walletTitle: t("dashboard.home.runtime.walletTitle"),
            selectedBot: t("dashboard.home.runtime.selectedBot"),
            status: t("dashboard.home.runtime.status"),
            mode: t("dashboard.home.runtime.mode"),
            heartbeat: t("dashboard.home.runtime.heartbeat"),
            openPositions: t("dashboard.home.runtime.openPositions"),
            signalsDca: t("dashboard.home.runtime.signalsDca"),
            netPnl: t("dashboard.home.runtime.netPnl"),
            noSession: t("dashboard.home.runtime.noSession"),
            noActiveSessionWarning: t("dashboard.home.runtime.noActiveSessionWarning"),
            capitalRiskTitle: t("dashboard.home.runtime.capitalRiskTitle"),
            portfolio: t("dashboard.home.runtime.portfolio"),
            deltaFromStart: t("dashboard.home.runtime.deltaFromStart"),
            marketContextTitle: t("dashboard.home.runtime.marketContextTitle"),
            strategyContextTitle: t("dashboard.home.runtime.strategyContextTitle"),
            marketGroup: t("dashboard.home.runtime.marketGroup"),
            exchange: t("dashboard.home.runtime.exchange"),
            market: t("dashboard.home.runtime.market"),
            strategy: t("dashboard.bots.create.strategyLabel"),
            interval: t("dashboard.home.runtime.interval"),
            leverage: t("dashboard.home.runtime.leverage"),
            walletAllocation: t("dashboard.home.runtime.walletAllocation"),
            markets: t("dashboard.home.runtime.markets"),
            strategies: t("dashboard.nav.strategies"),
            baseCurrency: t("dashboard.home.runtime.baseCurrency"),
            freeFunds: t("dashboard.home.runtime.freeFunds"),
            fundsInPositions: t("dashboard.home.runtime.fundsInPositions"),
            inPositionsShort: t("dashboard.home.runtime.inPositionsShort"),
            exposure: t("dashboard.home.runtime.exposure"),
            realizedOpen: t("dashboard.home.runtime.realizedOpen"),
            winRate: t("dashboard.home.runtime.winRate"),
            maxDrawdown: t("dashboard.home.runtime.maxDrawdown"),
            updatedAt: (value) => interpolateTemplate(t("dashboard.home.runtime.updatedAt"), { value }),
          }}
        />
      </section>
    </div>
  );
}
