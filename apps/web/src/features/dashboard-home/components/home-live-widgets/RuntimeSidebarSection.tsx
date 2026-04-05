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
  formatPercent: (value: number) => string;
  formatDateTime: (value?: string | null) => string;
  sessionBadgeClassName: (status?: string | null) => string;
  text: {
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
    exposure: string;
    realizedOpen: string;
    winRate: string;
    maxDrawdown: string;
    updatedAt: (value: string) => string;
  };
};

export default function RuntimeSidebarSection(props: RuntimeSidebarSectionProps) {
  return (
    <aside className={props.asideClassName}>
      <div className="space-y-3">
        <div className="rounded-box bg-base-200/35 p-3">
          <label className="form-control gap-1">
            <span className="text-[11px] uppercase tracking-wide opacity-60">{props.text.selectedBot}</span>
            <select
              className="select select-sm select-bordered"
              value={props.selected?.bot.id ?? ""}
              onChange={(event) => props.onSelectedBotIdChange(event.target.value)}
            >
              {props.snapshots.map((item) => (
                <option key={item.bot.id} value={item.bot.id}>
                  {item.bot.name} ({item.bot.mode})
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

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-box border border-base-300/50 bg-base-100/70 px-2 py-1.5">
              <p className="opacity-65">{props.text.status}</p>
              <p className="mt-1">
                <span className={`badge badge-xs ${props.sessionBadgeClassName(props.selectedData?.session?.status)}`}>
                  {props.selectedData?.session?.status ?? props.text.noSession}
                </span>
              </p>
            </div>
            <div className="rounded-box border border-base-300/50 bg-base-100/70 px-2 py-1.5">
              <p className="opacity-65">{props.text.mode}</p>
              <p className="mt-1 font-semibold">{props.selected?.bot.mode ?? "-"}</p>
            </div>
            <div className="rounded-box border border-base-300/50 bg-base-100/70 px-2 py-1.5">
              <p className="opacity-65">{props.text.heartbeat}</p>
              <p className="mt-1 font-semibold">{props.formatTime(props.selectedData?.session?.lastHeartbeatAt)}</p>
            </div>
            <div className="rounded-box border border-base-300/50 bg-base-100/70 px-2 py-1.5">
              <p className="opacity-65">{props.text.openPositions}</p>
              <p className="mt-1 font-semibold">{props.formatNumber(props.selectedData?.open.length ?? 0)}</p>
            </div>
            <div className="rounded-box border border-base-300/50 bg-base-100/70 px-2 py-1.5">
              <p className="opacity-65">{props.text.signalsDca}</p>
              <p className="mt-1 font-semibold">
                {props.formatNumber(props.selectedData?.session?.summary.totalSignals ?? 0)} / {props.formatNumber(props.selectedData?.session?.summary.dcaCount ?? 0)}
              </p>
            </div>
            <div className="rounded-box border border-base-300/50 bg-base-100/70 px-2 py-1.5">
              <p className="opacity-65">{props.text.netPnl}</p>
              <p className={`mt-1 font-semibold ${(props.selectedData?.net ?? 0) >= 0 ? "text-success" : "text-error"}`}>
                {props.formatCurrency(props.selectedData?.net ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {props.selectedData?.session?.status !== "RUNNING" ? (
          <p className="text-[11px] rounded-box border border-warning/40 bg-warning/10 px-2 py-1 text-warning-content/80">
            {props.text.noActiveSessionWarning}
          </p>
        ) : null}

        <div className="rounded-box bg-base-200/35 p-3 text-xs">
          <h4 className="mb-2 text-[11px] uppercase tracking-wide opacity-60">{props.text.capitalRiskTitle}</h4>
          <div className="space-y-1.5">
            <p className="flex items-center justify-between gap-2">
              <span className="opacity-65">{props.text.portfolio}</span>
              <span className={`font-semibold ${props.summary.paperDelta >= 0 ? "text-success" : "text-error"}`}>
                {props.summary.paperStart > 0 ? props.formatCurrency(props.summary.paperEquity) : "-"}
              </span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="opacity-65">{props.text.deltaFromStart}</span>
              <span className={`font-semibold ${props.summary.paperDelta >= 0 ? "text-success" : "text-error"}`}>
                {props.summary.paperStart > 0
                  ? `${props.formatCurrency(props.summary.paperDelta)} (${props.formatPercent((props.summary.paperDelta / props.summary.paperStart) * 100)})`
                  : "-"}
              </span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="opacity-65">{props.text.freeFunds}</span>
              <span className="font-semibold">{props.selectedData?.equity == null ? "-" : props.formatCurrency(props.selectedData.free ?? 0)}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="opacity-65">{props.text.fundsInPositions}</span>
              <span className="font-semibold">{props.formatCurrency(props.summary.usedMargin)}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="opacity-65">{props.text.exposure}</span>
              <span className="font-semibold">{props.selectedData?.exposurePct != null ? props.formatPercent(props.selectedData.exposurePct) : "-"}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="opacity-65">{props.text.realizedOpen}</span>
              <span className="font-semibold">
                {props.formatCurrency(props.selectedData?.realized ?? 0)} / {props.formatCurrency(props.selectedData?.unrealized ?? 0)}
              </span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="opacity-65">{props.text.winRate}</span>
              <span className="font-semibold">{props.selectedData?.winRate == null ? "-" : props.formatPercent(props.selectedData.winRate)}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="opacity-65">{props.text.maxDrawdown}</span>
              <span className="font-semibold text-error">{props.formatCurrency(-(props.selectedData?.drawdown.abs ?? 0))}</span>
            </p>
          </div>
        </div>

        <p className="text-[11px] opacity-60">
          {props.text.updatedAt(props.lastUpdatedAt ? props.formatDateTime(props.lastUpdatedAt) : "-")}
        </p>
      </div>
    </aside>
  );
}
