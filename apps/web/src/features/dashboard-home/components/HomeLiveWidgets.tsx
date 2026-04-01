'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Link from "next/link";

import { EmptyState, ErrorState, LoadingState } from "../../../ui/components/ViewState";
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

type RuntimeSnapshot = {
  bot: Bot;
  session: BotRuntimeSessionListItem | null;
  symbolStats: BotRuntimeSymbolStatsResponse | null;
  positions: BotRuntimePositionsResponse | null;
  loadError?: string;
};
type TickerEventPayload = {
  symbol: string;
  lastPrice: number;
};
type OpenPositionWithLive = BotRuntimePositionItem & {
  liveMarkPrice: number | null;
  liveUnrealizedPnl: number;
  livePnlPct: number | null;
  marginNotional: number;
};
type DirectionPillValue = "LONG" | "SHORT" | "BUY" | "SELL";

const CARD = "rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm";
const BTN_PRIMARY = "btn btn-primary btn-sm";
const BTN_SECONDARY = "btn btn-outline btn-sm";
const MAX_DASHBOARD_BOTS = 8;
const AUTO_REFRESH_INTERVAL_MS = 5_000;
const LOAD_STALE_AFTER_MS = 20_000;
const SELECTED_BOT_STORAGE_KEY = "dashboard.home.selectedBotId";
const normalizeSymbol = (value: string) => value.trim().toUpperCase();

const getAxiosMessage = (err: unknown) =>
  axios.isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;

const toTs = (v?: string | null) => {
  if (!v) return 0;
  const ts = new Date(v).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const pickPrimarySession = (sessions: BotRuntimeSessionListItem[]) => {
  if (sessions.length === 0) return null;
  const running = sessions.filter((x) => x.status === "RUNNING");
  if (running.length > 0) {
    return [...running].sort((a, b) => toTs(b.startedAt) - toTs(a.startedAt))[0] ?? null;
  }
  return [...sessions].sort((a, b) => toTs(b.startedAt) - toTs(a.startedAt))[0] ?? null;
};

const sessionBadge = (status?: string | null) => {
  if (status === "RUNNING") return "badge-info";
  if (status === "COMPLETED") return "badge-success";
  if (status === "FAILED") return "badge-error";
  if (status === "CANCELED") return "badge-warning";
  return "badge-ghost";
};

type SignalPillValue = "LONG" | "SHORT" | "EXIT" | "NEUTRAL";

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
  if (value === "LONG") return "border-success/40 bg-success/10 text-success";
  if (value === "SHORT") return "border-error/40 bg-error/10 text-error";
  if (value === "EXIT") return "border-warning/40 bg-warning/10 text-warning";
  return "border-base-300 bg-base-100 text-base-content/70";
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
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${signalPillClass(value)}`}>
    <SignalPillIcon value={value} />
    <span className="font-medium">{value}</span>
  </span>
);

const resolveUsedMargin = (positions: BotRuntimePositionsResponse | null) =>
  (positions?.openItems ?? []).reduce((sum, p) => {
    const lev = Number.isFinite(p.leverage) && p.leverage > 0 ? p.leverage : 1;
    return sum + p.entryNotional / lev;
  }, 0);

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
    const grossLiveUnrealizedPnl =
      liveMarkPrice == null
        ? (position.unrealizedPnl ?? 0)
        : position.side === "LONG"
          ? (liveMarkPrice - position.entryPrice) * position.quantity
          : (position.entryPrice - liveMarkPrice) * position.quantity;
    // Open PnL presented as net value including fees paid on the position.
    const liveUnrealizedPnl = grossLiveUnrealizedPnl - (position.feesPaid ?? 0);
    const livePnlPct = marginNotional > 0 ? (liveUnrealizedPnl / marginNotional) * 100 : null;

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
  const { formatCurrency, formatDateTime, formatNumber, formatPercent, formatTime } = useLocaleFormatting();
  const [bots, setBots] = useState<Bot[]>([]);
  const [snapshots, setSnapshots] = useState<RuntimeSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<BotRuntimeTradesResponse | null>(null);
  const [selectedTradesLoading, setSelectedTradesLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [liveTickerPrices, setLiveTickerPrices] = useState<Record<string, number>>({});
  const loadInFlightRef = useRef(false);
  const loadStartedAtRef = useRef<number | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean; showRefreshing?: boolean }) => {
    const silent = opts?.silent ?? false;
    const showRefreshing = opts?.showRefreshing ?? false;
    if (silent && loadInFlightRef.current) {
      const startedAt = loadStartedAtRef.current ?? 0;
      if (Date.now() - startedAt < LOAD_STALE_AFTER_MS) return;
    }
    loadInFlightRef.current = true;
    loadStartedAtRef.current = Date.now();
    if (showRefreshing) setRefreshing(true);
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
            const runningSessions = await listBotRuntimeSessions(bot.id, { status: "RUNNING", limit: 20 });
            const primary = pickPrimarySession(runningSessions);
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
              loadError: getAxiosMessage(err) ?? "Brak danych runtime",
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
        setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac podsumowania dashboardu.");
      }
    } finally {
      loadInFlightRef.current = false;
      loadStartedAtRef.current = null;
      if (showRefreshing) setRefreshing(false);
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(SELECTED_BOT_STORAGE_KEY);
    if (saved) setSelectedBotId(saved);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (snapshots.length === 0) return;
    const timer = window.setInterval(() => void load({ silent: true }), AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [snapshots.length, load]);

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
        const trades = await listBotRuntimeSessionTrades(selected.bot.id, selected.session.id, { limit: 300 });
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
  }, [selected?.bot.id, selected?.session?.id, refreshToken]);

  const summary = useMemo(() => {
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

  const selectedData = useMemo(() => {
    if (!selected) return null;
    const session = selected.session;
    const symbolsBase = [...(selected.symbolStats?.items ?? [])].sort(
      (a, b) => Math.max(toTs(b.lastSignalDecisionAt), toTs(b.lastSignalAt)) - Math.max(toTs(a.lastSignalDecisionAt), toTs(a.lastSignalAt))
    );
    const streamPrices = new Map<string, number>(Object.entries(liveTickerPrices));
    const open = buildLiveOpenPositions(selected.positions, selected.symbolStats, streamPrices);
    const openQtyBySymbol = new Map<string, number>();
    const openUnrealizedBySymbol = new Map<string, number>();
    for (const row of open) {
      const key = normalizeSymbol(row.symbol);
      openQtyBySymbol.set(key, (openQtyBySymbol.get(key) ?? 0) + row.quantity);
      openUnrealizedBySymbol.set(key, (openUnrealizedBySymbol.get(key) ?? 0) + row.liveUnrealizedPnl);
    }
    const symbols = symbolsBase.map((item) => {
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
    const unrealized = open.length > 0 ? open.reduce((sum, row) => sum + row.liveUnrealizedPnl, 0) : resolveUnrealized(selected);
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
      open,
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

  const showDynamicStopColumns = useMemo(
    () =>
      (selectedData?.open ?? []).some(
        (row) => row.dynamicTtpStopLoss != null || row.dynamicTslStopLoss != null
      ),
    [selectedData?.open]
  );

  if (loading) return <LoadingState title="Ladowanie dashboardu operacyjnego" />;
  if (error) return <ErrorState title="Nie udalo sie zaladowac dashboardu operacyjnego" description={error} retryLabel="Sprobuj ponownie" onRetry={() => void load()} />;
  if (bots.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState title="Brak botow do podsumowania dashboardu" description="Dodaj pierwszego bota, aby uruchomic centrum operacyjne." />
        <div className="flex gap-2">
          <Link href="/dashboard/bots" className={BTN_PRIMARY}>Dodaj bota</Link>
          <Link href="/dashboard/strategies/list" className={BTN_SECONDARY}>Przejdz do strategii</Link>
        </div>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Brak aktywnych botow na dashboardzie"
          description="Aktywuj co najmniej jednego bota, aby zobaczyc live runtime."
        />
        <div className="flex gap-2">
          <Link href="/dashboard/bots" className={BTN_PRIMARY}>Przejdz do botow</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <section className={CARD}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Otwarte pozycje</h3><span className="text-xs opacity-60">{selectedData?.open.length ?? 0}</span></div>
            <div className="overflow-x-auto rounded-lg border border-base-300/70 bg-base-200/40">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Czas otwarcia</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Margin</th>
                    <th>PnL</th>
                    <th>PnL %</th>
                    <th>DCA</th>
                    {showDynamicStopColumns ? <th>SL (TTP)</th> : null}
                    {showDynamicStopColumns ? <th>SL (TSL)</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {(selectedData?.open ?? []).map((p) => {
                    const pnl = p.liveUnrealizedPnl;
                    return (
                      <tr key={p.id}>
                        <td>{formatTime(p.openedAt)}</td>
                        <td className="font-medium">{p.symbol}</td>
                        <td><DirectionPill value={p.side} /></td>
                        <td>{formatCurrency(p.marginNotional)}</td>
                        <td className={pnl >= 0 ? "text-success" : "text-error"}>{formatCurrency(pnl)}</td>
                        <td className={pnl >= 0 ? "text-success" : "text-error"}>{p.livePnlPct == null ? "-" : formatPercent(p.livePnlPct)}</td>
                        <td>{p.dcaCount}</td>
                        {showDynamicStopColumns ? (
                          <td>
                            {p.dynamicTtpStopLoss == null
                              ? "-"
                              : formatNumber(p.dynamicTtpStopLoss, { maximumFractionDigits: 4 })}
                          </td>
                        ) : null}
                        {showDynamicStopColumns ? (
                          <td>
                            {p.dynamicTslStopLoss == null
                              ? "-"
                              : formatNumber(p.dynamicTslStopLoss, { maximumFractionDigits: 4 })}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                  {(selectedData?.open.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={showDynamicStopColumns ? 9 : 7} className="text-center text-xs opacity-70">
                        Brak otwartych pozycji.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className={CARD}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{selected?.bot.mode === "LIVE" ? "Zlecenia i historia transakcji" : "Historia transakcji"}</h3><span className="text-xs opacity-60">{selectedTradesLoading ? "Ladowanie..." : `${selectedData?.trades.length ?? 0}`}</span></div>
            <div className="overflow-x-auto rounded-lg border border-base-300/70 bg-base-200/40">
              <table className="table table-sm">
                <thead><tr><th>Czas</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Notional</th><th>Fee</th><th>Realized PnL</th><th>Origin</th></tr></thead>
                <tbody>
                  {(selectedData?.trades ?? []).map((t) => (
                    <tr key={t.id}>
                      <td>{formatDateTime(t.executedAt)}</td>
                      <td className="font-medium">{t.symbol}</td>
                      <td><DirectionPill value={t.side === "BUY" ? "BUY" : "SELL"} /></td>
                      <td>{formatNumber(t.quantity, { maximumFractionDigits: 6 })}</td>
                      <td>{formatNumber(t.price, { maximumFractionDigits: 4 })}</td>
                      <td>{formatCurrency(t.notional)}</td>
                      <td>{formatCurrency(t.fee)}</td>
                      <td className={t.realizedPnl >= 0 ? "text-success" : "text-error"}>{formatCurrency(t.realizedPnl)}</td>
                      <td>{t.origin}</td>
                    </tr>
                  ))}
                  {(selectedData?.trades.length ?? 0) === 0 ? <tr><td colSpan={9} className="text-center text-xs opacity-70">Brak historii transakcji.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className={CARD}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Live checks</h3><span className="text-xs opacity-60">{selectedData?.symbols.length ?? 0} par</span></div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(selectedData?.symbols ?? []).map((s) => {
                const signal: SignalPillValue = s.lastSignalDirection ?? "NEUTRAL";
                return (
                  <article key={s.id} className="rounded-lg border border-base-300/70 bg-base-200/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold tracking-wide">{s.symbol}</p>
                      <SignalPill value={signal} />
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] leading-4 opacity-75">
                      <div>
                        <p className="opacity-60">Warunki:</p>
                        {s.lastSignalConditionLines && s.lastSignalConditionLines.length > 0 ? (
                          <ul className="mt-1 space-y-1">
                            {s.lastSignalConditionLines.map((line, index) => (
                              <li key={`${s.id}-condition-${index}`} className="flex flex-wrap items-center gap-1">
                                <span
                                  className={
                                    line.scope === "LONG"
                                      ? "inline-flex rounded border border-success/40 bg-success/10 px-1 py-[1px] text-[10px] font-semibold text-success"
                                      : "inline-flex rounded border border-error/40 bg-error/10 px-1 py-[1px] text-[10px] font-semibold text-error"
                                  }
                                >
                                  {line.scope}
                                </span>
                                <span>{line.left}</span>
                                <span>=</span>
                                <span className="font-semibold">{line.value}</span>
                                <span>{line.operator}</span>
                                <span>{line.right}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 font-medium">-</p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
              {(selectedData?.symbols.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-base-300/70 bg-base-200/40 p-4 text-center text-xs opacity-70">
                  Brak danych sygnalowych.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className={`${CARD} h-fit`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide opacity-75">Bot runtime i ryzyko</h3>
              <span className="text-xs opacity-60">{snapshots.length}</span>
            </div>

            <label className="form-control gap-1">
              <span className="text-[11px] uppercase tracking-wide opacity-60">Wybrany bot</span>
              <select
                className="select select-sm select-bordered"
                value={selected?.bot.id ?? ""}
                onChange={(event) => setSelectedBotId(event.target.value)}
              >
                {snapshots.map((item) => (
                  <option key={item.bot.id} value={item.bot.id}>
                    {item.bot.name} ({item.bot.mode})
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-y border-base-300/80 py-2 text-xs">
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Status</span>
                <span className={`badge badge-xs ${sessionBadge(selectedData?.session?.status)}`}>
                  {selectedData?.session?.status ?? "NO_SESSION"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Tryb</span>
                <span className="font-semibold">{selected?.bot.mode ?? "-"}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Heartbeat</span>
                <span className="font-semibold">{formatTime(selectedData?.session?.lastHeartbeatAt)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Open pozycje</span>
                <span className="font-semibold">{formatNumber(selected?.positions?.openCount ?? 0)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Sygnaly / DCA</span>
                <span className="font-semibold">
                  {formatNumber(selectedData?.session?.summary.totalSignals ?? 0)} / {formatNumber(selectedData?.session?.summary.dcaCount ?? 0)}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Net PnL</span>
                <span className={`font-semibold ${(selectedData?.net ?? 0) >= 0 ? "text-success" : "text-error"}`}>
                  {formatCurrency(selectedData?.net ?? 0)}
                </span>
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <h4 className="text-[11px] uppercase tracking-wide opacity-60">Kapital i ryzyko</h4>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Portfel</span>
                <span className={`font-semibold ${summary.paperDelta >= 0 ? "text-success" : "text-error"}`}>
                  {summary.paperStart > 0 ? formatCurrency(summary.paperEquity) : "-"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Zmiana</span>
                <span className={`font-semibold ${summary.paperDelta >= 0 ? "text-success" : "text-error"}`}>
                  {summary.paperStart > 0 ? formatCurrency(summary.paperDelta) : "-"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Zmiana %</span>
                <span className="font-semibold">
                  {summary.paperStart > 0 ? formatPercent((summary.paperDelta / summary.paperStart) * 100) : "-"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Wolne srodki</span>
                <span className="font-semibold">{selectedData?.equity == null ? "-" : formatCurrency(selectedData.free)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Srodki w pozycjach</span>
                <span className="font-semibold">{formatCurrency(summary.usedMargin)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Open / Exposure</span>
                <span className="font-semibold">
                  {formatNumber(summary.openPositions)} / {selectedData?.exposurePct != null ? formatPercent(selectedData.exposurePct) : "-"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Realized / Open</span>
                <span className="font-semibold">
                  {formatCurrency(selectedData?.realized ?? 0)} / {formatCurrency(selectedData?.unrealized ?? 0)}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Win rate</span>
                <span className="font-semibold">{selectedData?.winRate == null ? "-" : formatPercent(selectedData.winRate)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">Max drawdown</span>
                <span className="font-semibold text-error">{formatCurrency(-(selectedData?.drawdown.abs ?? 0))}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() => void load({ silent: true, showRefreshing: true })}
                disabled={refreshing}
              >
                {refreshing ? "Odswiezanie..." : "Odswiez"}
              </button>
              <Link href="/dashboard/bots" className={BTN_PRIMARY}>Boty runtime</Link>
            </div>

            <p className="text-[11px] opacity-60">
              Aktualizacja: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "-"}
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
