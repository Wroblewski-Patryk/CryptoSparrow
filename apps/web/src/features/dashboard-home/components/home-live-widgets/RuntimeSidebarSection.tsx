import { LuBot, LuShieldCheck, LuTrophy } from "react-icons/lu";
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
    heartbeat: string;
    openPositions: string;
    signalsDca: string;
    netPnl: string;
    noSession: string;
    noActiveSessionWarning: string;
    capitalRiskTitle: string;
    portfolio: string;
    deltaFromStart: string;
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
  const walletTotal = Math.max(0, props.summary.paperEquity);
  const walletInPositions = Math.max(0, props.summary.usedMargin);
  const walletFree = Math.max(
    0,
    props.selectedData?.free ?? Math.max(0, walletTotal - walletInPositions)
  );
  const walletDenominator = Math.max(walletTotal, walletFree + walletInPositions, 1);
  const walletInPositionsPct = Math.max(0, Math.min(100, (walletInPositions / walletDenominator) * 100));
  const walletFreePct = Math.max(0, Math.min(100, (walletFree / walletDenominator) * 100));
  const panelFrameClassName =
    "rounded-box border-b-[3px] border-secondary/70 bg-gradient-to-br from-primary/70 to-secondary/70 p-px";
  const panelBodyClassName = "rounded-box bg-base-100/85 p-3";

  return (
    <aside className={props.asideClassName}>
      <div className="space-y-6">
        <section className={panelFrameClassName}>
          <div className={`${panelBodyClassName} text-xs`}>
            <div className="space-y-1.5">
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">{props.text.portfolio}</span>
                <span className="font-semibold">
                  {props.summary.paperStart > 0 ? props.formatAmountWithUnit(walletTotal) : "-"}
                </span>
              </p>
              <div className="space-y-2">
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
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-box py-1.5 text-left">
                    <p className="text-xs font-semibold">{props.formatAmountWithUnit(walletFree)}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">{props.text.freeFunds}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-primary">{props.formatPercent(walletFreePct)}</p>
                  </div>
                  <div className="rounded-box py-1.5 text-right">
                    <p className="text-xs font-semibold">{props.formatAmountWithUnit(walletInPositions)}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-65">{props.text.inPositionsShort}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-secondary">{props.formatPercent(walletInPositionsPct)}</p>
                  </div>
                </div>
              </div>
              <p className="flex items-center justify-between gap-2">
                <span className="opacity-65">{props.text.deltaFromStart}</span>
                <span className={`font-semibold ${props.summary.paperDelta >= 0 ? "text-success" : "text-error"}`}>
                  {props.summary.paperStart > 0
                    ? `${props.formatPercent((props.summary.paperDelta / props.summary.paperStart) * 100)} | ${props.formatAmountWithUnit(props.summary.paperDelta)}`
                    : "-"}
                </span>
              </p>
            </div>
          </div>
        </section>

        <section className={panelFrameClassName}>
          <div className={panelBodyClassName}>
            <label className="form-control gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-60">
                <LuBot className="h-3.5 w-3.5" aria-hidden />
                {props.text.selectedBot}
              </span>
              <div className="rounded-box border border-base-300/50 bg-base-100/65 p-2">
                <select
                  className="select select-sm select-bordered w-full"
                  value={props.selected?.bot.id ?? ""}
                  onChange={(event) => props.onSelectedBotIdChange(event.target.value)}
                >
                  {props.snapshots.map((item) => (
                    <option key={item.bot.id} value={item.bot.id}>
                      {item.bot.name} ({item.bot.mode})
                    </option>
                  ))}
                </select>
              </div>
            </label>

            {!props.selectedRuntimeCapabilityAvailable ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="badge badge-xs badge-warning badge-outline">
                  {props.placeholderBadgeLabel}
                </span>
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-box border border-base-300/50 bg-base-100/70 px-2.5 py-2">
                <p className="inline-flex items-center gap-1.5 opacity-70">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-base-300/60 bg-base-100/80">
                    <LuShieldCheck className="h-3 w-3" aria-hidden />
                  </span>
                  {props.text.status}
                </p>
                <p className="mt-1.5">
                  <span className={`badge badge-xs ${props.sessionBadgeClassName(props.selectedData?.session?.status)}`}>
                    {props.selectedData?.session?.status ?? props.text.noSession}
                  </span>
                </p>
              </div>
              <div className="rounded-box border border-base-300/50 bg-base-100/70 px-2.5 py-2">
                <p className="inline-flex items-center gap-1.5 opacity-70">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-base-300/60 bg-base-100/80">
                    <LuBot className="h-3 w-3" aria-hidden />
                  </span>
                  {props.text.mode}
                </p>
                <p className="mt-1.5 inline-flex items-center rounded-full border border-base-300/60 bg-base-100/85 px-2 py-0.5 font-semibold">
                  {props.selected?.bot.mode ?? "-"}
                </p>
              </div>
              <div className="rounded-box border border-base-300/50 bg-base-100/70 px-2.5 py-2">
                <p className="inline-flex items-center gap-1.5 opacity-70">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-base-300/60 bg-base-100/80">
                    <LuTrophy className="h-3 w-3" aria-hidden />
                  </span>
                  {props.text.winRate}
                </p>
                <p className="mt-1.5 font-semibold text-primary">
                  {props.selectedData?.winRate == null ? "-" : props.formatPercent(props.selectedData.winRate)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {props.selectedData?.session?.status !== "RUNNING" ? (
          <p className="text-[11px] rounded-box border border-warning/40 bg-warning/10 px-2 py-1 text-warning-content/80">
            {props.text.noActiveSessionWarning}
          </p>
        ) : null}

        <p className="text-[11px] opacity-60">
          {props.text.updatedAt(props.lastUpdatedAt ? props.formatDateTime(props.lastUpdatedAt) : "-")}
        </p>
      </div>
    </aside>
  );
}
