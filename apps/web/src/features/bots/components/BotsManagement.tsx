'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useI18n } from "../../../i18n/I18nProvider";
import { TranslationKey } from "../../../i18n/translations";

import StatusBadge from "../../../ui/components/StatusBadge";
import { EmptyState, ErrorState, SuccessState } from "../../../ui/components/ViewState";
import { SkeletonCardBlock, SkeletonFormBlock, SkeletonKpiRow, SkeletonTableRows } from "../../../ui/components/loading";
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
import { BotsManagementTabs } from "./bots-management/BotsManagementTabs";
import { BotsMonitoringTab } from "./bots-management/BotsMonitoringTab";
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
import { listWallets } from "../../wallets/services/wallets.service";
import { Wallet } from "../../wallets/types/wallet.type";
import { createMarketStreamEventSource } from "../../../lib/marketStream";
import { supportsExchangeCapability } from "../../exchanges/exchangeCapabilities";
import {
  pruneStickyFavorableMoveMap,
  resolveFallbackTtpProtectedPercent,
  toProtectedPnlPercentFromStopPrice,
} from "../utils/trailingStopDisplay";
import { formatDcaLadderCell } from "./bots-management/dcaLadderCell";

const LIVE_CONSENT_TEXT_VERSION = "mvp-v1";
const DUPLICATE_ACTIVE_BOT_ERROR = "active bot already exists for this strategy + market group pair";
const MONITOR_AUTO_REFRESH_INTERVAL_MS = 5_000;
const MONITOR_STALE_WARNING_AFTER_MS = 20_000;

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

const formatAgeCompact = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1_000))}s`;
  return formatDuration(ms);
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
  const [wallets, setWallets] = useState<Wallet[]>([]);

  const [name, setName] = useState("");
  const [walletId, setWalletId] = useState<string>("");
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
  const [monitorLastUpdatedAt, setMonitorLastUpdatedAt] = useState<string | null>(null);
  const [monitorStaleWatchNowMs, setMonitorStaleWatchNowMs] = useState(() => Date.now());
  const [monitorLiveTickerPrices, setMonitorLiveTickerPrices] = useState<Record<string, number>>({});
  const monitorTtpStickyFavorableMoveByPositionRef = useRef<Map<string, number>>(new Map());

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

  useEffect(() => {
    let mounted = true;
    const loadWalletOptions = async () => {
      try {
        const items = await listWallets();
        if (!mounted) return;
        setWallets(items);
        setWalletId((prev) => prev || items[0]?.id || "");
      } catch (err: unknown) {
        if (!mounted) return;
        setWallets([]);
        toast.error("Wallets load failed", { description: getAxiosMessage(err) });
      }
    };
    void loadWalletOptions();
    return () => {
      mounted = false;
    };
  }, []);

  const canCreate = useMemo(
    () =>
      name.trim().length > 0 &&
      walletId.trim().length > 0 &&
      strategyId.trim().length > 0 &&
      marketGroupId.trim().length > 0 &&
      !creating,
    [creating, marketGroupId, name, strategyId, walletId]
  );

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === strategyId) ?? null,
    [strategies, strategyId]
  );
  const selectedMarketGroup = useMemo(
    () => marketGroups.find((group) => group.id === marketGroupId) ?? null,
    [marketGroupId, marketGroups]
  );
  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === walletId) ?? null,
    [walletId, wallets]
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
    const openItems = monitorPositions?.openItems ?? [];
    const stickyFavorableMoveByPosition = monitorTtpStickyFavorableMoveByPositionRef.current;
    pruneStickyFavorableMoveMap(
      stickyFavorableMoveByPosition,
      new Set(openItems.map((position) => position.id))
    );

    return openItems.map((position) => {
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
      const ttpProtectedPercentFromStopPrice =
        toProtectedPnlPercentFromStopPrice({
          side: position.side,
          entryPrice: position.entryPrice,
          leverage: position.leverage,
          stopPrice: position.dynamicTtpStopLoss,
        }) ?? null;
      const ttpProtectedPercentFallback = resolveFallbackTtpProtectedPercent({
        positionId: position.id,
        livePnlPercent: pnlMarginPct,
        trailingTakeProfitLevels: position.trailingTakeProfitLevels,
        stickyFavorableMoveByPosition,
      });
      const ttpProtectedPercent =
        ttpProtectedPercentFromStopPrice ?? ttpProtectedPercentFallback ?? null;
      const tslProtectedPercent =
        ttpProtectedPercent != null
          ? null
          : toProtectedPnlPercentFromStopPrice({
              side: position.side,
              entryPrice: position.entryPrice,
              leverage: position.leverage,
              stopPrice: position.dynamicTslStopLoss,
            }) ?? null;

      return {
        ...position,
        markPrice: liveMarkPrice,
        openPnl,
        entryNotional,
        marginUsed,
        pnlNotionalPct,
        pnlMarginPct,
        marginInitPct,
        ttpProtectedPercent,
        tslProtectedPercent,
      };
    });
  }, [monitorLiveTickerPrices, monitorPositions?.openItems, selectedMonitorBot]);

  const monitorShowDynamicStopColumns = useMemo(
    () => {
      const fromStrategyMode = monitorPositions?.showDynamicStopColumns;
      if (typeof fromStrategyMode === "boolean") return fromStrategyMode;
      return monitorOpenPositionRows.some(
        (position) =>
          position.ttpProtectedPercent != null ||
          position.tslProtectedPercent != null ||
          (position.trailingTakeProfitLevels?.length ?? 0) > 0 ||
          (position.trailingStopLevels?.length ?? 0) > 0
      );
    },
    [monitorOpenPositionRows, monitorPositions?.showDynamicStopColumns]
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

  const monitorDataAgeMs = useMemo(() => {
    if (!monitorLastUpdatedAt) return null;
    const timestamp = Date.parse(monitorLastUpdatedAt);
    if (!Number.isFinite(timestamp)) return null;
    return Math.max(0, monitorStaleWatchNowMs - timestamp);
  }, [monitorLastUpdatedAt, monitorStaleWatchNowMs]);

  const monitorDataIsStale = useMemo(
    () => monitorDataAgeMs != null && monitorDataAgeMs >= MONITOR_STALE_WARNING_AFTER_MS,
    [monitorDataAgeMs]
  );

  const monitorDataAgeLabel = useMemo(
    () => (monitorDataAgeMs == null ? null : formatAgeCompact(monitorDataAgeMs)),
    [monitorDataAgeMs]
  );

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
    ): Promise<BotRuntimeSessionListItem[] | null> => {
      const silent = options?.silent ?? false;
      if (!botId) {
        setMonitorSessions([]);
        setMonitorSessionId("");
        setMonitorSessionDetail(null);
        setMonitorSymbolStats(null);
        setMonitorPositions(null);
        setMonitorTrades(null);
        setMonitorLastUpdatedAt(null);
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
        setMonitorLastUpdatedAt(new Date().toISOString());
        return sessions;
      } catch (err: unknown) {
        if (!silent) {
          setMonitorError(getAxiosMessage(err) ?? t("dashboard.bots.errors.loadRuntimeSessions"));
        }
        return null;
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
        setMonitorLastUpdatedAt(null);
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
        setMonitorLastUpdatedAt(new Date().toISOString());
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
        setMonitorLastUpdatedAt(null);
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
        setMonitorLastUpdatedAt(new Date().toISOString());
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
      const createMode = selectedWallet?.mode ?? "PAPER";
      if (createMode === "LIVE") {
        const accepted = confirmLiveRisk(t("dashboard.bots.confirms.liveCreate"));
        if (!accepted) return;
      }

      const created = await createBot({
        name: name.trim(),
        walletId,
        strategyId,
        marketGroupId,
        isActive: createMode === "PAPER",
        liveOptIn: false,
        consentTextVersion: null,
      });
      setBots((prev) => [created, ...prev]);
      setServerSnapshot((prev) => ({ ...prev, [created.id]: created }));
      setName("");
      setWalletId((prev) => prev || wallets[0]?.id || "");
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
        walletId: bot.walletId ?? null,
        isActive: bot.isActive,
        liveOptIn: effectiveLiveOptIn,
        consentTextVersion: effectiveLiveOptIn ? LIVE_CONSENT_TEXT_VERSION : null,
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
      if (sessions == null) return;
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
    if (activeTab !== "monitoring") return;
    const intervalId = window.setInterval(() => {
      setMonitorStaleWatchNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeTab]);

  useEffect(() => {
    setMonitorLiveTickerPrices({});
    monitorTtpStickyFavorableMoveByPositionRef.current.clear();
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
        <BotsManagementTabs activeTab={activeTab} onChange={setActiveTab} t={t} />
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
                <span className="label-text">Wallet</span>
                <select
                  className="select select-bordered"
                  aria-label="wallet"
                  value={walletId}
                  onChange={(event) => setWalletId(event.target.value)}
                  disabled={wallets.length === 0}
                >
                  {wallets.length === 0 ? <option value="">No wallets</option> : null}
                  {wallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} ({wallet.mode} · {wallet.exchange}/{wallet.marketType}/{wallet.baseCurrency})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div className={META_CARD_CLASS}>
                  <p className="uppercase tracking-wide opacity-60">{t("dashboard.bots.create.modeLabel")}</p>
                  <p className="font-medium">{selectedWallet?.mode ?? "-"}</p>
                </div>
                <div className={META_CARD_CLASS}>
                  <p className="uppercase tracking-wide opacity-60">{t("dashboard.bots.create.paperBalanceLabel")}</p>
                  <p className="font-medium">
                    {selectedWallet?.mode === "PAPER"
                      ? formatCurrency(selectedWallet.paperInitialBalance ?? 0)
                      : "-"}
                  </p>
                </div>
              </div>
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

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label={t("dashboard.bots.states.loadingBots")}>
          <SkeletonFormBlock fields={8} columns={2} title={false} submitButton={false} className="border-base-300/40 bg-base-100/60 p-3" />
          <SkeletonKpiRow items={4} />
          <SkeletonTableRows columns={7} rows={5} title={false} toolbar={false} className="border-base-300/40 bg-base-100/60 p-3" />
        </div>
      )}
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
                          <span className="text-[11px] opacity-70">{bot.wallet?.name ?? bot.walletId ?? "-"}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs opacity-70">
                          {bot.mode === "PAPER"
                            ? formatCurrency(bot.wallet?.paperInitialBalance ?? bot.paperStartBalance)
                            : "-"}
                        </span>
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
        <BotsMonitoringTab
          t={t}
          bots={bots}
          monitorQuickSwitchBots={monitorQuickSwitchBots}
          monitorBotId={monitorBotId}
          setMonitorBotId={setMonitorBotId}
          monitorRuntimeCapabilityAvailable={monitorRuntimeCapabilityAvailable}
          selectedMonitorBot={selectedMonitorBot}
          monitorAutoRefreshEnabled={monitorAutoRefreshEnabled}
          setMonitorAutoRefreshEnabled={setMonitorAutoRefreshEnabled}
          refreshMonitoring={refreshMonitoring}
          monitorStatus={monitorStatus}
          setMonitorStatus={setMonitorStatus}
          monitorSymbolFilter={monitorSymbolFilter}
          setMonitorSymbolFilter={setMonitorSymbolFilter}
          handleApplyMonitoringFilter={handleApplyMonitoringFilter}
          handleClearMonitoringFilter={handleClearMonitoringFilter}
          monitorAppliedSymbolFilter={monitorAppliedSymbolFilter}
          monitorViewMode={monitorViewMode}
          setMonitorViewMode={setMonitorViewMode}
          selectedMonitorSession={selectedMonitorSession}
          monitorSessions={monitorSessions}
          monitorSessionId={monitorSessionId}
          setMonitorSessionId={setMonitorSessionId}
          monitorLoading={monitorLoading}
          monitorError={monitorError}
          monitorSessionDetail={monitorSessionDetail}
          monitorSymbolStats={monitorSymbolStats}
          monitorChecklistItems={monitorChecklistItems}
          monitorSessionLoading={monitorSessionLoading}
          monitorPositions={monitorPositions}
          monitorOpenMarginSummary={monitorOpenMarginSummary}
          monitorWinRate={monitorWinRate}
          monitorShowOpenOrders={monitorShowOpenOrders}
          monitorOpenPositionRows={monitorOpenPositionRows}
          monitorShowDynamicStopColumns={monitorShowDynamicStopColumns}
          monitorOperationalTrades={monitorOperationalTrades}
          monitorTrades={monitorTrades}
          monitorSignalRows={monitorSignalRows}
          monitorHeartbeatLagMs={monitorHeartbeatLagMs}
          monitorDataIsStale={monitorDataIsStale}
          monitorDataAgeLabel={monitorDataAgeLabel}
          monitorLastSignalAt={monitorLastSignalAt}
          monitorLastTradeAt={monitorLastTradeAt}
          formatDateTime={formatDateTime}
          formatDuration={formatDuration}
          formatNumber={formatNumber}
          formatCurrency={formatCurrency}
          formatDcaLadderCell={formatDcaLadderCell}
          interpolateTemplate={interpolateTemplate}
          toSessionStatusBadgeClass={toSessionStatusBadgeClass}
          toTradeSideBadgeClass={toTradeSideBadgeClass}
          toTradeLifecycleBadgeClass={toTradeLifecycleBadgeClass}
          toTradeLifecycleLabelKey={toTradeLifecycleLabelKey}
          formatTradeFeeMeta={formatTradeFeeMeta}
        />
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
                <div className="space-y-3" aria-busy="true" aria-label={t("dashboard.bots.assistant.loading")}>
                  <SkeletonFormBlock
                    fields={7}
                    columns={2}
                    title={false}
                    submitButton={false}
                    className="border-base-300/40 bg-base-100/60 p-3"
                  />
                  <SkeletonCardBlock cards={4} linesPerCard={3} title={false} className="border-base-300/40 bg-base-100/60 p-3" />
                </div>
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



