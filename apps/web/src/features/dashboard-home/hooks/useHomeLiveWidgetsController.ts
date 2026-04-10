'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Bot,
  BotRuntimeGraph,
  BotRuntimePositionsResponse,
  BotRuntimeSessionListItem,
  BotRuntimeSymbolStatsResponse,
  BotRuntimeTradesResponse,
} from "../../bots/types/bot.type";
import { TranslationKey } from "../../../i18n/translations";
import type {
  RuntimeDataTab,
  RuntimeSnapshot,
  TradeFiltersState,
  TradeSortBy,
  TradeSortDir,
} from "../components/home-live-widgets/types";

const MAX_DASHBOARD_BOTS = 8;
const AUTO_REFRESH_INTERVAL_MS = 5_000;
const LOAD_STALE_AFTER_MS = 20_000;
const SELECTED_BOT_STORAGE_KEY = "dashboard.home.selectedBotId";
const DASHBOARD_TRADE_HISTORY_SORT_STORAGE_KEY = "dashboard.home.tradeHistory.sort.v1";
const TRADE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const EMPTY_TRADE_FILTERS: TradeFiltersState = {
  symbol: "",
  side: "ALL",
  action: "ALL",
  from: "",
  to: "",
};

const getAxiosMessage = (err: unknown) =>
  axios.isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;

const toTs = (v?: string | null) => {
  if (!v) return 0;
  const ts = new Date(v).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const normalizeSymbol = (value: string) => value.trim().toUpperCase();

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

type TickerEventPayload = {
  symbol: string;
  lastPrice: number;
};

type UseHomeLiveWidgetsControllerArgs = {
  createMarketStreamEventSource: (params: { symbols: string[]; interval: string }) => EventSource;
  getBotRuntimeGraph: (botId: string) => Promise<BotRuntimeGraph>;
  listBotRuntimeSessionPositions: (
    botId: string,
    sessionId: string,
    query?: { limit?: number; symbol?: string }
  ) => Promise<BotRuntimePositionsResponse>;
  listBotRuntimeSessionSymbolStats: (
    botId: string,
    sessionId: string,
    query?: { limit?: number; symbol?: string }
  ) => Promise<BotRuntimeSymbolStatsResponse>;
  listBotRuntimeSessionTrades: (
    botId: string,
    sessionId: string,
    query?: Record<string, unknown>
  ) => Promise<BotRuntimeTradesResponse>;
  listBotRuntimeSessions: (botId: string, query?: { limit?: number }) => Promise<BotRuntimeSessionListItem[]>;
  listBots: () => Promise<Bot[]>;
  t: (key: TranslationKey) => string;
};

export const useHomeLiveWidgetsController = ({
  createMarketStreamEventSource,
  getBotRuntimeGraph,
  listBotRuntimeSessionPositions,
  listBotRuntimeSessionSymbolStats,
  listBotRuntimeSessionTrades,
  listBotRuntimeSessions,
  listBots,
  t,
}: UseHomeLiveWidgetsControllerArgs) => {
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
  const [runtimeStaleWatchNowMs, setRuntimeStaleWatchNowMs] = useState(() => Date.now());
  const ttpStickyFavorableMoveByPositionRef = useRef<Map<string, number>>(new Map());
  const loadInFlightRef = useRef(false);
  const loadStartedAtRef = useRef<number | null>(null);
  const signalRailRef = useRef<HTMLDivElement | null>(null);

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
            const runtimeGraph = await getBotRuntimeGraph(bot.id).catch(() => null);
            if (!primary) {
              return { bot, session: null, symbolStats: null, positions: null, runtimeGraph };
            }
            const [symbolStats, positions] = await Promise.all([
              listBotRuntimeSessionSymbolStats(bot.id, primary.id, { limit: 200 }),
              listBotRuntimeSessionPositions(bot.id, primary.id, { limit: 200 }),
            ]);
            return { bot, session: primary, symbolStats, positions, runtimeGraph };
          } catch (err) {
            return {
              bot,
              session: null,
              symbolStats: null,
              positions: null,
              runtimeGraph: null,
              loadError: getAxiosMessage(err) ?? t("dashboard.home.runtime.noSignalData"),
            };
          }
        })
      );

      setSnapshots(next);
      setSelectedBotId((prev) => (prev && next.some((x) => x.bot.id === prev) ? prev : next[0]?.bot.id ?? null));
      const hasFreshSnapshot = next.some((item) => !item.loadError);
      if (hasFreshSnapshot) {
        setLastUpdatedAt(new Date().toISOString());
      }
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRuntimeStaleWatchNowMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

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
        const query: Record<string, unknown> = {
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

  return {
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
  };
};
