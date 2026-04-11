'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  EmptyState,
  ErrorState,
  SuccessState,
} from "../../../ui/components/ViewState";
import { SkeletonCardBlock, SkeletonFormBlock, SkeletonTableRows } from "../../../ui/components/loading";
import { useI18n } from "../../../i18n/I18nProvider";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { listLogs } from "../services/logs.service";
import { AuditLogEntry } from "../types/log.type";
import { getAxiosMessage } from '@/lib/getAxiosMessage';

type AuditItem = {
  id: string;
  source: string;
  severity: "DEBUG" | "INFO" | "WARN" | "ERROR";
  at: string;
  action: string;
  details: string;
  actor?: string | null;
  metadata?: unknown;
};

const toAuditItem = (entry: AuditLogEntry): AuditItem => ({
  id: entry.id,
  source: entry.source,
  severity: entry.level,
  at: entry.occurredAt,
  action: entry.action,
  details: entry.message,
  actor: entry.actor,
  metadata: entry.metadata,
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const logs = await listLogs({
        limit: 120,
        ...(sourceFilter !== "all" ? { source: sourceFilter } : {}),
        ...(severityFilter !== "all" ? { severity: severityFilter } : {}),
      });
      const nextItems = logs.map(toAuditItem);
      setItems(nextItems);
      if (!nextItems.some((item) => item.id === selectedItemId)) {
        setSelectedItemId(nextItems[0]?.id ?? null);
      }
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac logow audit trail.");
    } finally {
      setLoading(false);
    }
  }, [selectedItemId, severityFilter, sourceFilter]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const selectedMetadata = useMemo(() => {
    if (!selectedItem?.metadata) return null;
    if (typeof selectedItem.metadata === "string") return selectedItem.metadata;
    try {
      return JSON.stringify(selectedItem.metadata, null, 2);
    } catch {
      return String(selectedItem.metadata);
    }
  }, [selectedItem]);

  useEffect(() => {
    void load();
  }, [load]);

  const sourceOptions = useMemo(() => {
    const unique = new Set(items.map((item) => item.source));
    return ["all", ...Array.from(unique)];
  }, [items]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t("dashboard.logs.loading")}>
        <SkeletonFormBlock
          fields={3}
          columns={2}
          title={false}
          submitButton={false}
          className="border-base-300/40 bg-base-100/60 p-3"
        />
        <SkeletonTableRows
          columns={7}
          rows={6}
          title={false}
          toolbar={false}
          className="border-base-300/40 bg-base-100/60 p-3"
        />
        <SkeletonCardBlock cards={1} linesPerCard={5} title={false} className="border-base-300/40 bg-base-100/60 p-3" />
      </div>
    );
  }

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

      <div className="rounded-box border border-base-300/60 bg-base-200/60 p-4">
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
                <th>{t("dashboard.logs.tableTrace")}</th>
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
                  <td>
                    <button
                      type="button"
                      className={`btn btn-xs ${
                        selectedItemId === item.id ? "btn-primary" : "btn-outline"
                      }`}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      {t("dashboard.logs.traceButton")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-box border border-base-300/60 bg-base-200/60 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">
          {t("dashboard.logs.traceTitle")}
        </h3>
        <p className="mt-1 text-sm opacity-80">{t("dashboard.logs.traceDescription")}</p>

        {selectedItem ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge badge-outline">{selectedItem.source}</span>
              <span className="badge badge-outline">{selectedItem.action}</span>
              <span className="badge badge-outline">{formatDateTime(selectedItem.at)}</span>
            </div>
            <pre className="max-h-72 overflow-auto rounded-lg bg-base-300 p-3 text-xs">
              {selectedMetadata ?? t("dashboard.logs.traceNoMetadata")}
            </pre>
          </div>
        ) : (
          <p className="mt-3 text-sm opacity-75">{t("dashboard.logs.traceNoMetadata")}</p>
        )}
      </div>
    </div>
  );
}

