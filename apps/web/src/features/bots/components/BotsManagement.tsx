'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";

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

const LIVE_CONSENT_TEXT_VERSION = "mvp-v1";
const DUPLICATE_ACTIVE_BOT_ERROR = "active bot already exists for this strategy + market group pair";

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

const toModeBadge = (mode: BotMode) => {
  if (mode === "LIVE") return "live";
  return "paper";
};

const toRiskBadge = (bot: Bot) => {
  if (bot.mode === "LIVE" && bot.liveOptIn) return { value: "danger", label: "LIVE enabled" } as const;
  if (bot.mode === "LIVE" && !bot.liveOptIn) return { value: "warning", label: "LIVE blocked" } as const;
  return { value: "safe", label: "Safe mode" } as const;
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

type MonitorAggregateData = {
  sessionDetail: BotRuntimeSessionDetail;
  symbolStats: BotRuntimeSymbolStatsResponse;
  positions: BotRuntimePositionsResponse;
  trades: BotRuntimeTradesResponse;
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
      window: {
        startedAt,
        finishedAt: finishedAt ?? new Date().toISOString(),
      },
      items: tradeItems,
    },
  };
};

export default function BotsManagement() {
  const [activeTab, setActiveTab] = useState<"bots" | "monitoring" | "assistant">("bots");
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

  const loadBots = useCallback(async (filter: "ALL" | TradeMarket) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBots(filter === "ALL" ? undefined : filter);
      setBots(data);
      setServerSnapshot(Object.fromEntries(data.map((bot) => [bot.id, bot])));
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac botow.");
    } finally {
      setLoading(false);
    }
  }, []);

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
        toast.error("Nie udalo sie pobrac grup rynkow", { description: getAxiosMessage(err) });
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
  const monitorHasRunningSession = useMemo(
    () => monitorSessions.some((session) => session.status === "RUNNING"),
    [monitorSessions]
  );
  const monitorQuickSwitchBots = useMemo(() => {
    const active = bots.filter((bot) => bot.isActive);
    return active.length > 0 ? active : bots;
  }, [bots]);

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
      const pnlPct = trade.notional > 0 ? (trade.realizedPnl / trade.notional) * 100 : 0;
      const feePct = trade.notional > 0 ? (trade.fee / trade.notional) * 100 : 0;
      return {
        ...trade,
        rowNo: index + 1,
        pnlPct,
        feePct,
        cumulativePnl,
      };
    });
  }, [monitorTrades?.items]);

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
      toast.error("Nie udalo sie pobrac konfiguracji asystenta", { description: getAxiosMessage(err) });
      setAssistantSubagents([]);
    } finally {
      setAssistantLoading(false);
    }
  }, []);

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
          setMonitorError(getAxiosMessage(err) ?? "Nie udalo sie pobrac sesji runtime.");
        }
        return [];
      } finally {
        if (!silent) {
          setMonitorLoading(false);
        }
      }
    },
    []
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
          setMonitorError(getAxiosMessage(err) ?? "Nie udalo sie pobrac danych sesji runtime.");
        }
      } finally {
        if (!silent) {
          setMonitorSessionLoading(false);
        }
      }
    },
    []
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
          setMonitorError(getAxiosMessage(err) ?? "Nie udalo sie pobrac danych monitoringu zbiorczego.");
        }
      } finally {
        if (!silent) {
          setMonitorSessionLoading(false);
        }
      }
    },
    []
  );

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setCreating(true);
    try {
      if (mode === "LIVE") {
        const accepted = confirmLiveRisk(
          "Potwierdzenie LIVE: ten bot bedzie tworzony w trybie LIVE. Kontynuowac?"
        );
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
      toast.success("Bot utworzony");
      await loadBots(marketFilter);
    } catch (err: unknown) {
      const message = getAxiosMessage(err);
      if (message === DUPLICATE_ACTIVE_BOT_ERROR) {
        toast.error("Aktywny bot dla tej strategii i grupy juz istnieje", {
          description: "Wylacz poprzedniego bota albo wybierz inna strategie / grupe rynkow.",
        });
      } else {
        toast.error("Nie udalo sie utworzyc bota", { description: message });
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
      const accepted = confirmLiveRisk(
        "Potwierdzenie LIVE: zapis aktywuje ryzyko handlu na zywo. Kontynuowac?"
      );
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
      toast.success("Bot zaktualizowany");
    } catch (err: unknown) {
      const message = getAxiosMessage(err);
      if (message === DUPLICATE_ACTIVE_BOT_ERROR) {
        toast.error("Konflikt aktywnych botow", {
          description: "Ta strategia i grupa rynkow sa juz aktywne w innym bocie.",
        });
      } else {
        toast.error("Nie udalo sie zapisac zmian", { description: message });
      }
      void loadBots(marketFilter);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (bot: Bot) => {
    if (bot.mode === "LIVE" || bot.liveOptIn || bot.isActive) {
      const accepted = confirmLiveRisk(
        "Potwierdzenie LIVE: usuniecie tego bota zatrzyma aktywna konfiguracje tradingowa. Kontynuowac?"
      );
      if (!accepted) return;
    }

    setDeletingId(bot.id);
    try {
      await deleteBot(bot.id);
      await loadBots(marketFilter);
      toast.success("Bot usuniety");
    } catch (err: unknown) {
      toast.error("Nie udalo sie usunac bota", { description: getAxiosMessage(err) });
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
      toast.success("Konfiguracja main asystenta zapisana");
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error("Nie udalo sie zapisac konfiguracji asystenta", { description: getAxiosMessage(err) });
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
      toast.success(`Slot ${slot.slotIndex} zapisany`);
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error("Nie udalo sie zapisac slotu subagenta", { description: getAxiosMessage(err) });
    } finally {
      setAssistantSaving(false);
    }
  };

  const handleClearSubagent = async (slotIndex: number) => {
    if (!assistantBotId) return;
    setAssistantSaving(true);
    try {
      await deleteBotSubagentConfig(assistantBotId, slotIndex);
      toast.success(`Slot ${slotIndex} usuniety`);
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error("Nie udalo sie usunac slotu subagenta", { description: getAxiosMessage(err) });
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
      toast.success("Assistant dry-run gotowy");
    } catch (err: unknown) {
      toast.error("Nie udalo sie wykonac dry-run asystenta", { description: getAxiosMessage(err) });
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
    if (!assistantBotId) {
      setAssistantBotId(bots[0].id);
      return;
    }
    const exists = bots.some((bot) => bot.id === assistantBotId);
    if (!exists) setAssistantBotId(bots[0].id);
  }, [bots, assistantBotId]);

  useEffect(() => {
    if (!assistantBotId || activeTab !== "assistant") return;
    void loadAssistant(assistantBotId);
  }, [assistantBotId, activeTab, loadAssistant]);

  useEffect(() => {
    if (bots.length === 0) {
      setMonitorBotId("");
      return;
    }

    if (!monitorBotId) {
      setMonitorBotId(bots[0].id);
      return;
    }

    const exists = bots.some((bot) => bot.id === monitorBotId);
    if (!exists) setMonitorBotId(bots[0].id);
  }, [bots, monitorBotId]);

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
    if (!monitorHasRunningSession) return;

    const intervalId = window.setInterval(() => {
      void refreshMonitoring({ silent: true });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    activeTab,
    monitorAutoRefreshEnabled,
    monitorBotId,
    monitorHasRunningSession,
    refreshMonitoring,
  ]);

  return (
    <div className="space-y-5">
      <div role="tablist" className="tabs tabs-boxed inline-flex gap-1">
        <button
          type="button"
          role="tab"
          className={`tab ${activeTab === "bots" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("bots")}
        >
          Boty
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${activeTab === "monitoring" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("monitoring")}
        >
          Operacje runtime
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${activeTab === "assistant" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("assistant")}
        >
          Asystent
        </button>
      </div>

      {activeTab === "bots" && (
        <>
      <form onSubmit={handleCreate} className="rounded-xl border border-base-300 bg-base-200 p-4">
        <h2 className="text-lg font-semibold">Nowy bot</h2>
        <p className="text-sm opacity-70">Dodaj bota i wybierz strategia + grupe rynkow. LIVE wymaga opt-in.</p>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <section className="rounded-lg border border-base-300 bg-base-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">1. Podstawy bota</p>
            <div className="mt-2 space-y-3">
              <label className="form-control">
                <span className="label-text">Nazwa</span>
                <input
                  className="input input-bordered"
                  placeholder="Momentum Runner"
                  aria-label="Nazwa bota"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Tryb</span>
                <select
                  className="select select-bordered"
                  aria-label="Tryb bota"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as BotMode)}
                >
                  <option value="PAPER">PAPER</option>
                  <option value="LIVE">LIVE</option>
                </select>
              </label>
              {mode === "PAPER" ? (
                <label className="form-control">
                  <span className="label-text">Paper start balance</span>
                  <input
                    type="number"
                    min={0}
                    max={100000000}
                    className="input input-bordered"
                    aria-label="Paper start balance"
                    value={paperStartBalance}
                    onChange={(event) =>
                      setPaperStartBalance(Number.isFinite(Number(event.target.value)) ? Number(event.target.value) : 0)
                    }
                  />
                </label>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-base-300 bg-base-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">2. Kontekst rynku</p>
            <div className="mt-2 space-y-3">
              <label className="form-control">
                <span className="label-text">Grupa rynkow</span>
                <select
                  className="select select-bordered"
                  aria-label="Grupa rynkow bota"
                  value={marketGroupId}
                  onChange={(event) => setMarketGroupId(event.target.value)}
                  disabled={marketGroups.length === 0}
                >
                  {marketGroups.length === 0 ? <option value="">Brak grup rynkow</option> : null}
                  {marketGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.marketType}/{group.baseCurrency})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                  <p className="uppercase tracking-wide opacity-60">Rynek</p>
                  <p className="font-medium">
                    {selectedMarketGroup ? `${selectedMarketGroup.marketType}/${selectedMarketGroup.baseCurrency}` : "-"}
                  </p>
                </div>
                <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                  <p className="uppercase tracking-wide opacity-60">Whitelist</p>
                  <p className="font-medium">{selectedMarketGroup?.whitelist?.length ?? 0}</p>
                </div>
                <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                  <p className="uppercase tracking-wide opacity-60">Blacklist</p>
                  <p className="font-medium">{selectedMarketGroup?.blacklist?.length ?? 0}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-base-300 bg-base-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">3. Kontekst strategii</p>
            <div className="mt-2 space-y-3">
              <label className="form-control">
                <span className="label-text">Strategia</span>
                <select
                  className="select select-bordered"
                  aria-label="Strategia bota"
                  value={strategyId}
                  onChange={(event) => setStrategyId(event.target.value)}
                  disabled={strategies.length === 0}
                >
                  {strategies.length === 0 ? <option value="">Brak strategii</option> : null}
                  {strategies.map((strategy) => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                  <p className="uppercase tracking-wide opacity-60">Interwal</p>
                  <p className="font-medium">{selectedStrategy?.interval ?? "-"}</p>
                </div>
                <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                  <p className="uppercase tracking-wide opacity-60">Dzwignia</p>
                  <p className="font-medium">
                    {typeof selectedStrategy?.leverage === "number" ? `${selectedStrategy.leverage}x` : "-"}
                  </p>
                </div>
                <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                  <p className="uppercase tracking-wide opacity-60">Max open positions</p>
                  <p className="font-medium">{selectedStrategy ? selectedStrategyMaxOpenPositions : "-"}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn btn-primary btn-sm" disabled={!canCreate}>
            {creating ? "Tworzenie..." : "Dodaj bota"}
          </button>
        </div>
      </form>

      {loading && <LoadingState title="Ladowanie botow" />}
      {!loading && error && (
        <ErrorState
          title="Nie udalo sie pobrac botow"
          description={error}
          retryLabel="Sprobuj ponownie"
          onRetry={() => void loadBots(marketFilter)}
        />
      )}
      {!loading && !error && bots.length === 0 && (
        <EmptyState
          title="Brak botow"
          description="Dodaj pierwszego bota, aby kontrolowac tryb PAPER/LIVE i limity."
        />
      )}

      {!loading && !error && bots.length > 0 && (
        <div className="space-y-3">
          <SuccessState
            title="Bots control center aktywny"
            description={`Skonfigurowano ${bots.length} ${bots.length === 1 ? "bota" : "botow"}.`}
          />
          <div className="flex justify-end">
            <label className="form-control w-48">
              <span className="label-text text-xs">Filtr rynku</span>
              <select
                className="select select-bordered select-sm"
                aria-label="Filtr rynku botow"
                value={marketFilter}
                onChange={(event) => setMarketFilter(event.target.value as "ALL" | TradeMarket)}
              >
                <option value="ALL">Wszystkie</option>
                <option value="FUTURES">FUTURES</option>
                <option value="SPOT">SPOT</option>
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Rynek</th>
                  <th>Pozycja</th>
                  <th>Strategia</th>
                  <th>Status</th>
                  <th>Tryb</th>
                  <th>Paper balance</th>
                  <th>Max positions</th>
                  <th>Live opt-in</th>
                  <th>Aktywny</th>
                  <th>Akcje</th>
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
                        <span className="text-xs opacity-70">{bot.marketType}</span>
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
                          <option value="">Brak</option>
                          {strategies.map((strategy) => (
                            <option key={strategy.id} value={strategy.id}>
                              {strategy.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <StatusBadge kind="risk" value={risk.value} label={risk.label} />
                      </td>
                      <td>
                        <div className="space-y-1">
                          <StatusBadge kind="mode" value={toModeBadge(bot.mode)} label={`Mode: ${bot.mode}`} />
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
                            {savingId === bot.id ? "Zapisywanie..." : "Zapisz"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-error btn-xs"
                            disabled={deletingId === bot.id}
                            onClick={() => void handleDelete(bot)}
                          >
                            {deletingId === bot.id ? "Usuwanie..." : "Usun"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {bots.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center text-sm opacity-70">
                      Brak botow dla wybranego rynku.
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
        <div className="space-y-4 rounded-xl border border-base-300 bg-base-200 p-4">
          <h2 className="text-lg font-semibold">Centrum operacyjne botow (runtime)</h2>
          <p className="text-sm opacity-70">
            Dashboard zostaje ogolnym panelem sterowania aplikacja, a tutaj monitorujesz runtime botow:
            teraz (otwarte), historia (zamkniete) i co bedzie (live check sygnalow) bez ciezkich wykresow.
          </p>

          {bots.length === 0 ? (
            <EmptyState title="Brak botow" description="Utworz bota, aby monitorowac jego sesje runtime." />
          ) : (
            <>
              <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Szybki wybor kontekstu bota</h3>
                  <span className="text-xs opacity-60">
                    {monitorQuickSwitchBots.length} kart
                    {bots.some((bot) => bot.isActive) ? " (aktywne)" : " (wszystkie)"}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
                      <p className="text-sm font-semibold">{bot.name}</p>
                      <p className="mt-1 text-[11px] opacity-70">
                        {bot.marketType} | {bot.mode} | {bot.isActive ? "ACTIVE" : "INACTIVE"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Sterowanie monitoringiem</h3>
                    <p className="text-xs opacity-70">
                      Ustaw zakres i filtr, a potem obserwuj teraz/historie/live-check bez przeladowan sekcji.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="label cursor-pointer gap-2 p-0">
                      <input
                        type="checkbox"
                        className="toggle toggle-sm"
                        aria-label="Auto refresh monitoringu"
                        checked={monitorAutoRefreshEnabled}
                        onChange={(event) => setMonitorAutoRefreshEnabled(event.target.checked)}
                      />
                      <span className="label-text text-xs">Auto refresh RUNNING (15s)</span>
                    </label>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => void refreshMonitoring()}>
                      Odswiez
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-6">
                  <label className="form-control">
                    <span className="label-text">Status sesji</span>
                    <select
                      className="select select-bordered"
                      value={monitorStatus}
                      onChange={(event) => setMonitorStatus(event.target.value as "ALL" | BotRuntimeSessionStatus)}
                    >
                      <option value="ALL">ALL</option>
                      <option value="RUNNING">RUNNING</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="FAILED">FAILED</option>
                      <option value="CANCELED">CANCELED</option>
                    </select>
                  </label>
                  <label className="form-control md:col-span-2">
                    <span className="label-text">Filtr symbolu (opcjonalnie)</span>
                    <input
                      className="input input-bordered"
                      placeholder="np. BTCUSDT"
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
                      Podpowiedz: wpisz np. BTCUSDT i nacisnij Enter, aby zawezic wszystkie sekcje monitoringu.
                    </p>
                  </label>
                  <div className="form-control">
                    <span className="label-text">&nbsp;</span>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleApplyMonitoringFilter}>
                        Zastosuj
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={handleClearMonitoringFilter}>
                        Wyczysc
                      </button>
                    </div>
                  </div>
                  <div className="form-control md:col-span-2">
                    <span className="label-text">Aktywny filtr</span>
                    <div className="rounded-md border border-base-300 bg-base-200 px-3 py-2 text-sm">
                      {monitorAppliedSymbolFilter || "brak"}
                    </div>
                  </div>
                </div>

                <p className="text-xs opacity-70">
                  {monitorHasRunningSession
                    ? monitorViewMode === "aggregate"
                      ? "Auto-refresh aktywny dla widoku zbiorczego."
                      : selectedMonitorSession?.status === "RUNNING"
                        ? "Auto-refresh aktywny dla biezacej sesji."
                        : "Auto-refresh aktywny dla sesji RUNNING."
                    : "Brak sesji RUNNING - auto-refresh jest automatycznie wstrzymany."}
                </p>

                <details className="rounded-md border border-base-300 bg-base-200">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide opacity-70">
                    Opcje zaawansowane
                  </summary>
                  <div className="grid gap-3 border-t border-base-300 p-3 md:grid-cols-6">
                    <label className="form-control md:col-span-2">
                      <span className="label-text">Bot (manualny wybor)</span>
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
                      <span className="label-text">Widok</span>
                      <select
                        className="select select-bordered"
                        value={monitorViewMode}
                        onChange={(event) => setMonitorViewMode(event.target.value as "aggregate" | "session")}
                      >
                        <option value="aggregate">Zbiorczy (domyslny)</option>
                        <option value="session">Sesja (zaawansowany)</option>
                      </select>
                    </label>
                    {monitorViewMode === "session" ? (
                      <label className="form-control md:col-span-3">
                        <span className="label-text">Sesja</span>
                        <select
                          className="select select-bordered"
                          value={monitorSessionId}
                          onChange={(event) => setMonitorSessionId(event.target.value)}
                          disabled={monitorSessions.length === 0}
                        >
                          {monitorSessions.length === 0 ? <option value="">Brak sesji</option> : null}
                          {monitorSessions.map((session) => (
                            <option key={session.id} value={session.id}>
                              {session.id.slice(0, 8)} | {session.status} | {formatDateTime(session.startedAt)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="form-control md:col-span-3">
                        <span className="label-text">Zakres</span>
                        <div className="rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm">
                          Wszystkie sesje ({monitorSessions.length})
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>

              {monitorLoading ? <LoadingState title="Ladowanie sesji runtime" /> : null}
              {!monitorLoading && monitorError ? (
                <ErrorState
                  title="Nie udalo sie pobrac monitoringu"
                  description={monitorError}
                  retryLabel="Sprobuj ponownie"
                  onRetry={() => {
                    if (!monitorBotId) return;
                    void refreshMonitoring();
                  }}
                />
              ) : null}

              {!monitorLoading && !monitorError && monitorSessions.length === 0 ? (
                <EmptyState
                  title="Brak sesji runtime"
                  description="Bot nie uruchomil jeszcze sesji monitoringu albo filtr statusu nic nie zwrocil."
                />
              ) : null}

              {!monitorLoading && !monitorError && monitorSessionDetail ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${toSessionStatusBadgeClass(monitorSessionDetail.status)}`}>
                        {monitorSessionDetail.status}
                      </span>
                      <span className="badge badge-outline">Mode: {monitorSessionDetail.mode}</span>
                      {monitorViewMode === "aggregate" ? (
                        <span className="text-xs opacity-70">Sesje: {monitorSessions.length}</span>
                      ) : (
                        <span className="text-xs opacity-70">
                          Session ID: {(selectedMonitorSession?.id ?? monitorSessionDetail.id).slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      <p>
                        <span className="opacity-60">Start:</span> {formatDateTime(monitorSessionDetail.startedAt)}
                      </p>
                      <p>
                        <span className="opacity-60">Koniec:</span> {formatDateTime(monitorSessionDetail.finishedAt)}
                      </p>
                      <p>
                        <span className="opacity-60">Heartbeat:</span>{" "}
                        {formatDateTime(monitorSessionDetail.lastHeartbeatAt)}
                      </p>
                      <p>
                        <span className="opacity-60">Czas:</span> {formatDuration(monitorSessionDetail.durationMs)}
                      </p>
                    </div>
                  </div>

                  {monitorSessionLoading ? <LoadingState title="Ladowanie danych sesji" /> : null}

                  {monitorSessionDetail ? (
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-65">Co jest teraz</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p>
                            <span className="opacity-60">Pozycje otwarte:</span>{" "}
                            <span className="font-semibold">{monitorPositions?.openCount ?? 0}</span>
                          </p>
                          <p>
                            <span className="opacity-60">Zlecenia otwarte:</span>{" "}
                            <span className="font-semibold">
                              {monitorPositions?.openOrdersCount ?? monitorPositions?.openOrders?.length ?? 0}
                            </span>
                          </p>
                          <p>
                            <span className="opacity-60">Open PnL:</span>{" "}
                            <span
                              className={`font-semibold ${
                                (monitorSymbolStats?.summary.unrealizedPnl ?? 0) >= 0 ? "text-success" : "text-error"
                              }`}
                            >
                              {formatCurrency(monitorSymbolStats?.summary.unrealizedPnl ?? 0)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-65">Co bylo</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p>
                            <span className="opacity-60">Trade'y zamkniete:</span>{" "}
                            <span className="font-semibold">{monitorSessionDetail.summary.closedTrades}</span>
                          </p>
                          <p>
                            <span className="opacity-60">Win rate:</span>{" "}
                            <span className="font-semibold">{formatNumber(monitorWinRate, 2)}%</span>
                          </p>
                          <p>
                            <span className="opacity-60">Realized PnL:</span>{" "}
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
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-65">Co bedzie</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p>
                            <span className="opacity-60">Sledzone symbole:</span>{" "}
                            <span className="font-semibold">{monitorSymbolStats?.items.length ?? 0}</span>
                          </p>
                          <p>
                            <span className="opacity-60">Sygnaly:</span>{" "}
                            <span className="font-semibold">{monitorSessionDetail.summary.totalSignals}</span>
                          </p>
                          <p>
                            <span className="opacity-60">DCA:</span>{" "}
                            <span className="font-semibold">{monitorSessionDetail.summary.dcaCount}</span>
                          </p>
                          <p>
                            <span className="opacity-60">Fees:</span>{" "}
                            <span className="font-semibold">{formatCurrency(monitorSessionDetail.summary.feesPaid)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {monitorSessionDetail ? (
                    <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-65">
                        Szybka kontrola operatora
                      </p>
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                          <p className="opacity-60">Heartbeat lag</p>
                          <p className="mt-1 font-semibold">{formatDuration(monitorHeartbeatLagMs ?? 0)}</p>
                        </div>
                        <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                          <p className="opacity-60">Ostatni sygnal</p>
                          <p className="mt-1 font-semibold">{formatDateTime(monitorLastSignalAt)}</p>
                        </div>
                        <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                          <p className="opacity-60">Ostatni trade</p>
                          <p className="mt-1 font-semibold">{formatDateTime(monitorLastTradeAt)}</p>
                        </div>
                        <div className="rounded-md border border-base-300 bg-base-200 px-2 py-2">
                          <p className="opacity-60">Otwarte pozycje / zlecenia</p>
                          <p className="mt-1 font-semibold">
                            {monitorPositions?.openCount ?? 0} /{" "}
                            {monitorPositions?.openOrdersCount ?? monitorPositions?.openOrders?.length ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <h3 className="text-sm font-semibold">1. Teraz - otwarte pozycje i zlecenia</h3>
                    <p className="mt-1 text-xs opacity-70">
                      Sekcja do natychmiastowej kontroli stanu live: co jest aktywne w tej chwili.
                    </p>
                  </div>

                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Teraz - otwarte pozycje</h3>
                      <span className="text-xs opacity-60">
                        {(monitorPositions?.openItems.length ?? 0)} / {(monitorPositions?.openCount ?? 0)} aktywne
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table table-xs table-zebra">
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th>Side</th>
                            <th>Otwarcie</th>
                            <th>Qty</th>
                            <th>Entry</th>
                            <th>Mark</th>
                            <th>DCA</th>
                            <th>Fees</th>
                            <th>Open PnL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(monitorPositions?.openItems ?? []).map((position) => (
                            <tr key={position.id}>
                              <td className="font-medium">{position.symbol}</td>
                              <td>{position.side}</td>
                              <td>{formatDateTime(position.openedAt)}</td>
                              <td>{formatNumber(position.quantity, 6)}</td>
                              <td>{formatNumber(position.entryPrice, 4)}</td>
                              <td>{position.markPrice != null ? formatNumber(position.markPrice, 4) : "-"}</td>
                              <td>{position.dcaCount}</td>
                              <td>{formatCurrency(position.feesPaid)}</td>
                              <td className={(position.unrealizedPnl ?? 0) >= 0 ? "text-success" : "text-error"}>
                                {formatCurrency(position.unrealizedPnl ?? 0)}
                              </td>
                            </tr>
                          ))}
                          {(monitorPositions?.openItems.length ?? 0) === 0 ? (
                            <tr>
                              <td colSpan={9} className="text-center text-xs opacity-70">
                                Brak otwartych pozycji w tej sesji.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Teraz - otwarte zlecenia</h3>
                      <span className="text-xs opacity-60">
                        {(monitorPositions?.openOrders ?? []).length} /{" "}
                        {monitorPositions?.openOrdersCount ?? monitorPositions?.openOrders?.length ?? 0} aktywne
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table table-xs table-zebra">
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th>Side</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Qty</th>
                            <th>Filled</th>
                            <th>Price</th>
                            <th>Stop</th>
                            <th>Submitted</th>
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
                                Brak otwartych zlecen.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <h3 className="text-sm font-semibold">2. Historia - zamkniete pozycje i wykonane transakcje</h3>
                    <p className="mt-1 text-xs opacity-70">
                      Sekcja do weryfikacji co juz sie wydarzylo: wynik, tempo i jakosc wykonania.
                    </p>
                  </div>

                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Historia - pozycje</h3>
                      <span className="text-xs opacity-60">
                        {(monitorPositions?.historyItems.length ?? 0)} / {(monitorPositions?.closedCount ?? 0)} zamkniete
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table table-xs table-zebra">
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th>Side</th>
                            <th>Otwarcie</th>
                            <th>Zamkniecie</th>
                            <th>Czas</th>
                            <th>Qty</th>
                            <th>Entry</th>
                            <th>Exit</th>
                            <th>DCA</th>
                            <th>Fees</th>
                            <th>Realized PnL</th>
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
                              <td>{position.dcaCount}</td>
                              <td>{formatCurrency(position.feesPaid)}</td>
                              <td className={position.realizedPnl >= 0 ? "text-success" : "text-error"}>
                                {formatCurrency(position.realizedPnl)}
                              </td>
                            </tr>
                          ))}
                          {(monitorPositions?.historyItems.length ?? 0) === 0 ? (
                            <tr>
                              <td colSpan={11} className="text-center text-xs opacity-70">
                                Brak zamknietych pozycji w tej sesji.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Historia - log operacyjny trade'ow</h3>
                      <span className="text-xs opacity-60">
                        {monitorOperationalTrades.length} / {(monitorTrades?.total ?? 0)} rekordow
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table table-xs table-zebra">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Czas</th>
                            <th>Symbol</th>
                            <th>Side</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Notional</th>
                            <th>Fee</th>
                            <th>Fee %</th>
                            <th>Realized PnL</th>
                            <th>PnL %</th>
                            <th>Skumulowany PnL</th>
                            <th>Origin</th>
                            <th>Order</th>
                            <th>Position</th>
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
                              <td>{formatNumber(trade.quantity, 6)}</td>
                              <td>{formatNumber(trade.price, 4)}</td>
                              <td>{formatCurrency(trade.notional)}</td>
                              <td>{formatCurrency(trade.fee)}</td>
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
                              <td colSpan={15} className="text-center text-xs opacity-70">
                                Brak transakcji dla tej sesji i filtra.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <h3 className="text-sm font-semibold">3. Co bedzie - live check sygnalow per para</h3>
                    <p className="mt-1 text-xs opacity-70">
                      Sekcja predykcyjna do szybkiej oceny, ktory symbol ma sygnal LONG/SHORT/EXIT lub brak sygnalu.
                    </p>
                  </div>

                  <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold">Co bedzie - live check sygnalow</h3>
                      <div className="text-right text-xs opacity-60">
                        <div>
                          {monitorSignalRows.length} / {monitorSessionDetail?.symbolsTracked ?? 0} symboli
                        </div>
                        <div className="opacity-50">Sort: najnowszy sygnal</div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table table-xs table-zebra">
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th>Sygnal</th>
                            <th>Czas sygnalu</th>
                            <th>Signals</th>
                            <th>L/S/E</th>
                            <th>DCA</th>
                            <th>Closed</th>
                            <th>W/L</th>
                            <th>Open qty</th>
                            <th>Realized PnL</th>
                            <th>Open PnL</th>
                            <th>Fees</th>
                            <th>Last trade</th>
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
                                  {item.lastSignalDirection ?? "NONE"}
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
                                Brak danych live-check sygnalow dla tej sesji i filtra.
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
        <div className="space-y-4 rounded-xl border border-base-300 bg-base-200 p-4">
          <h2 className="text-lg font-semibold">Konfiguracja asystenta</h2>
          <p className="text-sm opacity-70">
            Konfiguracja glownego asystenta i 4 slotow subagentow per bot.
          </p>

          {bots.length === 0 ? (
            <EmptyState
              title="Brak botow"
              description="Utworz najpierw bota, aby skonfigurowac Assistant."
            />
          ) : (
            <>
              <label className="form-control max-w-sm">
                <span className="label-text">Bot</span>
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
                <LoadingState title="Ladowanie konfiguracji asystenta" />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-5">
                    <label className="form-control">
                      <span className="label-text">Main enabled</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-success"
                        checked={assistantMainEnabled}
                        onChange={(event) => setAssistantMainEnabled(event.target.checked)}
                      />
                    </label>
                    <label className="form-control md:col-span-2">
                      <span className="label-text">Mandate</span>
                      <input
                        className="input input-bordered"
                        value={assistantMandate}
                        onChange={(event) => setAssistantMandate(event.target.value)}
                        placeholder="Trade only with clear risk-adjusted edge"
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text">Model profile</span>
                      <input
                        className="input input-bordered"
                        value={assistantModelProfile}
                        onChange={(event) => setAssistantModelProfile(event.target.value)}
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text">Safety mode</span>
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
                    <span className="label-text">Main latency (ms)</span>
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
                      {assistantSaving ? "Zapisywanie..." : "Zapisz main config"}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {assistantSlots.map((slot) => (
                      <div key={slot.slotIndex} className="rounded-lg border border-base-300 p-3">
                        <div className="mb-2 font-medium">Subagent slot {slot.slotIndex}</div>
                        <div className="grid gap-3 md:grid-cols-5">
                          <label className="form-control">
                            <span className="label-text">Enabled</span>
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
                            <span className="label-text">Role</span>
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
                            <span className="label-text">Profile</span>
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
                            <span className="label-text">Timeout (ms)</span>
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
                            <span className="label-text">Safety</span>
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
                            Zapisz slot
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            disabled={assistantSaving || !assistantBotId}
                            onClick={() => void handleClearSubagent(slot.slotIndex)}
                          >
                            Usun slot
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-base-300 p-3">
                    <div className="mb-2 font-medium">Decision Timeline (dry-run)</div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <label className="form-control">
                        <span className="label-text">Symbol</span>
                        <input
                          className="input input-bordered input-sm"
                          value={assistantDryRunSymbol}
                          onChange={(event) => setAssistantDryRunSymbol(event.target.value.toUpperCase())}
                        />
                      </label>
                      <label className="form-control">
                        <span className="label-text">Interval</span>
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
                          {assistantDryRunRunning ? "Uruchamianie..." : "Uruchom dry-run"}
                        </button>
                      </div>
                    </div>

                    {assistantTrace && (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-md border border-base-300 p-2 text-sm">
                          <div>Request: {assistantTrace.requestId}</div>
                          <div>Mode: {assistantTrace.mode}</div>
                          <div>Final decision: {assistantTrace.finalDecision}</div>
                          <div>Reason: {assistantTrace.finalReason}</div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="table table-xs">
                            <thead>
                              <tr>
                                <th>Slot</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Latency (ms)</th>
                                <th>Msg</th>
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
