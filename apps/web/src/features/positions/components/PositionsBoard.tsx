'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import DataTable, { DataTableColumn } from "../../../ui/components/DataTable";
import { TableToneBadge } from "../../../ui/components/TableUi";
import { ErrorState, LoadingState } from "../../../ui/components/ViewState";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import {
  fetchExchangePositionsSnapshot,
  listPositions,
  updatePositionManagementMode,
} from "../services/positions.service";
import { Position, PositionStatus } from "../types/position.type";

const statuses: Array<PositionStatus | "ALL"> = ["ALL", "OPEN", "CLOSED", "LIQUIDATED"];
const positionSources = [
  { value: "runtime", label: "Runtime snapshot" },
  { value: "exchange", label: "Exchange live snapshot" },
] as const;

type PositionSource = (typeof positionSources)[number]["value"];
type PositionsFiltersState = {
  source: PositionSource;
  status: PositionStatus | "ALL";
  symbol: string;
};

const EMPTY_POSITIONS_FILTERS: PositionsFiltersState = {
  source: "runtime",
  status: "ALL",
  symbol: "",
};

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

const pnlClass = (value: number | null) => {
  if (value == null) return "";
  if (value > 0) return "text-success";
  if (value < 0) return "text-error";
  return "";
};

const sourceBadgeClass: Record<string, string> = {
  BOT: "badge-primary",
  USER: "badge-info",
  EXCHANGE_SYNC: "badge-secondary",
  BACKTEST: "badge-accent",
};

const managementBadgeClass: Record<string, string> = {
  BOT_MANAGED: "badge-success",
  MANUAL_MANAGED: "badge-warning",
};

const sideTone = (side: string): "success" | "danger" | "neutral" => {
  const normalized = side.toUpperCase();
  if (normalized === "LONG") return "success";
  if (normalized === "SHORT") return "danger";
  return "neutral";
};

const statusTone = (
  status: PositionStatus
): "success" | "warning" | "danger" | "neutral" => {
  if (status === "OPEN") return "success";
  if (status === "CLOSED") return "neutral";
  if (status === "LIQUIDATED") return "danger";
  return "warning";
};

export default function PositionsBoard() {
  const { formatDateTime, formatNumber } = useLocaleFormatting();
  const [positions, setPositions] = useState<Position[]>([]);
  const [draftFilters, setDraftFilters] = useState<PositionsFiltersState>(EMPTY_POSITIONS_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<PositionsFiltersState>(EMPTY_POSITIONS_FILTERS);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingManagementId, setPendingManagementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (appliedFilters.source === "runtime") {
        const data = await listPositions({
          status: appliedFilters.status === "ALL" ? undefined : appliedFilters.status,
          symbol: appliedFilters.symbol.trim() ? appliedFilters.symbol.trim().toUpperCase() : undefined,
          limit: 100,
        });
        setPositions(data);
        setLastSyncAt(null);
      } else {
        const snapshot = await fetchExchangePositionsSnapshot();
        const normalized = snapshot.positions.map((item, index) => ({
          id: `exchange-${index}-${item.symbol}`,
          symbol: item.symbol,
          side: item.side?.toUpperCase() ?? "UNKNOWN",
          status: "OPEN" as const,
          entryPrice: item.entryPrice ?? 0,
          quantity: item.contracts,
          leverage: item.leverage ?? 1,
          unrealizedPnl: item.unrealizedPnl,
          realizedPnl: null,
          openedAt: item.timestamp ?? undefined,
        }));
        const symbolFilter = appliedFilters.symbol.trim().toUpperCase();
        const filtered = symbolFilter
          ? normalized.filter((position) => position.symbol.toUpperCase().includes(symbolFilter))
          : normalized;
        setPositions(filtered);
        setLastSyncAt(snapshot.syncedAt);
      }
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac listy positions.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  const applyFilters = () => {
    setAppliedFilters({
      source: draftFilters.source,
      status: draftFilters.status,
      symbol: draftFilters.symbol.trim().toUpperCase(),
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_POSITIONS_FILTERS);
    setAppliedFilters(EMPTY_POSITIONS_FILTERS);
  };

  const handleToggleManagementMode = async (position: Position) => {
    if (!position.managementMode) return;
    const nextMode = position.managementMode === "BOT_MANAGED" ? "MANUAL_MANAGED" : "BOT_MANAGED";

    setPendingManagementId(position.id);
    try {
      await updatePositionManagementMode(position.id, nextMode);
      await loadPositions();
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie zaktualizowac trybu zarzadzania pozycja.");
    } finally {
      setPendingManagementId(null);
    }
  };

  const columns = useMemo<DataTableColumn<Position>[]>(
    () => [
      {
        key: "symbol",
        label: "Symbol",
        sortable: true,
        accessor: (row) => row.symbol,
        className: "font-medium",
      },
      {
        key: "side",
        label: "Side",
        sortable: true,
        accessor: (row) => row.side,
        render: (row) => <TableToneBadge label={row.side} tone={sideTone(row.side)} />,
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (row) => row.status,
        render: (row) => <TableToneBadge label={row.status} tone={statusTone(row.status)} />,
      },
      {
        key: "entryPrice",
        label: "Entry",
        sortable: true,
        accessor: (row) => row.entryPrice,
        render: (row) => formatNumber(row.entryPrice),
      },
      {
        key: "quantity",
        label: "Qty",
        sortable: true,
        accessor: (row) => row.quantity,
        render: (row) => formatNumber(row.quantity),
      },
      {
        key: "leverage",
        label: "Lev",
        sortable: true,
        accessor: (row) => row.leverage,
        render: (row) => `${row.leverage}x`,
      },
      {
        key: "unrealizedPnl",
        label: "Unrealized PnL",
        sortable: true,
        accessor: (row) => row.unrealizedPnl ?? null,
        render: (row) => (
          <span className={pnlClass(row.unrealizedPnl)}>
            {formatNumber(row.unrealizedPnl)}
          </span>
        ),
      },
      {
        key: "realizedPnl",
        label: "Realized PnL",
        sortable: true,
        accessor: (row) => row.realizedPnl ?? null,
        render: (row) => (
          <span className={pnlClass(row.realizedPnl)}>
            {formatNumber(row.realizedPnl)}
          </span>
        ),
      },
      {
        key: "openedAt",
        label: "Opened",
        sortable: true,
        accessor: (row) => row.openedAt ?? "",
        render: (row) => formatDateTime(row.openedAt),
      },
      {
        key: "source",
        label: "Source",
        sortable: true,
        accessor: (row) => row.origin ?? (appliedFilters.source === "exchange" ? "EXCHANGE_SYNC" : "BOT"),
        render: (row) => {
          const value = row.origin ?? (appliedFilters.source === "exchange" ? "EXCHANGE_SYNC" : "BOT");
          return (
            <span
              className={`badge badge-outline ${sourceBadgeClass[value] ?? "badge-outline"}`}
            >
              {value}
            </span>
          );
        },
      },
      {
        key: "management",
        label: "Management",
        sortable: true,
        accessor: (row) => row.managementMode ?? (appliedFilters.source === "exchange" ? "MANUAL_MANAGED" : "BOT_MANAGED"),
        render: (row) => {
          const value = row.managementMode ?? (appliedFilters.source === "exchange" ? "MANUAL_MANAGED" : "BOT_MANAGED");
          return (
            <span
              className={`badge badge-outline ${managementBadgeClass[value] ?? "badge-outline"}`}
            >
              {value}
            </span>
          );
        },
      },
      {
        key: "action",
        label: "Action",
        sortable: false,
        accessor: () => "",
        render: (row) =>
          appliedFilters.source === "runtime" ? (
            <button
              type="button"
              className={`btn btn-xs ${row.managementMode === "BOT_MANAGED" ? "btn-warning" : "btn-success"}`}
              onClick={() => void handleToggleManagementMode(row)}
              disabled={pendingManagementId === row.id}
            >
              {pendingManagementId === row.id
                ? "Aktualizacja..."
                : row.managementMode === "BOT_MANAGED"
                  ? "Ustaw manual"
                  : "Ustaw bot"}
            </button>
          ) : (
            <span className="text-xs text-base-content/70">Readonly</span>
          ),
      },
    ],
    [appliedFilters.source, formatDateTime, formatNumber, pendingManagementId]
  );

  return (
    <div className="space-y-5">
      {loading && <LoadingState title="Ladowanie positions" />}
      {!loading && error && (
        <ErrorState
          title="Nie udalo sie pobrac positions"
          description={error}
          retryLabel="Sprobuj ponownie"
          onRetry={() => void loadPositions()}
        />
      )}

      {!loading && !error ? (
        <div className="space-y-2">
          <DataTable
            compact
            rows={positions}
            columns={columns}
            getRowId={(row) => row.id}
            filterPlaceholder="ETHUSDT"
            query={draftFilters.symbol}
            onQueryChange={(value) =>
              setDraftFilters((prev) => ({ ...prev, symbol: value }))
            }
            onSearch={applyFilters}
            manualFiltering
            advancedToggleLabel="Zaawansowane"
            advancedFilters={
              <div className="grid gap-2 md:grid-cols-[minmax(12rem,14rem)_minmax(12rem,14rem)_auto]">
                <label className="form-control gap-1">
                  <span className="text-[11px] uppercase tracking-wide opacity-60">Zrodlo</span>
                  <select
                    className="select select-bordered select-xs"
                    value={draftFilters.source}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        source: event.target.value as PositionSource,
                      }))
                    }
                  >
                    {positionSources.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-control gap-1">
                  <span className="text-[11px] uppercase tracking-wide opacity-60">Status</span>
                  <select
                    className="select select-bordered select-xs"
                    value={draftFilters.status}
                    disabled={draftFilters.source === "exchange"}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        status: event.target.value as PositionStatus | "ALL",
                      }))
                    }
                  >
                    {statuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end justify-end gap-2">
                  <button type="button" className="btn btn-primary btn-xs" onClick={applyFilters}>
                    Zastosuj
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={resetFilters}>
                    Reset
                  </button>
                </div>
              </div>
            }
            paginationEnabled
            defaultPageSize={10}
            pageSizeOptions={[10, 25, 50, 100]}
            rowsPerPageLabel="Wierszy"
            previousLabel="Poprzednia"
            nextLabel="Nastepna"
            emptyText="Brak positions"
          />

          {appliedFilters.source === "exchange" && lastSyncAt ? (
            <p className="text-xs text-base-content/70">
              Ostatnia synchronizacja: {formatDateTime(lastSyncAt)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
