"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getAdminSubscriptionPlans,
  updateAdminSubscriptionPlan,
} from "../services/adminSubscriptionPlan.service";
import { AdminSubscriptionPlan } from "../types/adminSubscriptionPlan.type";

type PlanFormState = {
  monthlyPriceMinor: string;
  currency: string;
  maxBotsTotal: string;
  paperBotsLimit: string;
  liveBotsLimit: string;
  maxConcurrentBacktests: string;
};

const priceFormatter = (currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function AdminSubscriptionsPage() {
  const [plans, setPlans] = useState<AdminSubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<AdminSubscriptionPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<PlanFormState>({
    monthlyPriceMinor: "",
    currency: "USD",
    maxBotsTotal: "",
    paperBotsLimit: "",
    liveBotsLimit: "",
    maxConcurrentBacktests: "",
  });

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getAdminSubscriptionPlans();
      setPlans(payload);
    } catch {
      setError("Could not load subscription plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName)),
    [plans]
  );

  const openEditModal = (plan: AdminSubscriptionPlan) => {
    setEditingPlan(plan);
    setFormError(null);
    setFormState({
      monthlyPriceMinor: String(plan.monthlyPriceMinor),
      currency: plan.currency,
      maxBotsTotal: String(plan.entitlements.limits.maxBotsTotal),
      paperBotsLimit: String(plan.entitlements.limits.maxBotsByMode.PAPER),
      liveBotsLimit: String(plan.entitlements.limits.maxBotsByMode.LIVE),
      maxConcurrentBacktests: String(plan.entitlements.limits.maxConcurrentBacktests),
    });
  };

  const closeEditModal = () => {
    if (saving) return;
    setEditingPlan(null);
    setFormError(null);
  };

  const updateField = (field: keyof PlanFormState, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingPlan) return;

    const monthlyPriceMinor = Number.parseInt(formState.monthlyPriceMinor, 10);
    const maxBotsTotal = Number.parseInt(formState.maxBotsTotal, 10);
    const paperBotsLimit = Number.parseInt(formState.paperBotsLimit, 10);
    const liveBotsLimit = Number.parseInt(formState.liveBotsLimit, 10);
    const maxConcurrentBacktests = Number.parseInt(formState.maxConcurrentBacktests, 10);
    const currency = formState.currency.trim().toUpperCase();

    if (
      [monthlyPriceMinor, maxBotsTotal, paperBotsLimit, liveBotsLimit, maxConcurrentBacktests].some((value) =>
        Number.isNaN(value)
      )
    ) {
      setFormError("All numeric fields must be valid integers.");
      return;
    }
    if (monthlyPriceMinor < 0 || maxBotsTotal < 0 || paperBotsLimit < 0 || liveBotsLimit < 0) {
      setFormError("Price and limits cannot be negative.");
      return;
    }
    if (maxConcurrentBacktests < 1) {
      setFormError("Concurrent backtests limit must be at least 1.");
      return;
    }
    if (paperBotsLimit > maxBotsTotal || liveBotsLimit > maxBotsTotal) {
      setFormError("Mode limits cannot exceed total bot limit.");
      return;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      setFormError("Currency must be a 3-letter code (for example USD).");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateAdminSubscriptionPlan(editingPlan.code, {
        monthlyPriceMinor,
        currency,
        entitlements: {
          ...editingPlan.entitlements,
          limits: {
            ...editingPlan.entitlements.limits,
            maxBotsTotal,
            maxBotsByMode: {
              PAPER: paperBotsLimit,
              LIVE: liveBotsLimit,
            },
            maxConcurrentBacktests,
          },
        },
      });

      setPlans((prev) => prev.map((item) => (item.code === updated.code ? updated : item)));
      setEditingPlan(null);
    } catch {
      setFormError("Could not save subscription plan. Please check values and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Subscriptions admin</h1>
          <p className="text-sm text-base-content/70">
            Edit pricing and entitlement limits for FREE, ADVANCED, and PROFESSIONAL plans.
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void loadPlans()} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading && <div className="alert alert-info">Loading plans...</div>}
      {!loading && error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-box border border-base-300/70">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Price</th>
                <th>Total bots</th>
                <th>PAPER / LIVE</th>
                <th>Backtests</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlans.map((plan) => {
                const formattedPrice = priceFormatter(plan.currency).format(plan.monthlyPriceMinor / 100);
                return (
                  <tr key={plan.code}>
                    <td>
                      <div className="font-semibold">{plan.displayName}</div>
                      <div className="text-xs opacity-60">{plan.code}</div>
                    </td>
                    <td>{formattedPrice}</td>
                    <td>{plan.entitlements.limits.maxBotsTotal}</td>
                    <td>
                      {plan.entitlements.limits.maxBotsByMode.PAPER} / {plan.entitlements.limits.maxBotsByMode.LIVE}
                    </td>
                    <td>{plan.entitlements.limits.maxConcurrentBacktests}</td>
                    <td>
                      <span className={`badge ${plan.isActive ? "badge-success" : "badge-ghost"}`}>
                        {plan.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => openEditModal(plan)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <dialog className={`modal ${editingPlan ? "modal-open" : ""}`}>
        <div className="modal-box max-w-2xl">
          <h3 className="mb-4 text-lg font-bold">
            Edit plan: {editingPlan?.displayName ?? "Plan"}
          </h3>
          {editingPlan && (
            <form className="space-y-4" onSubmit={onSave}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="form-control">
                  <span className="label-text">Monthly price (minor units)</span>
                  <input
                    className="input input-bordered"
                    type="number"
                    min={0}
                    value={formState.monthlyPriceMinor}
                    onChange={(event) => updateField("monthlyPriceMinor", event.target.value)}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">Currency</span>
                  <input
                    className="input input-bordered uppercase"
                    maxLength={3}
                    value={formState.currency}
                    onChange={(event) => updateField("currency", event.target.value)}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">Max bots total</span>
                  <input
                    className="input input-bordered"
                    type="number"
                    min={0}
                    value={formState.maxBotsTotal}
                    onChange={(event) => updateField("maxBotsTotal", event.target.value)}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">PAPER bots limit</span>
                  <input
                    className="input input-bordered"
                    type="number"
                    min={0}
                    value={formState.paperBotsLimit}
                    onChange={(event) => updateField("paperBotsLimit", event.target.value)}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">LIVE bots limit</span>
                  <input
                    className="input input-bordered"
                    type="number"
                    min={0}
                    value={formState.liveBotsLimit}
                    onChange={(event) => updateField("liveBotsLimit", event.target.value)}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">Max concurrent backtests</span>
                  <input
                    className="input input-bordered"
                    type="number"
                    min={1}
                    value={formState.maxConcurrentBacktests}
                    onChange={(event) => updateField("maxConcurrentBacktests", event.target.value)}
                  />
                </label>
              </div>

              {formError && <div className="alert alert-error text-sm">{formError}</div>}

              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={closeEditModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className={`btn btn-primary ${saving ? "loading" : ""}`} disabled={saving}>
                  Save
                </button>
              </div>
            </form>
          )}
        </div>
        <form method="dialog" className="modal-backdrop" onClick={closeEditModal}>
          <button type="button">close</button>
        </form>
      </dialog>
    </section>
  );
}
