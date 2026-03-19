'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";

import { EmptyState, ErrorState, LoadingState, SuccessState } from "../../../ui/components/ViewState";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { listOrders } from "../../../features/orders/services/orders.service";
import { Order } from "../../../features/orders/types/order.type";
import { listPositions } from "../../../features/positions/services/positions.service";
import { Position } from "../../../features/positions/types/position.type";
import LiveMarketBar from "./LiveMarketBar";

type FeedItem = {
  key: string;
  at: string;
  text: string;
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

export default function HomeLiveWidgets() {
  const { formatNumber, formatTime } = useLocaleFormatting();
  const [orders, setOrders] = useState<Order[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersData, positionsData] = await Promise.all([
        listOrders({ limit: 50 }),
        listPositions({ limit: 50 }),
      ]);
      setOrders(ordersData);
      setPositions(positionsData);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac widgetow dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openPositions = useMemo(() => positions.filter((item) => item.status === "OPEN"), [positions]);
  const openOrders = useMemo(
    () => orders.filter((item) => item.status === "PENDING" || item.status === "OPEN"),
    [orders]
  );
  const pendingOrders = useMemo(() => orders.filter((item) => item.status === "PENDING").length, [orders]);
  const filledOrders = useMemo(() => orders.filter((item) => item.status === "FILLED").length, [orders]);
  const rejectedOrders = useMemo(() => orders.filter((item) => item.status === "REJECTED").length, [orders]);

  const feed = useMemo(() => {
    const positionEvents: FeedItem[] = openPositions.map((position) => ({
      key: `p-${position.id}`,
      at: position.openedAt ?? "",
      text: `${position.side} ${position.symbol} opened (x${position.leverage}).`,
    }));

    const orderEvents: FeedItem[] = orders.map((order) => ({
      key: `o-${order.id}`,
      at: order.createdAt ?? "",
      text: `${order.type} ${order.symbol} ${order.side} (${order.status}).`,
    }));

    return [...positionEvents, ...orderEvents]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 8);
  }, [openPositions, orders]);

  const kpiCards = [
    { label: "Open Positions", value: openPositions.length, tone: "text-info" },
    { label: "Open Orders", value: openOrders.length, tone: "text-warning" },
    { label: "Filled Orders", value: filledOrders, tone: "text-success" },
    { label: "Rejected Orders", value: rejectedOrders, tone: "text-error" },
  ];

  if (loading) return <LoadingState title="Ladowanie widgetow live snapshot" />;

  if (error) {
    return (
      <ErrorState
        title="Nie udalo sie zaladowac widgetow dashboard"
        description={error}
        retryLabel="Sprobuj ponownie"
        onRetry={() => void load()}
      />
    );
  }

  if (orders.length === 0 && positions.length === 0) {
    return (
      <EmptyState
        title="Brak danych tradingowych"
        description="Gdy pojawia sie orders lub positions, zobaczysz tu live snapshot i feed aktywnosci."
      />
    );
  }

  return (
    <div className="space-y-6">
      <LiveMarketBar symbols={["BTCUSDT", "ETHUSDT"]} interval="1m" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="card bg-base-200 shadow-sm">
            <div className="card-body p-5">
              <p className="text-sm opacity-70">{card.label}</p>
              <p className={`text-3xl font-bold ${card.tone}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card bg-base-200 shadow-sm xl:col-span-2">
          <div className="card-body p-5">
            <h2 className="card-title">Positions Snapshot</h2>
            {openPositions.length === 0 ? (
              <EmptyState title="Brak otwartych pozycji" description="W tej chwili nie ma aktywnych positions." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Side</th>
                      <th>Qty</th>
                      <th>Leverage</th>
                      <th>Unrealized PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openPositions.slice(0, 6).map((position) => (
                      <tr key={position.id}>
                        <td>{position.symbol}</td>
                        <td>{position.side}</td>
                        <td>{formatNumber(position.quantity)}</td>
                        <td>{position.leverage}x</td>
                        <td className={pnlClass(position.unrealizedPnl)}>{formatNumber(position.unrealizedPnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="card-actions justify-end">
              <Link href="/dashboard/positions" className="btn btn-sm btn-outline">
                Open Positions
              </Link>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-5">
            <h2 className="card-title">Quick Actions</h2>
            <div className="flex flex-col gap-2">
              <Link href="/dashboard/strategies" className="btn btn-primary btn-sm">
                Review Strategies
              </Link>
              <Link href="/dashboard/orders" className="btn btn-outline btn-sm">
                Open Orders
              </Link>
              <Link href="/dashboard/backtest" className="btn btn-outline btn-sm">
                Run Backtest
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-5">
            <h2 className="card-title">Orders Snapshot</h2>
            <div className="stats stats-vertical lg:stats-horizontal w-full shadow bg-base-100">
              <div className="stat">
                <div className="stat-title">Pending</div>
                <div className="stat-value text-warning text-2xl">{pendingOrders}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Filled</div>
                <div className="stat-value text-success text-2xl">{filledOrders}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Rejected</div>
                <div className="stat-value text-error text-2xl">{rejectedOrders}</div>
              </div>
            </div>
            <div className="card-actions justify-end">
              <Link href="/dashboard/orders" className="btn btn-sm btn-outline">
                Open Orders
              </Link>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-5">
            <h2 className="card-title">Recent Activity</h2>
            {feed.length === 0 ? (
              <EmptyState title="Brak aktywnosci" description="Feed pojawi sie po pierwszych orders/positions." />
            ) : (
              <ul className="timeline timeline-vertical">
                {feed.map((item) => (
                  <li key={item.key}>
                    <div className="timeline-start text-xs opacity-60">{formatTime(item.at)}</div>
                    <div className="timeline-middle">*</div>
                    <div className="timeline-end py-2 text-sm">{item.text}</div>
                    <hr />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <SuccessState
        title="Live snapshot synced"
        description={`Open positions: ${openPositions.length}, open orders: ${openOrders.length}.`}
      />
    </div>
  );
}
