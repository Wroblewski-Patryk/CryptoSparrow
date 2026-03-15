'use client';

import { useCallback, useEffect, useState } from "react";
import axios from "axios";

import { EmptyState, ErrorState, LoadingState, SuccessState } from "../../../ui/components/ViewState";
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

export default function OrdersBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL");
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listOrders({
        status: status === "ALL" ? undefined : status,
        symbol: symbol.trim() ? symbol.trim().toUpperCase() : undefined,
        limit: 100,
      });
      setOrders(data);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac listy orders.");
    } finally {
      setLoading(false);
    }
  }, [status, symbol]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-base-300 bg-base-200 p-4">
        <h2 className="text-lg font-semibold">Filtry orders</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="form-control">
            <span className="label-text">Status</span>
            <select
              className="select select-bordered"
              value={status}
              onChange={(event) => setStatus(event.target.value as OrderStatus | "ALL")}
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Symbol</span>
            <input
              className="input input-bordered"
              placeholder="BTCUSDT"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
            />
          </label>
          <div className="form-control justify-end">
            <button type="button" className="btn btn-primary btn-sm mt-6" onClick={() => void loadOrders()}>
              Odswiez
            </button>
          </div>
        </div>
      </div>

      {loading && <LoadingState title="Ladowanie orders" />}
      {!loading && error && (
        <ErrorState
          title="Nie udalo sie pobrac orders"
          description={error}
          retryLabel="Sprobuj ponownie"
          onRetry={() => void loadOrders()}
        />
      )}
      {!loading && !error && orders.length === 0 && (
        <EmptyState title="Brak orders" description="Brak zlecen spelniajacych filtry." />
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="space-y-3">
          <SuccessState
            title="Orders loaded"
            description={`Pobrano ${orders.length} ${orders.length === 1 ? "order" : "orders"}.`}
          />
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Qty</th>
                  <th>Filled</th>
                  <th>Price</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-medium">{order.symbol}</td>
                    <td>{order.side}</td>
                    <td>{order.type}</td>
                    <td>
                      <span className="badge badge-outline">{order.status}</span>
                    </td>
                    <td>{order.quantity}</td>
                    <td>{order.filledQuantity}</td>
                    <td>{order.price ?? "-"}</td>
                    <td>{order.createdAt?.slice(0, 16).replace("T", " ") ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

