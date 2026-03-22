'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";

import {
  DegradedState,
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessState,
} from "../../../ui/components/ViewState";
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

const statuses: Array<BacktestStatus | "ALL"> = ["ALL", "PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELED"];

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

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
    if ((report?.netPnl ?? 0) > 0 && winRate >= 55 && maxDrawdown <= 20 && sharpe >= 1) return "Strong";
    if ((report?.netPnl ?? 0) > 0 && winRate >= 45) return "Stable";
    return "Risky";
  }, [report]);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBacktestRuns(selectedStatus === "ALL" ? undefined : selectedStatus);
      setRuns(data);
      setSelectedRunId((prev) => prev ?? data[0]?.id ?? null);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac backtest runs.");
    } finally {
      setLoading(false);
    }
  }, [selectedStatus]);

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
      toast.error("Nie udalo sie pobrac szczegolow backtestu", {
        description: getAxiosMessage(err),
      });
      setTrades([]);
      setReport(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

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
    if (!name.trim() || !symbol.trim() || !timeframe.trim()) return;

    setCreating(true);
    try {
      const created = await createBacktestRun({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        timeframe: timeframe.trim(),
        strategyId: strategyId.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setRuns((prev) => [created, ...prev]);
      setSelectedRunId(created.id);
      toast.success("Backtest run utworzony");
    } catch (err: unknown) {
      toast.error("Nie udalo sie utworzyc backtestu", {
        description: getAxiosMessage(err),
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleCreate} className="rounded-xl border border-base-300 bg-base-200 p-4">
        <h2 className="text-lg font-semibold">Nowy backtest run</h2>
        <p className="text-sm opacity-70">Utworz run, a potem sprawdz summary, trades i overlay raportu.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="form-control">
            <span className="label-text">Name</span>
            <input
              className="input input-bordered"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="MVP Backtest Run"
            />
          </label>
          <label className="form-control">
            <span className="label-text">Symbol</span>
            <input
              className="input input-bordered"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              placeholder="BTCUSDT"
            />
          </label>
          <label className="form-control">
            <span className="label-text">Timeframe</span>
            <input
              className="input input-bordered"
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value)}
              placeholder="5m"
            />
          </label>
          <label className="form-control md:col-span-2">
            <span className="label-text">Strategy (optional)</span>
            <select
              className="select select-bordered"
              value={strategyId}
              onChange={(event) => setStrategyId(event.target.value)}
            >
              <option value="">No strategy</option>
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Status filter</span>
            <select
              className="select select-bordered"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as BacktestStatus | "ALL")}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control md:col-span-3">
            <span className="label-text">Notes (optional)</span>
            <textarea
              className="textarea textarea-bordered"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Run notes"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void loadRuns()}>
            Odswiez liste
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
            {creating ? "Tworzenie..." : "Utworz run"}
          </button>
        </div>
      </form>

      {loading && <LoadingState title="Ladowanie backtest runs" />}
      {!loading && error && (
        <ErrorState
          title="Nie udalo sie pobrac backtest runs"
          description={error}
          retryLabel="Sprobuj ponownie"
          onRetry={() => void loadRuns()}
        />
      )}
      {!loading && !error && runs.length === 0 && (
        <EmptyState
          title="Brak backtest runs"
          description="Utworz pierwszy run i sprawdz wynik w sekcji summary."
        />
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-xl border border-base-300 bg-base-200 p-4">
            <SuccessState title="Backtest runs loaded" description={`Pobrano ${runs.length} run(s).`} />
            <div className="mt-3 overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Symbol</th>
                    <th>Timeframe</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Akcja</th>
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
                          Podglad
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-base-300 bg-base-200 p-4">
            {!selectedRun && (
              <DegradedState
                title="Wybierz run"
                description="Aby zobaczyc summary/trades i otworzyc overlay, wybierz run z tabeli."
              />
            )}

            {selectedRun && detailsLoading && <LoadingState title="Ladowanie szczegolow runa" />}

            {selectedRun && !detailsLoading && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Summary</h3>
                  <button type="button" className="btn btn-xs btn-primary" onClick={() => setOverlayOpen(true)}>
                    Open Overlay
                  </button>
                </div>

                <div role="tablist" className="tabs tabs-boxed">
                  <button
                    type="button"
                    className={`tab ${activeTab === "summary" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("summary")}
                  >
                    Summary
                  </button>
                  <button
                    type="button"
                    className={`tab ${activeTab === "trades" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("trades")}
                  >
                    Trades
                  </button>
                  <button
                    type="button"
                    className={`tab ${activeTab === "raw" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("raw")}
                  >
                    Raw
                  </button>
                </div>

                {activeTab === "summary" && (
                  <div className="space-y-2">
                    {!report && (
                      <DegradedState
                        title="Report nie jest jeszcze gotowy"
                        description="Run istnieje, ale backend nie zapisal jeszcze raportu."
                      />
                    )}
                    {report && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="stat bg-base-100 rounded-lg p-3">
                          <div className="stat-title">Net PnL</div>
                          <div className={`stat-value text-xl ${pnlClass(report.netPnl)}`}>{formatCurrency(report.netPnl)}</div>
                        </div>
                        <div className="stat bg-base-100 rounded-lg p-3">
                          <div className="stat-title">Win Rate</div>
                          <div className="stat-value text-xl">{formatPercent(report.winRate)}</div>
                        </div>
                        <div className="stat bg-base-100 rounded-lg p-3">
                          <div className="stat-title">Total Trades</div>
                          <div className="stat-value text-xl">{formatNumber(report.totalTrades)}</div>
                        </div>
                        <div className="stat bg-base-100 rounded-lg p-3">
                          <div className="stat-title">Max Drawdown</div>
                          <div className="stat-value text-xl">{formatPercent(report.maxDrawdown)}</div>
                        </div>
                        <div className="stat bg-base-100 rounded-lg p-3 col-span-2">
                          <div className="stat-title">Overlay Quality</div>
                          <div className="stat-value text-xl">{overlayQuality}</div>
                          <div className="stat-desc">
                            WinRate {formatPercent(report.winRate)} / MaxDD {formatPercent(report.maxDrawdown)} / Sharpe{" "}
                            {formatNumber(report.sharpe, { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                      <p className="text-sm font-medium">Equity Overlay</p>
                      {equityCurvePoints ? (
                        <svg
                          role="img"
                          aria-label="Backtest equity overlay"
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
                        <p className="mt-2 text-xs opacity-70">Brak danych trades do narysowania overlayu equity.</p>
                      )}
                      {report && (
                        <p className="mt-2 text-xs opacity-70">
                          Net PnL {formatCurrency(report.netPnl)} | Gross Profit {formatCurrency(report.grossProfit)} | Gross
                          Loss {formatCurrency(report.grossLoss)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "trades" && (
                  <div className="overflow-x-auto">
                    {trades.length === 0 ? (
                      <EmptyState title="Brak trades" description="Brak transakcji przypisanych do tego runa." />
                    ) : (
                      <table className="table table-xs">
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th>Side</th>
                            <th>Entry</th>
                            <th>Exit</th>
                            <th>PnL</th>
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
            <h3 className="font-bold text-lg">Backtest Overlay Summary</h3>
            <p className="text-sm opacity-70 mt-1">
              {selectedRun.name} / {selectedRun.symbol} / {selectedRun.timeframe}
            </p>
            {!report && (
              <p className="mt-3 text-sm">Report not available yet. Run status: {selectedRun.status}.</p>
            )}
            {report && (
              <div className="mt-3 space-y-2">
                <p>
                  Net PnL: <strong className={pnlClass(report.netPnl)}>{formatCurrency(report.netPnl)}</strong>
                </p>
                <p>Win rate: <strong>{formatPercent(report.winRate)}</strong></p>
                <p>Sharpe: <strong>{formatNumber(report.sharpe, { maximumFractionDigits: 2 })}</strong></p>
                <p>Total trades: <strong>{formatNumber(report.totalTrades)}</strong></p>
                <p>Overlay quality: <strong>{overlayQuality}</strong></p>
                <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                  <p className="text-xs font-medium">Equity Overlay</p>
                  {equityCurvePoints ? (
                    <svg
                      role="img"
                      aria-label="Backtest equity overlay modal"
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
                    <p className="mt-2 text-xs opacity-70">Brak trades do overlayu.</p>
                  )}
                </div>
              </div>
            )}
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setOverlayOpen(false)}>
                Zamknij
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setOverlayOpen(false)}>
              close
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}
