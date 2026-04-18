'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState, SuccessState } from "../../../ui/components/ViewState";
import { useI18n } from "../../../i18n/I18nProvider";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { getBacktestRunReport, listBacktestRuns } from "../../backtest/services/backtests.service";
import { BacktestReport, BacktestRun } from "../../backtest/types/backtest.type";
import { CrossModePerformanceRow, getCrossModePerformance } from "../services/reports.service";
import { getAxiosMessage } from '@/lib/getAxiosMessage';

type RunReportRow = {
  run: BacktestRun;
  report: BacktestReport;
};

const avg = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((acc, item) => acc + item, 0) / values.length;
};

export default function PerformanceReportsView() {
  const { t } = useI18n();
  const { formatCurrency, formatNumber, formatPercent } = useLocaleFormatting();
  const [rows, setRows] = useState<RunReportRow[]>([]);
  const [modeRows, setModeRows] = useState<CrossModePerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const runs = await listBacktestRuns("COMPLETED");
      const modePerformance = await getCrossModePerformance();
      const withReports = await Promise.all(
        runs.slice(0, 40).map(async (run) => {
          const report = await getBacktestRunReport(run.id);
          if (!report) return null;
          return { run, report };
        })
      );
      setModeRows(modePerformance.rows);
      setRows(withReports.filter((item): item is RunReportRow => item != null));
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? t("dashboard.reports.states.errorFallback"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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

  if (loading) return <LoadingState title={t("dashboard.reports.states.loadingTitle")} />;

  if (error) {
    return (
      <ErrorState
        title={t("dashboard.reports.states.errorTitle")}
        description={error}
        retryLabel={t("dashboard.reports.states.retryLabel")}
        onRetry={() => void load()}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={t("dashboard.reports.states.emptyTitle")}
        description={t("dashboard.reports.states.emptyDescription")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SuccessState
        title={t("dashboard.reports.states.successTitle")}
        description={t("dashboard.reports.states.successDescription").replace("{count}", String(rows.length))}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card border border-base-300/60 bg-base-200/60">
          <div className="card-body p-4">
            <p className="text-sm opacity-70">{t("dashboard.reports.cards.reports")}</p>
            <p className="text-3xl font-bold">{metrics.runsCount}</p>
          </div>
        </div>
        <div className="card border border-base-300/60 bg-base-200/60">
          <div className="card-body p-4">
            <p className="text-sm opacity-70">{t("dashboard.reports.cards.avgNetPnl")}</p>
              <p className={`text-3xl font-bold ${metrics.avgNetPnl >= 0 ? "text-success" : "text-error"}`}>
              {formatCurrency(metrics.avgNetPnl)}
            </p>
          </div>
        </div>
        <div className="card border border-base-300/60 bg-base-200/60">
          <div className="card-body p-4">
            <p className="text-sm opacity-70">{t("dashboard.reports.cards.avgWinRate")}</p>
            <p className="text-3xl font-bold text-info">{formatPercent(metrics.avgWinRate)}</p>
          </div>
        </div>
        <div className="card border border-base-300/60 bg-base-200/60">
          <div className="card-body p-4">
            <p className="text-sm opacity-70">{t("dashboard.reports.cards.bestRun")}</p>
            <p className="text-sm font-semibold truncate">{metrics.bestRunName}</p>
            <p className="text-xl font-bold text-success">{formatCurrency(metrics.bestNetPnl)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-box border border-base-300/60 bg-base-100/80 p-4">
        <h2 className="text-lg font-semibold">{t("dashboard.reports.sections.crossMode.title")}</h2>
        <p className="mt-1 text-sm text-base-content/70">
          {t("dashboard.reports.sections.crossMode.description")}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>{t("dashboard.reports.sections.crossMode.table.mode")}</th>
                <th>{t("dashboard.reports.sections.crossMode.table.trades")}</th>
                <th>{t("dashboard.reports.sections.crossMode.table.winRate")}</th>
                <th>{t("dashboard.reports.sections.crossMode.table.netPnl")}</th>
                <th>{t("dashboard.reports.sections.crossMode.table.grossProfit")}</th>
                <th>{t("dashboard.reports.sections.crossMode.table.grossLoss")}</th>
              </tr>
            </thead>
            <tbody>
              {modeRows.map((row) => (
                <tr key={row.mode}>
                  <td className="font-medium">{row.mode}</td>
                  <td>{formatNumber(row.totalTrades)}</td>
                  <td>{formatPercent(row.winRate)}</td>
                  <td className={row.netPnl >= 0 ? "text-success" : "text-error"}>
                    {formatCurrency(row.netPnl)}
                  </td>
                  <td className="text-success">{formatCurrency(row.grossProfit)}</td>
                  <td className="text-error">{formatCurrency(-Math.abs(row.grossLoss))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-box border border-base-300/60 bg-base-100/80 p-4">
        <h2 className="text-lg font-semibold">{t("dashboard.reports.sections.byRun.title")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>{t("dashboard.reports.sections.byRun.table.run")}</th>
                <th>{t("dashboard.reports.sections.byRun.table.symbol")}</th>
                <th>{t("dashboard.reports.sections.byRun.table.timeframe")}</th>
                <th>{t("dashboard.reports.sections.byRun.table.trades")}</th>
                <th>{t("dashboard.reports.sections.byRun.table.winRate")}</th>
                <th>{t("dashboard.reports.sections.byRun.table.netPnl")}</th>
                <th>{t("dashboard.reports.sections.byRun.table.maxDd")}</th>
                <th>{t("dashboard.reports.sections.byRun.table.sharpe")}</th>
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

