'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { LuPencilLine, LuTrash2 } from "react-icons/lu";
import { useRouter } from "next/navigation";

import ConfirmModal from "@/ui/components/ConfirmModal";
import DataTable, { DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState, ErrorState, LoadingState } from "@/ui/components/ViewState";
import { useI18n } from "@/i18n/I18nProvider";
import { listStrategies } from "@/features/strategies/api/strategies.api";
import { StrategyDto } from "@/features/strategies/types/StrategyForm.type";
import { deleteBot, listBots } from "../services/bots.service";
import { Bot } from "../types/bot.type";

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

const modeBadgeClass = (mode: string) => (mode === "LIVE" ? "badge-warning" : "badge-info");
const statusBadgeClass = (active: boolean) => (active ? "badge-success" : "badge-ghost");

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
      const [bots, strategyRows] = await Promise.all([
        listBots(),
        listStrategies(),
      ]);
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
      render: (row) => <span className={`badge badge-xs ${modeBadgeClass(row.mode)}`}>{row.mode}</span>,
      className: "w-28",
    },
    {
      key: "status",
      label: t("dashboard.bots.list.columns.status"),
      sortable: true,
      accessor: (row) => (row.isActive ? 1 : 0),
      render: (row) => (
        <span className={`badge badge-xs ${statusBadgeClass(row.isActive)}`}>
          {row.isActive ? t("dashboard.bots.monitoring.active") : t("dashboard.bots.monitoring.inactive")}
        </span>
      ),
      className: "w-28",
    },
    {
      key: "market",
      label: t("dashboard.bots.list.columns.market"),
      sortable: true,
      accessor: (row) => `${row.exchange} ${row.marketType}`,
      render: (row) => (
        <span className="text-sm">
          {row.exchange} / {row.marketType}
        </span>
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
              {strategyMeta.interval} · {strategyMeta.leverage ?? 1}x
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
      className: "w-[260px] text-right",
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href={`/dashboard/bots/runtime?botId=${row.id}`} className="btn btn-xs btn-outline">
            Podglad
          </Link>
          <Link href={`/dashboard/bots/assistant?botId=${row.id}`} className="btn btn-xs btn-outline">
            Asystent
          </Link>
          <Link href={`/dashboard/bots/create?editId=${row.id}`} className="btn btn-xs btn-info">
            <LuPencilLine className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            className="btn btn-xs btn-error"
            onClick={() => setSelectedDeleteBot(row)}
            title={t("dashboard.bots.list.delete")}
          >
            <LuTrash2 className="h-3.5 w-3.5" />
          </button>
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
        onAction={() => router.push("/dashboard/bots/create")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        title={t("dashboard.nav.botsList")}
        description={t("dashboard.bots.monitoring.description")}
        filterPlaceholder={t("dashboard.bots.monitoring.symbolFilterPlaceholder")}
        filterFn={(row, query) => {
          const normalized = query.trim().toLowerCase();
          return (
            row.name.toLowerCase().includes(normalized) ||
            row.marketType.toLowerCase().includes(normalized) ||
            row.mode.toLowerCase().includes(normalized) ||
            (strategyMap.get(row.strategyId ?? "")?.name ?? "")
              .toLowerCase()
              .includes(normalized)
          );
        }}
        emptyText={t("dashboard.bots.list.noBotsForFilter")}
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
