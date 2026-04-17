'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";

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
import DataTable, { DataTableColumn } from "@/ui/components/DataTable";
import { TableIconButtonAction, TableToneBadge } from "@/ui/components/TableUi";

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
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

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

  const renderMetadata = (metadata: unknown) => {
    if (!metadata) return t("dashboard.logs.traceNoMetadata");
    if (typeof metadata === "string") return metadata;
    try {
      return JSON.stringify(metadata, null, 2);
    } catch {
      return String(metadata);
    }
  };

  const columns = useMemo<DataTableColumn<AuditItem>[]>(
    () => [
      {
        key: "at",
        label: t("dashboard.logs.tableTime"),
        sortable: true,
        accessor: (row) => row.at,
        render: (row) => formatDateTime(row.at),
      },
      {
        key: "source",
        label: t("dashboard.logs.tableSource"),
        sortable: true,
        accessor: (row) => row.source,
        render: (row) => <TableToneBadge label={row.source} tone="neutral" />,
      },
      {
        key: "severity",
        label: t("dashboard.logs.tableSeverity"),
        sortable: true,
        accessor: (row) => row.severity,
        render: (row) => (
          <TableToneBadge
            label={row.severity}
            tone={row.severity === "ERROR" ? "danger" : row.severity === "WARN" ? "warning" : "info"}
          />
        ),
      },
      {
        key: "action",
        label: t("dashboard.logs.tableAction"),
        sortable: true,
        accessor: (row) => row.action,
      },
      {
        key: "actor",
        label: t("dashboard.logs.tableActor"),
        sortable: true,
        accessor: (row) => row.actor ?? "",
        render: (row) => row.actor ?? t("dashboard.logs.actorFallback"),
      },
      {
        key: "details",
        label: t("dashboard.logs.tableDetails"),
        sortable: true,
        accessor: (row) => row.details,
      },
      {
        key: "trace",
        label: t("dashboard.logs.tableTrace"),
        className: "w-20 text-right",
        render: (row) => (
          <div className="flex items-center justify-end">
            <TableIconButtonAction
              label={expandedRows[row.id] ? t("dashboard.logs.traceTitle") : t("dashboard.logs.traceButton")}
              icon={
                expandedRows[row.id] ? (
                  <LuChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <LuChevronDown className="h-3.5 w-3.5" />
                )
              }
              onClick={() =>
                setExpandedRows((prev) => ({
                  ...prev,
                  [row.id]: !prev[row.id],
                }))
              }
            />
          </div>
        ),
      },
    ],
    [expandedRows, formatDateTime, t]
  );

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

      <DataTable
        compact
        rows={items}
        columns={columns}
        getRowId={(row) => row.id}
        filterPlaceholder={t("dashboard.logs.tableAction")}
        filterFn={(row, query) => {
          const normalized = query.trim().toLowerCase();
          return (
            row.source.toLowerCase().includes(normalized) ||
            row.severity.toLowerCase().includes(normalized) ||
            row.action.toLowerCase().includes(normalized) ||
            row.details.toLowerCase().includes(normalized) ||
            (row.actor ?? "").toLowerCase().includes(normalized)
          );
        }}
        emptyText={t("dashboard.logs.emptyDescription")}
        advancedMode
        columnVisibilityPreferenceKey='logs.audit.list'
        advancedFilters={
          <div className="flex flex-wrap items-center gap-2">
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
        }
        advancedToggleLabel={t("dashboard.logs.sourceFilterLabel")}
        advancedDefaultOpen
        isRowExpanded={(row) => Boolean(expandedRows[row.id])}
        renderExpandedRow={(row) => (
          <div className="rounded-box border border-base-300 bg-base-200/60 p-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">
              {t("dashboard.logs.traceTitle")}
            </h3>
            <p className="mt-1 text-sm opacity-80">{t("dashboard.logs.traceDescription")}</p>
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="badge badge-outline">{row.source}</span>
                <span className="badge badge-outline">{row.action}</span>
                <span className="badge badge-outline">{formatDateTime(row.at)}</span>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg bg-base-300 p-3 text-xs">
                {renderMetadata(row.metadata)}
              </pre>
            </div>
          </div>
        )}
      />
    </div>
  );
}

