'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";

import { EmptyState, ErrorState, LoadingState } from "../../../ui/components/ViewState";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { useI18n } from "../../../i18n/I18nProvider";
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
  const { t } = useI18n();
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
      text: t("dashboard.home.activityPositionOpened")
        .replace("{side}", position.side)
        .replace("{symbol}", position.symbol)
        .replace("{leverage}", String(position.leverage)),
    }));

    const orderEvents: FeedItem[] = orders.map((order) => ({
      key: `o-${order.id}`,
      at: order.createdAt ?? "",
      text: t("dashboard.home.activityOrder")
        .replace("{type}", order.type)
        .replace("{symbol}", order.symbol)
        .replace("{side}", order.side)
        .replace("{status}", order.status),
    }));

    return [...positionEvents, ...orderEvents]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 8);
  }, [openPositions, orders, t]);

  const statusGroups = [
    {
      key: "runtime-now",
      label: t("dashboard.home.statusRuntimeNowLabel"),
      value: t("dashboard.home.statusRuntimeNowValue")
        .replace("{positions}", String(openPositions.length))
        .replace("{orders}", String(openOrders.length)),
      tone: "text-info",
    },
    {
      key: "execution-quality",
      label: t("dashboard.home.statusExecutionQualityLabel"),
      value: t("dashboard.home.statusExecutionQualityValue")
        .replace("{filled}", String(filledOrders))
        .replace("{rejected}", String(rejectedOrders)),
      tone: "text-success",
    },
    {
      key: "activity",
      label: t("dashboard.home.statusActivityLabel"),
      value: t("dashboard.home.statusActivityValue").replace("{count}", String(feed.length)),
      tone: "text-warning",
    },
  ];

  if (loading) return <LoadingState title={t("dashboard.home.loadWidgets")} />;

  if (error) {
    return (
      <ErrorState
        title={t("dashboard.home.loadWidgetsErrorTitle")}
        description={error}
        retryLabel={t("dashboard.logs.retry")}
        onRetry={() => void load()}
      />
    );
  }

  if (orders.length === 0 && positions.length === 0) {
    return (
      <EmptyState
        title={t("dashboard.home.noTradingDataTitle")}
        description={t("dashboard.home.noTradingDataDescription")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <LiveMarketBar symbols={["BTCUSDT", "ETHUSDT"]} interval="1m" />

      <div className="rounded-lg border border-base-300 bg-base-200 p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide">{t("dashboard.home.controlCenterTitle")}</h2>
            <p className="text-xs leading-5 opacity-70">{t("dashboard.home.controlCenterDescription")}</p>
          </div>
          <span className="badge badge-outline">{t("dashboard.home.controlCenterBadge")}</span>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <div className="rounded-lg border border-primary/30 bg-base-100 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide opacity-60">{t("dashboard.home.runtimeOpsTitle")}</p>
              <span className="badge badge-ghost badge-sm">{t("dashboard.home.laneStepOne")}</span>
            </div>
            <p className="mt-1 text-[13px] leading-5 opacity-75">{t("dashboard.home.runtimeOpsDescription")}</p>
            <p className="mt-2 text-[11px] opacity-65">
              {t("dashboard.home.runtimeOpsMeta")
                .replace("{positions}", String(openPositions.length))
                .replace("{orders}", String(openOrders.length))}
            </p>
            <div className="mt-3">
              <Link href="/dashboard/bots" className="btn btn-primary btn-sm w-full">
                {t("dashboard.home.runtimeOpsAction")}
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-base-300 bg-base-100 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide opacity-60">{t("dashboard.home.strategyLabTitle")}</p>
              <span className="badge badge-ghost badge-sm">{t("dashboard.home.laneStepTwo")}</span>
            </div>
            <p className="mt-1 text-[13px] leading-5 opacity-75">{t("dashboard.home.strategyLabDescription")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Link href="/dashboard/strategies/list" className="btn btn-outline btn-sm">
                {t("dashboard.home.strategyLabPrimaryAction")}
              </Link>
              <Link href="/dashboard/backtests/list" className="btn btn-outline btn-sm">
                {t("dashboard.home.strategyLabSecondaryAction")}
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-base-300 bg-base-100 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide opacity-60">{t("dashboard.home.executionReviewTitle")}</p>
              <span className="badge badge-ghost badge-sm">{t("dashboard.home.laneStepThree")}</span>
            </div>
            <p className="mt-1 text-[13px] leading-5 opacity-75">{t("dashboard.home.executionReviewDescription")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Link href="/dashboard/orders" className="btn btn-outline btn-sm">
                {t("dashboard.home.executionReviewPrimaryAction")}
              </Link>
              <Link href="/dashboard/positions" className="btn btn-outline btn-sm">
                {t("dashboard.home.executionReviewSecondaryAction")}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-base-300 bg-base-100 p-3">
          <p className="text-xs uppercase tracking-wide opacity-60">{t("dashboard.home.quickActionsStripTitle")}</p>
          <p className="mt-1 text-[11px] leading-5 opacity-65">{t("dashboard.home.quickActionsStripDescription")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/dashboard/bots" className="btn btn-primary btn-sm">
              {t("dashboard.home.runtimeOpsActionShort")}
            </Link>
            <Link href="/dashboard/strategies/list" className="btn btn-outline btn-sm">
              {t("dashboard.home.strategyLabPrimaryAction")}
            </Link>
            <Link href="/dashboard/backtests/list" className="btn btn-outline btn-sm">
              {t("dashboard.home.strategyLabSecondaryAction")}
            </Link>
            <Link href="/dashboard/orders" className="btn btn-outline btn-sm">
              {t("dashboard.home.executionReviewPrimaryAction")}
            </Link>
            <Link href="/dashboard/reports" className="btn btn-outline btn-sm">
              {t("dashboard.nav.reports")}
            </Link>
          </div>
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-wide opacity-60">{t("dashboard.home.handoffCuesTitle")}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="badge badge-outline">{t("dashboard.home.handoffRuntimeCue")}</span>
              <span className="badge badge-outline">{t("dashboard.home.handoffBacktestCue")}</span>
              <span className="badge badge-outline">{t("dashboard.home.handoffReportsCue")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {statusGroups.map((group) => (
          <div key={group.key} className="rounded-md border border-base-300 bg-base-200 p-3">
            <p className="text-[10px] uppercase tracking-wide opacity-60">{group.label}</p>
            <p className={`mt-1 text-[13px] font-semibold ${group.tone}`}>{group.value}</p>
          </div>
        ))}
      </div>

      <div className="card bg-base-200 shadow-sm">
        <div className="card-body p-5">
          <h2 className="card-title">{t("dashboard.home.positionsSnapshot")}</h2>
          {openPositions.length === 0 ? (
            <EmptyState
              title={t("dashboard.home.noOpenPositionsTitle")}
              description={t("dashboard.home.noOpenPositionsDescription")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>{t("dashboard.home.side")}</th>
                    <th>{t("dashboard.home.quantity")}</th>
                    <th>{t("dashboard.home.leverage")}</th>
                    <th>{t("dashboard.home.unrealizedPnl")}</th>
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
              {t("dashboard.home.positionsAction")}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-5">
            <h2 className="card-title">{t("dashboard.home.ordersSnapshot")}</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-base-300 bg-base-100 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide opacity-60">{t("dashboard.home.pending")}</p>
                <p className="mt-1 text-xl font-semibold text-warning">{pendingOrders}</p>
              </div>
              <div className="rounded-md border border-base-300 bg-base-100 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide opacity-60">{t("dashboard.home.filledOrders")}</p>
                <p className="mt-1 text-xl font-semibold text-success">{filledOrders}</p>
              </div>
              <div className="rounded-md border border-base-300 bg-base-100 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide opacity-60">{t("dashboard.home.rejectedOrders")}</p>
                <p className="mt-1 text-xl font-semibold text-error">{rejectedOrders}</p>
              </div>
            </div>
            <div className="card-actions justify-end">
              <Link href="/dashboard/orders" className="btn btn-sm btn-outline">
                {t("dashboard.home.openOrdersAction")}
              </Link>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-5">
            <h2 className="card-title">{t("dashboard.home.recentActivity")}</h2>
            {feed.length === 0 ? (
              <EmptyState
                title={t("dashboard.home.noActivityTitle")}
                description={t("dashboard.home.noActivityDescription")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra table-sm">
                  <thead>
                    <tr>
                      <th>{t("dashboard.home.activityTableTime")}</th>
                      <th>{t("dashboard.home.activityTableEvent")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feed.map((item) => (
                      <tr key={item.key}>
                        <td className="whitespace-nowrap text-xs opacity-65">{formatTime(item.at)}</td>
                        <td className="text-sm">{item.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
