'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { LuBot, LuChartCandlestick, LuChartLine, LuChevronDown, LuListChecks, LuPackageOpen } from "react-icons/lu";

import { ErrorState, LoadingState } from "../../../ui/components/ViewState";
import { DataTableColumn } from "../../../ui/components/DataTable";
import AssetSymbol from "../../../ui/components/AssetSymbol";
import { useI18n } from "../../../i18n/I18nProvider";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { createMarketStreamEventSource } from "../../../lib/marketStream";
import {
  Bot,
  BotRuntimePositionItem,
  BotRuntimePositionsResponse,
  BotRuntimeSessionListItem,
  BotRuntimeSymbolStatsResponse,
  BotRuntimeTrade,
  BotRuntimeTradesResponse,
} from "../../../features/bots/types/bot.type";
import {
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
import type {
  OpenPositionWithLive,
  RuntimeDataTab,
  RuntimeSelectedData,
  RuntimeSnapshot,
  RuntimeSummary,
  RuntimeTabItem,
  RuntimeSymbolWithLive,
  SignalPillValue,
  TradeActionFilter,
  TradeFiltersState,
  TradeSideFilter,
  TradeSortBy,
  TradeSortDir,
} from "./home-live-widgets/types";
type TickerEventPayload = {
  symbol: string;
  lastPrice: number;
};
type DirectionPillValue = "LONG" | "SHORT" | "BUY" | "SELL";

const CARD = "rounded-box bg-base-100/80";
const CARD_ASIDE = "rounded-box bg-base-100/85 h-fit xl:sticky xl:top-4";
const BTN_PRIMARY = "btn btn-primary btn-sm";
const BTN_SECONDARY = "btn btn-outline btn-sm";
const MAX_DASHBOARD_BOTS = 8;
const AUTO_REFRESH_INTERVAL_MS = 5_000;
const LOAD_STALE_AFTER_MS = 20_000;
const SELECTED_BOT_STORAGE_KEY = "dashboard.home.selectedBotId";
const DASHBOARD_OPEN_POSITIONS_SORT_STORAGE_KEY = "dashboard.home.openPositions.sort.v1";
const DASHBOARD_TRADE_HISTORY_SORT_STORAGE_KEY = "dashboard.home.tradeHistory.sort.v1";
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

const EMPTY_TRADE_FILTERS: TradeFiltersState = {
  symbol: "",
  side: "ALL",
  action: "ALL",
  from: "",
  to: "",
};

const RUNTIME_DATA_TABS: {
  key: RuntimeDataTab;
  hash: string;
  labelKey: "dashboard.home.runtime.openPositionsTitle" | "dashboard.home.runtime.tradesHistoryTitlePaper";
}[] = [
  { key: "OPEN_POSITIONS", hash: "positions", labelKey: "dashboard.home.runtime.openPositionsTitle" },
  { key: "TRADE_HISTORY", hash: "history", labelKey: "dashboard.home.runtime.tradesHistoryTitlePaper" },
];

const normalizeDateTimeLocalToIso = (value: string, bound: "from" | "to") => {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (bound === "to") {
    const hasSeconds = raw.length >= 19;
    if (hasSeconds) {
      parsed.setMilliseconds(999);
    } else {
      parsed.setSeconds(59, 999);
    }
  }
  return parsed.toISOString();
};

const getAxiosMessage = (err: unknown) =>
  axios.isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;

const toTs = (v?: string | null) => {
  if (!v) return 0;
  const ts = new Date(v).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const interpolateTemplate = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, token) => String(values[token] ?? ""));

const pickPrimarySession = (sessions: BotRuntimeSessionListItem[]) => {
  if (sessions.length === 0) return null;
  const byFreshestHeartbeat = (a: BotRuntimeSessionListItem, b: BotRuntimeSessionListItem) => {
    const heartbeatDiff = toTs(b.lastHeartbeatAt) - toTs(a.lastHeartbeatAt);
    if (heartbeatDiff !== 0) return heartbeatDiff;
    const startedDiff = toTs(b.startedAt) - toTs(a.startedAt);
    if (startedDiff !== 0) return startedDiff;
    return b.id.localeCompare(a.id);
  };
  const running = sessions.filter((x) => x.status === "RUNNING");
  if (running.length > 0) {
    return [...running].sort(byFreshestHeartbeat)[0] ?? null;
  }
  return [...sessions].sort(byFreshestHeartbeat)[0] ?? null;
};

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
        <path d="M7 17V9" />
        <path d="m3 13 4-4 4 4" />
        <path d="M14 17h7" />
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
      <path d="M7 7v8" />
      <path d="m3 11 4 4 4-4" />
      <path d="M14 7h7" />
    </svg>
  );
};

const DirectionPill = ({ value }: { value: DirectionPillValue }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${directionPillClass(value)}`}>
    <DirectionPillIcon value={value} />
    <span className="font-medium">{value}</span>
  </span>
);

const signalPillClass = (value: SignalPillValue) => {
  if (value === "LONG") return "text-success";
  if (value === "SHORT") return "text-error";
  if (value === "EXIT") return "text-warning";
  return "text-base-content/70";
};

const SignalPillIcon = ({ value }: { value: SignalPillValue }) => {
  if (value === "LONG") return <DirectionPillIcon value="LONG" />;
  if (value === "SHORT") return <DirectionPillIcon value="SHORT" />;
  if (value === "EXIT") {
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
        <path d="M7 12h10" />
        <path d="m13 8 4 4-4 4" />
        <path d="M3 12h4" />
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
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
};

const SignalPill = ({ value }: { value: SignalPillValue }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${signalPillClass(value)}`}>
    <SignalPillIcon value={value} />
    <span>{value}</span>
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
  const { formatCurrency, formatDateTime, formatNumber, formatPercent, formatTime } = useLocaleFormatting();
  const formatDcaPercent = useCallback(
    (value: number) => `${formatNumber(value, { maximumFractionDigits: 2 })}%`,
    [formatNumber]
  );
  const [bots, setBots] = useState<Bot[]>([]);
  const [snapshots, setSnapshots] = useState<RuntimeSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<BotRuntimeTradesResponse | null>(null);
  const [selectedTradesLoading, setSelectedTradesLoading] = useState(false);
  const [tradePage, setTradePage] = useState(1);
  const [tradePageSize, setTradePageSize] = useState<number>(TRADE_PAGE_SIZE_OPTIONS[0]);
  const [tradeSortBy, setTradeSortBy] = useState<TradeSortBy | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(DASHBOARD_TRADE_HISTORY_SORT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { sortBy?: unknown };
      return typeof parsed.sortBy === "string" ? (parsed.sortBy as TradeSortBy) : null;
    } catch {
      return null;
    }
  });
  const [tradeSortDir, setTradeSortDir] = useState<TradeSortDir>(() => {
    if (typeof window === "undefined") return "asc";
    try {
      const raw = window.localStorage.getItem(DASHBOARD_TRADE_HISTORY_SORT_STORAGE_KEY);
      if (!raw) return "asc";
      const parsed = JSON.parse(raw) as { sortDir?: unknown };
      return parsed.sortDir === "desc" ? "desc" : "asc";
    } catch {
      return "asc";
    }
  });
  const [runtimeDataTab, setRuntimeDataTab] = useState<RuntimeDataTab>("OPEN_POSITIONS");
  const [tradeDraftFilters, setTradeDraftFilters] = useState<TradeFiltersState>(EMPTY_TRADE_FILTERS);
  const [tradeAppliedFilters, setTradeAppliedFilters] = useState<TradeFiltersState>(EMPTY_TRADE_FILTERS);
  const [refreshToken, setRefreshToken] = useState(0);
  const [liveTickerPrices, setLiveTickerPrices] = useState<Record<string, number>>({});
  const [viewportWidth, setViewportWidth] = useState(0);
  const ttpStickyFavorableMoveByPositionRef = useRef<Map<string, number>>(new Map());
  const loadInFlightRef = useRef(false);
  const loadStartedAtRef = useRef<number | null>(null);
  const signalRailRef = useRef<HTMLDivElement | null>(null);
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

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (silent && loadInFlightRef.current) {
      const startedAt = loadStartedAtRef.current ?? 0;
      if (Date.now() - startedAt < LOAD_STALE_AFTER_MS) return;
    }
    loadInFlightRef.current = true;
    loadStartedAtRef.current = Date.now();
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const botsResponse = await listBots();
      const ordered = [...botsResponse].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setBots(ordered);

      if (ordered.length === 0) {
        setSnapshots([]);
        setSelectedBotId(null);
        setLastUpdatedAt(new Date().toISOString());
        setRefreshToken((x) => x + 1);
        return;
      }

      const active = ordered.filter((x) => x.isActive);
      if (active.length === 0) {
        setSnapshots([]);
        setSelectedBotId(null);
        setLastUpdatedAt(new Date().toISOString());
        setRefreshToken((x) => x + 1);
        return;
      }
      const scope = active.slice(0, MAX_DASHBOARD_BOTS);
      const next = await Promise.all(
        scope.map(async (bot): Promise<RuntimeSnapshot> => {
          try {
            const sessions = await listBotRuntimeSessions(bot.id, { limit: 20 });
            const primary = pickPrimarySession(sessions);
            if (!primary) return { bot, session: null, symbolStats: null, positions: null };
            const [symbolStats, positions] = await Promise.all([
              listBotRuntimeSessionSymbolStats(bot.id, primary.id, { limit: 200 }),
              listBotRuntimeSessionPositions(bot.id, primary.id, { limit: 200 }),
            ]);
            return { bot, session: primary, symbolStats, positions };
          } catch (err) {
            return {
              bot,
              session: null,
              symbolStats: null,
              positions: null,
              loadError: getAxiosMessage(err) ?? t("dashboard.home.runtime.noSignalData"),
            };
          }
        })
      );

      setSnapshots(next);
      setSelectedBotId((prev) => (prev && next.some((x) => x.bot.id === prev) ? prev : next[0]?.bot.id ?? null));
      setLastUpdatedAt(new Date().toISOString());
      setRefreshToken((x) => x + 1);
    } catch (err) {
      if (!silent) {
        setError(getAxiosMessage(err) ?? t("dashboard.home.loadWidgetsErrorDescription"));
      }
    } finally {
      loadInFlightRef.current = false;
      loadStartedAtRef.current = null;
      if (!silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(SELECTED_BOT_STORAGE_KEY);
    if (saved) setSelectedBotId(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncViewport = () => setViewportWidth(window.innerWidth);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load({ silent: true }), AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const selected = useMemo(() => {
    if (snapshots.length === 0) return null;
    if (!selectedBotId) return snapshots[0];
    return snapshots.find((x) => x.bot.id === selectedBotId) ?? snapshots[0];
  }, [snapshots, selectedBotId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selected?.bot.id) return;
    window.localStorage.setItem(SELECTED_BOT_STORAGE_KEY, selected.bot.id);
  }, [selected?.bot.id]);

  useEffect(() => {
    setTradePage(1);
  }, [selected?.bot.id, selected?.session?.id]);

  const streamSymbols = useMemo(() => {
    const fromStats = selected?.symbolStats?.items?.map((item) => item.symbol) ?? [];
    const fromOpen = selected?.positions?.openItems?.map((item) => item.symbol) ?? [];
    return [...new Set([...fromStats, ...fromOpen].map((symbol) => normalizeSymbol(symbol)))];
  }, [selected?.symbolStats?.items, selected?.positions?.openItems]);
  const streamSymbolsKey = useMemo(() => streamSymbols.join(","), [streamSymbols]);

  useEffect(() => {
    if (!selected?.session?.id || selected.session.status !== "RUNNING") return;
    if (!streamSymbolsKey) return;
    if (typeof window === "undefined" || typeof window.EventSource === "undefined") return;

    const source = createMarketStreamEventSource({
      symbols: streamSymbols,
      interval: "1m",
    });

    source.addEventListener("ticker", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as TickerEventPayload;
        if (!data?.symbol || !Number.isFinite(data.lastPrice)) return;
        const symbolKey = normalizeSymbol(data.symbol);
        setLiveTickerPrices((prev) => {
          if (prev[symbolKey] === data.lastPrice) return prev;
          return { ...prev, [symbolKey]: data.lastPrice };
        });
      } catch {
        // ignore malformed ticker payload
      }
    });

    return () => {
      source.close();
    };
  }, [selected?.session?.id, selected?.session?.status, streamSymbols, streamSymbolsKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selected?.session?.id) {
        setSelectedTrades(null);
        return;
      }
      const shouldShowLoading = selectedTrades == null;
      if (shouldShowLoading) setSelectedTradesLoading(true);
      try {
        const query: Parameters<typeof listBotRuntimeSessionTrades>[2] = {
          page: tradePage,
          pageSize: tradePageSize,
        };
        const symbol = tradeAppliedFilters.symbol.trim() ? normalizeSymbol(tradeAppliedFilters.symbol) : undefined;
        const side = tradeAppliedFilters.side === "ALL" ? undefined : tradeAppliedFilters.side;
        const action = tradeAppliedFilters.action === "ALL" ? undefined : tradeAppliedFilters.action;
        const from = normalizeDateTimeLocalToIso(tradeAppliedFilters.from, "from");
        const to = normalizeDateTimeLocalToIso(tradeAppliedFilters.to, "to");
        if (tradeSortBy) {
          query.sortBy = tradeSortBy;
          query.sortDir = tradeSortDir;
        }
        if (symbol) query.symbol = symbol;
        if (side) query.side = side;
        if (action) query.action = action;
        if (from) query.from = from;
        if (to) query.to = to;

        const trades = await listBotRuntimeSessionTrades(selected.bot.id, selected.session.id, query);
        if (!cancelled) setSelectedTrades(trades);
      } catch {
        if (!cancelled) setSelectedTrades(null);
      } finally {
        if (!cancelled && shouldShowLoading) setSelectedTradesLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    selected?.bot.id,
    selected?.session?.id,
    refreshToken,
    tradePage,
    tradePageSize,
    tradeSortBy,
    tradeSortDir,
    tradeAppliedFilters,
  ]);

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
    const equity = paperInit != null ? paperInit + net : null;
    const free = equity != null ? Math.max(0, equity - usedMargin) : null;
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
  }, [selected, selectedTrades, liveTickerPrices]);

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

  const selectedPlaceholderHint = useMemo(() => {
    if (!selected || !selected.bot.exchange) return "";
    return `${selected.bot.exchange}: ${t("dashboard.bots.create.placeholderActivationHint").replace("{mode}", selected.bot.mode)}`;
  }, [selected, t]);

  const signalCardsPerView = resolveSignalCardsPerView(
    viewportWidth > 0 ? viewportWidth : SIGNAL_CARDS_DENSITY_BREAKPOINTS.desktopMinWidth
  );
  const signalSymbols = selectedData?.symbols ?? [];
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
          className="font-semibold"
        />
      );
    },
    [resolveRuntimeIcon, runtimeIconsError, runtimeIconsLoading]
  );
  const renderBaseCurrencySymbol = useCallback(
    (currency: string) => {
      const icon = resolveRuntimeIcon(currency);
      return (
        <AssetSymbol
          symbol={currency}
          iconUrl={icon?.iconUrl ?? null}
          loading={runtimeIconsLoading && !icon}
          hasError={Boolean(runtimeIconsError)}
          className="font-semibold text-[11px]"
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

  const patchTradeDraftFilters = (patch: Partial<TradeFiltersState>) => {
    setTradeDraftFilters((prev) => ({ ...prev, ...patch }));
  };

  const applyTradeFilters = () => {
    setTradePage(1);
    setTradeAppliedFilters({ ...tradeDraftFilters });
  };

  const handleTradeSortChange = useCallback(
    (columnKey: string | null, direction: "asc" | "desc") => {
      setTradePage(1);
      setTradeSortBy(columnKey as TradeSortBy | null);
      setTradeSortDir(direction);
    },
    []
  );

  const resetTradeFilters = () => {
    setTradePage(1);
    setTradeDraftFilters(EMPTY_TRADE_FILTERS);
    setTradeAppliedFilters(EMPTY_TRADE_FILTERS);
    setTradeSortBy(null);
    setTradeSortDir("asc");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        DASHBOARD_TRADE_HISTORY_SORT_STORAGE_KEY,
        JSON.stringify({
          sortBy: tradeSortBy,
          sortDir: tradeSortDir,
        })
      );
    } catch {
      // Ignore localStorage write failures.
    }
  }, [tradeSortBy, tradeSortDir]);

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
        label: t("dashboard.home.runtime.margin"),
        sortable: true,
        accessor: (row) => row.marginNotional,
        render: (row) => formatCurrency(row.marginNotional),
      },
      {
        key: "pnl",
        label: t("dashboard.home.runtime.pnl"),
        sortable: true,
        accessor: (row) => row.liveUnrealizedPnl,
        render: (row) => (
          <span className={row.liveUnrealizedPnl >= 0 ? "text-success" : "text-error"}>
            {formatCurrency(row.liveUnrealizedPnl)}
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
    formatCurrency,
    formatDcaPercent,
    formatPercent,
    resolveRuntimeIcon,
    runtimeIconsError,
    runtimeIconsLoading,
    showDynamicStopColumns,
    t,
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
      label: t("dashboard.home.runtime.margin"),
      sortable: true,
      accessor: (row) => row.margin,
      render: (row) => formatCurrency(row.margin),
    },
    {
      key: "realizedPnl",
      label: t("dashboard.home.runtime.realizedPnl"),
      sortable: true,
      accessor: (row) => row.realizedPnl,
      render: (row) => (
        <span className={row.realizedPnl >= 0 ? "text-success" : "text-error"}>
          {formatCurrency(row.realizedPnl)}
        </span>
      ),
    },
  ], [
    formatCurrency,
    formatDateTime,
    formatNumber,
    resolveRuntimeIcon,
    runtimeIconsError,
    runtimeIconsLoading,
    t,
  ]);

  const runtimeTabItems = useMemo<RuntimeTabItem[]>(
    () =>
      RUNTIME_DATA_TABS.map((tab) => ({
        key: tab.key,
        hash: tab.hash,
        icon:
          tab.key === "TRADE_HISTORY" ? (
            <LuChartCandlestick className="h-4 w-4" aria-hidden />
          ) : (
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

  if (loading) return <LoadingState title={t("dashboard.home.runtime.loadingTitle")} />;
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
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <section className={CARD}>
            <div className="space-y-6">
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
                titleLabel={t("dashboard.home.runtime.liveChecksTitle")}
                marketsLabel={t("dashboard.home.runtime.markets")}
                signalsLabel={t("dashboard.home.runtime.signals")}
                baseCurrencyLabel={t("dashboard.home.runtime.baseCurrency")}
                marketsCount={signalHeaderStats.marketsCount}
                actionableSignalsCount={signalHeaderStats.actionableSignalsCount}
                baseCurrencyCode={signalHeaderStats.baseCurrencyCode}
                renderBaseCurrency={renderBaseCurrencySymbol}
                renderSymbolLabel={renderRuntimeSymbol}
                renderSignalPill={(value) => <SignalPill value={value} />}
              />

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
                openPositionsPageSizeOptions={OPEN_POSITIONS_PAGE_SIZE_OPTIONS}
                rowsPerPageLabel={t("dashboard.home.runtime.rows")}
                previousLabel={t("dashboard.home.runtime.previous")}
                nextLabel={t("dashboard.home.runtime.next")}
                noOpenPositionsLabel={t("dashboard.home.runtime.noOpenPositions")}
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
                noTradeHistoryLabel={t("dashboard.home.runtime.noTradeHistory")}
                recordsBadgeLabel={(total) => interpolateTemplate(t("dashboard.home.runtime.recordsBadge"), { total })}
                pageBadgeLabel={(page, totalPages) =>
                  interpolateTemplate(t("dashboard.home.runtime.pageBadge"), { page, totalPages })
                }
              />
            </div>
          </section>

        </div>

        <RuntimeSidebarSection
          asideClassName={CARD_ASIDE}
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
          formatPercent={formatPercent}
          formatDateTime={formatDateTime}
          sessionBadgeClassName={sessionBadge}
          text={{
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
            freeFunds: t("dashboard.home.runtime.freeFunds"),
            fundsInPositions: t("dashboard.home.runtime.fundsInPositions"),
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
