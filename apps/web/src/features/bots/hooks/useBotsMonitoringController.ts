'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { TranslationKey } from "../../../i18n/translations";
import { createMarketStreamEventSource } from "../../../lib/marketStream";
import {
  getBotRuntimeSession,
  listBotRuntimeSessionPositions,
  listBotRuntimeSessions,
  listBotRuntimeSessionSymbolStats,
  listBotRuntimeSessionTrades,
} from "../services/bots.service";
import {
  Bot,
  BotRuntimePositionsResponse,
  BotRuntimeSessionDetail,
  BotRuntimeSessionListItem,
  BotRuntimeSessionStatus,
  BotRuntimeSymbolStatsResponse,
  BotRuntimeTradesResponse,
} from "../types/bot.type";

const MONITOR_AUTO_REFRESH_INTERVAL_MS = 5_000;

type TickerEventPayload = {
  symbol: string;
  lastPrice: number;
};

type MonitorAggregateData = {
  sessionDetail: BotRuntimeSessionDetail;
  symbolStats: BotRuntimeSymbolStatsResponse;
  positions: BotRuntimePositionsResponse;
  trades: BotRuntimeTradesResponse;
};

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const response = err.response?.data as { error?: { message?: string }; message?: string } | undefined;
  return response?.error?.message ?? response?.message;
};

const normalizeSymbol = (value: string) => value.trim().toUpperCase();

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
  const mode: "PAPER" | "LIVE" = sessions.some((session) => session.mode === "LIVE") ? "LIVE" : "PAPER";
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

type UseBotsMonitoringControllerArgs = {
  activeTab: "bots" | "monitoring" | "assistant";
  bots: Bot[];
  preferredBotId: string | null;
  t: (key: TranslationKey) => string;
};

export const useBotsMonitoringController = ({
  activeTab,
  bots,
  preferredBotId,
  t,
}: UseBotsMonitoringControllerArgs) => {
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

  const monitorStreamSymbols = useMemo(() => {
    const fromStats = monitorSymbolStats?.items?.map((item) => item.symbol) ?? [];
    const fromPositions = monitorPositions?.openItems?.map((item) => item.symbol) ?? [];
    return [...new Set([...fromStats, ...fromPositions].map((symbol) => normalizeSymbol(symbol)))];
  }, [monitorPositions?.openItems, monitorSymbolStats?.items]);
  const monitorStreamSymbolsKey = useMemo(
    () => monitorStreamSymbols.join(","),
    [monitorStreamSymbols]
  );

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

  return {
    handleApplyMonitoringFilter,
    handleClearMonitoringFilter,
    monitorAppliedSymbolFilter,
    monitorAutoRefreshEnabled,
    monitorBotId,
    monitorError,
    monitorLastUpdatedAt,
    monitorLiveTickerPrices,
    monitorLoading,
    monitorPositions,
    monitorSessionDetail,
    monitorSessionId,
    monitorSessionLoading,
    monitorSessions,
    monitorStaleWatchNowMs,
    monitorStatus,
    monitorSymbolFilter,
    monitorSymbolStats,
    monitorTtpStickyFavorableMoveByPositionRef,
    monitorTrades,
    monitorViewMode,
    refreshMonitoring,
    setMonitorAutoRefreshEnabled,
    setMonitorBotId,
    setMonitorSessionId,
    setMonitorStatus,
    setMonitorSymbolFilter,
    setMonitorViewMode,
  };
};
