'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useI18n } from "../../../i18n/I18nProvider";
import { TranslationKey } from "../../../i18n/translations";

import StatusBadge from "../../../ui/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState, SuccessState } from "../../../ui/components/ViewState";
import {
  createBot,
  deleteBot,
  deleteBotSubagentConfig,
  getBotRuntimeSession,
  getBotAssistantConfig,
  listBots,
  listBotRuntimeSessionSymbolStats,
  listBotRuntimeSessionPositions,
  listBotRuntimeSessionTrades,
  listBotRuntimeSessions,
  runBotAssistantDryRun,
  updateBot,
  upsertBotAssistantConfig,
  upsertBotSubagentConfig,
} from "../services/bots.service";
import {
  Bot,
  AssistantDecisionTrace,
  BotMode,
  BotRuntimeSessionDetail,
  BotRuntimeSessionListItem,
  BotRuntimeSessionStatus,
  BotRuntimeSymbolStatsResponse,
  BotRuntimePositionsResponse,
  BotRuntimeTradesResponse,
  BotSubagentConfig,
  TradeMarket,
} from "../types/bot.type";
import { listMarketUniverses } from "../../markets/services/markets.service";
import { MarketUniverse } from "../../markets/types/marketUniverse.type";
import { listStrategies } from "../../strategies/api/strategies.api";
import { StrategyDto } from "../../strategies/types/StrategyForm.type";
import { createMarketStreamEventSource } from "../../../lib/marketStream";
import { supportsExchangeCapability } from "../../exchanges/exchangeCapabilities";
import { LuChevronDown } from "react-icons/lu";

const LIVE_CONSENT_TEXT_VERSION = "mvp-v1";
const DUPLICATE_ACTIVE_BOT_ERROR = "active bot already exists for this strategy + market group pair";
const MONITOR_AUTO_REFRESH_INTERVAL_MS = 5_000;

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const response = err.response?.data as { error?: { message?: string }; message?: string } | undefined;
  return response?.error?.message ?? response?.message;
};

const toModeBadge = (mode: BotMode) => {
  if (mode === "LIVE") return "live";
  return "paper";
};

const toRiskBadge = (bot: Bot) => {
  if (bot.mode === "LIVE" && bot.liveOptIn) {
    return { value: "danger", labelKey: "dashboard.bots.badges.liveEnabled" as TranslationKey } as const;
  }
  if (bot.mode === "LIVE" && !bot.liveOptIn) {
    return { value: "warning", labelKey: "dashboard.bots.badges.liveBlocked" as TranslationKey } as const;
  }
  return { value: "safe", labelKey: "dashboard.bots.badges.safeMode" as TranslationKey } as const;
};

const deriveStrategyMaxOpenPositions = (strategy: StrategyDto | null): number => {
  if (!strategy?.config || typeof strategy.config !== "object") return 1;
  const config = strategy.config as {
    additional?: {
      maxPositions?: unknown;
      maxOpenPositions?: unknown;
    };
  };
  const raw = config.additional?.maxPositions ?? config.additional?.maxOpenPositions;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const formatNumber = (value: number, digits = 2) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const formatDuration = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

const normalizeDcaLevels = (levels?: number[] | null) =>
  (levels ?? []).filter((level) => Number.isFinite(level));

const resolveDcaExecutedLevels = (params: {
  dcaCount: number;
  dcaExecutedLevels?: number[] | null;
  dcaPlannedLevels?: number[] | null;
}) => {
  const dcaCount = Number.isFinite(params.dcaCount) ? Math.max(0, Math.trunc(params.dcaCount)) : 0;
  if (dcaCount <= 0) return [];

  const executed = normalizeDcaLevels(params.dcaExecutedLevels);
  if (executed.length >= dcaCount) return executed.slice(0, dcaCount);
  if (executed.length > 0) {
    return [
      ...executed,
      ...Array.from({ length: dcaCount - executed.length }, () => executed[executed.length - 1]!),
    ];
  }

  const planned = normalizeDcaLevels(params.dcaPlannedLevels);
  if (planned.length === 0) return [];
  if (planned.length >= dcaCount) return planned.slice(0, dcaCount);

  return [
    ...planned,
    ...Array.from({ length: dcaCount - planned.length }, () => planned[planned.length - 1]!),
  ];
};

const formatDcaLadderCell = (params: {
  id?: string;
  dcaCount: number;
  dcaExecutedLevels?: number[] | null;
  dcaPlannedLevels?: number[] | null;
}) => {
  const dcaCount = Number.isFinite(params.dcaCount) ? Math.max(0, Math.trunc(params.dcaCount)) : 0;
  if (dcaCount <= 0) return <span className="text-xs opacity-70">0</span>;

  const executedLevels = resolveDcaExecutedLevels(params);
  if (executedLevels.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
        {dcaCount}
      </span>
    );
  }

  const ladderPreview = executedLevels
    .map((level, index) => `${index + 1}:${formatNumber(level, 2)}%`)
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
              key={`${params.id ?? "dca"}-${index}`}
              className="grid grid-cols-[auto_auto] items-center gap-x-1.5 whitespace-nowrap"
            >
              <span className="font-medium opacity-70">{index + 1}</span>
              <span className="font-semibold">{formatNumber(level, 2)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
};

const interpolateTemplate = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, token) => String(values[token] ?? ""));

const toSessionStatusBadgeClass = (status: BotRuntimeSessionStatus) => {
  if (status === "RUNNING") return "badge-info";
  if (status === "COMPLETED") return "badge-success";
  if (status === "FAILED") return "badge-error";
  return "badge-warning";
};

const toTradeSideBadgeClass = (side: string) => {
  if (side === "BUY" || side === "LONG") return "badge-success";
  if (side === "SELL" || side === "SHORT") return "badge-error";
  return "badge-ghost";
};

const toTradeLifecycleBadgeClass = (value: "OPEN" | "DCA" | "CLOSE" | "UNKNOWN") => {
  if (value === "OPEN") return "badge-success";
  if (value === "DCA") return "badge-warning";
  if (value === "CLOSE") return "badge-primary";
  return "badge-ghost";
};

const toTradeLifecycleLabelKey = (value: "OPEN" | "DCA" | "CLOSE" | "UNKNOWN") => {
  if (value === "OPEN") return "dashboard.bots.actions.open" as TranslationKey;
  if (value === "DCA") return "dashboard.bots.actions.dca" as TranslationKey;
  if (value === "CLOSE") return "dashboard.bots.actions.close" as TranslationKey;
  return "dashboard.bots.actions.unknown" as TranslationKey;
};

const formatTradeFeeMeta = (trade: {
  feeSource: "ESTIMATED" | "EXCHANGE_FILL";
  feePending: boolean;
  feeCurrency: string | null;
}) => {
  const currencySuffix = trade.feeCurrency ? ` ${trade.feeCurrency}` : "";
  if (trade.feePending) return `PENDING${currencySuffix}`;
  const sourceLabel = trade.feeSource === "EXCHANGE_FILL" ? "EXCHANGE" : "EST.";
  return `${sourceLabel}${currencySuffix}`;
};

type MonitorAggregateData = {
  sessionDetail: BotRuntimeSessionDetail;
  symbolStats: BotRuntimeSymbolStatsResponse;
  positions: BotRuntimePositionsResponse;
  trades: BotRuntimeTradesResponse;
};

const FIELD_WRAPPER_CLASS = "form-control gap-1";
const META_CARD_CLASS = "rounded-box border border-base-300/60 bg-base-200/60 px-3 py-2";
const normalizeSymbol = (value: string) => value.trim().toUpperCase();
type TickerEventPayload = {
  symbol: string;
  lastPrice: number;
};

const toTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const uniqueById = <T extends { id: string }>(items: T[]) => {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return [...map.values()];
};

const aggregateMonitorData = (params: {
  sessions: BotRuntimeSessionListItem[];
  symbolResponses: BotRuntimeSymbolStatsResponse[];
  positionResponses: BotRuntimePositionsResponse[];
  tradeResponses: BotRuntimeTradesResponse[];
}): MonitorAggregateData => {
  const sessions = params.sessions;
  const mode: BotMode = sessions.some((session) => session.mode === "LIVE") ? "LIVE" : "PAPER";
  const status: BotRuntimeSessionStatus = sessions.some((session) => session.status === "RUNNING")
    ? "RUNNING"
    : sessions.some((session) => session.status === "FAILED")
      ? "FAILED"
      : sessions.some((session) => session.status === "CANCELED")
        ? "CANCELED"
        : "COMPLETED";

  const startedAt = sessions
    .map((session) => session.startedAt)
    .filter(Boolean)
    .sort((a, b) => toTimestamp(a) - toTimestamp(b))[0] ?? new Date().toISOString();
  const finishedAt = sessions
    .map((session) => session.finishedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => toTimestamp(b) - toTimestamp(a))[0] ?? null;
  const lastHeartbeatAt = sessions
    .map((session) => session.lastHeartbeatAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => toTimestamp(b) - toTimestamp(a))[0] ?? null;
  const durationMs = Math.max(
    0,
    sessions.reduce((acc, session) => acc + Math.max(0, session.durationMs), 0)
  );
  const eventsCount = sessions.reduce((acc, session) => acc + session.eventsCount, 0);

  const symbolMap = new Map<string, BotRuntimeSymbolStatsResponse["items"][number]>();
  for (const response of params.symbolResponses) {
    for (const item of response.items) {
      const existing = symbolMap.get(item.symbol);
      if (!existing) {
        symbolMap.set(item.symbol, {
          ...item,
          id: `aggregate-${item.symbol}`,
          sessionId: "AGGREGATE",
        });
        continue;
      }

      const currentSignalTs = Math.max(
        toTimestamp(item.lastSignalDecisionAt),
        toTimestamp(item.lastSignalAt)
      );
      const existingSignalTs = Math.max(
        toTimestamp(existing.lastSignalDecisionAt),
        toTimestamp(existing.lastSignalAt)
      );
      const currentTradeTs = toTimestamp(item.lastTradeAt);
      const existingTradeTs = toTimestamp(existing.lastTradeAt);

      symbolMap.set(item.symbol, {
        ...existing,
        totalSignals: existing.totalSignals + item.totalSignals,
        longEntries: existing.longEntries + item.longEntries,
        shortEntries: existing.shortEntries + item.shortEntries,
        exits: existing.exits + item.exits,
        dcaCount: existing.dcaCount + item.dcaCount,
        closedTrades: existing.closedTrades + item.closedTrades,
        winningTrades: existing.winningTrades + item.winningTrades,
        losingTrades: existing.losingTrades + item.losingTrades,
        realizedPnl: existing.realizedPnl + item.realizedPnl,
        grossProfit: existing.grossProfit + item.grossProfit,
        grossLoss: existing.grossLoss + item.grossLoss,
        feesPaid: existing.feesPaid + item.feesPaid,
        openPositionCount: existing.openPositionCount + item.openPositionCount,
        openPositionQty: existing.openPositionQty + item.openPositionQty,
        unrealizedPnl: (existing.unrealizedPnl ?? 0) + (item.unrealizedPnl ?? 0),
        lastPrice: currentSignalTs >= existingSignalTs ? item.lastPrice : existing.lastPrice,
        lastSignalAt: currentSignalTs >= existingSignalTs ? item.lastSignalAt : existing.lastSignalAt,
        lastSignalDirection:
          currentSignalTs >= existingSignalTs ? item.lastSignalDirection : existing.lastSignalDirection,
        lastSignalDecisionAt:
          currentSignalTs >= existingSignalTs ? item.lastSignalDecisionAt : existing.lastSignalDecisionAt,
        lastTradeAt: currentTradeTs >= existingTradeTs ? item.lastTradeAt : existing.lastTradeAt,
        snapshotAt: toTimestamp(item.snapshotAt) >= toTimestamp(existing.snapshotAt) ? item.snapshotAt : existing.snapshotAt,
      });
    }
  }
  const symbolItems = [...symbolMap.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const symbolSummary = symbolItems.reduce(
    (acc, item) => ({
      totalSignals: acc.totalSignals + item.totalSignals,
      longEntries: acc.longEntries + item.longEntries,
      shortEntries: acc.shortEntries + item.shortEntries,
      exits: acc.exits + item.exits,
      dcaCount: acc.dcaCount + item.dcaCount,
      closedTrades: acc.closedTrades + item.closedTrades,
      winningTrades: acc.winningTrades + item.winningTrades,
      losingTrades: acc.losingTrades + item.losingTrades,
      realizedPnl: acc.realizedPnl + item.realizedPnl,
      unrealizedPnl: acc.unrealizedPnl + (item.unrealizedPnl ?? 0),
      totalPnl: acc.totalPnl + item.realizedPnl + (item.unrealizedPnl ?? 0),
      grossProfit: acc.grossProfit + item.grossProfit,
      grossLoss: acc.grossLoss + item.grossLoss,
      feesPaid: acc.feesPaid + item.feesPaid,
      openPositionCount: acc.openPositionCount + item.openPositionCount,
      openPositionQty: acc.openPositionQty + item.openPositionQty,
    }),
    {
      totalSignals: 0,
      longEntries: 0,
      shortEntries: 0,
      exits: 0,
      dcaCount: 0,
      closedTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      feesPaid: 0,
      openPositionCount: 0,
      openPositionQty: 0,
    }
  );

  const openItems = uniqueById(
    params.positionResponses.flatMap((response) => response.openItems)
  ).sort((a, b) => toTimestamp(b.openedAt) - toTimestamp(a.openedAt));
  const historyItems = uniqueById(
    params.positionResponses.flatMap((response) => response.historyItems)
  ).sort((a, b) => toTimestamp(b.closedAt) - toTimestamp(a.closedAt));
  const openOrders = uniqueById(
    params.positionResponses.flatMap((response) => response.openOrders)
  ).sort((a, b) => toTimestamp(b.submittedAt ?? b.createdAt) - toTimestamp(a.submittedAt ?? a.createdAt));

  const tradeItems = uniqueById(params.tradeResponses.flatMap((response) => response.items)).sort(
    (a, b) => toTimestamp(b.executedAt) - toTimestamp(a.executedAt)
  );

  const positionsSummary = {
    realizedPnl: historyItems.reduce((acc, item) => acc + item.realizedPnl, 0),
    unrealizedPnl: openItems.reduce((acc, item) => acc + (item.unrealizedPnl ?? 0), 0),
    feesPaid: [...openItems, ...historyItems].reduce((acc, item) => acc + item.feesPaid, 0),
  };

  return {
    sessionDetail: {
      id: "AGGREGATE",
      botId: sessions[0]?.botId ?? "",
      mode,
      status,
      startedAt,
      finishedAt,
      lastHeartbeatAt,
      stopReason: null,
      errorMessage: null,
      metadata: {
        aggregate: true,
        sessionsCount: sessions.length,
      },
      createdAt: startedAt,
      updatedAt: lastHeartbeatAt ?? finishedAt ?? startedAt,
      durationMs,
      eventsCount,
      symbolsTracked: symbolItems.length,
      summary: {
        totalSignals: symbolSummary.totalSignals,
        longEntries: symbolSummary.longEntries,
        shortEntries: symbolSummary.shortEntries,
        exits: symbolSummary.exits,
        dcaCount: symbolSummary.dcaCount,
        closedTrades: symbolSummary.closedTrades,
        winningTrades: symbolSummary.winningTrades,
        losingTrades: symbolSummary.losingTrades,
        realizedPnl: tradeItems.reduce((acc, item) => acc + item.realizedPnl, 0),
        grossProfit: symbolSummary.grossProfit,
        grossLoss: symbolSummary.grossLoss,
        feesPaid: tradeItems.reduce((acc, item) => acc + item.fee, 0),
        openPositionCount: openItems.length,
        openPositionQty: openItems.reduce((acc, item) => acc + item.quantity, 0),
      },
    },
    symbolStats: {
      sessionId: "AGGREGATE",
      items: symbolItems,
      summary: symbolSummary,
    },
    positions: {
      sessionId: "AGGREGATE",
      total: openItems.length + historyItems.length,
      openCount: openItems.length,
      closedCount: historyItems.length,
      openOrdersCount: openOrders.length,
      window: {
        startedAt,
        finishedAt: finishedAt ?? new Date().toISOString(),
      },
      summary: positionsSummary,
      openOrders,
      openItems,
      historyItems,
    },
    trades: {
      sessionId: "AGGREGATE",
      total: tradeItems.length,
      meta: {
        page: 1,
        pageSize: tradeItems.length || 1,
        total: tradeItems.length,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      },
      window: {
        startedAt,
        finishedAt: finishedAt ?? new Date().toISOString(),
      },
      items: tradeItems,
    },
  };
};

type BotsManagementProps = {
  initialTab?: "bots" | "monitoring" | "assistant";
  lockedTab?: "bots" | "monitoring" | "assistant";
  preferredBotId?: string | null;
};

export default function BotsManagement({
  initialTab = "bots",
  lockedTab,
  preferredBotId = null,
}: BotsManagementProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"bots" | "monitoring" | "assistant">(
    lockedTab ?? initialTab
  );
  const [bots, setBots] = useState<Bot[]>([]);
  const [serverSnapshot, setServerSnapshot] = useState<Record<string, Bot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [marketGroups, setMarketGroups] = useState<MarketUniverse[]>([]);

  const [name, setName] = useState("");
  const [mode, setMode] = useState<BotMode>("PAPER");
  const [paperStartBalance, setPaperStartBalance] = useState(10_000);
  const [marketFilter, setMarketFilter] = useState<"ALL" | TradeMarket>("ALL");
  const [strategyId, setStrategyId] = useState<string>("");
  const [marketGroupId, setMarketGroupId] = useState<string>("");
  const [assistantBotId, setAssistantBotId] = useState<string>("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantSaving, setAssistantSaving] = useState(false);
  const [assistantMainEnabled, setAssistantMainEnabled] = useState(false);
  const [assistantMandate, setAssistantMandate] = useState("");
  const [assistantModelProfile, setAssistantModelProfile] = useState("balanced");
  const [assistantSafetyMode, setAssistantSafetyMode] = useState<"STRICT" | "BALANCED" | "EXPERIMENTAL">("STRICT");
  const [assistantLatencyMs, setAssistantLatencyMs] = useState(2500);
  const [assistantSubagents, setAssistantSubagents] = useState<BotSubagentConfig[]>([]);
  const [assistantTrace, setAssistantTrace] = useState<AssistantDecisionTrace | null>(null);
  const [assistantDryRunSymbol, setAssistantDryRunSymbol] = useState("BTCUSDT");
  const [assistantDryRunInterval, setAssistantDryRunInterval] = useState("5m");
  const [assistantDryRunRunning, setAssistantDryRunRunning] = useState(false);

  const [monitorBotId, setMonitorBotId] = useState("");
  const [monitorViewMode, setMonitorViewMode] = useState<"aggregate" | "session">("aggregate");
  const [monitorStatus, setMonitorStatus] = useState<"ALL" | BotRuntimeSessionStatus>("ALL");
  const [monitorSymbolFilter, setMonitorSymbolFilter] = useState("");
  const [monitorAppliedSymbolFilter, setMonitorAppliedSymbolFilter] = useState("");
  const [monitorSessions, setMonitorSessions] = useState<BotRuntimeSessionListItem[]>([]);
  const [monitorSessionId, setMonitorSessionId] = useState("");
  const [monitorSessionDetail, setMonitorSessionDetail] = useState<BotRuntimeSessionDetail | null>(null);
  const [monitorSymbolStats, setMonitorSymbolStats] = useState<BotRuntimeSymbolStatsResponse | null>(null);
  const [monitorPositions, setMonitorPositions] = useState<BotRuntimePositionsResponse | null>(null);
  const [monitorTrades, setMonitorTrades] = useState<BotRuntimeTradesResponse | null>(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorSessionLoading, setMonitorSessionLoading] = useState(false);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [monitorAutoRefreshEnabled, setMonitorAutoRefreshEnabled] = useState(true);
  const [monitorLiveTickerPrices, setMonitorLiveTickerPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!lockedTab) return;
    setActiveTab(lockedTab);
  }, [lockedTab]);

  const loadBots = useCallback(async (filter: "ALL" | TradeMarket) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBots(filter === "ALL" ? undefined : filter);
      setBots(data);
      setServerSnapshot(Object.fromEntries(data.map((bot) => [bot.id, bot])));
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? t("dashboard.bots.errors.loadBots"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadBots(marketFilter);
  }, [loadBots, marketFilter]);

  useEffect(() => {
    let mounted = true;
    const loadStrategyOptions = async () => {
      try {
        const items = await listStrategies();
        if (!mounted) return;
        setStrategies(items);
        setStrategyId((prev) => prev || items[0]?.id || "");
      } catch {
        if (!mounted) return;
        setStrategies([]);
        setStrategyId("");
      }
    };
    void loadStrategyOptions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadMarketGroupOptions = async () => {
      try {
        const items = await listMarketUniverses();
        if (!mounted) return;
        setMarketGroups(items);
        setMarketGroupId((prev) => prev || items[0]?.id || "");
      } catch (err: unknown) {
        if (!mounted) return;
        setMarketGroups([]);
        toast.error(t("dashboard.bots.toasts.marketGroupsLoadFailed"), { description: getAxiosMessage(err) });
      }
    };
    void loadMarketGroupOptions();
    return () => {
      mounted = false;
    };
  }, []);

  const canCreate = useMemo(
    () =>
      name.trim().length > 0 &&
      strategyId.trim().length > 0 &&
      marketGroupId.trim().length > 0 &&
      Number.isFinite(paperStartBalance) &&
      paperStartBalance >= 0 &&
      !creating,
    [creating, marketGroupId, name, paperStartBalance, strategyId]
  );

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === strategyId) ?? null,
    [strategies, strategyId]
  );
  const selectedMarketGroup = useMemo(
    () => marketGroups.find((group) => group.id === marketGroupId) ?? null,
    [marketGroupId, marketGroups]
  );
  const selectedStrategyMaxOpenPositions = useMemo(
    () => deriveStrategyMaxOpenPositions(selectedStrategy),
    [selectedStrategy]
  );

  const assistantSlots = useMemo(
    () =>
      [1, 2, 3, 4].map((slotIndex) => {
        const existing = assistantSubagents.find((slot) => slot.slotIndex === slotIndex);
        return (
          existing ?? {
            id: `slot-${slotIndex}`,
            userId: "",
            botId: assistantBotId,
            slotIndex,
            role: "GENERAL",
            enabled: false,
            modelProfile: "balanced",
            timeoutMs: 1200,
            safetyMode: "STRICT" as const,
          }
        );
      }),
    [assistantBotId, assistantSubagents]
  );

  const selectedMonitorSession = useMemo(
    () => monitorSessions.find((session) => session.id === monitorSessionId) ?? null,
    [monitorSessionId, monitorSessions]
  );
  const monitorQuickSwitchBots = useMemo(() => {
    const active = bots.filter((bot) => bot.isActive);
    return active.length > 0 ? active : bots;
  }, [bots]);
  const selectedMonitorBot = useMemo(
    () => bots.find((bot) => bot.id === monitorBotId) ?? null,
    [bots, monitorBotId]
  );
  const monitorRuntimeCapabilityAvailable = useMemo(() => {
    if (!selectedMonitorBot) return true;
    return selectedMonitorBot.mode === "LIVE"
      ? supportsExchangeCapability(selectedMonitorBot.exchange, "LIVE_EXECUTION")
      : supportsExchangeCapability(selectedMonitorBot.exchange, "PAPER_PRICING_FEED");
  }, [selectedMonitorBot]);
  const monitorStreamSymbols = useMemo(() => {
    const fromStats = monitorSymbolStats?.items?.map((item) => item.symbol) ?? [];
    const fromPositions = monitorPositions?.openItems?.map((item) => item.symbol) ?? [];
    return [...new Set([...fromStats, ...fromPositions].map((symbol) => normalizeSymbol(symbol)))];
  }, [monitorPositions?.openItems, monitorSymbolStats?.items]);
  const monitorStreamSymbolsKey = useMemo(
    () => monitorStreamSymbols.join(","),
    [monitorStreamSymbols]
  );

  const monitorWinRate = useMemo(() => {
    const closedTrades = monitorSessionDetail?.summary.closedTrades ?? 0;
    if (closedTrades <= 0) return 0;
    const wins = monitorSessionDetail?.summary.winningTrades ?? 0;
    return (wins / closedTrades) * 100;
  }, [monitorSessionDetail]);

  const monitorOperationalTrades = useMemo(() => {
    const items = [...(monitorTrades?.items ?? [])].sort(
      (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
    );
    let cumulativePnl = 0;
    return items.map((trade, index) => {
      cumulativePnl += trade.realizedPnl;
      const capitalBase = trade.margin > 0 ? trade.margin : trade.notional;
      const pnlPct = capitalBase > 0 ? (trade.realizedPnl / capitalBase) * 100 : 0;
      const feePct = capitalBase > 0 ? (trade.fee / capitalBase) * 100 : 0;
      return {
        ...trade,
        rowNo: index + 1,
        capitalBase,
        pnlPct,
        feePct,
        cumulativePnl,
      };
    });
  }, [monitorTrades?.items]);

  const monitorOpenPositionRows = useMemo(() => {
    const initBalance =
      selectedMonitorBot?.mode === "PAPER" && selectedMonitorBot.paperStartBalance > 0
        ? selectedMonitorBot.paperStartBalance
        : null;

    return (monitorPositions?.openItems ?? []).map((position) => {
      const liveMarkPrice =
        monitorLiveTickerPrices[normalizeSymbol(position.symbol)] ?? position.markPrice ?? null;
      const openPnl =
        typeof liveMarkPrice === "number" && Number.isFinite(liveMarkPrice)
          ? (liveMarkPrice - position.entryPrice) *
            position.quantity *
            (position.side === "LONG" ? 1 : -1)
          : (position.unrealizedPnl ?? 0);
      const entryNotional = position.entryNotional;
      const marginUsed = position.leverage > 0 ? entryNotional / position.leverage : entryNotional;
      const pnlNotionalPct = entryNotional > 0 ? (openPnl / entryNotional) * 100 : 0;
      const pnlMarginPct = marginUsed > 0 ? (openPnl / marginUsed) * 100 : 0;
      const marginInitPct = initBalance && initBalance > 0 ? (marginUsed / initBalance) * 100 : null;

      return {
        ...position,
        markPrice: liveMarkPrice,
        openPnl,
        entryNotional,
        marginUsed,
        pnlNotionalPct,
        pnlMarginPct,
        marginInitPct,
      };
    });
  }, [monitorLiveTickerPrices, monitorPositions?.openItems, selectedMonitorBot]);

  const monitorShowDynamicStopColumns = useMemo(
    () =>
      monitorOpenPositionRows.some(
        (position) =>
          position.dynamicTtpStopLoss != null || position.dynamicTslStopLoss != null
      ),
    [monitorOpenPositionRows]
  );

  const monitorOpenMarginSummary = useMemo(() => {
    const totalMarginUsed = monitorOpenPositionRows.reduce((acc, item) => acc + item.marginUsed, 0);
    const totalNotional = monitorOpenPositionRows.reduce((acc, item) => acc + item.entryNotional, 0);
    const totalOpenPnl = monitorOpenPositionRows.reduce((acc, item) => acc + item.openPnl, 0);
    const initBalance =
      selectedMonitorBot?.mode === "PAPER" && selectedMonitorBot.paperStartBalance > 0
        ? selectedMonitorBot.paperStartBalance
        : null;
    const marginInitPct = initBalance && initBalance > 0 ? (totalMarginUsed / initBalance) * 100 : null;

    return {
      totalMarginUsed,
      totalNotional,
      totalOpenPnl,
      marginInitPct,
    };
  }, [monitorOpenPositionRows, selectedMonitorBot]);

  const monitorShowOpenOrders = useMemo(() => {
    const mode = monitorSessionDetail?.mode ?? selectedMonitorBot?.mode ?? null;
    return mode === "LIVE";
  }, [monitorSessionDetail?.mode, selectedMonitorBot?.mode]);

  const monitorSignalRows = useMemo(() => {
    return [...(monitorSymbolStats?.items ?? [])].sort((a, b) => {
      const aTs = Math.max(toTimestamp(a.lastSignalDecisionAt), toTimestamp(a.lastSignalAt));
      const bTs = Math.max(toTimestamp(b.lastSignalDecisionAt), toTimestamp(b.lastSignalAt));
      if (aTs !== bTs) return bTs - aTs;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [monitorSymbolStats?.items]);

  const monitorLastSignalAt = useMemo(() => {
    const timestamp = Math.max(
      0,
      ...(monitorSymbolStats?.items ?? []).map((item) =>
        toTimestamp(item.lastSignalDecisionAt ?? item.lastSignalAt ?? null)
      )
    );
    return timestamp > 0 ? new Date(timestamp).toISOString() : null;
  }, [monitorSymbolStats?.items]);

  const monitorLastTradeAt = useMemo(() => {
    const timestamp = Math.max(0, ...monitorOperationalTrades.map((trade) => toTimestamp(trade.executedAt)));
    return timestamp > 0 ? new Date(timestamp).toISOString() : null;
  }, [monitorOperationalTrades]);

  const monitorHeartbeatLagMs = useMemo(() => {
    if (!monitorSessionDetail?.lastHeartbeatAt) return null;
    const heartbeatTs = toTimestamp(monitorSessionDetail.lastHeartbeatAt);
    if (heartbeatTs <= 0) return null;
    return Math.max(0, Date.now() - heartbeatTs);
  }, [monitorSessionDetail?.lastHeartbeatAt]);

  const monitorChecklistItems = useMemo(() => {
    if (!monitorSessionDetail) return [];

    const hasSignalData = monitorSessionDetail.symbolsTracked <= 0 || monitorSignalRows.length > 0;

    return [
      {
        key: "session",
        label: t("dashboard.bots.monitoring.checklist.sessionActive"),
        ok: monitorSessionDetail.status === "RUNNING",
        note: monitorSessionDetail.status,
      },
      {
        key: "heartbeat",
        label: t("dashboard.bots.monitoring.checklist.heartbeatFresh"),
        ok: monitorHeartbeatLagMs != null && monitorHeartbeatLagMs <= 60_000,
        note: monitorHeartbeatLagMs == null ? "-" : formatDuration(monitorHeartbeatLagMs),
      },
      {
        key: "positions",
        label: t("dashboard.bots.monitoring.checklist.positionData"),
        ok: Boolean(monitorPositions),
        note: monitorPositions
          ? interpolateTemplate(t("dashboard.bots.monitoring.checklist.openCount"), {
              count: monitorPositions.openCount,
            })
          : t("dashboard.bots.monitoring.checklist.none"),
      },
      {
        key: "signals",
        label: t("dashboard.bots.monitoring.checklist.signalData"),
        ok: hasSignalData,
        note: `${monitorSignalRows.length} / ${monitorSessionDetail.symbolsTracked}`,
      },
      {
        key: "errors",
        label: t("dashboard.bots.monitoring.checklist.noSessionErrors"),
        ok: !monitorSessionDetail.errorMessage,
        note: monitorSessionDetail.errorMessage
          ? t("dashboard.bots.monitoring.checklist.reviewRequired")
          : t("dashboard.bots.monitoring.checklist.ok"),
      },
    ];
  }, [monitorHeartbeatLagMs, monitorPositions, monitorSessionDetail, monitorSignalRows.length, t]);

  const confirmLiveRisk = (message: string) => window.confirm(message);

  const loadAssistant = useCallback(async (botId: string) => {
    setAssistantLoading(true);
    try {
      const config = await getBotAssistantConfig(botId);
      setAssistantMainEnabled(config.assistant?.mainAgentEnabled ?? false);
      setAssistantMandate(config.assistant?.mandate ?? "");
      setAssistantModelProfile(config.assistant?.modelProfile ?? "balanced");
      setAssistantSafetyMode(config.assistant?.safetyMode ?? "STRICT");
      setAssistantLatencyMs(config.assistant?.maxDecisionLatencyMs ?? 2500);
      setAssistantSubagents(config.subagents ?? []);
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.assistant.toasts.loadFailed"), { description: getAxiosMessage(err) });
      setAssistantSubagents([]);
    } finally {
      setAssistantLoading(false);
    }
  }, [t]);

  const loadMonitorSessions = useCallback(
    async (
      botId: string,
      statusFilter: "ALL" | BotRuntimeSessionStatus,
      options?: { silent?: boolean }
    ): Promise<BotRuntimeSessionListItem[]> => {
      const silent = options?.silent ?? false;
      if (!botId) {
        setMonitorSessions([]);
        setMonitorSessionId("");
        setMonitorSessionDetail(null);
        setMonitorSymbolStats(null);
        setMonitorPositions(null);
        setMonitorTrades(null);
        return [];
      }

      if (!silent) {
        setMonitorLoading(true);
        setMonitorError(null);
      }
      try {
        const sessions = await listBotRuntimeSessions(botId, {
          status: statusFilter === "ALL" ? undefined : statusFilter,
          limit: 50,
        });
        setMonitorSessions(sessions);
        setMonitorSessionId((prev) => {
          const stillExists = sessions.some((item) => item.id === prev);
          if (stillExists) return prev;
          return sessions[0]?.id ?? "";
        });

        if (sessions.length === 0) {
          setMonitorSessionDetail(null);
          setMonitorSymbolStats(null);
          setMonitorPositions(null);
          setMonitorTrades(null);
        }
        return sessions;
      } catch (err: unknown) {
        if (!silent) {
          setMonitorError(getAxiosMessage(err) ?? t("dashboard.bots.errors.loadRuntimeSessions"));
        }
        return [];
      } finally {
        if (!silent) {
          setMonitorLoading(false);
        }
      }
    },
    [t]
  );

  const loadMonitorSessionData = useCallback(
    async (
      botId: string,
      sessionId: string,
      symbolFilter: string,
      options?: { silent?: boolean }
    ) => {
      const silent = options?.silent ?? false;
      if (!botId || !sessionId) {
        setMonitorSessionDetail(null);
        setMonitorSymbolStats(null);
        setMonitorPositions(null);
        setMonitorTrades(null);
        return;
      }

      const normalizedSymbol = symbolFilter.trim().toUpperCase();
      if (!silent) {
        setMonitorSessionLoading(true);
        setMonitorError(null);
      }
      try {
        const [session, symbolStats, positions, trades] = await Promise.all([
          getBotRuntimeSession(botId, sessionId),
          listBotRuntimeSessionSymbolStats(botId, sessionId, {
            symbol: normalizedSymbol || undefined,
            limit: 200,
          }),
          listBotRuntimeSessionPositions(botId, sessionId, {
            symbol: normalizedSymbol || undefined,
            limit: 200,
          }),
          listBotRuntimeSessionTrades(botId, sessionId, {
            symbol: normalizedSymbol || undefined,
            limit: 200,
          }),
        ]);
        setMonitorSessionDetail(session);
        setMonitorSymbolStats(symbolStats);
        setMonitorPositions(positions);
        setMonitorTrades(trades);
      } catch (err: unknown) {
        if (!silent) {
          setMonitorError(getAxiosMessage(err) ?? t("dashboard.bots.errors.loadRuntimeSessionData"));
        }
      } finally {
        if (!silent) {
          setMonitorSessionLoading(false);
        }
      }
    },
    [t]
  );

  const loadMonitorAggregateData = useCallback(
    async (
      botId: string,
      sessions: BotRuntimeSessionListItem[],
      symbolFilter: string,
      options?: { silent?: boolean }
    ) => {
      const silent = options?.silent ?? false;
      if (!botId || sessions.length === 0) {
        setMonitorSessionDetail(null);
        setMonitorSymbolStats(null);
        setMonitorPositions(null);
        setMonitorTrades(null);
        return;
      }

      const normalizedSymbol = symbolFilter.trim().toUpperCase();
      const scopedSessions = sessions.slice(0, 20);

      if (!silent) {
        setMonitorSessionLoading(true);
        setMonitorError(null);
      }

      try {
        const payloads = await Promise.all(
          scopedSessions.map(async (session) => {
            const [symbolStats, positions, trades] = await Promise.all([
              listBotRuntimeSessionSymbolStats(botId, session.id, {
                symbol: normalizedSymbol || undefined,
                limit: 200,
              }),
              listBotRuntimeSessionPositions(botId, session.id, {
                symbol: normalizedSymbol || undefined,
                limit: 200,
              }),
              listBotRuntimeSessionTrades(botId, session.id, {
                symbol: normalizedSymbol || undefined,
                limit: 200,
              }),
            ]);

            return {
              session,
              symbolStats,
              positions,
              trades,
            };
          })
        );

        const aggregate = aggregateMonitorData({
          sessions: payloads.map((payload) => payload.session),
          symbolResponses: payloads.map((payload) => payload.symbolStats),
          positionResponses: payloads.map((payload) => payload.positions),
          tradeResponses: payloads.map((payload) => payload.trades),
        });

        setMonitorSessionDetail(aggregate.sessionDetail);
        setMonitorSymbolStats(aggregate.symbolStats);
        setMonitorPositions(aggregate.positions);
        setMonitorTrades(aggregate.trades);
      } catch (err: unknown) {
        if (!silent) {
          setMonitorError(getAxiosMessage(err) ?? t("dashboard.bots.errors.loadAggregateMonitoring"));
        }
      } finally {
        if (!silent) {
          setMonitorSessionLoading(false);
        }
      }
    },
    [t]
  );

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setCreating(true);
    try {
      if (mode === "LIVE") {
        const accepted = confirmLiveRisk(t("dashboard.bots.confirms.liveCreate"));
        if (!accepted) return;
      }

      const created = await createBot({
        name: name.trim(),
        mode,
        paperStartBalance,
        strategyId,
        marketGroupId,
        isActive: mode === "PAPER",
        liveOptIn: false,
        consentTextVersion: null,
      });
      setBots((prev) => [created, ...prev]);
      setServerSnapshot((prev) => ({ ...prev, [created.id]: created }));
      setName("");
      setMode("PAPER");
      setPaperStartBalance(10_000);
      setStrategyId((prev) => prev || strategies[0]?.id || "");
      setMarketGroupId((prev) => prev || marketGroups[0]?.id || "");
      toast.success(t("dashboard.bots.toasts.created"));
      await loadBots(marketFilter);
    } catch (err: unknown) {
      const message = getAxiosMessage(err);
      if (message === DUPLICATE_ACTIVE_BOT_ERROR) {
        toast.error(t("dashboard.bots.toasts.duplicateActiveTitle"), {
          description: t("dashboard.bots.toasts.duplicateActiveDescription"),
        });
      } else {
        toast.error(t("dashboard.bots.toasts.createFailed"), { description: message });
      }
    } finally {
      setCreating(false);
    }
  };

  const patchBot = (id: string, patch: Partial<Bot>) => {
    setBots((prev) => prev.map((bot) => (bot.id === id ? { ...bot, ...patch } : bot)));
  };

  const handleSave = async (bot: Bot) => {
    const previous = serverSnapshot[bot.id];
    const effectiveLiveOptIn = bot.mode === "LIVE" ? bot.liveOptIn : false;
    const enteringLiveMode = !!previous && previous.mode !== "LIVE" && bot.mode === "LIVE";
    const enablingLiveOptIn = !!previous && !previous.liveOptIn && effectiveLiveOptIn;
    const activatingLiveBot =
      !!previous && !previous.isActive && bot.isActive && (bot.mode === "LIVE" || effectiveLiveOptIn);

    if (enteringLiveMode || enablingLiveOptIn || activatingLiveBot) {
      const accepted = confirmLiveRisk(t("dashboard.bots.confirms.liveSave"));
      if (!accepted) {
        patchBot(bot.id, previous);
        return;
      }
    }

    setSavingId(bot.id);
    try {
      const updated = await updateBot(bot.id, {
        name: bot.name,
        mode: bot.mode,
        isActive: bot.isActive,
        liveOptIn: effectiveLiveOptIn,
        consentTextVersion: effectiveLiveOptIn ? LIVE_CONSENT_TEXT_VERSION : null,
        paperStartBalance: bot.paperStartBalance,
        strategyId: bot.strategyId ?? null,
      });
      patchBot(bot.id, updated);
      setServerSnapshot((prev) => ({ ...prev, [bot.id]: updated }));
      toast.success(t("dashboard.bots.toasts.updated"));
    } catch (err: unknown) {
      const message = getAxiosMessage(err);
      if (message === DUPLICATE_ACTIVE_BOT_ERROR) {
        toast.error(t("dashboard.bots.toasts.activeConflictTitle"), {
          description: t("dashboard.bots.toasts.activeConflictDescription"),
        });
      } else {
        toast.error(t("dashboard.bots.toasts.saveFailed"), { description: message });
      }
      void loadBots(marketFilter);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (bot: Bot) => {
    if (bot.mode === "LIVE" || bot.liveOptIn || bot.isActive) {
      const accepted = confirmLiveRisk(t("dashboard.bots.confirms.liveDelete"));
      if (!accepted) return;
    }

    setDeletingId(bot.id);
    try {
      await deleteBot(bot.id);
      await loadBots(marketFilter);
      toast.success(t("dashboard.bots.toasts.deleted"));
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.toasts.deleteFailed"), { description: getAxiosMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveAssistantMain = async () => {
    if (!assistantBotId) return;
    setAssistantSaving(true);
    try {
      await upsertBotAssistantConfig(assistantBotId, {
        mainAgentEnabled: assistantMainEnabled,
        mandate: assistantMandate || null,
        modelProfile: assistantModelProfile,
        safetyMode: assistantSafetyMode,
        maxDecisionLatencyMs: assistantLatencyMs,
      });
      toast.success(t("dashboard.bots.assistant.toasts.mainSaved"));
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.assistant.toasts.mainSaveFailed"), { description: getAxiosMessage(err) });
    } finally {
      setAssistantSaving(false);
    }
  };

  const handleSaveSubagent = async (slot: BotSubagentConfig) => {
    if (!assistantBotId) return;
    setAssistantSaving(true);
    try {
      await upsertBotSubagentConfig(assistantBotId, slot.slotIndex, {
        role: slot.role,
        enabled: slot.enabled,
        modelProfile: slot.modelProfile,
        timeoutMs: slot.timeoutMs,
        safetyMode: slot.safetyMode,
      });
      toast.success(interpolateTemplate(t("dashboard.bots.assistant.toasts.slotSaved"), { slot: slot.slotIndex }));
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.assistant.toasts.slotSaveFailed"), { description: getAxiosMessage(err) });
    } finally {
      setAssistantSaving(false);
    }
  };

  const handleClearSubagent = async (slotIndex: number) => {
    if (!assistantBotId) return;
    setAssistantSaving(true);
    try {
      await deleteBotSubagentConfig(assistantBotId, slotIndex);
      toast.success(interpolateTemplate(t("dashboard.bots.assistant.toasts.slotDeleted"), { slot: slotIndex }));
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.assistant.toasts.slotDeleteFailed"), { description: getAxiosMessage(err) });
    } finally {
      setAssistantSaving(false);
    }
  };

  const handleRunAssistantDryRun = async () => {
    if (!assistantBotId) return;
    setAssistantDryRunRunning(true);
    try {
      const trace = await runBotAssistantDryRun(assistantBotId, {
        symbol: assistantDryRunSymbol,
        intervalWindow: assistantDryRunInterval,
        mode: "PAPER",
      });
      setAssistantTrace(trace);
      toast.success(t("dashboard.bots.assistant.toasts.dryRunReady"));
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.assistant.toasts.dryRunFailed"), { description: getAxiosMessage(err) });
    } finally {
      setAssistantDryRunRunning(false);
    }
  };

  const handleApplyMonitoringFilter = () => {
    setMonitorAppliedSymbolFilter(monitorSymbolFilter.trim().toUpperCase());
  };

  const handleClearMonitoringFilter = () => {
    setMonitorSymbolFilter("");
    setMonitorAppliedSymbolFilter("");
  };

  const refreshMonitoring = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!monitorBotId) return;
      const sessions = await loadMonitorSessions(monitorBotId, monitorStatus, options);
      if (monitorViewMode === "aggregate") {
        await loadMonitorAggregateData(monitorBotId, sessions, monitorAppliedSymbolFilter, options);
        return;
      }
      const effectiveSessionId = monitorSessionId || sessions[0]?.id;
      if (!effectiveSessionId) {
        setMonitorSessionDetail(null);
        setMonitorSymbolStats(null);
        setMonitorPositions(null);
        setMonitorTrades(null);
        return;
      }
      await loadMonitorSessionData(monitorBotId, effectiveSessionId, monitorAppliedSymbolFilter, options);
    },
    [
      loadMonitorAggregateData,
      loadMonitorSessionData,
      loadMonitorSessions,
      monitorAppliedSymbolFilter,
      monitorBotId,
      monitorSessionId,
      monitorStatus,
      monitorViewMode,
    ]
  );

  useEffect(() => {
    if (bots.length === 0) return;
    const preferredCandidate =
      preferredBotId && bots.some((bot) => bot.id === preferredBotId) ? preferredBotId : null;
    const fallbackBotId = preferredCandidate ?? bots[0].id;
    if (!assistantBotId) {
      setAssistantBotId(fallbackBotId);
      return;
    }
    const exists = bots.some((bot) => bot.id === assistantBotId);
    if (!exists || (preferredCandidate && assistantBotId !== preferredCandidate)) {
      setAssistantBotId(fallbackBotId);
    }
  }, [bots, assistantBotId, preferredBotId]);

  useEffect(() => {
    if (!assistantBotId || activeTab !== "assistant") return;
    void loadAssistant(assistantBotId);
  }, [assistantBotId, activeTab, loadAssistant]);

  useEffect(() => {
    if (bots.length === 0) {
      setMonitorBotId("");
      return;
    }
    const preferredCandidate =
      preferredBotId && bots.some((bot) => bot.id === preferredBotId) ? preferredBotId : null;
    const fallbackBotId = preferredCandidate ?? bots[0].id;

    if (!monitorBotId) {
      setMonitorBotId(fallbackBotId);
      return;
    }

    const exists = bots.some((bot) => bot.id === monitorBotId);
    if (!exists || (preferredCandidate && monitorBotId !== preferredCandidate)) {
      setMonitorBotId(fallbackBotId);
    }
  }, [bots, monitorBotId, preferredBotId]);

  useEffect(() => {
    if ((activeTab === "monitoring" || activeTab === "assistant") && marketFilter !== "ALL") {
      setMarketFilter("ALL");
    }
  }, [activeTab, marketFilter]);

  useEffect(() => {
    if (activeTab !== "monitoring" || !monitorBotId) return;
    void refreshMonitoring();
  }, [activeTab, monitorBotId, refreshMonitoring]);

  useEffect(() => {
    if (activeTab !== "monitoring" || !monitorAutoRefreshEnabled || !monitorBotId) return;

    const intervalId = window.setInterval(() => {
      void refreshMonitoring({ silent: true });
    }, MONITOR_AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    activeTab,
    monitorAutoRefreshEnabled,
    monitorBotId,
    refreshMonitoring,
  ]);

  useEffect(() => {
    setMonitorLiveTickerPrices({});
  }, [monitorBotId, monitorSessionId, monitorViewMode]);

  useEffect(() => {
    if (activeTab !== "monitoring" || !monitorBotId) return;
    if (!monitorStreamSymbolsKey) return;
    if (typeof window === "undefined" || typeof window.EventSource === "undefined") return;

    const source = createMarketStreamEventSource({
      symbols: monitorStreamSymbols,
      interval: "1m",
    });

    source.addEventListener("ticker", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as TickerEventPayload;
        if (!data?.symbol || !Number.isFinite(data.lastPrice)) return;
        const symbolKey = normalizeSymbol(data.symbol);
        setMonitorLiveTickerPrices((prev) => {
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
  }, [activeTab, monitorBotId, monitorStreamSymbols, monitorStreamSymbolsKey]);

  return (
    <div className="space-y-5">
      {!lockedTab ? (
        <div role="tablist" className="tabs tabs-boxed inline-flex gap-1">
          <button
            type="button"
            role="tab"
            className={`tab ${activeTab === "bots" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("bots")}
          >
            {t("dashboard.bots.tabs.bots")}
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${activeTab === "monitoring" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("monitoring")}
          >
            {t("dashboard.bots.tabs.monitoring")}
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${activeTab === "assistant" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("assistant")}
          >
            {t("dashboard.bots.tabs.assistant")}
          </button>
        </div>
      ) : null}

      {activeTab === "bots" && (
        <>
      <form onSubmit={handleCreate} className="rounded-box border border-base-300/60 bg-base-200/60 p-4">
        <h2 className="text-lg font-semibold">{t("dashboard.bots.create.title")}</h2>
        <p className="text-sm opacity-70">{t("dashboard.bots.create.description")}</p>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <section className="rounded-lg border border-base-300 bg-base-100 p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{t("dashboard.bots.create.sectionBasics")}</p>
            <div className="mt-2 space-y-3">
              <label className={FIELD_WRAPPER_CLASS}>
                <span className="label-text">{t("dashboard.bots.create.nameLabel")}</span>
                <input
                  className="input input-bordered"
                  placeholder={t("dashboard.bots.create.namePlaceholder")}
                  aria-label={t("dashboard.bots.create.nameAria")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className={FIELD_WRAPPER_CLASS}>
                <span className="label-text">{t("dashboard.bots.create.modeLabel")}</span>
                <select
                  className="select select-bordered"
                  aria-label={t("dashboard.bots.create.modeAria")}
                  value={mode}
                  onChange={(event) => setMode(event.target.value as BotMode)}
                >
                  <option value="PAPER">PAPER</option>
                  <option value="LIVE">LIVE</option>
                </select>
              </label>
              {mode === "PAPER" ? (
                <label className={FIELD_WRAPPER_CLASS}>
                  <span className="label-text">{t("dashboard.bots.create.paperBalanceLabel")}</span>
                  <input
                    type="number"
                    min={0}
                    max={100000000}
                    className="input input-bordered"
                    aria-label={t("dashboard.bots.create.paperBalanceAria")}
                    value={paperStartBalance}
                    onChange={(event) =>
                      setPaperStartBalance(Number.isFinite(Number(event.target.value)) ? Number(event.target.value) : 0)
                    }
                  />
                </label>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-base-300 bg-base-100 p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{t("dashboard.bots.create.sectionMarket")}</p>
            <div className="mt-2 space-y-3">
              <label className={FIELD_WRAPPER_CLASS}>
                <span className="label-text">{t("dashboard.bots.create.marketGroupLabel")}</span>
                <select
                  className="select select-bordered"
                  aria-label={t("dashboard.bots.create.marketGroupAria")}
                  value={marketGroupId}
                  onChange={(event) => setMarketGroupId(event.target.value)}
                  disabled={marketGroups.length === 0}
                >
                  {marketGroups.length === 0 ? <option value="">{t("dashboard.bots.create.noMarketGroups")}</option> : null}
                  {marketGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.exchange ?? "BINANCE"} Â· {group.marketType}/{group.baseCurrency})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <div className={META_CARD_CLASS}>
                  <p className="uppercase tracking-wide opacity-60">{t("dashboard.bots.create.marketSummaryLabel")}</p>
                  <p className="font-medium">
                    {selectedMarketGroup
                      ? `${selectedMarketGroup.exchange ?? "BINANCE"} Â· ${selectedMarketGroup.marketType}/${selectedMarketGroup.baseCurrency}`
                      : "-"}
                  </p>
                </div>
                <div className={META_CARD_CLASS}>
                  <p className="uppercase tracking-wide opacity-60">{t("dashboard.bots.create.whitelistLabel")}</p>
                  <p className="font-medium">{selectedMarketGroup?.whitelist?.length ?? 0}</p>
                </div>
                <div className={META_CARD_CLASS}>
                  <p className="uppercase tracking-wide opacity-60">{t("dashboard.bots.create.blacklistLabel")}</p>
                  <p className="font-medium">{selectedMarketGroup?.blacklist?.length ?? 0}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-base-300 bg-base-100 p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{t("dashboard.bots.create.sectionStrategy")}</p>
            <div className="mt-2 space-y-3">
              <label className={FIELD_WRAPPER_CLASS}>
                <span className="label-text">{t("dashboard.bots.create.strategyLabel")}</span>
                <select
                  className="select select-bordered"
                  aria-label={t("dashboard.bots.create.strategyAria")}
                  value={strategyId}
                  onChange={(event) => setStrategyId(event.target.value)}
                  disabled={strategies.length === 0}
                >
                  {strategies.length === 0 ? <option value="">{t("dashboard.bots.create.noStrategies")}</option> : null}
                  {strategies.map((strategy) => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <div className={META_CARD_CLASS}>
                  <p className="uppercase tracking-wide opacity-60">{t("dashboard.bots.create.intervalLabel")}</p>
                  <p className="font-medium">{selectedStrategy?.interval ?? "-"}</p>
                </div>
                <div className={META_CARD_CLASS}>
                  <p className="uppercase tracking-wide opacity-60">{t("dashboard.bots.create.leverageLabel")}</p>
                  <p className="font-medium">
                    {typeof selectedStrategy?.leverage === "number" ? `${selectedStrategy.leverage}x` : "-"}
                  </p>
                </div>
                <div className={META_CARD_CLASS}>
                  <p className="uppercase tracking-wide opacity-60">{t("dashboard.bots.create.maxOpenLabel")}</p>
                  <p className="font-medium">{selectedStrategy ? selectedStrategyMaxOpenPositions : "-"}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn btn-primary btn-sm" disabled={!canCreate}>
            {creating ? t("dashboard.bots.create.creatingCta") : t("dashboard.bots.create.createCta")}
          </button>
        </div>
      </form>

      {loading && <LoadingState title={t("dashboard.bots.states.loadingBots")} />}
      {!loading && error && (
        <ErrorState
          title={t("dashboard.bots.states.loadBotsFailedTitle")}
          description={error}
          retryLabel={t("dashboard.bots.states.retry")}
          onRetry={() => void loadBots(marketFilter)}
        />
      )}
      {!loading && !error && bots.length === 0 && (
        <EmptyState
          title={t("dashboard.bots.states.emptyTitle")}
          description={t("dashboard.bots.states.emptyDescription")}
        />
      )}

      {!loading && !error && bots.length > 0 && (
        <div className="space-y-3">
          <SuccessState
            title={t("dashboard.bots.states.successTitle")}
            description={interpolateTemplate(
              t(bots.length === 1 ? "dashboard.bots.states.successDescriptionOne" : "dashboard.bots.states.successDescriptionMany"),
              { count: bots.length }
            )}
          />
          <div className="flex justify-end">
            <label className="form-control w-48">
              <span className="label-text text-xs">{t("dashboard.bots.list.marketFilterLabel")}</span>
              <select
                className="select select-bordered select-sm"
                aria-label={t("dashboard.bots.list.marketFilterAria")}
                value={marketFilter}
                onChange={(event) => setMarketFilter(event.target.value as "ALL" | TradeMarket)}
              >
                <option value="ALL">{t("dashboard.bots.list.allMarkets")}</option>
                <option value="FUTURES">FUTURES</option>
                <option value="SPOT">SPOT</option>
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>{t("dashboard.bots.list.columns.name")}</th>
                  <th>{t("dashboard.bots.list.columns.market")}</th>
                  <th>{t("dashboard.bots.list.columns.position")}</th>
                  <th>{t("dashboard.bots.list.columns.strategy")}</th>
                  <th>{t("dashboard.bots.list.columns.status")}</th>
                  <th>{t("dashboard.bots.list.columns.mode")}</th>
                  <th>{t("dashboard.bots.list.columns.paperBalance")}</th>
                  <th>{t("dashboard.bots.list.columns.maxPositions")}</th>
                  <th>{t("dashboard.bots.list.columns.liveOptIn")}</th>
                  <th>{t("dashboard.bots.list.columns.active")}</th>
                  <th>{t("dashboard.bots.list.columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot) => {
                  const risk = toRiskBadge(bot);
                  return (
                    <tr key={bot.id}>
                      <td>
                        <input
                          className="input input-bordered input-sm w-full min-w-40"
                          value={bot.name}
                          onChange={(event) => patchBot(bot.id, { name: event.target.value })}
                        />
                      </td>
                      <td>
                        <span className="text-xs opacity-70">{bot.exchange} - {bot.marketType}</span>
                      </td>
                      <td>
                        <span className="text-xs opacity-70">{bot.positionMode}</span>
                      </td>
                      <td>
                        <select
                          className="select select-bordered select-xs w-full min-w-48"
                          value={bot.strategyId ?? ""}
                          onChange={(event) =>
                            patchBot(bot.id, { strategyId: event.target.value || null })
                          }
                        >
                          <option value="">{t("dashboard.bots.list.noneOption")}</option>
                          {strategies.map((strategy) => (
                            <option key={strategy.id} value={strategy.id}>
                              {strategy.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <StatusBadge kind="risk" value={risk.value} label={t(risk.labelKey)} />
                      </td>
                      <td>
                        <div className="space-y-1">
                          <StatusBadge
                            kind="mode"
                            value={toModeBadge(bot.mode)}
                            label={interpolateTemplate(t("dashboard.bots.list.modeLabel"), { mode: bot.mode })}
                          />
                          <select
                            className="select select-bordered select-xs w-full"
                            value={bot.mode}
                            onChange={(event) => {
                              const nextMode = event.target.value as BotMode;
                              patchBot(bot.id, {
                                mode: nextMode,
                                liveOptIn: nextMode === "LIVE" ? bot.liveOptIn : false,
                              });
                            }}
                          >
                            <option value="PAPER">PAPER</option>
                            <option value="LIVE">LIVE</option>
                          </select>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={100000000}
                          className="input input-bordered input-sm w-28"
                          value={bot.paperStartBalance}
                          disabled={bot.mode === "LIVE"}
                          onChange={(event) =>
                            patchBot(bot.id, {
                              paperStartBalance: Number.isFinite(Number(event.target.value))
                                ? Number(event.target.value)
                                : 0,
                            })
                          }
                        />
                      </td>
                      <td>
                        <span className="text-xs opacity-70">{bot.maxOpenPositions}</span>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="toggle toggle-warning toggle-sm"
                          checked={bot.mode === "LIVE" ? bot.liveOptIn : false}
                          disabled={bot.mode !== "LIVE"}
                          onChange={(event) => patchBot(bot.id, { liveOptIn: event.target.checked })}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="toggle toggle-success toggle-sm"
                          checked={bot.isActive}
                          onChange={(event) => patchBot(bot.id, { isActive: event.target.checked })}
                        />
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            disabled={savingId === bot.id}
                            onClick={() => void handleSave(bot)}
                          >
                            {savingId === bot.id ? t("dashboard.bots.list.saving") : t("dashboard.bots.list.save")}
                          </button>
                          <button
                            type="button"
                            className="btn btn-error btn-xs"
                            disabled={deletingId === bot.id}
                            onClick={() => void handleDelete(bot)}
                          >
                            {deletingId === bot.id ? t("dashboard.bots.list.deleting") : t("dashboard.bots.list.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {bots.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center text-sm opacity-70">
                      {t("dashboard.bots.list.noBotsForFilter")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {activeTab === "monitoring" && (
        <div className="space-y-4 rounded-box border border-base-300/60 bg-base-200/60 p-4">
          <h2 className="text-lg font-semibold">{t("dashboard.bots.monitoring.title")}</h2>
          <p className="text-sm opacity-70">{t("dashboard.bots.monitoring.description")}</p>

          {bots.length === 0 ? (
            <EmptyState
              title={t("dashboard.bots.monitoring.emptyBotsTitle")}
              description={t("dashboard.bots.monitoring.emptyBotsDescription")}
            />
          ) : (
            <>
              <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t("dashboard.bots.monitoring.quickContextTitle")}</h3>
                  <span className="text-xs opacity-60">
                    {interpolateTemplate(t("dashboard.bots.monitoring.cardsCount"), {
                      count: monitorQuickSwitchBots.length,
                    })}
                    {bots.some((bot) => bot.isActive)
                      ? t("dashboard.bots.monitoring.cardsActiveSuffix")
                      : t("dashboard.bots.monitoring.cardsAllSuffix")}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {monitorQuickSwitchBots.map((bot) => (
                    <button
                      key={bot.id}
                      type="button"
                      className={`rounded-md border p-2 text-left transition-colors ${
                        monitorBotId === bot.id
                          ? "border-primary bg-primary/10"
                          : "border-base-300 bg-base-200 hover:border-primary/50"
                      }`}
                      onClick={() => setMonitorBotId(bot.id)}
                    >
                      <p className="truncate text-sm font-semibold">{bot.name}</p>
                      <p className="mt-1 text-[11px] opacity-70">
                        {bot.exchange} - {bot.marketType} | {bot.mode} | {bot.isActive ? t("dashboard.bots.monitoring.active") : t("dashboard.bots.monitoring.inactive")}
                      </p>
                      {!((bot.mode === "LIVE"
                        ? supportsExchangeCapability(bot.exchange, "LIVE_EXECUTION")
                        : supportsExchangeCapability(bot.exchange, "PAPER_PRICING_FEED"))) ? (
                        <div className="mt-1">
                          <span className="badge badge-xs badge-warning badge-outline">
                            {t("dashboard.bots.list.placeholderBadge")}
                          </span>
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{t("dashboard.bots.monitoring.controlsTitle")}</h3>
                    <p className="text-xs opacity-70">{t("dashboard.bots.monitoring.controlsDescription")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="label cursor-pointer gap-2 p-0">
                      <input
                        type="checkbox"
                        className="toggle toggle-sm"
                        aria-label={t("dashboard.bots.monitoring.autoRefreshAria")}
                        checked={monitorAutoRefreshEnabled}
                        onChange={(event) => setMonitorAutoRefreshEnabled(event.target.checked)}
                      />
                      <span className="label-text text-xs">{t("dashboard.bots.monitoring.autoRefreshLabel")}</span>
                    </label>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => void refreshMonitoring()}>
                      {t("dashboard.bots.monitoring.refresh")}
                    </button>
                  </div>
                </div>

                {!monitorRuntimeCapabilityAvailable && selectedMonitorBot ? (
                  <div className="alert alert-warning text-sm">
                    <div className="space-y-1">
                      <span className="badge badge-xs badge-warning badge-outline">
                        {t("dashboard.bots.list.placeholderBadge")}
                      </span>
                      <span>
                        {selectedMonitorBot.exchange}:{" "}
                        {t("dashboard.bots.create.placeholderActivationHint").replace(
                          "{mode}",
                          selectedMonitorBot.mode
                        )}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-6">
                  <label className="form-control">
                    <span className="label-text">{t("dashboard.bots.monitoring.sessionStatusLabel")}</span>
                    <select
                      className="select select-bordered"
                      value={monitorStatus}
                      onChange={(event) => setMonitorStatus(event.target.value as "ALL" | BotRuntimeSessionStatus)}
                    >
                      <option value="ALL">{t("dashboard.bots.monitoring.sessionStatusAll")}</option>
                      <option value="RUNNING">RUNNING</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="FAILED">FAILED</option>
                      <option value="CANCELED">CANCELED</option>
                    </select>
                  </label>
                  <label className="form-control md:col-span-2">
                    <span className="label-text">{t("dashboard.bots.monitoring.symbolFilterLabel")}</span>
                    <input
                      className="input input-bordered"
                      placeholder={t("dashboard.bots.monitoring.symbolFilterPlaceholder")}
                      value={monitorSymbolFilter}
                      onChange={(event) => setMonitorSymbolFilter(event.target.value.toUpperCase())}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleApplyMonitoringFilter();
                        }
                      }}
                    />
                    <p className="mt-1 text-[11px] opacity-65">
                      {t("dashboard.bots.monitoring.symbolFilterHint")}
                    </p>
                  </label>
                  <div className="form-control">
                    <span className="label-text">&nbsp;</span>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleApplyMonitoringFilter}>
                        {t("dashboard.bots.monitoring.applyFilter")}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={handleClearMonitoringFilter}>
                        {t("dashboard.bots.monitoring.clearFilter")}
                      </button>
                    </div>
                  </div>
                  <div className="form-control md:col-span-2">
                    <span className="label-text">{t("dashboard.bots.monitoring.activeFilterLabel")}</span>
                    <div className="rounded-md border border-base-300 bg-base-200 px-3 py-2 text-sm">
                      {monitorAppliedSymbolFilter || t("dashboard.bots.monitoring.none")}
                    </div>
                  </div>
                </div>

                <p className="rounded-md border border-base-300 bg-base-200 px-3 py-2 text-xs opacity-75" aria-live="polite">
                  {monitorViewMode === "aggregate"
                    ? t("dashboard.bots.monitoring.autoRefreshAggregate")
                    : selectedMonitorSession?.status === "RUNNING"
                      ? t("dashboard.bots.monitoring.autoRefreshCurrentSession")
                      : t("dashboard.bots.monitoring.autoRefreshSelectedSession")}
                </p>

                <details className="rounded-md border border-base-300 bg-base-200">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                    {t("dashboard.bots.monitoring.advancedOptions")}
                  </summary>
                  <div className="grid gap-3 border-t border-base-300 p-3 md:grid-cols-6">
                    <label className="form-control md:col-span-2">
                      <span className="label-text">{t("dashboard.bots.monitoring.botManualLabel")}</span>
                      <select
                        className="select select-bordered"
                        value={monitorBotId}
                        onChange={(event) => setMonitorBotId(event.target.value)}
                      >
                        {bots.map((bot) => (
                          <option key={bot.id} value={bot.id}>
                            {bot.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-control">
                      <span className="label-text">{t("dashboard.bots.monitoring.viewLabel")}</span>
                      <select
                        className="select select-bordered"
                        value={monitorViewMode}
                        onChange={(event) => setMonitorViewMode(event.target.value as "aggregate" | "session")}
                      >
                        <option value="aggregate">{t("dashboard.bots.monitoring.viewAggregate")}</option>
                        <option value="session">{t("dashboard.bots.monitoring.viewSession")}</option>
                      </select>
                    </label>
                    {monitorViewMode === "session" ? (
                      <label className="form-control md:col-span-3">
                        <span className="label-text">{t("dashboard.bots.monitoring.sessionLabel")}</span>
                        <select
                          className="select select-bordered"
                          value={monitorSessionId}
                          onChange={(event) => setMonitorSessionId(event.target.value)}
                          disabled={monitorSessions.length === 0}
                        >
                          {monitorSessions.length === 0 ? <option value="">{t("dashboard.bots.monitoring.noSessionsOption")}</option> : null}
                          {monitorSessions.map((session) => (
                            <option key={session.id} value={session.id}>
                              {session.id.slice(0, 8)} | {session.status} | {formatDateTime(session.startedAt)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="form-control md:col-span-3">
                        <span className="label-text">{t("dashboard.bots.monitoring.scopeLabel")}</span>
                        <div className="rounded-box border border-base-300/60 bg-base-100/70 px-3 py-2 text-sm">
                          {interpolateTemplate(t("dashboard.bots.monitoring.scopeAllSessions"), {
                            count: monitorSessions.length,
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>

              <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-65">{t("dashboard.bots.monitoring.quickNavTitle")}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <a href="#monitor-now" className="btn btn-outline btn-xs">
                    {t("dashboard.bots.monitoring.quickNavNow")}
                  </a>
                  <a href="#monitor-history" className="btn btn-outline btn-xs">
                    {t("dashboard.bots.monitoring.quickNavHistory")}
                  </a>
                  <a href="#monitor-future" className="btn btn-outline btn-xs">
                    {t("dashboard.bots.monitoring.quickNavFuture")}
                  </a>
                </div>
                <p className="mt-2 text-[11px] opacity-65">
                  {t("dashboard.bots.monitoring.quickNavDescription")}
                </p>
              </div>

              {monitorLoading ? <LoadingState title={t("dashboard.bots.monitoring.loadingSessions")} /> : null}
              {!monitorLoading && monitorError ? (
                <ErrorState
                  title={t("dashboard.bots.monitoring.loadErrorTitle")}
                  description={monitorError}
                  retryLabel={t("dashboard.bots.states.retry")}
                  onRetry={() => {
                    if (!monitorBotId) return;
                    void refreshMonitoring();
                  }}
                />
              ) : null}

              {!monitorLoading && !monitorError && monitorSessions.length === 0 ? (
                <EmptyState
                  title={t("dashboard.bots.monitoring.emptySessionsTitle")}
                  description={t("dashboard.bots.monitoring.emptySessionsDescription")}
                />
              ) : null}

              {!monitorLoading && !monitorError && monitorSessionDetail ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${toSessionStatusBadgeClass(monitorSessionDetail.status)}`}>
                        {monitorSessionDetail.status}
                      </span>
                      <span className="badge badge-outline">
                        {interpolateTemplate(t("dashboard.bots.monitoring.sessionModeBadge"), {
                          mode: monitorSessionDetail.mode,
                        })}
                      </span>
                      {monitorViewMode === "aggregate" ? (
                        <span className="text-xs opacity-70">
                          {interpolateTemplate(t("dashboard.bots.monitoring.sessionsBadge"), {
                            count: monitorSessions.length,
                          })}
                        </span>
                      ) : (
                        <span className="text-xs opacity-70">
                          {interpolateTemplate(t("dashboard.bots.monitoring.sessionIdBadge"), {
                            id: (selectedMonitorSession?.id ?? monitorSessionDetail.id).slice(0, 8),
                          })}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      <p>
                        <span className="opacity-60">{t("dashboard.bots.monitoring.startLabel")}</span>{" "}
                        {formatDateTime(monitorSessionDetail.startedAt)}
                      </p>
                      <p>
                        <span className="opacity-60">{t("dashboard.bots.monitoring.endLabel")}</span>{" "}
                        {formatDateTime(monitorSessionDetail.finishedAt)}
                      </p>
                      <p>
                        <span className="opacity-60">{t("dashboard.bots.monitoring.heartbeatLabel")}</span>{" "}
                        {formatDateTime(monitorSessionDetail.lastHeartbeatAt)}
                      </p>
                      <p>
                        <span className="opacity-60">{t("dashboard.bots.monitoring.durationLabel")}</span>{" "}
                        {formatDuration(monitorSessionDetail.durationMs)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{t("dashboard.bots.monitoring.checklist.title")}</h3>
                      <span className="text-xs opacity-60">
                        {interpolateTemplate(t("dashboard.bots.monitoring.checklist.summary"), {
                          ok: monitorChecklistItems.filter((item) => item.ok).length,
                          total: monitorChecklistItems.length,
                        })}
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      {monitorChecklistItems.map((item) => (
                        <div key={item.key} className="rounded-md border border-base-300 bg-base-200 px-2 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{item.label}</span>
                            <span className={`badge badge-xs ${item.ok ? "badge-success" : "badge-warning"}`}>
                              {item.ok
                                ? t("dashboard.bots.monitoring.checklist.ok")
                                : t("dashboard.bots.monitoring.checklist.check")}
                            </span>
                          </div>
                          <p className="mt-1 opacity-65">{item.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {monitorSessionLoading ? <LoadingState title={t("dashboard.bots.monitoring.loadingSessionData")} /> : null}

                  {monitorSessionDetail ? (
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-65">{t("dashboard.bots.monitoring.nowTitle")}</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p>
                            <span className="opacity-60">{t("dashboard.bots.monitoring.openPositionsLabel")}</span>{" "}
                            <span className="font-semibold">{monitorPositions?.openCount ?? 0}</span>
                          </p>
                          <p>
                            <span className="opacity-60">{t("dashboard.bots.monitoring.openOrdersLabel")}</span>{" "}
                            <span className="font-semibold">
                              {monitorPositions?.openOrdersCount ?? monitorPositions?.openOrders?.length ?? 0}
                            </span>
                          </p>
                          <p>
                            <span className="opacity-60">{t("dashboard.bots.monitoring.openPnlLabel")}</span>{" "}
                            <span
                              className={`font-semibold ${
                                monitorOpenMarginSummary.totalOpenPnl >= 0 ? "text-success" : "text-error"
                              }`}
                            >
                              {formatCurrency(monitorOpenMarginSummary.totalOpenPnl)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-65">{t("dashboard.bots.monitoring.wasTitle")}</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p>
                            <span className="opacity-60">{t("dashboard.bots.monitoring.closedTradesLabel")}</span>{" "}
                            <span className="font-semibold">{monitorSessionDetail.summary.closedTrades}</span>
                          </p>
                          <p>
                            <span className="opacity-60">{t("dashboard.bots.monitoring.winRateLabel")}</span>{" "}
                            <span className="font-semibold">{formatNumber(monitorWinRate, 2)}%</span>
                          </p>
                          <p>
                            <span className="opacity-60">{t("dashboard.bots.monitoring.realizedPnlLabel")}</span>{" "}
                            <span
                              className={`font-semibold ${
                                monitorSessionDetail.summary.realizedPnl >= 0 ? "text-success" : "text-error"
                              }`}
                            >
                              {formatCurrency(monitorSessionDetail.summary.realizedPnl)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-65">{t("dashboard.bots.monitoring.futureTitle")}</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p>
                            <span className="opacity-60">{t("dashboard.bots.monitoring.trackedSymbolsLabel")}</span>{" "}
                            <span className="font-semibold">{monitorSymbolStats?.items.length ?? 0}</span>
                          </p>
                          <p>
                            <span className="opacity-60">{t("dashboard.bots.monitoring.signalsLabel")}</span>{" "}
                            <span className="font-semibold">{monitorSessionDetail.summary.totalSignals}</span>
                          </p>
                          <p>
                            <span className="opacity-60">{t("dashboard.bots.monitoring.dcaLabel")}</span>{" "}
                            <span className="font-semibold">{monitorSessionDetail.summary.dcaCount}</span>
                          </p>
                          <p>
                            <span className="opacity-60">{t("dashboard.bots.monitoring.feesLabel")}</span>{" "}
                            <span className="font-semibold">{formatCurrency(monitorSessionDetail.summary.feesPaid)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {monitorSessionDetail ? (
                    <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-65">
                        {t("dashboard.bots.monitoring.operatorCheckTitle")}
                      </p>
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                          <p className="opacity-60">{t("dashboard.bots.monitoring.heartbeatLagLabel")}</p>
                          <p className="mt-1 font-semibold">{formatDuration(monitorHeartbeatLagMs ?? 0)}</p>
                        </div>
                        <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                          <p className="opacity-60">{t("dashboard.bots.monitoring.lastSignalLabel")}</p>
                          <p className="mt-1 font-semibold">{formatDateTime(monitorLastSignalAt)}</p>
                        </div>
                        <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                          <p className="opacity-60">{t("dashboard.bots.monitoring.lastTradeLabel")}</p>
                          <p className="mt-1 font-semibold">{formatDateTime(monitorLastTradeAt)}</p>
                        </div>
                        <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                          <p className="opacity-60">{t("dashboard.bots.monitoring.openPositionsOrdersLabel")}</p>
                          <p className="mt-1 font-semibold">
                            {monitorPositions?.openCount ?? 0} /{" "}
                            {monitorPositions?.openOrdersCount ?? monitorPositions?.openOrders?.length ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div id="monitor-now" className="scroll-mt-24 rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">{t("dashboard.bots.monitoring.sections.nowOpenPositionsTitle")}</h3>
                        <p className="text-xs opacity-65">
                          {t("dashboard.bots.monitoring.sections.nowOpenPositionsDescription")}
                        </p>
                        <p className="mt-1 text-xs opacity-60">
                          {t("dashboard.bots.monitoring.notionalLabel")}: {formatCurrency(monitorOpenMarginSummary.totalNotional)} | {t("dashboard.bots.monitoring.marginLabel")}:{" "}
                          {formatCurrency(monitorOpenMarginSummary.totalMarginUsed)} | {t("dashboard.bots.monitoring.openPnlLabel")}{" "}
                          <span
                            className={
                              monitorOpenMarginSummary.totalOpenPnl >= 0 ? "text-success" : "text-error"
                            }
                          >
                            {formatCurrency(monitorOpenMarginSummary.totalOpenPnl)}
                          </span>
                          {monitorOpenMarginSummary.marginInitPct != null ? (
                            <>
                              {" "}
                              | {t("dashboard.bots.monitoring.marginInitLabel")}: {formatNumber(monitorOpenMarginSummary.marginInitPct, 2)}%
                            </>
                          ) : null}
                        </p>
                      </div>
                      <span className="text-xs opacity-60">
                        {interpolateTemplate(t("dashboard.bots.monitoring.activeCount"), {
                          count: monitorOpenPositionRows.length,
                          total: monitorPositions?.openCount ?? 0,
                        })}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table table-xs table-zebra">
                        <thead>
                          <tr>
                            <th>{t("dashboard.bots.monitoring.table.timeOpened")}</th>
                            <th>{t("dashboard.bots.monitoring.table.symbol")}</th>
                            <th>{t("dashboard.bots.monitoring.table.side")}</th>
                            <th>{t("dashboard.bots.monitoring.table.qty")}</th>
                            <th>{t("dashboard.bots.monitoring.table.entry")}</th>
                            <th>{t("dashboard.bots.monitoring.table.mark")}</th>
                            <th>{t("dashboard.bots.monitoring.notionalLabel")}</th>
                            <th>{t("dashboard.bots.monitoring.marginLabel")}</th>
                            <th>{t("dashboard.bots.monitoring.marginInitLabel")}</th>
                            <th>{t("dashboard.bots.monitoring.table.fees")}</th>
                            <th>{t("dashboard.bots.monitoring.table.openPnl")}</th>
                            <th>{t("dashboard.bots.monitoring.table.openPct")}</th>
                            <th>{t("dashboard.bots.monitoring.table.roiMarginPct")}</th>
                            <th>{t("dashboard.bots.monitoring.table.dca")}</th>
                            {monitorShowDynamicStopColumns ? <th>{t("dashboard.bots.monitoring.table.slTtp")}</th> : null}
                            {monitorShowDynamicStopColumns ? <th>{t("dashboard.bots.monitoring.table.slTsl")}</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {monitorOpenPositionRows.map((position) => (
                            <tr key={position.id}>
                              <td>{formatDateTime(position.openedAt)}</td>
                              <td className="font-medium">{position.symbol}</td>
                              <td>{position.side}</td>
                              <td>{formatNumber(position.quantity, 6)}</td>
                              <td>{formatNumber(position.entryPrice, 4)}</td>
                              <td>{position.markPrice != null ? formatNumber(position.markPrice, 4) : "-"}</td>
                              <td>{formatCurrency(position.entryNotional)}</td>
                              <td>{formatCurrency(position.marginUsed)}</td>
                              <td>
                                {position.marginInitPct != null
                                  ? `${formatNumber(position.marginInitPct, 2)}%`
                                  : "-"}
                              </td>
                              <td>{formatCurrency(position.feesPaid)}</td>
                              <td className={position.openPnl >= 0 ? "text-success" : "text-error"}>
                                {formatCurrency(position.openPnl)}
                              </td>
                              <td className={position.pnlNotionalPct >= 0 ? "text-success" : "text-error"}>
                                {formatNumber(position.pnlNotionalPct, 2)}%
                              </td>
                              <td className={position.pnlMarginPct >= 0 ? "text-success" : "text-error"}>
                                {formatNumber(position.pnlMarginPct, 2)}%
                              </td>
                              <td className="text-[11px]">
                                {formatDcaLadderCell({
                                  id: position.id,
                                  dcaCount: position.dcaCount,
                                  dcaExecutedLevels: position.dcaExecutedLevels,
                                  dcaPlannedLevels: position.dcaPlannedLevels,
                                })}
                              </td>
                              {monitorShowDynamicStopColumns ? (
                                <td>
                                  {position.dynamicTtpStopLoss == null
                                    ? "-"
                                    : formatNumber(position.dynamicTtpStopLoss, 4)}
                                </td>
                              ) : null}
                              {monitorShowDynamicStopColumns ? (
                                <td>
                                  {position.dynamicTslStopLoss == null
                                    ? "-"
                                    : formatNumber(position.dynamicTslStopLoss, 4)}
                                </td>
                              ) : null}
                            </tr>
                          ))}
                          {monitorOpenPositionRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={monitorShowDynamicStopColumns ? 16 : 14}
                                className="text-center text-xs opacity-70"
                              >
                                {t("dashboard.bots.monitoring.emptyOpenPositions")}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {monitorShowOpenOrders ? (
                    <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{t("dashboard.bots.monitoring.sections.nowOpenOrdersTitle")}</h3>
                        <span className="text-xs opacity-60">
                          {interpolateTemplate(t("dashboard.bots.monitoring.activeCount"), {
                            count: (monitorPositions?.openOrders ?? []).length,
                            total: monitorPositions?.openOrdersCount ?? monitorPositions?.openOrders?.length ?? 0,
                          })}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="table table-xs table-zebra">
                          <thead>
                            <tr>
                              <th>{t("dashboard.bots.monitoring.table.symbol")}</th>
                              <th>{t("dashboard.bots.monitoring.table.side")}</th>
                              <th>{t("dashboard.bots.monitoring.table.type")}</th>
                              <th>{t("dashboard.bots.monitoring.table.status")}</th>
                              <th>{t("dashboard.bots.monitoring.table.qty")}</th>
                              <th>{t("dashboard.bots.monitoring.table.filled")}</th>
                              <th>{t("dashboard.bots.monitoring.table.price")}</th>
                              <th>{t("dashboard.bots.monitoring.table.stop")}</th>
                              <th>{t("dashboard.bots.monitoring.table.submitted")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(monitorPositions?.openOrders ?? []).map((order) => (
                              <tr key={order.id}>
                                <td className="font-medium">{order.symbol}</td>
                                <td>{order.side}</td>
                                <td>{order.type}</td>
                                <td>{order.status}</td>
                                <td>{formatNumber(order.quantity, 6)}</td>
                                <td>{formatNumber(order.filledQuantity, 6)}</td>
                                <td>{order.price != null ? formatNumber(order.price, 4) : "-"}</td>
                                <td>{order.stopPrice != null ? formatNumber(order.stopPrice, 4) : "-"}</td>
                                <td>{formatDateTime(order.submittedAt ?? order.createdAt)}</td>
                              </tr>
                            ))}
                            {(monitorPositions?.openOrders?.length ?? 0) === 0 ? (
                              <tr>
                                <td colSpan={9} className="text-center text-xs opacity-70">
                                  {t("dashboard.bots.monitoring.emptyOpenOrders")}
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  <div id="monitor-history" className="scroll-mt-24 rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">{t("dashboard.bots.monitoring.sections.historyPositionsTitle")}</h3>
                        <p className="text-xs opacity-65">
                          {t("dashboard.bots.monitoring.sections.historyPositionsDescription")}
                        </p>
                      </div>
                      <span className="text-xs opacity-60">
                        {interpolateTemplate(t("dashboard.bots.monitoring.closedCount"), {
                          count: monitorPositions?.historyItems.length ?? 0,
                          total: monitorPositions?.closedCount ?? 0,
                        })}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table table-xs table-zebra">
                        <thead>
                          <tr>
                            <th>{t("dashboard.bots.monitoring.table.symbol")}</th>
                            <th>{t("dashboard.bots.monitoring.table.side")}</th>
                            <th>{t("dashboard.bots.monitoring.table.open")}</th>
                            <th>{t("dashboard.bots.monitoring.table.close")}</th>
                            <th>{t("dashboard.bots.monitoring.table.duration")}</th>
                            <th>{t("dashboard.bots.monitoring.table.qty")}</th>
                            <th>{t("dashboard.bots.monitoring.table.entry")}</th>
                            <th>{t("dashboard.bots.monitoring.table.exit")}</th>
                            <th>{t("dashboard.bots.monitoring.table.dca")}</th>
                            <th>{t("dashboard.bots.monitoring.table.fees")}</th>
                            <th>{t("dashboard.bots.monitoring.table.realizedPnl")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(monitorPositions?.historyItems ?? []).map((position) => (
                            <tr key={position.id}>
                              <td className="font-medium">{position.symbol}</td>
                              <td>{position.side}</td>
                              <td>{formatDateTime(position.openedAt)}</td>
                              <td>{formatDateTime(position.closedAt)}</td>
                              <td>{formatDuration(position.holdMs)}</td>
                              <td>{formatNumber(position.quantity, 6)}</td>
                              <td>{formatNumber(position.entryPrice, 4)}</td>
                              <td>{position.exitPrice != null ? formatNumber(position.exitPrice, 4) : "-"}</td>
                              <td className="text-[11px]">
                                {formatDcaLadderCell({
                                  id: position.id,
                                  dcaCount: position.dcaCount,
                                  dcaExecutedLevels: position.dcaExecutedLevels,
                                  dcaPlannedLevels: position.dcaPlannedLevels,
                                })}
                              </td>
                              <td>{formatCurrency(position.feesPaid)}</td>
                              <td className={position.realizedPnl >= 0 ? "text-success" : "text-error"}>
                                {formatCurrency(position.realizedPnl)}
                              </td>
                            </tr>
                          ))}
                          {(monitorPositions?.historyItems.length ?? 0) === 0 ? (
                            <tr>
                              <td colSpan={11} className="text-center text-xs opacity-70">
                                {t("dashboard.bots.monitoring.emptyClosedPositions")}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{t("dashboard.bots.monitoring.sections.historyTradesTitle")}</h3>
                      <span className="text-xs opacity-60">
                        {interpolateTemplate(t("dashboard.bots.monitoring.recordsCount"), {
                          count: monitorOperationalTrades.length,
                          total: monitorTrades?.total ?? 0,
                        })}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table table-xs table-zebra">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>{t("dashboard.bots.monitoring.table.time")}</th>
                            <th>{t("dashboard.bots.monitoring.table.symbol")}</th>
                            <th>{t("dashboard.bots.monitoring.table.side")}</th>
                            <th>{t("dashboard.bots.monitoring.table.action")}</th>
                            <th>{t("dashboard.bots.monitoring.table.qty")}</th>
                            <th>{t("dashboard.bots.monitoring.table.price")}</th>
                            <th>{t("dashboard.bots.monitoring.table.margin")}</th>
                            <th>{t("dashboard.bots.monitoring.table.fee")}</th>
                            <th>{t("dashboard.bots.monitoring.table.feePct")}</th>
                            <th>{t("dashboard.bots.monitoring.table.realizedPnl")}</th>
                            <th>{t("dashboard.bots.monitoring.table.pnlPct")}</th>
                            <th>{t("dashboard.bots.monitoring.table.cumulativePnl")}</th>
                            <th>{t("dashboard.bots.monitoring.table.origin")}</th>
                            <th>{t("dashboard.bots.monitoring.table.order")}</th>
                            <th>{t("dashboard.bots.monitoring.table.position")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monitorOperationalTrades.map((trade) => (
                            <tr key={trade.id}>
                              <td>{trade.rowNo}</td>
                              <td>{formatDateTime(trade.executedAt)}</td>
                              <td className="font-medium">{trade.symbol}</td>
                              <td>
                                <span className={`badge badge-xs ${toTradeSideBadgeClass(trade.side)}`}>{trade.side}</span>
                              </td>
                              <td>
                                <span className={`badge badge-xs ${toTradeLifecycleBadgeClass(trade.lifecycleAction)}`}>
                                  {t(toTradeLifecycleLabelKey(trade.lifecycleAction))}
                                </span>
                              </td>
                              <td>{formatNumber(trade.quantity, 6)}</td>
                              <td>{formatNumber(trade.price, 4)}</td>
                              <td>{formatCurrency(trade.margin)}</td>
                              <td>
                                <div className="flex flex-col leading-tight">
                                  <span>{formatCurrency(trade.fee)}</span>
                                  <span className="text-[10px] opacity-60">{formatTradeFeeMeta(trade)}</span>
                                </div>
                              </td>
                              <td>{formatNumber(trade.feePct, 2)}%</td>
                              <td className={trade.realizedPnl >= 0 ? "text-success" : "text-error"}>
                                {formatCurrency(trade.realizedPnl)}
                              </td>
                              <td className={trade.pnlPct >= 0 ? "text-success" : "text-error"}>
                                {formatNumber(trade.pnlPct, 2)}%
                              </td>
                              <td className={trade.cumulativePnl >= 0 ? "text-success" : "text-error"}>
                                {formatCurrency(trade.cumulativePnl)}
                              </td>
                              <td>
                                <span className="badge badge-outline badge-xs">{trade.origin}</span>
                              </td>
                              <td className="font-mono text-[10px]">{trade.orderId.slice(0, 8)}</td>
                              <td className="font-mono text-[10px]">{trade.positionId.slice(0, 8)}</td>
                            </tr>
                          ))}
                          {monitorOperationalTrades.length === 0 ? (
                            <tr>
                              <td colSpan={16} className="text-center text-xs opacity-70">
                                {t("dashboard.bots.monitoring.emptyTrades")}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div id="monitor-future" className="scroll-mt-24 rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">{t("dashboard.bots.monitoring.sections.futureSignalsTitle")}</h3>
                        <p className="text-xs opacity-65">
                          {t("dashboard.bots.monitoring.sections.futureSignalsDescription")}
                        </p>
                      </div>
                      <div className="text-right text-xs opacity-60">
                        <div>
                          {interpolateTemplate(t("dashboard.bots.monitoring.symbolCount"), {
                            count: monitorSignalRows.length,
                            total: monitorSessionDetail?.symbolsTracked ?? 0,
                          })}
                        </div>
                        <div className="opacity-50">{t("dashboard.bots.monitoring.sortLatestSignal")}</div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table table-xs table-zebra">
                        <thead>
                          <tr>
                            <th>{t("dashboard.bots.monitoring.table.symbol")}</th>
                            <th>{t("dashboard.bots.monitoring.table.signal")}</th>
                            <th>{t("dashboard.bots.monitoring.table.signalTime")}</th>
                            <th>{t("dashboard.bots.monitoring.table.signals")}</th>
                            <th>{t("dashboard.bots.monitoring.table.lse")}</th>
                            <th>{t("dashboard.bots.monitoring.table.dca")}</th>
                            <th>{t("dashboard.bots.monitoring.table.closed")}</th>
                            <th>{t("dashboard.bots.monitoring.table.wl")}</th>
                            <th>{t("dashboard.bots.monitoring.table.openQty")}</th>
                            <th>{t("dashboard.bots.monitoring.table.realizedPnl")}</th>
                            <th>{t("dashboard.bots.monitoring.table.openPnl")}</th>
                            <th>{t("dashboard.bots.monitoring.table.fees")}</th>
                            <th>{t("dashboard.bots.monitoring.table.lastTrade")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monitorSignalRows.map((item) => (
                            <tr key={item.id}>
                              <td className="font-medium">{item.symbol}</td>
                              <td>
                                <span
                                  className={`badge badge-xs ${
                                    item.lastSignalDirection === "LONG"
                                      ? "badge-success"
                                      : item.lastSignalDirection === "SHORT"
                                        ? "badge-error"
                                        : item.lastSignalDirection === "EXIT"
                                          ? "badge-warning"
                                          : "badge-ghost"
                                  }`}
                                >
                                  {item.lastSignalDirection ?? t("dashboard.bots.monitoring.neutral")}
                                </span>
                              </td>
                              <td>{formatDateTime(item.lastSignalDecisionAt ?? item.lastSignalAt)}</td>
                              <td>{item.totalSignals}</td>
                              <td>
                                {item.longEntries}/{item.shortEntries}/{item.exits}
                              </td>
                              <td>{item.dcaCount}</td>
                              <td>{item.closedTrades}</td>
                              <td>
                                {item.winningTrades}/{item.losingTrades}
                              </td>
                              <td>{formatNumber(item.openPositionQty, 6)}</td>
                              <td className={item.realizedPnl >= 0 ? "text-success" : "text-error"}>
                                {formatCurrency(item.realizedPnl)}
                              </td>
                              <td className={(item.unrealizedPnl ?? 0) >= 0 ? "text-success" : "text-error"}>
                                {formatCurrency(item.unrealizedPnl ?? 0)}
                              </td>
                              <td>{formatCurrency(item.feesPaid)}</td>
                              <td>{formatDateTime(item.lastTradeAt)}</td>
                            </tr>
                          ))}
                          {monitorSignalRows.length === 0 ? (
                            <tr>
                              <td colSpan={13} className="text-center text-xs opacity-70">
                                {t("dashboard.bots.monitoring.emptySignalData")}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {activeTab === "assistant" && (
        <div className="space-y-4 rounded-box border border-base-300/60 bg-base-200/60 p-4">
          <h2 className="text-lg font-semibold">{t("dashboard.bots.assistant.title")}</h2>
          <p className="text-sm opacity-70">
            {t("dashboard.bots.assistant.description")}
          </p>

          {bots.length === 0 ? (
            <EmptyState
              title={t("dashboard.bots.assistant.emptyTitle")}
              description={t("dashboard.bots.assistant.emptyDescription")}
            />
          ) : (
            <>
              <label className="form-control max-w-sm">
                <span className="label-text">{t("dashboard.bots.assistant.botLabel")}</span>
                <select
                  className="select select-bordered"
                  value={assistantBotId}
                  onChange={(event) => setAssistantBotId(event.target.value)}
                >
                  {bots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name}
                    </option>
                  ))}
                </select>
              </label>

              {assistantLoading ? (
                <LoadingState title={t("dashboard.bots.assistant.loading")} />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-5">
                    <label className="form-control">
                      <span className="label-text">{t("dashboard.bots.assistant.mainEnabledLabel")}</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-success"
                        checked={assistantMainEnabled}
                        onChange={(event) => setAssistantMainEnabled(event.target.checked)}
                      />
                    </label>
                    <label className="form-control md:col-span-2">
                      <span className="label-text">{t("dashboard.bots.assistant.mandateLabel")}</span>
                      <input
                        className="input input-bordered"
                        value={assistantMandate}
                        onChange={(event) => setAssistantMandate(event.target.value)}
                        placeholder={t("dashboard.bots.assistant.mandatePlaceholder")}
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text">{t("dashboard.bots.assistant.modelProfileLabel")}</span>
                      <input
                        className="input input-bordered"
                        value={assistantModelProfile}
                        onChange={(event) => setAssistantModelProfile(event.target.value)}
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text">{t("dashboard.bots.assistant.safetyModeLabel")}</span>
                      <select
                        className="select select-bordered"
                        value={assistantSafetyMode}
                        onChange={(event) =>
                          setAssistantSafetyMode(event.target.value as "STRICT" | "BALANCED" | "EXPERIMENTAL")
                        }
                      >
                        <option value="STRICT">STRICT</option>
                        <option value="BALANCED">BALANCED</option>
                        <option value="EXPERIMENTAL">EXPERIMENTAL</option>
                      </select>
                    </label>
                  </div>
                  <label className="form-control max-w-xs">
                    <span className="label-text">{t("dashboard.bots.assistant.mainLatencyLabel")}</span>
                    <input
                      type="number"
                      className="input input-bordered"
                      min={200}
                      max={30000}
                      value={assistantLatencyMs}
                      onChange={(event) => setAssistantLatencyMs(Number(event.target.value))}
                    />
                  </label>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={assistantSaving || !assistantBotId}
                      onClick={() => void handleSaveAssistantMain()}
                    >
                      {assistantSaving ? t("dashboard.bots.assistant.saving") : t("dashboard.bots.assistant.saveMain")}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {assistantSlots.map((slot) => (
                      <div key={slot.slotIndex} className="rounded-lg border border-base-300 p-3">
                        <div className="mb-2 font-medium">
                          {interpolateTemplate(t("dashboard.bots.assistant.subagentSlotTitle"), {
                            slot: slot.slotIndex,
                          })}
                        </div>
                        <div className="grid gap-3 md:grid-cols-5">
                          <label className="form-control">
                            <span className="label-text">{t("dashboard.bots.assistant.enabledLabel")}</span>
                            <input
                              type="checkbox"
                              className="toggle toggle-sm"
                              checked={slot.enabled}
                              onChange={(event) =>
                                setAssistantSubagents((prev) => {
                                  const next = [...prev];
                                  const idx = next.findIndex((item) => item.slotIndex === slot.slotIndex);
                                  const updated = { ...slot, enabled: event.target.checked };
                                  if (idx >= 0) next[idx] = updated;
                                  else next.push(updated);
                                  return next;
                                })
                              }
                            />
                          </label>
                          <label className="form-control">
                            <span className="label-text">{t("dashboard.bots.assistant.roleLabel")}</span>
                            <input
                              className="input input-bordered input-sm"
                              value={slot.role}
                              onChange={(event) =>
                                setAssistantSubagents((prev) => {
                                  const next = [...prev];
                                  const idx = next.findIndex((item) => item.slotIndex === slot.slotIndex);
                                  const updated = { ...slot, role: event.target.value };
                                  if (idx >= 0) next[idx] = updated;
                                  else next.push(updated);
                                  return next;
                                })
                              }
                            />
                          </label>
                          <label className="form-control">
                            <span className="label-text">{t("dashboard.bots.assistant.profileLabel")}</span>
                            <input
                              className="input input-bordered input-sm"
                              value={slot.modelProfile}
                              onChange={(event) =>
                                setAssistantSubagents((prev) => {
                                  const next = [...prev];
                                  const idx = next.findIndex((item) => item.slotIndex === slot.slotIndex);
                                  const updated = { ...slot, modelProfile: event.target.value };
                                  if (idx >= 0) next[idx] = updated;
                                  else next.push(updated);
                                  return next;
                                })
                              }
                            />
                          </label>
                          <label className="form-control">
                            <span className="label-text">{t("dashboard.bots.assistant.timeoutLabel")}</span>
                            <input
                              type="number"
                              min={100}
                              max={15000}
                              className="input input-bordered input-sm"
                              value={slot.timeoutMs}
                              onChange={(event) =>
                                setAssistantSubagents((prev) => {
                                  const next = [...prev];
                                  const idx = next.findIndex((item) => item.slotIndex === slot.slotIndex);
                                  const updated = { ...slot, timeoutMs: Number(event.target.value) };
                                  if (idx >= 0) next[idx] = updated;
                                  else next.push(updated);
                                  return next;
                                })
                              }
                            />
                          </label>
                          <label className="form-control">
                            <span className="label-text">{t("dashboard.bots.assistant.safetyLabel")}</span>
                            <select
                              className="select select-bordered select-sm"
                              value={slot.safetyMode}
                              onChange={(event) =>
                                setAssistantSubagents((prev) => {
                                  const next = [...prev];
                                  const idx = next.findIndex((item) => item.slotIndex === slot.slotIndex);
                                  const updated = {
                                    ...slot,
                                    safetyMode: event.target.value as "STRICT" | "BALANCED" | "EXPERIMENTAL",
                                  };
                                  if (idx >= 0) next[idx] = updated;
                                  else next.push(updated);
                                  return next;
                                })
                              }
                            >
                              <option value="STRICT">STRICT</option>
                              <option value="BALANCED">BALANCED</option>
                              <option value="EXPERIMENTAL">EXPERIMENTAL</option>
                            </select>
                          </label>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            disabled={assistantSaving || !assistantBotId}
                            onClick={() => void handleSaveSubagent(slot)}
                          >
                            {t("dashboard.bots.assistant.saveSlot")}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            disabled={assistantSaving || !assistantBotId}
                            onClick={() => void handleClearSubagent(slot.slotIndex)}
                          >
                            {t("dashboard.bots.assistant.deleteSlot")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-base-300 p-3">
                    <div className="mb-2 font-medium">{t("dashboard.bots.assistant.decisionTimelineTitle")}</div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <label className="form-control">
                        <span className="label-text">{t("dashboard.bots.assistant.symbolLabel")}</span>
                        <input
                          className="input input-bordered input-sm"
                          value={assistantDryRunSymbol}
                          onChange={(event) => setAssistantDryRunSymbol(event.target.value.toUpperCase())}
                        />
                      </label>
                      <label className="form-control">
                        <span className="label-text">{t("dashboard.bots.assistant.intervalLabel")}</span>
                        <input
                          className="input input-bordered input-sm"
                          value={assistantDryRunInterval}
                          onChange={(event) => setAssistantDryRunInterval(event.target.value)}
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={assistantDryRunRunning || !assistantBotId}
                          onClick={() => void handleRunAssistantDryRun()}
                        >
                          {assistantDryRunRunning ? t("dashboard.bots.assistant.running") : t("dashboard.bots.assistant.runDryRun")}
                        </button>
                      </div>
                    </div>

                    {assistantTrace && (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-md border border-base-300 p-2 text-sm">
                          <div>{t("dashboard.bots.assistant.traceRequest")}: {assistantTrace.requestId}</div>
                          <div>{t("dashboard.bots.assistant.traceMode")}: {assistantTrace.mode}</div>
                          <div>{t("dashboard.bots.assistant.traceFinalDecision")}: {assistantTrace.finalDecision}</div>
                          <div>{t("dashboard.bots.assistant.traceReason")}: {assistantTrace.finalReason}</div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="table table-xs">
                            <thead>
                              <tr>
                                <th>{t("dashboard.bots.assistant.traceTableSlot")}</th>
                                <th>{t("dashboard.bots.assistant.traceTableRole")}</th>
                                <th>{t("dashboard.bots.assistant.traceTableStatus")}</th>
                                <th>{t("dashboard.bots.assistant.traceTableLatency")}</th>
                                <th>{t("dashboard.bots.assistant.traceTableMessage")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assistantTrace.statuses.map((status) => (
                                <tr key={`${status.slotIndex}-${status.role}`}>
                                  <td>{status.slotIndex}</td>
                                  <td>{status.role}</td>
                                  <td>{status.status}</td>
                                  <td>{status.latencyMs}</td>
                                  <td>{status.message ?? "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}



