"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import { getProfileSubscription } from "../services/subscription.service";
import { ProfileSubscriptionResponse, SubscriptionCatalogItem } from "../types/subscription.type";

export default function SubscriptionPanel() {
  const { locale } = useI18n();
  const copy =
    locale === "pl"
      ? {
          title: "Subskrypcja",
          loading: "Ladowanie subskrypcji...",
          loadError: "Nie udalo sie pobrac subskrypcji.",
          retry: "Sprobuj ponownie",
          activePlan: "Aktywny plan",
          monthly: "miesiecznie",
          free: "Darmowy",
          maxBots: "Maks. botow",
          maxBotsPaper: "PAPER",
          maxBotsLive: "LIVE",
          maxBacktests: "Rownoleglych backtestow",
          liveTrading: "Live trading",
          yes: "Tak",
          no: "Nie",
        }
      : {
          title: "Subscription",
          loading: "Loading subscription...",
          loadError: "Could not load subscription.",
          retry: "Try again",
          activePlan: "Active plan",
          monthly: "monthly",
          free: "Free",
          maxBots: "Max bots",
          maxBotsPaper: "PAPER",
          maxBotsLive: "LIVE",
          maxBacktests: "Concurrent backtests",
          liveTrading: "Live trading",
          yes: "Yes",
          no: "No",
        };

  const [data, setData] = useState<ProfileSubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getProfileSubscription();
      setData(payload);
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const activePlanCode = data?.activePlanCode ?? null;

  const sortedCatalog = useMemo(() => {
    return [...(data?.catalog ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data?.catalog]);

  const formatPrice = (item: SubscriptionCatalogItem) => {
    if (item.priceMonthlyMinor <= 0) return copy.free;

    const amount = item.priceMonthlyMinor / 100;
    return `${new Intl.NumberFormat(locale, {
      style: "currency",
      currency: item.currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount)} / ${copy.monthly}`;
  };

  if (loading) {
    return <p className="text-sm opacity-70">{copy.loading}</p>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-error">{error}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void loadSubscription()}>
          {copy.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold mb-4">{copy.title}</h2>

      <div className="grid gap-3 md:grid-cols-3">
        {sortedCatalog.map((plan) => {
          const limits = plan.entitlements?.limits;
          const features = plan.entitlements?.features;
          const isActive = activePlanCode === plan.code;
          return (
            <article
              key={plan.code}
              className={`rounded-box border p-3 transition-colors ${
                isActive ? "border-success/70 bg-success/10" : "border-base-300/60 bg-base-100"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{plan.displayName}</h3>
                  <p className="text-xs opacity-70">{formatPrice(plan)}</p>
                </div>
                {isActive ? <span className="badge badge-success badge-outline badge-sm">{copy.activePlan}</span> : null}
              </div>

              <div className="mt-3 space-y-1 text-xs">
                <p className="flex items-center justify-between gap-2">
                  <span className="opacity-70">{copy.maxBots}</span>
                  <span className="font-medium">{limits?.maxBotsTotal ?? "-"}</span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="opacity-70">{copy.maxBotsPaper}</span>
                  <span className="font-medium">{limits?.maxBotsByMode?.PAPER ?? "-"}</span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="opacity-70">{copy.maxBotsLive}</span>
                  <span className="font-medium">{limits?.maxBotsByMode?.LIVE ?? "-"}</span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="opacity-70">{copy.maxBacktests}</span>
                  <span className="font-medium">{limits?.maxConcurrentBacktests ?? "-"}</span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="opacity-70">{copy.liveTrading}</span>
                  <span className="font-medium">{features?.liveTrading ? copy.yes : copy.no}</span>
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
