'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import ConfirmModal from "@/ui/components/ConfirmModal";
import DataTable, { DataTableColumn } from "@/ui/components/DataTable";
import { TablePresetButtonAction, TablePresetLinkAction, TableToneBadge } from "@/ui/components/TableUi";
import { EmptyState, ErrorState, LoadingState } from "@/ui/components/ViewState";
import { dashboardRoutes } from "@/ui/layout/dashboard/dashboardRoutes";
import { useI18n } from "@/i18n/I18nProvider";
import { listStrategies } from "@/features/strategies/api/strategies.api";
import { StrategyDto } from "@/features/strategies/types/StrategyForm.type";
import { supportsExchangeCapability } from "@/features/exchanges/exchangeCapabilities";
import { deleteBot, listBots } from "../services/bots.service";
import { Bot } from "../types/bot.type";
import { getAxiosMessage } from '@/lib/getAxiosMessage';

export default function BotsListTable() {
  const { t } = useI18n();
  const router = useRouter();
  const [rows, setRows] = useState<Bot[]>([]);
  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeleteBot, setSelectedDeleteBot] = useState<Bot | null>(null);
  const [deleting, setDeleting] = useState(false);

  const strategyMap = useMemo(
    () =>
      new Map(
        strategies.map((strategy) => [
          strategy.id,
          { name: strategy.name, interval: strategy.interval, leverage: strategy.leverage },
        ])
      ),
    [strategies]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bots, strategyRows] = await Promise.all([listBots(), listStrategies()]);
      setRows(bots);
      setStrategies(strategyRows);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? t("dashboard.bots.errors.loadBots"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!selectedDeleteBot) return;
    setDeleting(true);
    try {
      await deleteBot(selectedDeleteBot.id);
      setRows((prev) => prev.filter((bot) => bot.id !== selectedDeleteBot.id));
      toast.success(t("dashboard.bots.toasts.deleted"));
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.toasts.deleteFailed"), { description: getAxiosMessage(err) });
    } finally {
      setDeleting(false);
      setSelectedDeleteBot(null);
    }
  };

  const columns: DataTableColumn<Bot>[] = [
    {
      key: "name",
      label: t("dashboard.bots.list.columns.name"),
      sortable: true,
      accessor: (row) => row.name,
      className: "font-medium",
    },
    {
      key: "mode",
      label: t("dashboard.bots.list.columns.mode"),
      sortable: true,
      accessor: (row) => row.mode,
      render: (row) => (
        <TableToneBadge label={row.mode} tone={row.mode === "LIVE" ? "warning" : "info"} />
      ),
      className: "w-28",
    },
    {
      key: "status",
      label: t("dashboard.bots.list.columns.status"),
      sortable: true,
      accessor: (row) => (row.isActive ? 1 : 0),
      render: (row) => (
        <TableToneBadge
          label={row.isActive ? t("dashboard.bots.monitoring.active") : t("dashboard.bots.monitoring.inactive")}
          tone={row.isActive ? "success" : "neutral"}
        />
      ),
      className: "w-28",
    },
    {
      key: "market",
      label: t("dashboard.bots.list.columns.market"),
      sortable: true,
      accessor: (row) => `${row.exchange} ${row.marketType}`,
      render: (row) => (
        <div className="space-y-0.5">
          <p className="font-medium">{row.exchange}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] uppercase tracking-wide opacity-60">{row.marketType}</p>
            {!supportsExchangeCapability(row.exchange, "PAPER_PRICING_FEED") &&
            !supportsExchangeCapability(row.exchange, "LIVE_EXECUTION") ? (
              <TableToneBadge
                label={t("dashboard.bots.list.placeholderBadge")}
                tone="warning"
                className="badge-xs"
              />
            ) : null}
          </div>
        </div>
      ),
      className: "w-40",
    },
    {
      key: "strategy",
      label: t("dashboard.bots.list.columns.strategy"),
      sortable: true,
      accessor: (row) => strategyMap.get(row.strategyId ?? "")?.name ?? t("dashboard.bots.list.noneOption"),
      render: (row) => {
        const strategyMeta = strategyMap.get(row.strategyId ?? "");
        if (!strategyMeta) return <span className="opacity-60">{t("dashboard.bots.list.noneOption")}</span>;
        return (
          <div className="space-y-0.5">
            <p className="font-medium">{strategyMeta.name}</p>
            <p className="text-[11px] opacity-60">
              {strategyMeta.interval} | {strategyMeta.leverage ?? 1}x
            </p>
          </div>
        );
      },
    },
    {
      key: "paperBalance",
      label: t("dashboard.bots.list.columns.paperBalance"),
      sortable: true,
      accessor: (row) => row.paperStartBalance,
      render: (row) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(row.paperStartBalance),
      className: "w-36",
    },
    {
      key: "actions",
      label: t("dashboard.bots.list.columns.actions"),
      className: "w-[140px] text-right",
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <TablePresetLinkAction
            preset="runtime"
            href={dashboardRoutes.bots.preview(row.id)}
            label={t("dashboard.bots.tabs.monitoring")}
          />
          <TablePresetLinkAction
            preset="edit"
            href={dashboardRoutes.bots.edit(row.id)}
            label={t("dashboard.bots.list.edit")}
          />
          <TablePresetButtonAction
            preset="delete"
            label={t("dashboard.bots.list.delete")}
            onClick={() => setSelectedDeleteBot(row)}
          />
        </div>
      ),
    },
  ];

  if (loading) {
    return <LoadingState title={t("dashboard.bots.states.loadingBots")} />;
  }

  if (error) {
    return (
      <ErrorState
        title={t("dashboard.bots.states.loadBotsFailedTitle")}
        description={error}
        retryLabel={t("dashboard.bots.states.retry")}
        onRetry={() => void loadData()}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={t("dashboard.bots.states.emptyTitle")}
        description={t("dashboard.bots.states.emptyDescription")}
        actionLabel={t("dashboard.nav.createBot")}
        onAction={() => router.push(dashboardRoutes.bots.create)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <DataTable
        compact
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        filterPlaceholder={t("dashboard.bots.list.searchPlaceholder")}
        filterFn={(row, query) => {
          const normalized = query.trim().toLowerCase();
          return (
            row.name.toLowerCase().includes(normalized) ||
            row.marketType.toLowerCase().includes(normalized) ||
            row.exchange.toLowerCase().includes(normalized) ||
            row.mode.toLowerCase().includes(normalized) ||
            (strategyMap.get(row.strategyId ?? "")?.name ?? "").toLowerCase().includes(normalized)
          );
        }}
        emptyText={t("dashboard.bots.list.noBotsForFilter")}
        advancedMode
        columnVisibilityPreferenceKey='bots.list'
      />

      <ConfirmModal
        open={Boolean(selectedDeleteBot)}
        title={t("dashboard.bots.list.delete")}
        description={
          selectedDeleteBot
            ? `${t("dashboard.bots.list.delete")} "${selectedDeleteBot.name}"?`
            : t("dashboard.bots.list.delete")
        }
        confirmLabel={t("dashboard.bots.list.delete")}
        cancelLabel="Anuluj"
        confirmVariant="error"
        pending={deleting}
        onCancel={() => {
          if (deleting) return;
          setSelectedDeleteBot(null);
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
