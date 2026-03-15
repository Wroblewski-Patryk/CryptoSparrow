'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  DegradedState,
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessState,
} from "../../../ui/components/ViewState";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { listBacktestRuns } from "../../backtest/services/backtests.service";
import { BacktestRun } from "../../backtest/types/backtest.type";
import { listOrders } from "../../orders/services/orders.service";
import { Order } from "../../orders/types/order.type";
import { listPositions } from "../../positions/services/positions.service";
import { Position } from "../../positions/types/position.type";

type AuditItem = {
  id: string;
  source: "orders" | "positions" | "backtests";
  severity: "INFO" | "WARN";
  at: string;
  action: string;
  details: string;
};

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

const toAuditFromOrder = (order: Order): AuditItem => ({
  id: `order-${order.id}`,
  source: "orders",
  severity: order.status === "REJECTED" ? "WARN" : "INFO",
  at: order.createdAt ?? "",
  action: "order.state.changed",
  details: `${order.symbol} ${order.side} ${order.type} -> ${order.status}`,
});

const toAuditFromPosition = (position: Position): AuditItem => ({
  id: `position-${position.id}`,
  source: "positions",
  severity: position.status === "LIQUIDATED" ? "WARN" : "INFO",
  at: position.openedAt ?? "",
  action: "position.lifecycle",
  details: `${position.symbol} ${position.side} status=${position.status} lev=${position.leverage}x`,
});

const toAuditFromBacktest = (run: BacktestRun): AuditItem => ({
  id: `backtest-${run.id}`,
  source: "backtests",
  severity: run.status === "FAILED" ? "WARN" : "INFO",
  at: run.startedAt ?? "",
  action: "backtest.run",
  details: `${run.name} ${run.symbol}/${run.timeframe} status=${run.status}`,
});

export default function AuditTrailView() {
  const { formatDateTime } = useLocaleFormatting();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "orders" | "positions" | "backtests">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orders, positions, runs] = await Promise.all([
        listOrders({ limit: 50 }),
        listPositions({ limit: 50 }),
        listBacktestRuns(undefined),
      ]);
      const merged = [
        ...orders.map(toAuditFromOrder),
        ...positions.map(toAuditFromPosition),
        ...runs.map(toAuditFromBacktest),
      ]
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 120);
      setItems(merged);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac danych do audit trail.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (sourceFilter === "all") return items;
    return items.filter((item) => item.source === sourceFilter);
  }, [items, sourceFilter]);

  if (loading) return <LoadingState title="Ladowanie audit trail" />;

  if (error) {
    return (
      <ErrorState
        title="Nie udalo sie zaladowac audit trail"
        description={error}
        retryLabel="Sprobuj ponownie"
        onRetry={() => void load()}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Brak zdarzen audit trail"
        description="Gdy pojawia sie aktywnosc w orders/positions/backtests, zobaczysz ja tutaj."
      />
    );
  }

  return (
    <div className="space-y-4">
      <DegradedState
        title="Audit trail MVP (derived view)"
        description="Widok oparty o orders/positions/backtests. Dedykowany endpoint /dashboard/logs zostanie dodany osobno."
      />
      <SuccessState title="Audit trail loaded" description={`Wczytano ${items.length} zdarzen.`} />

      <div className="rounded-xl border border-base-300 bg-base-200 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-xs ${sourceFilter === "all" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setSourceFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={`btn btn-xs ${sourceFilter === "orders" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setSourceFilter("orders")}
          >
            Orders
          </button>
          <button
            type="button"
            className={`btn btn-xs ${sourceFilter === "positions" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setSourceFilter("positions")}
          >
            Positions
          </button>
          <button
            type="button"
            className={`btn btn-xs ${sourceFilter === "backtests" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setSourceFilter("backtests")}
          >
            Backtests
          </button>
          <button type="button" className="btn btn-xs btn-outline ml-auto" onClick={() => void load()}>
            Odswiez
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Time</th>
                <th>Source</th>
                <th>Severity</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.at)}</td>
                  <td>
                    <span className="badge badge-outline">{item.source}</span>
                  </td>
                  <td>
                    <span className={`badge ${item.severity === "WARN" ? "badge-warning" : "badge-info"}`}>
                      {item.severity}
                    </span>
                  </td>
                  <td>{item.action}</td>
                  <td>{item.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
