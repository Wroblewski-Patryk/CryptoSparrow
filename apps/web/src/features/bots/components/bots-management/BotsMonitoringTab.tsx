'use client';

import { ReactNode } from "react";
import { TranslationKey } from "../../../../i18n/translations";
import { EmptyState, ErrorState } from "../../../../ui/components/ViewState";
import { SkeletonCardBlock, SkeletonKpiRow, SkeletonTableRows } from "../../../../ui/components/loading";
import { supportsExchangeCapability } from "../../../exchanges/exchangeCapabilities";
import {
  Bot,
  BotRuntimeSessionDetail,
  BotRuntimeSessionListItem,
  BotRuntimeSessionStatus,
} from "../../types/bot.type";

type MonitorChecklistItem = {
  key: string;
  label: string;
  ok: boolean;
  note: string;
};

type MonitorOpenPositionRow = {
  id: string;
  openedAt?: string | null;
  symbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  markPrice: number | null;
  entryNotional: number;
  marginUsed: number;
  marginInitPct: number | null;
  feesPaid: number;
  openPnl: number;
  pnlNotionalPct: number;
  pnlMarginPct: number;
  dcaCount: number;
  dcaExecutedLevels?: number[] | null;
  dcaPlannedLevels?: number[] | null;
  ttpProtectedPercent: number | null;
  tslProtectedPercent: number | null;
};

type MonitorOperationalTradeRow = {
  id: string;
  rowNo: number;
  executedAt: string;
  symbol: string;
  side: string;
  lifecycleAction: "OPEN" | "DCA" | "CLOSE" | "UNKNOWN";
  quantity: number;
  price: number;
  margin: number;
  fee: number;
  feePct: number;
  realizedPnl: number;
  pnlPct: number;
  cumulativePnl: number;
  origin: string;
  orderId: string;
  positionId: string;
  feeSource: "ESTIMATED" | "EXCHANGE_FILL";
  feePending: boolean;
  feeCurrency: string | null;
};

type BotsMonitoringTabProps = {
  t: (key: TranslationKey) => string;
  bots: Bot[];
  monitorQuickSwitchBots: Bot[];
  monitorBotId: string;
  setMonitorBotId: (botId: string) => void;
  monitorRuntimeCapabilityAvailable: boolean;
  selectedMonitorBot: Bot | null;
  monitorAutoRefreshEnabled: boolean;
  setMonitorAutoRefreshEnabled: (value: boolean) => void;
  refreshMonitoring: () => Promise<void>;
  monitorStatus: "ALL" | BotRuntimeSessionStatus;
  setMonitorStatus: (status: "ALL" | BotRuntimeSessionStatus) => void;
  monitorSymbolFilter: string;
  setMonitorSymbolFilter: (value: string) => void;
  handleApplyMonitoringFilter: () => void;
  handleClearMonitoringFilter: () => void;
  monitorAppliedSymbolFilter: string;
  monitorViewMode: "aggregate" | "session";
  setMonitorViewMode: (mode: "aggregate" | "session") => void;
  selectedMonitorSession: BotRuntimeSessionListItem | null;
  monitorSessions: BotRuntimeSessionListItem[];
  monitorSessionId: string;
  setMonitorSessionId: (sessionId: string) => void;
  monitorLoading: boolean;
  monitorError: string | null;
  monitorSessionDetail: BotRuntimeSessionDetail | null;
  monitorSymbolStats: { items: Array<{ symbol: string }> } | null;
  monitorChecklistItems: MonitorChecklistItem[];
  monitorSessionLoading: boolean;
  monitorPositions: {
    openCount: number;
    openOrdersCount?: number;
    openOrders?: Array<{
      id: string;
      symbol: string;
      side: string;
      type: string;
      status: string;
      quantity: number;
      filledQuantity: number;
      price?: number | null;
      stopPrice?: number | null;
      submittedAt?: string | null;
      createdAt?: string | null;
    }>;
    historyItems: Array<{
      id: string;
      symbol: string;
      side: string;
      openedAt?: string | null;
      closedAt?: string | null;
      holdMs: number;
      quantity: number;
      entryPrice: number;
      exitPrice?: number | null;
      dcaCount: number;
      dcaExecutedLevels?: number[] | null;
      dcaPlannedLevels?: number[] | null;
      feesPaid: number;
      realizedPnl: number;
    }>;
    closedCount?: number;
  } | null;
  monitorOpenMarginSummary: {
    totalNotional: number;
    totalMarginUsed: number;
    totalOpenPnl: number;
    marginInitPct: number | null;
  };
  monitorWinRate: number;
  monitorShowOpenOrders: boolean;
  monitorOpenPositionRows: MonitorOpenPositionRow[];
  monitorShowDynamicStopColumns: boolean;
  monitorOperationalTrades: MonitorOperationalTradeRow[];
  monitorTrades: { total: number } | null;
  monitorSignalRows: Array<{
    id: string;
    symbol: string;
    lastSignalDirection?: "LONG" | "SHORT" | "EXIT" | null;
    lastSignalDecisionAt?: string | null;
    lastSignalAt?: string | null;
    totalSignals: number;
    longEntries: number;
    shortEntries: number;
    exits: number;
    dcaCount: number;
    closedTrades: number;
    winningTrades: number;
    losingTrades: number;
    openPositionQty: number;
    realizedPnl: number;
    unrealizedPnl?: number | null;
    feesPaid: number;
    lastTradeAt?: string | null;
  }>;
  monitorHeartbeatLagMs: number | null;
  monitorDataIsStale: boolean;
  monitorDataAgeLabel: string | null;
  monitorLastSignalAt: string | null;
  monitorLastTradeAt: string | null;
  formatDateTime: (value?: string | null) => string;
  formatDuration: (ms: number) => string;
  formatNumber: (value: number, digits?: number) => string;
  formatCurrency: (value: number) => string;
  formatDcaLadderCell: (params: {
    id?: string;
    dcaCount: number;
    dcaExecutedLevels?: number[] | null;
    dcaPlannedLevels?: number[] | null;
  }) => ReactNode;
  interpolateTemplate: (template: string, values: Record<string, string | number>) => string;
  toSessionStatusBadgeClass: (status: BotRuntimeSessionStatus) => string;
  toTradeSideBadgeClass: (side: string) => string;
  toTradeLifecycleBadgeClass: (value: "OPEN" | "DCA" | "CLOSE" | "UNKNOWN") => string;
  toTradeLifecycleLabelKey: (value: "OPEN" | "DCA" | "CLOSE" | "UNKNOWN") => TranslationKey;
  formatTradeFeeMeta: (trade: {
    feeSource: "ESTIMATED" | "EXCHANGE_FILL";
    feePending: boolean;
    feeCurrency: string | null;
  }) => string;
};

export function BotsMonitoringTab(props: BotsMonitoringTabProps) {
  const {
    t,
    bots,
    monitorQuickSwitchBots,
    monitorBotId,
    setMonitorBotId,
    monitorRuntimeCapabilityAvailable,
    selectedMonitorBot,
    monitorAutoRefreshEnabled,
    setMonitorAutoRefreshEnabled,
    refreshMonitoring,
    monitorStatus,
    setMonitorStatus,
    monitorSymbolFilter,
    setMonitorSymbolFilter,
    handleApplyMonitoringFilter,
    handleClearMonitoringFilter,
    monitorAppliedSymbolFilter,
    monitorViewMode,
    setMonitorViewMode,
    selectedMonitorSession,
    monitorSessions,
    monitorSessionId,
    setMonitorSessionId,
    monitorLoading,
    monitorError,
    monitorSessionDetail,
    monitorSymbolStats,
    monitorChecklistItems,
    monitorSessionLoading,
    monitorPositions,
    monitorOpenMarginSummary,
    monitorWinRate,
    monitorShowOpenOrders,
    monitorOpenPositionRows,
    monitorShowDynamicStopColumns,
    monitorOperationalTrades,
    monitorTrades,
    monitorSignalRows,
    monitorHeartbeatLagMs,
    monitorDataIsStale,
    monitorDataAgeLabel,
    monitorLastSignalAt,
    monitorLastTradeAt,
    formatDateTime,
    formatDuration,
    formatNumber,
    formatCurrency,
    formatDcaLadderCell,
    interpolateTemplate,
    toSessionStatusBadgeClass,
    toTradeSideBadgeClass,
    toTradeLifecycleBadgeClass,
    toTradeLifecycleLabelKey,
    formatTradeFeeMeta,
  } = props;

  return (
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

                {monitorDataIsStale ? (
                  <p
                    className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-content/85"
                    aria-live="polite"
                  >
                    {t("dashboard.bots.monitoring.staleDataWarning").replace(
                      "{age}",
                      monitorDataAgeLabel ?? "-"
                    )}
                  </p>
                ) : null}

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

              {monitorLoading ? (
                <div className="space-y-3" aria-busy="true" aria-label={t("dashboard.bots.monitoring.loadingSessions")}>
                  <SkeletonKpiRow items={4} />
                  <SkeletonCardBlock cards={3} linesPerCard={3} title={false} className="border-base-300/40 bg-base-100/60 p-3" />
                </div>
              ) : null}
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

                  {monitorSessionLoading ? (
                    <SkeletonTableRows
                      columns={8}
                      rows={4}
                      title={false}
                      toolbar={false}
                      className="border-base-300/40 bg-base-100/60 p-3"
                    />
                  ) : null}

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
                                  {position.ttpProtectedPercent == null
                                    ? "-"
                                    : `${formatNumber(position.ttpProtectedPercent, 2)}%`}
                                </td>
                              ) : null}
                              {monitorShowDynamicStopColumns ? (
                                <td>
                                  {position.tslProtectedPercent == null
                                    ? "-"
                                    : `${formatNumber(position.tslProtectedPercent, 2)}%`}
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
  );
}
