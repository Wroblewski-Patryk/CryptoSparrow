"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuTrash2, LuPencilLine } from "react-icons/lu";
import axios from "axios";
import { toast } from "sonner";
import { deleteStrategy, listStrategies } from "../api/strategies.api";
import { StrategyDto } from "../types/StrategyForm.type";
import { EmptyState, ErrorState, LoadingState } from "@/ui/components/ViewState";
import { useLocaleFormatting } from "@/i18n/useLocaleFormatting";
import DataTable, { DataTableColumn } from "@/ui/components/DataTable";
import ConfirmModal from "@/ui/components/ConfirmModal";
import { TableIconButtonAction } from "@/ui/components/TableUi";

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const response = err.response?.data as { error?: { message?: string }; message?: string } | undefined;
  return response?.error?.message ?? response?.message;
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
      className: "w-28 text-center",
      render: (row) => (
        <div className="flex items-center justify-center gap-2">
          <TableIconButtonAction
            label="Edytuj"
            icon={<LuPencilLine className="h-3.5 w-3.5" />}
            onClick={() => router.push(`/dashboard/strategies/${row.id}/edit`)}
          />
          <TableIconButtonAction
            label="Usun"
            icon={<LuTrash2 className="h-3.5 w-3.5" />}
            onClick={() => setSelectedStrategy(row)}
            tone="danger"
          />
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
          onAction={() => router.push("/dashboard/strategies/create")}
        />
      )}

      {!loading && !loadError && strategies.length > 0 && (
        <DataTable
          compact
          rows={strategies}
          columns={columns}
          getRowId={(row) => row.id}
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

