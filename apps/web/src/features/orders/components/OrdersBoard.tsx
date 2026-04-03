'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import DataTable, { DataTableColumn } from "../../../ui/components/DataTable";
import { TableToneBadge } from "../../../ui/components/TableUi";
import { ErrorState, LoadingState } from "../../../ui/components/ViewState";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { listOrders } from "../services/orders.service";
import { Order, OrderStatus } from "../types/order.type";

const statuses: Array<OrderStatus | "ALL"> = [
  "ALL",
  "PENDING",
  "OPEN",
  "PARTIALLY_FILLED",
  "FILLED",
  "CANCELED",
  "REJECTED",
  "EXPIRED",
];

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

type OrdersFiltersState = {
  status: OrderStatus | "ALL";
  symbol: string;
};

const EMPTY_ORDERS_FILTERS: OrdersFiltersState = {
  status: "ALL",
  symbol: "",
};

const statusTone = (status: OrderStatus): "neutral" | "info" | "success" | "warning" | "danger" => {
  if (status === "FILLED") return "success";
  if (status === "PARTIALLY_FILLED") return "info";
  if (status === "PENDING" || status === "OPEN") return "warning";
  if (status === "CANCELED" || status === "REJECTED" || status === "EXPIRED") return "danger";
  return "neutral";
};

export default function OrdersBoard() {
  const { formatDateTime, formatNumber } = useLocaleFormatting();
  const [orders, setOrders] = useState<Order[]>([]);
  const [draftFilters, setDraftFilters] = useState<OrdersFiltersState>(EMPTY_ORDERS_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<OrdersFiltersState>(EMPTY_ORDERS_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listOrders({
        status: appliedFilters.status === "ALL" ? undefined : appliedFilters.status,
        symbol: appliedFilters.symbol.trim() ? appliedFilters.symbol.trim().toUpperCase() : undefined,
        limit: 100,
      });
      setOrders(data);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac listy orders.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const applyFilters = () => {
    setAppliedFilters({
      status: draftFilters.status,
      symbol: draftFilters.symbol.trim().toUpperCase(),
    });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_ORDERS_FILTERS);
    setAppliedFilters(EMPTY_ORDERS_FILTERS);
  };

  const columns = useMemo<DataTableColumn<Order>[]>(
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
        render: (row) => (
          <TableToneBadge label={row.side} tone={row.side === "BUY" ? "success" : "danger"} />
        ),
      },
      { key: "type", label: "Type", sortable: true, accessor: (row) => row.type },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (row) => row.status,
        render: (row) => <TableToneBadge label={row.status} tone={statusTone(row.status)} />,
      },
      {
        key: "quantity",
        label: "Qty",
        sortable: true,
        accessor: (row) => row.quantity,
        render: (row) => formatNumber(row.quantity),
      },
      {
        key: "filledQuantity",
        label: "Filled",
        sortable: true,
        accessor: (row) => row.filledQuantity,
        render: (row) => formatNumber(row.filledQuantity),
      },
      {
        key: "price",
        label: "Price",
        sortable: true,
        accessor: (row) => row.price ?? null,
        render: (row) => (row.price == null ? "-" : formatNumber(row.price)),
      },
      {
        key: "createdAt",
        label: "Created",
        sortable: true,
        accessor: (row) => row.createdAt ?? "",
        render: (row) => formatDateTime(row.createdAt),
      },
    ],
    [formatDateTime, formatNumber]
  );

  return (
    <div className="space-y-5">
      {loading && <LoadingState title="Ladowanie orders" />}
      {!loading && error && (
        <ErrorState
          title="Nie udalo sie pobrac orders"
          description={error}
          retryLabel="Sprobuj ponownie"
          onRetry={() => void loadOrders()}
        />
      )}

      {!loading && !error ? (
        <DataTable
          compact
          rows={orders}
          columns={columns}
          getRowId={(row) => row.id}
          filterPlaceholder="BTCUSDT"
          query={draftFilters.symbol}
          onQueryChange={(value) => {
            setDraftFilters((prev) => ({ ...prev, symbol: value }));
          }}
          onSearch={applyFilters}
          manualFiltering
          advancedToggleLabel="Zaawansowane"
          advancedFilters={
            <div className="grid gap-2 md:grid-cols-[minmax(12rem,16rem)_auto]">
              <label className="form-control gap-1">
                <span className="text-[11px] uppercase tracking-wide opacity-60">Status</span>
                <select
                  className="select select-bordered select-xs"
                  value={draftFilters.status}
                  onChange={(event) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      status: event.target.value as OrderStatus | "ALL",
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
          emptyText="Brak orders"
        />
      ) : null}
    </div>
  );
}
