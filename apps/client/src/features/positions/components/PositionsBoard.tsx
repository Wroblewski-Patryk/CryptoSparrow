'use client';

import { useCallback, useEffect, useState } from "react";
import axios from "axios";

import { EmptyState, ErrorState, LoadingState, SuccessState } from "../../../ui/components/ViewState";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { listPositions } from "../services/positions.service";
import { Position, PositionStatus } from "../types/position.type";

const statuses: Array<PositionStatus | "ALL"> = ["ALL", "OPEN", "CLOSED", "LIQUIDATED"];

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

export default function PositionsBoard() {
  const { formatDateTime, formatNumber } = useLocaleFormatting();
  const [positions, setPositions] = useState<Position[]>([]);
  const [status, setStatus] = useState<PositionStatus | "ALL">("ALL");
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPositions({
        status: status === "ALL" ? undefined : status,
        symbol: symbol.trim() ? symbol.trim().toUpperCase() : undefined,
        limit: 100,
      });
      setPositions(data);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac listy positions.");
    } finally {
      setLoading(false);
    }
  }, [status, symbol]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-base-300 bg-base-200 p-4">
        <h2 className="text-lg font-semibold">Filtry positions</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="form-control">
            <span className="label-text">Status</span>
            <select
              className="select select-bordered"
              value={status}
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
            description={`Pobrano ${positions.length} ${positions.length === 1 ? "position" : "positions"}.`}
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
