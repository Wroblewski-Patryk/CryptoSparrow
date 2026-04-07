import { LuBot, LuChartCandlestick, LuChartLine, LuListChecks, LuShieldCheck, LuTrophy, LuWallet } from "react-icons/lu";
import type { RuntimeSelectedData, RuntimeSnapshot, RuntimeSummary } from "./types";

type RuntimeSidebarSectionProps = {
  asideClassName: string;
  snapshots: RuntimeSnapshot[];
  selected: RuntimeSnapshot | null;
  selectedData: RuntimeSelectedData | null;
  selectedRuntimeCapabilityAvailable: boolean;
  placeholderBadgeLabel: string;
  summary: RuntimeSummary;
  lastUpdatedAt: string | null;
  onSelectedBotIdChange: (botId: string) => void;
  formatTime: (value?: string | null) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number) => string;
  formatAmountWithUnit: (value: number) => string;
  formatPercent: (value: number) => string;
  formatDateTime: (value?: string | null) => string;
  sessionBadgeClassName: (status?: string | null) => string;
  text: {
    walletTitle: string;
    selectedBot: string;
    status: string;
    mode: string;
    marketContextTitle: string;
    strategyContextTitle: string;
    marketGroup: string;
    exchange: string;
    market: string;
    baseCurrency: string;
    strategy: string;
    interval: string;
    leverage: string;
    walletAllocation: string;
    heartbeat: string;
    openPositions: string;
    signalsDca: string;
    netPnl: string;
    noSession: string;
    noActiveSessionWarning: string;
    capitalRiskTitle: string;
    portfolio: string;
    deltaFromStart: string;
    markets: string;
    strategies: string;
    freeFunds: string;
    fundsInPositions: string;
    inPositionsShort: string;
    exposure: string;
    realizedOpen: string;
    winRate: string;
    maxDrawdown: string;
    updatedAt: (value: string) => string;
  };
};

export default function RuntimeSidebarSection(props: RuntimeSidebarSectionProps) {
  const selectedWallet = props.selected?.bot.wallet ?? null;
  const selectedWalletMode = selectedWallet?.mode ?? props.selected?.bot.mode ?? null;
  const walletName = selectedWallet?.name ?? "-";
  const selectedUsedMargin = Math.max(0, props.selectedData?.usedMargin ?? 0);
  const selectedNet = props.selectedData?.net ?? 0;
  const paperStartBalance =
    selectedWalletMode === "PAPER"
      ? (props.selectedData?.paperInit ??
        selectedWallet?.paperInitialBalance ??
        props.selected?.bot.paperStartBalance ??
        null)
      : null;
  const liveFixedAllocation =
    selectedWalletMode === "LIVE" && selectedWallet?.liveAllocationMode === "FIXED"
      ? selectedWallet.liveAllocationValue ?? null
      : null;
  const walletBaseline = paperStartBalance ?? liveFixedAllocation;
  const walletTotal = walletBaseline != null ? Math.max(0, walletBaseline + selectedNet) : null;
  const walletFree = walletTotal != null ? Math.max(0, walletTotal - selectedUsedMargin) : props.selectedData?.free ?? null;
  const canCalculatePortfolioSplit = walletTotal != null && walletFree != null;
  const walletDenominator = canCalculatePortfolioSplit
    ? Math.max(walletTotal, walletFree + selectedUsedMargin, 1)
    : 1;
  const walletInPositionsPct = canCalculatePortfolioSplit
    ? Math.max(0, Math.min(100, (selectedUsedMargin / walletDenominator) * 100))
    : null;
  const walletFreePct = canCalculatePortfolioSplit
    ? Math.max(0, Math.min(100, (walletFree / walletDenominator) * 100))
    : null;
  const walletAllocationLabel =
    selectedWalletMode === "LIVE"
      ? selectedWallet?.liveAllocationMode === "PERCENT"
        ? `${selectedWallet.liveAllocationValue ?? 0}%`
        : selectedWallet?.liveAllocationMode === "FIXED"
          ? props.formatAmountWithUnit(selectedWallet.liveAllocationValue ?? 0)
          : "-"
      : "-";
  const panelFrameClassName =
    "rounded-box border-b-[3px] border-secondary/70 bg-gradient-to-br from-primary/70 to-secondary/70 p-px";
  const panelBodyClassName = "rounded-box bg-base-100/85 p-3";
  const statusValueClassName = (status?: string | null) => {
    if (status === "RUNNING") return "text-info";
    if (status === "COMPLETED") return "text-success";
    if (status === "FAILED") return "text-error";
    if (status === "CANCELED") return "text-warning";
    return "text-base-content/70";
  };
  const normalizedMarketType = (() => {
    if (!props.selected?.bot.marketType) return "-";
    return props.selected.bot.marketType === "FUTURES" ? "Futures" : "Spot";
  })();
  const runtimeGraph = props.selected?.runtimeGraph;
  const sortedGraphGroups = [...(runtimeGraph?.marketGroups ?? [])].sort(
    (left, right) => left.executionOrder - right.executionOrder
  );
  const primaryGroup = sortedGraphGroups.find((group) => group.isEnabled) ?? sortedGraphGroups[0] ?? null;
  const sortedGroupStrategies = [...(primaryGroup?.strategies ?? [])].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    return right.weight - left.weight;
  });
  const primaryStrategyFromGroup = sortedGroupStrategies.find((item) => item.isEnabled) ?? sortedGroupStrategies[0] ?? null;
  const fallbackLegacyStrategy = runtimeGraph?.legacyBotStrategies[0] ?? null;
  const selectedMarketGroupName =
    primaryGroup?.symbolGroup?.name ??
    fallbackLegacyStrategy?.symbolGroup?.name ??
    "-";
  const displayMarketGroupName =
    selectedMarketGroupName === "-"
      ? selectedMarketGroupName
      : selectedMarketGroupName.replace(/\s+group$/i, "");
  const selectedStrategyName =
    primaryStrategyFromGroup?.strategy?.name ??
    fallbackLegacyStrategy?.strategy?.name ??
    "-";
  const selectedStrategyInterval =
    primaryStrategyFromGroup?.strategy?.interval ??
    fallbackLegacyStrategy?.strategy?.interval ??
    "-";
  const selectedStrategyLeverage = (() => {
    const fromRuntimeGraph = (primaryStrategyFromGroup?.strategy as { leverage?: unknown } | undefined)?.leverage;
    if (typeof fromRuntimeGraph === "number" && Number.isFinite(fromRuntimeGraph) && fromRuntimeGraph > 0) {
      return `${fromRuntimeGraph}x`;
    }
    const fromOpenPosition = props.selectedData?.open?.find((item) => Number.isFinite(item.leverage) && item.leverage > 0);
    if (fromOpenPosition) return `${fromOpenPosition.leverage}x`;
    return "-";
  })();
  const selectedBaseCurrency = (() => {
    const fromWallet = selectedWallet?.baseCurrency;
    if (fromWallet) return fromWallet.toUpperCase();
    const fromTrades = props.selectedData?.trades.find((item) => item.feeCurrency)?.feeCurrency;
    if (fromTrades) return fromTrades.toUpperCase();
    const symbol = props.selectedData?.symbols[0]?.symbol;
    if (!symbol) return "-";
    const normalized = symbol.trim().toUpperCase();
    const knownQuoteCurrencies = ["USDT", "USDC", "BUSD", "FDUSD", "TUSD", "USDP", "DAI", "USD", "BTC", "ETH", "BNB", "EUR", "TRY", "GBP", "JPY"];
    for (const quote of knownQuoteCurrencies) {
      if (normalized.endsWith(quote) && normalized.length > quote.length) return quote;
    }
    return "-";
  })();

  return (
    <aside className={props.asideClassName}>
      <div className="space-y-6">
        <section className={panelFrameClassName}>
          <div className={panelBodyClassName}>
            <label className="flex items-center justify-between gap-3">
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium tracking-wide opacity-60">
                <LuBot className="h-3.5 w-3.5" aria-hidden />
                {props.text.selectedBot}
              </span>
              <select
                className="select select-xs select-bordered h-8 min-h-8 w-44 max-w-[65%] bg-base-100/65"
                value={props.selected?.bot.id ?? ""}
                onChange={(event) => props.onSelectedBotIdChange(event.target.value)}
              >
                {props.snapshots.map((item) => (
                  <option key={item.bot.id} value={item.bot.id}>
                    {item.bot.name} ({item.bot.mode} · {item.bot.wallet?.name ?? "no-wallet"})
                  </option>
                ))}
              </select>
            </label>

            {!props.selectedRuntimeCapabilityAvailable ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="badge badge-xs badge-warning badge-outline">
                  {props.placeholderBadgeLabel}
                </span>
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-3 divide-x divide-base-300/40 text-xs">
              <div className="px-1.5 text-center">
                <p className="inline-flex items-center justify-center opacity-70">
                  <LuShieldCheck className="h-3.5 w-3.5" aria-hidden />
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wide opacity-60">{props.text.status}</p>
                <p className={`mt-1.5 font-semibold ${statusValueClassName(props.selectedData?.session?.status)}`}>
                  {props.selectedData?.session?.status ?? props.text.noSession}
                </p>
              </div>
              <div className="px-1.5 text-center">
                <p className="inline-flex items-center justify-center opacity-70">
                  <LuChartLine className="h-3.5 w-3.5" aria-hidden />
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wide opacity-60">{props.text.mode}</p>
                <p className="mt-1.5 font-semibold">{props.selected?.bot.mode ?? "-"}</p>
              </div>
              <div className="px-1.5 text-center">
                <p className="inline-flex items-center justify-center opacity-70">
                  <LuTrophy className="h-3.5 w-3.5" aria-hidden />
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wide opacity-60">{props.text.winRate}</p>
                <p className="mt-1.5 font-semibold text-primary">
                  {props.selectedData?.winRate == null ? "-" : props.formatPercent(props.selectedData.winRate)}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-box border border-base-300/45 bg-base-100/60 px-2.5 py-2.5">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide opacity-65">
                  <LuChartCandlestick className="h-3.5 w-3.5" aria-hidden />
                  {props.text.marketContextTitle}
                </p>
                <div className="mt-2 space-y-1.5">
                  <p className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                    <span className="opacity-65">{props.text.marketGroup}</span>
                    <span className="min-w-0 break-words text-right font-semibold">{displayMarketGroupName}</span>
                  </p>
                  <p className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                    <span className="opacity-65">{props.text.exchange}</span>
                    <span className="min-w-0 break-words text-right font-semibold">{props.selected?.bot.exchange ?? "-"}</span>
                  </p>
                  <p className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                    <span className="opacity-65">{props.text.market}</span>
                    <span className="min-w-0 break-words text-right font-semibold">{normalizedMarketType}</span>
                  </p>
                  <p className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                    <span className="opacity-65">{props.text.baseCurrency}</span>
                    <span className="min-w-0 break-words text-right font-semibold">{selectedBaseCurrency}</span>
                  </p>
                </div>
              </div>
              <div className="rounded-box border border-base-300/45 bg-base-100/60 px-2.5 py-2.5">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide opacity-65">
                  <LuListChecks className="h-3.5 w-3.5" aria-hidden />
                  {props.text.strategyContextTitle}
                </p>
                <div className="mt-2 space-y-1.5">
                  <p className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                    <span className="opacity-65">{props.text.strategy}</span>
                    <span className="min-w-0 break-words text-right font-semibold">{selectedStrategyName}</span>
                  </p>
                  <p className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                    <span className="opacity-65">{props.text.interval}</span>
                    <span className="min-w-0 break-words text-right font-semibold">{selectedStrategyInterval}</span>
                  </p>
                  <p className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                    <span className="opacity-65">{props.text.leverage}</span>
                    <span className="min-w-0 break-words text-right font-semibold">{selectedStrategyLeverage}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={panelFrameClassName}>
          <div className={`${panelBodyClassName} text-xs`}>
            <div className="space-y-1.5">
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">{props.text.walletTitle}</span>
                <span className="font-semibold">{walletName}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">{props.text.mode}</span>
                <span className="font-semibold">{selectedWalletMode ?? "-"}</span>
              </p>
              {selectedWalletMode === "LIVE" ? (
                <p className="flex items-center justify-between gap-2">
                  <span className="opacity-65">{props.text.walletAllocation}</span>
                  <span className="font-semibold">{walletAllocationLabel}</span>
                </p>
              ) : null}
              <p className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 opacity-65">
                  <LuWallet className="h-3.5 w-3.5" aria-hidden />
                  {props.text.portfolio}
                </span>
                <span className="font-semibold">
                  {walletTotal != null ? props.formatAmountWithUnit(walletTotal) : "-"}
                </span>
              </p>
              <div className="space-y-2">
                {walletFreePct != null && walletInPositionsPct != null ? (
                  <div className="flex h-2 overflow-hidden rounded-full bg-base-300/30">
                    <div
                      className="h-full bg-primary/80 transition-all"
                      style={{ width: `${walletFreePct}%` }}
                    />
                    <div
                      className="h-full bg-secondary/80 transition-all"
                      style={{ width: `${walletInPositionsPct}%` }}
                    />
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-box py-1.5 text-left">
                    <p className="text-xs font-semibold">
                      {walletFree != null ? props.formatAmountWithUnit(walletFree) : "-"}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">{props.text.freeFunds}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-primary">
                      {walletFreePct != null ? props.formatPercent(walletFreePct) : "-"}
                    </p>
                  </div>
                  <div className="rounded-box py-1.5 text-right">
                    <p className="text-xs font-semibold">{props.formatAmountWithUnit(selectedUsedMargin)}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">{props.text.inPositionsShort}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-secondary">
                      {walletInPositionsPct != null ? props.formatPercent(walletInPositionsPct) : "-"}
                    </p>
                  </div>
                </div>
              </div>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">{props.text.deltaFromStart}</span>
                <span className={`font-semibold ${selectedNet >= 0 ? "text-success" : "text-error"}`}>
                  {walletBaseline != null && walletBaseline > 0
                    ? `${props.formatPercent((selectedNet / walletBaseline) * 100)} | ${props.formatAmountWithUnit(selectedNet)}`
                    : "-"}
                </span>
              </p>
            </div>
          </div>
        </section>

        {props.selectedData?.session?.status !== "RUNNING" ? (
          <p className="text-[11px] rounded-box border border-warning/40 bg-warning/10 px-2 py-1 text-warning-content/80">
            {props.text.noActiveSessionWarning}
          </p>
        ) : null}

      </div>
    </aside>
  );
}
