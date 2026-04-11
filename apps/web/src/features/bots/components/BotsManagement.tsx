'use client';

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import { TranslationKey } from "../../../i18n/translations";

import StatusBadge from "../../../ui/components/StatusBadge";
import { EmptyState, ErrorState, SuccessState } from "../../../ui/components/ViewState";
import { SkeletonCardBlock, SkeletonFormBlock, SkeletonKpiRow, SkeletonTableRows } from "../../../ui/components/loading";
import { BotsManagementTabs } from "./bots-management/BotsManagementTabs";
import { BotsMonitoringTab } from "./bots-management/BotsMonitoringTab";
import {
  Bot,
  BotMode,
  BotRuntimeSessionStatus,
  TradeMarket,
} from "../types/bot.type";
import { supportsExchangeCapability } from "../../exchanges/exchangeCapabilities";
import {
  pruneStickyFavorableMoveMap,
  resolveFallbackTtpProtectedPercent,
  toProtectedPnlPercentFromStopPrice,
} from "../utils/trailingStopDisplay";
import { formatDcaLadderCell } from "./bots-management/dcaLadderCell";
import { useBotsListController } from "../hooks/useBotsListController";
import { useBotsAssistantController } from "../hooks/useBotsAssistantController";
import { useBotsMonitoringController } from "../hooks/useBotsMonitoringController";

const MONITOR_STALE_WARNING_AFTER_MS = 20_000;

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

const FIELD_WRAPPER_CLASS = "form-control gap-1";
const META_CARD_CLASS = "rounded-box border border-base-300/60 bg-base-200/60 px-3 py-2";
const normalizeSymbol = (value: string) => value.trim().toUpperCase();

const toTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
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
  const confirmLiveRisk = (message: string) => window.confirm(message);

  useEffect(() => {
    if (!lockedTab) return;
    setActiveTab(lockedTab);
  }, [lockedTab]);

  const {
    bots,
    canCreate,
    creating,
    deletingId,
    error,
    handleCreate,
    handleDelete,
    handleSave,
    loadBots,
    loading,
    marketFilter,
    marketGroupId,
    marketGroups,
    name,
    patchBot,
    savingId,
    selectedMarketGroup,
    selectedStrategy,
    selectedStrategyMaxOpenPositions,
    selectedWallet,
    setMarketFilter,
    setMarketGroupId,
    setName,
    setStrategyId,
    setWalletId,
    strategyId,
    strategies,
    walletId,
    wallets,
  } = useBotsListController({
    confirmLiveRisk,
    t,
  });

  const {
    assistantBotId,
    assistantDryRunInterval,
    assistantDryRunRunning,
    assistantDryRunSymbol,
    assistantLatencyMs,
    assistantLoading,
    assistantMainEnabled,
    assistantMandate,
    assistantModelProfile,
    assistantSafetyMode,
    assistantSaving,
    assistantSlots,
    assistantTrace,
    handleClearSubagent,
    handleRunAssistantDryRun,
    handleSaveAssistantMain,
    handleSaveSubagent,
    setAssistantBotId,
    setAssistantDryRunInterval,
    setAssistantDryRunSymbol,
    setAssistantLatencyMs,
    setAssistantMainEnabled,
    setAssistantMandate,
    setAssistantModelProfile,
    setAssistantSafetyMode,
    setAssistantSubagents,
  } = useBotsAssistantController({
    activeTab,
    bots,
    preferredBotId,
    t,
  });

  const {
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
  } = useBotsMonitoringController({
    activeTab,
    bots,
    preferredBotId,
    t,
  });

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
  }, [monitorLiveTickerPrices, monitorPositions?.openItems, monitorTtpStickyFavorableMoveByPositionRef, selectedMonitorBot]);

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

  useEffect(() => {
    if ((activeTab === "monitoring" || activeTab === "assistant") && marketFilter !== "ALL") {
      setMarketFilter("ALL");
    }
  }, [activeTab, marketFilter, setMarketFilter]);

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



