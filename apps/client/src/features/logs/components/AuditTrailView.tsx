'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessState,
} from "../../../ui/components/ViewState";
import { useI18n } from "../../../i18n/I18nProvider";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { listLogs } from "../services/logs.service";
import { AuditLogEntry } from "../types/log.type";

type AuditItem = {
  id: string;
  source: string;
  severity: "DEBUG" | "INFO" | "WARN" | "ERROR";
  at: string;
  action: string;
  details: string;
  actor?: string | null;
};

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

const toAuditItem = (entry: AuditLogEntry): AuditItem => ({
  id: entry.id,
  source: entry.source,
  severity: entry.level,
  at: entry.occurredAt,
  action: entry.action,
  details: entry.message,
  actor: entry.actor,
});

export default function AuditTrailView() {
  const { t } = useI18n();
  const { formatDateTime } = useLocaleFormatting();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "DEBUG" | "INFO" | "WARN" | "ERROR">(
    "all"
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const logs = await listLogs({
        limit: 120,
        ...(sourceFilter !== "all" ? { source: sourceFilter } : {}),
        ...(severityFilter !== "all" ? { severity: severityFilter } : {}),
      });
      setItems(logs.map(toAuditItem));
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac logow audit trail.");
    } finally {
      setLoading(false);
    }
  }, [severityFilter, sourceFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const sourceOptions = useMemo(() => {
    const unique = new Set(items.map((item) => item.source));
    return ["all", ...Array.from(unique)];
  }, [items]);

  if (loading) return <LoadingState title={t("dashboard.logs.loading")} />;

  if (error) {
    return (
      <ErrorState
        title={t("dashboard.logs.loadErrorTitle")}
        description={error ?? t("dashboard.logs.loadErrorDescription")}
        retryLabel={t("dashboard.logs.retry")}
        onRetry={() => void load()}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={t("dashboard.logs.emptyTitle")}
        description={t("dashboard.logs.emptyDescription")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SuccessState
        title={t("dashboard.logs.loadedTitle")}
        description={t("dashboard.logs.loadedDescription").replace("{count}", String(items.length))}
      />

      <div className="rounded-xl border border-base-300 bg-base-200 p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <select
            aria-label={t("dashboard.logs.sourceFilterLabel")}
            className="select select-bordered select-xs"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {source === "all" ? t("dashboard.logs.sourceAll") : source}
              </option>
            ))}
          </select>
          <select
            aria-label={t("dashboard.logs.severityFilterLabel")}
            className="select select-bordered select-xs"
            value={severityFilter}
            onChange={(event) =>
              setSeverityFilter(event.target.value as "all" | "DEBUG" | "INFO" | "WARN" | "ERROR")
            }
          >
            <option value="all">{t("dashboard.logs.severityAll")}</option>
            <option value="DEBUG">DEBUG</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
          <button type="button" className="btn btn-xs btn-outline ml-auto" onClick={() => void load()}>
            {t("dashboard.logs.refresh")}
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>{t("dashboard.logs.tableTime")}</th>
                <th>{t("dashboard.logs.tableSource")}</th>
                <th>{t("dashboard.logs.tableSeverity")}</th>
                <th>{t("dashboard.logs.tableAction")}</th>
                <th>{t("dashboard.logs.tableActor")}</th>
                <th>{t("dashboard.logs.tableDetails")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.at)}</td>
                  <td>
                    <span className="badge badge-outline">{item.source}</span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        item.severity === "ERROR"
                          ? "badge-error"
                          : item.severity === "WARN"
                            ? "badge-warning"
                            : "badge-info"
                      }`}
                    >
                      {item.severity}
                    </span>
                  </td>
                  <td>{item.action}</td>
                  <td>{item.actor ?? t("dashboard.logs.actorFallback")}</td>
                  <td>{item.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
