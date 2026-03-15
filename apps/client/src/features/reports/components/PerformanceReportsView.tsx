'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import { EmptyState, ErrorState, LoadingState, SuccessState } from "../../../ui/components/ViewState";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { getBacktestRunReport, listBacktestRuns } from "../../backtest/services/backtests.service";
import { BacktestReport, BacktestRun } from "../../backtest/types/backtest.type";

type RunReportRow = {
  run: BacktestRun;
  report: BacktestReport;
};

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

const avg = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((acc, item) => acc + item, 0) / values.length;
};

export default function PerformanceReportsView() {
  const { formatCurrency, formatNumber, formatPercent } = useLocaleFormatting();
  const [rows, setRows] = useState<RunReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const runs = await listBacktestRuns("COMPLETED");
      const withReports = await Promise.all(
        runs.slice(0, 40).map(async (run) => {
          const report = await getBacktestRunReport(run.id);
          if (!report) return null;
          return { run, report };
        })
      );
      setRows(withReports.filter((item): item is RunReportRow => item != null));
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac raportow performance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => {
    const netPnls = rows.map((item) => item.report.netPnl ?? 0);
    const winRates = rows.map((item) => item.report.winRate ?? 0);
    const bestRun = rows.reduce<RunReportRow | null>((best, current) => {
      if (!best) return current;
      return (current.report.netPnl ?? -Infinity) > (best.report.netPnl ?? -Infinity) ? current : best;
    }, null);

    return {
      runsCount: rows.length,
      avgNetPnl: avg(netPnls),
      avgWinRate: avg(winRates),
      bestNetPnl: bestRun?.report.netPnl ?? null,
      bestRunName: bestRun?.run.name ?? "-",
    };
  }, [rows]);

  if (loading) return <LoadingState title="Ladowanie reports performance" />;

  if (error) {
    return (
      <ErrorState
        title="Nie udalo sie pobrac reports performance"
        description={error}
        retryLabel="Sprobuj ponownie"
        onRetry={() => void load()}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Brak raportow performance"
        description="Gdy pojawia sie zakonczone backtesty z reportem, zobaczysz je tutaj."
      />
    );
  }

  return (
    <div className="space-y-4">
      <SuccessState
        title="Reports performance loaded"
        description={`Wczytano ${rows.length} raportow do analizy wydajnosci.`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <p className="text-sm opacity-70">Reports</p>
            <p className="text-3xl font-bold">{metrics.runsCount}</p>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <p className="text-sm opacity-70">Avg Net PnL</p>
              <p className={`text-3xl font-bold ${metrics.avgNetPnl >= 0 ? "text-success" : "text-error"}`}>
              {formatCurrency(metrics.avgNetPnl)}
            </p>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <p className="text-sm opacity-70">Avg Win Rate</p>
            <p className="text-3xl font-bold text-info">{formatPercent(metrics.avgWinRate)}</p>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <p className="text-sm opacity-70">Best Run</p>
            <p className="text-sm font-semibold truncate">{metrics.bestRunName}</p>
            <p className="text-xl font-bold text-success">{formatCurrency(metrics.bestNetPnl)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-base-300 bg-base-200 p-4">
        <h2 className="text-lg font-semibold">Performance by backtest run</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Run</th>
                <th>Symbol</th>
                <th>Timeframe</th>
                <th>Trades</th>
                <th>Win Rate</th>
                <th>Net PnL</th>
                <th>Max DD</th>
                <th>Sharpe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.run.id}>
                  <td className="font-medium">{item.run.name}</td>
                  <td>{item.run.symbol}</td>
                  <td>{item.run.timeframe}</td>
                  <td>{formatNumber(item.report.totalTrades)}</td>
                  <td>{formatPercent(item.report.winRate)}</td>
                  <td className={(item.report.netPnl ?? 0) >= 0 ? "text-success" : "text-error"}>
                    {formatCurrency(item.report.netPnl)}
                  </td>
                  <td>{formatPercent(item.report.maxDrawdown)}</td>
                  <td>{formatNumber(item.report.sharpe, { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
