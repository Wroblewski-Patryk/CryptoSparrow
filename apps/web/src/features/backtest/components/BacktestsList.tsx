'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DegradedState,
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessState,
} from "../../../ui/components/ViewState";
import { useOptionalI18n } from "../../../i18n/useOptionalI18n";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { listStrategies } from "../../strategies/api/strategies.api";
import { StrategyDto } from "../../strategies/types/StrategyForm.type";
import {
  createBacktestRun,
  getBacktestRunReport,
  listBacktestRuns,
  listBacktestRunTrades,
} from "../services/backtests.service";
import { BacktestReport, BacktestRun, BacktestStatus, BacktestTrade } from "../types/backtest.type";
import { getAxiosMessage } from '@/lib/getAxiosMessage';
import { normalizeSymbol } from '@/lib/symbols';

const statuses: Array<BacktestStatus | "ALL"> = ["ALL", "PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELED"];

const pnlClass = (value: number | null) => {
  if (value == null) return "";
  if (value > 0) return "text-success";
  if (value < 0) return "text-error";
  return "";
};

const buildEquityCurve = (items: BacktestTrade[]) => {
  const sorted = [...items].sort((a, b) => (a.closedAt < b.closedAt ? -1 : 1));
  const points: number[] = [];
  let cumulative = 0;
  for (const trade of sorted) {
    cumulative += trade.pnl;
    points.push(cumulative);
  }
  return points;
};

const toSparklinePoints = (series: number[]) => {
  if (series.length === 0) return "";
  const width = 280;
  const height = 70;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  return series
    .map((value, index) => {
      const x = (index / Math.max(series.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
};

export function BacktestsList() {
  const { t } = useOptionalI18n();
  const { formatCurrency, formatDateTime, formatNumber, formatPercent } = useLocaleFormatting();
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<BacktestStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "trades" | "raw">("summary");

  const [name, setName] = useState("MVP Backtest Run");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("5m");
  const [strategyId, setStrategyId] = useState("");
  const [notes, setNotes] = useState("");

  const statusLabels = useMemo(
    () => ({
      ALL: t("dashboard.backtests.legacy.statusAll"),
      PENDING: t("dashboard.backtests.legacy.statusPending"),
      RUNNING: t("dashboard.backtests.legacy.statusRunning"),
      COMPLETED: t("dashboard.backtests.legacy.statusCompleted"),
      FAILED: t("dashboard.backtests.legacy.statusFailed"),
      CANCELED: t("dashboard.backtests.legacy.statusCanceled"),
    }),
    [t]
  );

  const copy = useMemo(
    () => ({
      createTitle: t("dashboard.backtests.legacy.createTitle"),
      createDescription: t("dashboard.backtests.legacy.createDescription"),
      nameLabel: t("dashboard.backtests.runsTable.colName"),
      namePlaceholder: t("dashboard.backtests.legacy.namePlaceholder"),
      symbolLabel: t("dashboard.backtests.runsTable.colSymbol"),
      symbolPlaceholder: t("dashboard.backtests.legacy.symbolPlaceholder"),
      timeframeLabel: t("dashboard.backtests.runsTable.colTimeframe"),
      timeframePlaceholder: t("dashboard.backtests.legacy.timeframePlaceholder"),
      strategyLabel: t("dashboard.backtests.createForm.strategy"),
      noStrategy: t("dashboard.backtests.createForm.noStrategies"),
      statusFilterLabel: t("dashboard.backtests.legacy.statusFilterLabel"),
      notesLabel: t("dashboard.backtests.createForm.notes"),
      notesPlaceholder: t("dashboard.backtests.createForm.notesPlaceholder"),
      refreshList: t("dashboard.backtests.legacy.refreshList"),
      creating: t("dashboard.backtests.createForm.creating"),
      createRun: t("dashboard.backtests.legacy.createRun"),
      loadingRunsTitle: t("dashboard.backtests.listView.loadingTitle"),
      errorRunsTitle: t("dashboard.backtests.listView.errorTitle"),
      retry: t("dashboard.backtests.listView.retry"),
      emptyRunsTitle: t("dashboard.backtests.listView.emptyTitle"),
      emptyRunsDescription: t("dashboard.backtests.listView.emptyDescription"),
      loadedSuccessTitle: t("dashboard.backtests.legacy.loadedSuccessTitle"),
      loadedSuccessDescriptionPrefix: t("dashboard.backtests.legacy.loadedSuccessDescriptionPrefix"),
      actionHeader: t("dashboard.backtests.runsTable.colActions"),
      preview: t("dashboard.backtests.runsTable.preview"),
      selectRunTitle: t("dashboard.backtests.legacy.selectRunTitle"),
      selectRunDescription: t("dashboard.backtests.legacy.selectRunDescription"),
      loadingRunDetailsTitle: t("dashboard.backtests.legacy.loadingRunDetailsTitle"),
      summaryTab: t("dashboard.backtests.legacy.summaryTab"),
      tradesTab: t("dashboard.backtests.legacy.tradesTab"),
      rawTab: t("dashboard.backtests.legacy.rawTab"),
      openOverlay: t("dashboard.backtests.legacy.openOverlay"),
      reportNotReadyTitle: t("dashboard.backtests.legacy.reportNotReadyTitle"),
      reportNotReadyDescription: t("dashboard.backtests.legacy.reportNotReadyDescription"),
      netPnl: t("dashboard.backtests.legacy.netPnl"),
      winRate: t("dashboard.backtests.legacy.winRate"),
      totalTrades: t("dashboard.backtests.legacy.totalTrades"),
      maxDrawdown: t("dashboard.backtests.legacy.maxDrawdown"),
      overlayQuality: t("dashboard.backtests.legacy.overlayQuality"),
      equityOverlay: t("dashboard.backtests.legacy.equityOverlay"),
      equityNoData: t("dashboard.backtests.legacy.equityNoData"),
      grossProfit: t("dashboard.backtests.legacy.grossProfit"),
      grossLoss: t("dashboard.backtests.legacy.grossLoss"),
      noTradesTitle: t("dashboard.backtests.legacy.noTradesTitle"),
      noTradesDescription: t("dashboard.backtests.legacy.noTradesDescription"),
      side: t("dashboard.backtests.legacy.side"),
      entry: t("dashboard.backtests.legacy.entry"),
      exit: t("dashboard.backtests.legacy.exit"),
      modalTitle: t("dashboard.backtests.legacy.modalTitle"),
      modalReportMissing: t("dashboard.backtests.legacy.modalReportMissing"),
      modalRunStatus: t("dashboard.backtests.legacy.modalRunStatus"),
      modalClose: t("dashboard.backtests.legacy.modalClose"),
      closeBackdrop: t("public.a11y.closeModalBackdrop"),
      detailsLoadError: t("dashboard.backtests.legacy.detailsLoadError"),
      loadRunsError: t("dashboard.backtests.legacy.loadRunsError"),
    }),
    [t]
  );

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  const equityCurve = useMemo(() => buildEquityCurve(trades), [trades]);
  const equityCurvePoints = useMemo(() => toSparklinePoints(equityCurve), [equityCurve]);
  const overlayQuality = useMemo(() => {
    const winRate = report?.winRate ?? 0;
    const maxDrawdown = report?.maxDrawdown ?? 100;
    const sharpe = report?.sharpe ?? 0;
    if ((report?.netPnl ?? 0) > 0 && winRate >= 55 && maxDrawdown <= 20 && sharpe >= 1) {
      return t("dashboard.backtests.legacy.overlayQualityStrong");
    }
    if ((report?.netPnl ?? 0) > 0 && winRate >= 45) {
      return t("dashboard.backtests.legacy.overlayQualityStable");
    }
    return t("dashboard.backtests.legacy.overlayQualityRisky");
  }, [report, t]);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBacktestRuns(selectedStatus === "ALL" ? undefined : selectedStatus);
      setRuns(data);
      setSelectedRunId((prev) => prev ?? data[0]?.id ?? null);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? copy.loadRunsError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadRunsError, selectedStatus]);

  const loadDetails = useCallback(async (runId: string) => {
    setDetailsLoading(true);
    try {
      const [tradesData, reportData] = await Promise.all([
        listBacktestRunTrades(runId),
        getBacktestRunReport(runId),
      ]);
      setTrades(tradesData);
      setReport(reportData);
    } catch (err: unknown) {
      toast.error(copy.detailsLoadError, {
        description: getAxiosMessage(err),
      });
      setTrades([]);
      setReport(null);
    } finally {
      setDetailsLoading(false);
    }
  }, [copy.detailsLoadError]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!selectedRunId) {
      setTrades([]);
      setReport(null);
      return;
    }
    void loadDetails(selectedRunId);
  }, [selectedRunId, loadDetails]);

  useEffect(() => {
    (async () => {
      try {
        const data = await listStrategies();
        setStrategies(data);
      } catch {
        setStrategies([]);
      }
    })();
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!name.trim() || !normalizedSymbol || !timeframe.trim()) return;

    setCreating(true);
    try {
      const created = await createBacktestRun({
        name: name.trim(),
        symbol: normalizedSymbol,
        timeframe: timeframe.trim(),
        strategyId: strategyId.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setRuns((prev) => [created, ...prev]);
      setSelectedRunId(created.id);
      toast.success(t("dashboard.backtests.toastCreated"));
    } catch (err: unknown) {
      toast.error(t("dashboard.backtests.toastCreateFailed"), {
        description: getAxiosMessage(err),
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleCreate} className="rounded-box border border-base-300/60 bg-base-200/60 p-4">
        <h2 className="text-lg font-semibold">{copy.createTitle}</h2>
        <p className="text-sm opacity-70">{copy.createDescription}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="form-control">
            <span className="label-text">{copy.nameLabel}</span>
            <input
              className="input input-bordered"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={copy.namePlaceholder}
            />
          </label>
          <label className="form-control">
            <span className="label-text">{copy.symbolLabel}</span>
            <input
              className="input input-bordered"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              placeholder={copy.symbolPlaceholder}
            />
          </label>
          <label className="form-control">
            <span className="label-text">{copy.timeframeLabel}</span>
            <input
              className="input input-bordered"
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value)}
              placeholder={copy.timeframePlaceholder}
            />
          </label>
          <label className="form-control md:col-span-2">
            <span className="label-text">{copy.strategyLabel}</span>
            <select
              className="select select-bordered"
              value={strategyId}
              onChange={(event) => setStrategyId(event.target.value)}
            >
              <option value="">{copy.noStrategy}</option>
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">{copy.statusFilterLabel}</span>
            <select
              className="select select-bordered"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as BacktestStatus | "ALL")}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control md:col-span-3">
            <span className="label-text">{copy.notesLabel}</span>
            <textarea
              className="textarea textarea-bordered"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={copy.notesPlaceholder}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void loadRuns()}>
            {copy.refreshList}
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
            {creating ? copy.creating : copy.createRun}
          </button>
        </div>
      </form>

      {loading && <LoadingState title={copy.loadingRunsTitle} />}
      {!loading && error && (
        <ErrorState
          title={copy.errorRunsTitle}
          description={error}
          retryLabel={copy.retry}
          onRetry={() => void loadRuns()}
        />
      )}
      {!loading && !error && runs.length === 0 && (
        <EmptyState
          title={copy.emptyRunsTitle}
          description={copy.emptyRunsDescription}
        />
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-box border border-base-300/60 bg-base-200/60 p-4">
            <SuccessState
              title={copy.loadedSuccessTitle}
              description={`${copy.loadedSuccessDescriptionPrefix} ${runs.length}`}
            />
            <div className="mt-3 overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>{t("dashboard.backtests.runsTable.colName")}</th>
                    <th>{t("dashboard.backtests.runsTable.colSymbol")}</th>
                    <th>{t("dashboard.backtests.runsTable.colTimeframe")}</th>
                    <th>{t("dashboard.backtests.runsTable.colStatus")}</th>
                    <th>{t("dashboard.backtests.runsTable.colStart")}</th>
                    <th>{copy.actionHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className={selectedRunId === run.id ? "bg-base-300/40" : ""}>
                      <td>{run.name}</td>
                      <td>{run.symbol}</td>
                      <td>{run.timeframe}</td>
                      <td>
                        <span className="badge badge-outline">{run.status}</span>
                      </td>
                      <td>{formatDateTime(run.startedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => setSelectedRunId(run.id)}
                        >
                          {copy.preview}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-box border border-base-300/60 bg-base-200/60 p-4">
            {!selectedRun && (
              <DegradedState
                title={copy.selectRunTitle}
                description={copy.selectRunDescription}
              />
            )}

            {selectedRun && detailsLoading && <LoadingState title={copy.loadingRunDetailsTitle} />}

            {selectedRun && !detailsLoading && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{copy.summaryTab}</h3>
                  <button type="button" className="btn btn-xs btn-primary" onClick={() => setOverlayOpen(true)}>
                    {copy.openOverlay}
                  </button>
                </div>

                <div role="tablist" className="tabs tabs-boxed">
                  <button
                    type="button"
                    className={`tab ${activeTab === "summary" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("summary")}
                  >
                    {copy.summaryTab}
                  </button>
                  <button
                    type="button"
                    className={`tab ${activeTab === "trades" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("trades")}
                  >
                    {copy.tradesTab}
                  </button>
                  <button
                    type="button"
                    className={`tab ${activeTab === "raw" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("raw")}
                  >
                    {copy.rawTab}
                  </button>
                </div>

                {activeTab === "summary" && (
                  <div className="space-y-2">
                    {!report && (
                      <DegradedState
                        title={copy.reportNotReadyTitle}
                        description={copy.reportNotReadyDescription}
                      />
                    )}
                    {report && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="stat bg-base-100 rounded-lg p-3">
                          <div className="stat-title">{copy.netPnl}</div>
                          <div className={`stat-value text-xl ${pnlClass(report.netPnl)}`}>{formatCurrency(report.netPnl)}</div>
                        </div>
                        <div className="stat bg-base-100 rounded-lg p-3">
                          <div className="stat-title">{copy.winRate}</div>
                          <div className="stat-value text-xl">{formatPercent(report.winRate)}</div>
                        </div>
                        <div className="stat bg-base-100 rounded-lg p-3">
                          <div className="stat-title">{copy.totalTrades}</div>
                          <div className="stat-value text-xl">{formatNumber(report.totalTrades)}</div>
                        </div>
                        <div className="stat bg-base-100 rounded-lg p-3">
                          <div className="stat-title">{copy.maxDrawdown}</div>
                          <div className="stat-value text-xl">{formatPercent(report.maxDrawdown)}</div>
                        </div>
                        <div className="stat bg-base-100 rounded-lg p-3 col-span-2">
                          <div className="stat-title">{copy.overlayQuality}</div>
                          <div className="stat-value text-xl">{overlayQuality}</div>
                          <div className="stat-desc">
                            {copy.winRate} {formatPercent(report.winRate)} / {copy.maxDrawdown} {formatPercent(report.maxDrawdown)} / Sharpe{" "}
                            {formatNumber(report.sharpe, { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                      <p className="text-sm font-medium">{copy.equityOverlay}</p>
                      {equityCurvePoints ? (
                        <svg
                          role="img"
                          aria-label={copy.equityOverlay}
                          className="mt-2 h-[76px] w-full"
                          viewBox="0 0 280 70"
                          preserveAspectRatio="none"
                        >
                          <polyline
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={(report?.netPnl ?? 0) >= 0 ? "text-success" : "text-error"}
                            points={equityCurvePoints}
                          />
                        </svg>
                      ) : (
                        <p className="mt-2 text-xs opacity-70">{copy.equityNoData}</p>
                      )}
                      {report && (
                        <p className="mt-2 text-xs opacity-70">
                          {copy.netPnl} {formatCurrency(report.netPnl)} | {copy.grossProfit} {formatCurrency(report.grossProfit)} | {copy.grossLoss} {formatCurrency(report.grossLoss)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "trades" && (
                  <div className="overflow-x-auto">
                    {trades.length === 0 ? (
                      <EmptyState title={copy.noTradesTitle} description={copy.noTradesDescription} />
                    ) : (
                      <table className="table table-xs">
                        <thead>
                          <tr>
                            <th>{t("dashboard.backtests.runsTable.colSymbol")}</th>
                            <th>{copy.side}</th>
                            <th>{copy.entry}</th>
                            <th>{copy.exit}</th>
                            <th>{copy.netPnl}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trades.slice(0, 12).map((trade) => (
                            <tr key={trade.id}>
                              <td>{trade.symbol}</td>
                              <td>{trade.side}</td>
                              <td>{formatNumber(trade.entryPrice)}</td>
                              <td>{formatNumber(trade.exitPrice)}</td>
                              <td className={trade.pnl >= 0 ? "text-success" : "text-error"}>{formatCurrency(trade.pnl)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === "raw" && (
                  <pre className="mockup-code whitespace-pre-wrap text-xs">
                    {JSON.stringify({ run: selectedRun, report, trades: trades.slice(0, 20) }, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {overlayOpen && selectedRun && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{copy.modalTitle}</h3>
            <p className="text-sm opacity-70 mt-1">
              {selectedRun.name} / {selectedRun.symbol} / {selectedRun.timeframe}
            </p>
            {!report && (
              <p className="mt-3 text-sm">
                {copy.modalReportMissing} {copy.modalRunStatus}: {selectedRun.status}.
              </p>
            )}
            {report && (
              <div className="mt-3 space-y-2">
                <p>
                  {copy.netPnl}: <strong className={pnlClass(report.netPnl)}>{formatCurrency(report.netPnl)}</strong>
                </p>
                <p>{copy.winRate}: <strong>{formatPercent(report.winRate)}</strong></p>
                <p>Sharpe: <strong>{formatNumber(report.sharpe, { maximumFractionDigits: 2 })}</strong></p>
                <p>{copy.totalTrades}: <strong>{formatNumber(report.totalTrades)}</strong></p>
                <p>{copy.overlayQuality}: <strong>{overlayQuality}</strong></p>
                <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                  <p className="text-xs font-medium">{copy.equityOverlay}</p>
                  {equityCurvePoints ? (
                    <svg
                      role="img"
                      aria-label={`${copy.equityOverlay} modal`}
                      className="mt-2 h-[76px] w-full"
                      viewBox="0 0 280 70"
                      preserveAspectRatio="none"
                    >
                      <polyline
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={(report.netPnl ?? 0) >= 0 ? "text-success" : "text-error"}
                        points={equityCurvePoints}
                      />
                    </svg>
                  ) : (
                    <p className="mt-2 text-xs opacity-70">{copy.equityNoData}</p>
                  )}
                </div>
              </div>
            )}
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setOverlayOpen(false)}>
                {copy.modalClose}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setOverlayOpen(false)}>
              {copy.closeBackdrop}
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}

