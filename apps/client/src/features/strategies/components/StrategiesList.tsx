"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuTrash2, LuPencilLine } from "react-icons/lu";
import axios from "axios";
import { toast } from "sonner";
import { deleteStrategy, listStrategies } from "../api/strategies.api";
import { StrategyDto } from "../types/StrategyForm.type";
import { EmptyState, ErrorState, LoadingState } from "apps/client/src/ui/components/ViewState";
import { useLocaleFormatting } from "apps/client/src/i18n/useLocaleFormatting";
import DataTable, { DataTableColumn } from "apps/client/src/ui/components/DataTable";
import ConfirmModal from "apps/client/src/ui/components/ConfirmModal";

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

export default function StrategiesList() {
  const { formatDate } = useLocaleFormatting();
  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const loadStrategies = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await listStrategies();
      setStrategies(data);
    } catch (err: unknown) {
      const message = getAxiosMessage(err) ?? "Nie udalo sie pobrac listy strategii";
      setLoadError(message);
      toast.error("Nie udalo sie pobrac listy strategii", {
        description: getAxiosMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStrategies();
  }, [loadStrategies]);

  const handleDelete = async () => {
    if (!selectedStrategy) return;
    setDeleting(true);
    try {
      await deleteStrategy(selectedStrategy.id);
      setStrategies((prev) => prev.filter((s) => s.id !== selectedStrategy.id));
      toast.success("Strategia usunieta");
    } catch (err: unknown) {
      toast.error(getAxiosMessage(err) ?? "Blad usuwania strategii");
    } finally {
      setDeleting(false);
      setSelectedStrategy(null);
    }
  };

  const columns: DataTableColumn<StrategyDto>[] = [
    {
      key: "name",
      label: "Nazwa",
      sortable: true,
      accessor: (row) => row.name,
      className: "font-medium",
    },
    {
      key: "leverage",
      label: "Dzwignia",
      sortable: true,
      accessor: (row) => row.leverage,
      render: (row) => `${row.leverage}x`,
      className: "w-32",
    },
    {
      key: "interval",
      label: "Interwal",
      sortable: true,
      accessor: (row) => row.interval,
      className: "w-32",
    },
    {
      key: "createdAt",
      label: "Data utworzenia",
      sortable: true,
      accessor: (row) => row.createdAt ?? "",
      render: (row) => formatDate(row.createdAt),
      className: "w-44",
    },
    {
      key: "actions",
      label: "Akcje",
      className: "w-32 text-center",
      render: (row) => (
        <div className="flex items-center justify-center gap-2">
          <button
            className="btn btn-sm btn-info"
            onClick={() => router.push(`/dashboard/strategies/${row.id}`)}
            title="Edytuj"
            type="button"
          >
            <LuPencilLine className="w-4 h-4" />
          </button>
          <button
            className="btn btn-sm btn-error"
            onClick={() => setSelectedStrategy(row)}
            title="Usun"
            type="button"
          >
            <LuTrash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {loading && <LoadingState />}
      {!loading && loadError && (
        <ErrorState
          title="Nie udalo sie pobrac listy strategii"
          description={loadError}
          retryLabel="Sprobuj ponownie"
          onRetry={() => void loadStrategies()}
        />
      )}
      {!loading && !loadError && strategies.length === 0 && (
        <EmptyState
          title="Brak strategii"
          description="Dodaj pierwsza strategie, aby uruchomic backtest i bota."
          actionLabel="Nowa strategia"
          onAction={() => router.push("/dashboard/strategies/add")}
        />
      )}

      {!loading && !loadError && strategies.length > 0 && (
        <DataTable
          rows={strategies}
          columns={columns}
          getRowId={(row) => row.id}
          title="Lista strategii"
          description="Sortowanie i filtrowanie pomaga szybko znalezc strategie pod backtest i boty."
          filterPlaceholder="Filtruj strategie..."
          filterFn={(row, query) => {
            const normalized = query.trim().toLowerCase();
            return (
              row.name.toLowerCase().includes(normalized) ||
              row.interval.toLowerCase().includes(normalized)
            );
          }}
          emptyText="Brak strategii."
        />
      )}

      <ConfirmModal
        open={Boolean(selectedStrategy)}
        title="Potwierdz usuniecie"
        description={
          selectedStrategy
            ? `Czy na pewno chcesz usunac strategie "${selectedStrategy.name}"?`
            : "Czy na pewno chcesz usunac te strategie?"
        }
        confirmLabel="Usun"
        cancelLabel="Anuluj"
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
