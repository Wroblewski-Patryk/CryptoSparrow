'use client';

import { useCallback, useEffect, useState } from "react";
import axios from "axios";

import { EmptyState, ErrorState, LoadingState, SuccessState } from "../../../ui/components/ViewState";
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

export default function PositionsBoard() {
  const { formatDateTime, formatNumber } = useLocaleFormatting();
  const [positions, setPositions] = useState<Position[]>([]);
  const [source, setSource] = useState<PositionSource>("runtime");
  const [status, setStatus] = useState<PositionStatus | "ALL">("ALL");
  const [symbol, setSymbol] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingManagementId, setPendingManagementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (source === "runtime") {
        const data = await listPositions({
          status: status === "ALL" ? undefined : status,
          symbol: symbol.trim() ? symbol.trim().toUpperCase() : undefined,
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
        const symbolFilter = symbol.trim().toUpperCase();
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
  }, [source, status, symbol]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

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

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-base-300 bg-base-200 p-4">
        <h2 className="text-lg font-semibold">Filtry positions</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="form-control">
            <span className="label-text">Zrodlo</span>
            <select
              className="select select-bordered"
              value={source}
              onChange={(event) => setSource(event.target.value as PositionSource)}
            >
              {positionSources.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Status</span>
            <select
              className="select select-bordered"
              value={status}
              disabled={source === "exchange"}
              onChange={(event) => setStatus(event.target.value as PositionStatus | "ALL")}
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
              placeholder="ETHUSDT"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
            />
          </label>
          <div className="form-control justify-end">
            <button
              type="button"
              className="btn btn-primary btn-sm mt-6"
              onClick={() => void loadPositions()}
            >
              Odswiez
            </button>
          </div>
        </div>
        {source === "exchange" && lastSyncAt && (
          <p className="mt-3 text-xs text-base-content/70">
            Ostatnia synchronizacja: {formatDateTime(lastSyncAt)}
          </p>
        )}
      </div>

      {loading && <LoadingState title="Ladowanie positions" />}
      {!loading && error && (
        <ErrorState
          title="Nie udalo sie pobrac positions"
          description={error}
          retryLabel="Sprobuj ponownie"
          onRetry={() => void loadPositions()}
        />
      )}
      {!loading && !error && positions.length === 0 && (
        <EmptyState title="Brak positions" description="Brak pozycji spelniajacych filtry." />
      )}

      {!loading && !error && positions.length > 0 && (
        <div className="space-y-3">
          <SuccessState
            title="Positions loaded"
            description={`${source === "exchange" ? "Exchange snapshot" : "Runtime snapshot"}: pobrano ${positions.length} ${positions.length === 1 ? "position" : "positions"}.`}
          />
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Status</th>
                  <th>Entry</th>
                  <th>Qty</th>
                  <th>Lev</th>
                  <th>Unrealized PnL</th>
                  <th>Realized PnL</th>
                  <th>Opened</th>
                  <th>Source</th>
                  <th>Management</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id}>
                    <td className="font-medium">{position.symbol}</td>
                    <td>{position.side}</td>
                    <td>
                      <span className="badge badge-outline">{position.status}</span>
                    </td>
                    <td>{formatNumber(position.entryPrice)}</td>
                    <td>{formatNumber(position.quantity)}</td>
                    <td>{position.leverage}x</td>
                    <td className={pnlClass(position.unrealizedPnl)}>{formatNumber(position.unrealizedPnl)}</td>
                    <td className={pnlClass(position.realizedPnl)}>{formatNumber(position.realizedPnl)}</td>
                    <td>{formatDateTime(position.openedAt)}</td>
                    <td>
                      <span
                        className={`badge badge-outline ${sourceBadgeClass[position.origin ?? "EXCHANGE_SYNC"] ?? "badge-outline"}`}
                      >
                        {position.origin ?? (source === "exchange" ? "EXCHANGE_SYNC" : "BOT")}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge badge-outline ${managementBadgeClass[position.managementMode ?? "MANUAL_MANAGED"] ?? "badge-outline"}`}
                      >
                        {position.managementMode ?? (source === "exchange" ? "MANUAL_MANAGED" : "BOT_MANAGED")}
                      </span>
                    </td>
                    <td>
                      {source === "runtime" ? (
                        <button
                          type="button"
                          className={`btn btn-xs ${position.managementMode === "BOT_MANAGED" ? "btn-warning" : "btn-success"}`}
                          onClick={() => void handleToggleManagementMode(position)}
                          disabled={pendingManagementId === position.id}
                        >
                          {pendingManagementId === position.id
                            ? "Aktualizacja..."
                            : position.managementMode === "BOT_MANAGED"
                              ? "Ustaw manual"
                              : "Ustaw bot"}
                        </button>
                      ) : (
                        <span className="text-xs text-base-content/70">Readonly</span>
                      )}
                    </td>
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
