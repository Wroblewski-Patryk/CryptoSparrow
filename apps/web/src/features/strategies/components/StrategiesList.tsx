"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LuTrash2, LuPencilLine } from "react-icons/lu";
import axios from "axios";
import { toast } from "sonner";
import { deleteStrategy, listStrategies } from "../api/strategies.api";
import { StrategyDto } from "../types/StrategyForm.type";
import { EmptyState, ErrorState } from "@/ui/components/ViewState";
import { SkeletonTableRows } from "@/ui/components/loading";
import { useLocaleFormatting } from "@/i18n/useLocaleFormatting";
import { useI18n } from "@/i18n/I18nProvider";
import DataTable, { DataTableColumn } from "@/ui/components/DataTable";
import ConfirmModal from "@/ui/components/ConfirmModal";
import { TableIconButtonAction } from "@/ui/components/TableUi";

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const response = err.response?.data as { error?: { message?: string }; message?: string } | undefined;
  return response?.error?.message ?? response?.message;
};

export default function StrategiesList() {
  const { locale } = useI18n();
  const { formatDate } = useLocaleFormatting();
  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const copy = useMemo(
    () =>
      locale === "pl"
        ? {
            loadFailedTitle: "Nie udalo sie pobrac listy strategii",
            strategyDeleted: "Strategia usunieta",
            deleteFailed: "Blad usuwania strategii",
            colName: "Nazwa",
            colLeverage: "Dzwignia",
            colInterval: "Interwal",
            colCreatedAt: "Data utworzenia",
            colActions: "Akcje",
            edit: "Edytuj",
            remove: "Usun",
            filterPlaceholder: "Filtruj strategie...",
            emptyTable: "Brak strategii.",
            emptyTitle: "Brak strategii",
            emptyDescription: "Dodaj pierwsza strategie, aby uruchomic backtest i bota.",
            addAction: "Nowa strategia",
            retry: "Sprobuj ponownie",
            confirmTitle: "Potwierdz usuniecie",
            confirmDescription: 'Czy na pewno chcesz usunac strategie "{name}"?',
            confirmDescriptionFallback: "Czy na pewno chcesz usunac te strategie?",
            confirm: "Usun",
            cancel: "Anuluj",
          }
        : {
            loadFailedTitle: "Could not load strategies list",
            strategyDeleted: "Strategy deleted",
            deleteFailed: "Failed to delete strategy",
            colName: "Name",
            colLeverage: "Leverage",
            colInterval: "Interval",
            colCreatedAt: "Created at",
            colActions: "Actions",
            edit: "Edit",
            remove: "Delete",
            filterPlaceholder: "Filter strategies...",
            emptyTable: "No strategies.",
            emptyTitle: "No strategies",
            emptyDescription: "Add your first strategy to run backtests and bots.",
            addAction: "New strategy",
            retry: "Try again",
            confirmTitle: "Confirm deletion",
            confirmDescription: 'Are you sure you want to delete strategy "{name}"?',
            confirmDescriptionFallback: "Are you sure you want to delete this strategy?",
            confirm: "Delete",
            cancel: "Cancel",
          },
    [locale]
  );

  const loadStrategies = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await listStrategies();
      setStrategies(data);
    } catch (err: unknown) {
      const message = getAxiosMessage(err) ?? copy.loadFailedTitle;
      setLoadError(message);
      toast.error(copy.loadFailedTitle, {
        description: getAxiosMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailedTitle]);

  useEffect(() => {
    void loadStrategies();
  }, [loadStrategies]);

  const handleDelete = async () => {
    if (!selectedStrategy) return;
    setDeleting(true);
    try {
      await deleteStrategy(selectedStrategy.id);
      setStrategies((prev) => prev.filter((s) => s.id !== selectedStrategy.id));
      toast.success(copy.strategyDeleted);
    } catch (err: unknown) {
      toast.error(getAxiosMessage(err) ?? copy.deleteFailed);
    } finally {
      setDeleting(false);
      setSelectedStrategy(null);
    }
  };

  const columns = useMemo<DataTableColumn<StrategyDto>[]>(
    () => [
      {
        key: "name",
        label: copy.colName,
        sortable: true,
        accessor: (row) => row.name,
        className: "font-medium",
      },
      {
        key: "leverage",
        label: copy.colLeverage,
        sortable: true,
        accessor: (row) => row.leverage,
        render: (row) => `${row.leverage}x`,
        className: "w-32",
      },
      {
        key: "interval",
        label: copy.colInterval,
        sortable: true,
        accessor: (row) => row.interval,
        className: "w-32",
      },
      {
        key: "createdAt",
        label: copy.colCreatedAt,
        sortable: true,
        accessor: (row) => row.createdAt ?? "",
        render: (row) => formatDate(row.createdAt),
        className: "w-44",
      },
      {
        key: "actions",
        label: copy.colActions,
        className: "w-28 text-center",
        render: (row) => (
          <div className="flex items-center justify-center gap-2">
            <TableIconButtonAction
              label={copy.edit}
              icon={<LuPencilLine className="h-3.5 w-3.5" />}
              onClick={() => router.push(`/dashboard/strategies/${row.id}/edit`)}
            />
            <TableIconButtonAction
              label={copy.remove}
              icon={<LuTrash2 className="h-3.5 w-3.5" />}
              onClick={() => setSelectedStrategy(row)}
              tone="danger"
            />
          </div>
        ),
      },
    ],
    [copy, formatDate, router]
  );

  return (
    <div>
      {loading && (
        <SkeletonTableRows
          columns={5}
          rows={6}
          title={false}
          toolbar
          className="border-base-300/40 bg-base-100/60 p-3"
        />
      )}
      {!loading && loadError && (
        <ErrorState
          title={copy.loadFailedTitle}
          description={loadError}
          retryLabel={copy.retry}
          onRetry={() => void loadStrategies()}
        />
      )}
      {!loading && !loadError && strategies.length === 0 && (
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          actionLabel={copy.addAction}
          onAction={() => router.push("/dashboard/strategies/create")}
        />
      )}

      {!loading && !loadError && strategies.length > 0 && (
        <DataTable
          compact
          rows={strategies}
          columns={columns}
          getRowId={(row) => row.id}
          filterPlaceholder={copy.filterPlaceholder}
          filterFn={(row, query) => {
            const normalized = query.trim().toLowerCase();
            return (
              row.name.toLowerCase().includes(normalized) ||
              row.interval.toLowerCase().includes(normalized)
            );
          }}
          emptyText={copy.emptyTable}
        />
      )}

      <ConfirmModal
        open={Boolean(selectedStrategy)}
        title={copy.confirmTitle}
        description={
          selectedStrategy
            ? copy.confirmDescription.replace("{name}", selectedStrategy.name)
            : copy.confirmDescriptionFallback
        }
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
        confirmVariant="error"
        pending={deleting}
        onCancel={() => {
          if (deleting) return;
          setSelectedStrategy(null);
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
