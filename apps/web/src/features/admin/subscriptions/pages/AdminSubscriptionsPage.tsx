"use client";

import { FormEvent, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getAdminSubscriptionPlans,
  updateAdminSubscriptionPlan,
} from "../services/adminSubscriptionPlan.service";
import { AdminSubscriptionPlan } from "../types/adminSubscriptionPlan.type";
import { I18nContext } from "@/i18n/I18nProvider";

type PlanFormState = {
  monthlyPriceMinor: string;
  currency: string;
  maxBotsTotal: string;
  paperBotsLimit: string;
  liveBotsLimit: string;
  maxConcurrentBacktests: string;
};

const priceFormatter = (currency: string, locale: "en" | "pl" | "pt") =>
  new Intl.NumberFormat(locale === "pl" ? "pl-PL" : locale === "pt" ? "pt-PT" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function AdminSubscriptionsPage() {
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale ?? "en";
  const copy = {
    en: {
      loadError: "Could not load subscription plans.",
      numericValidation: "All numeric fields must be valid integers.",
      nonNegativeValidation: "Price and limits cannot be negative.",
      minBacktestsValidation: "Concurrent backtests limit must be at least 1.",
      modeLimitsValidation: "Mode limits cannot exceed total bot limit.",
      currencyValidation: "Currency must be a 3-letter code (for example USD).",
      saveError: "Could not save subscription plan. Please check values and try again.",
      title: "Subscriptions admin",
      description: "Edit pricing and entitlement limits for FREE, ADVANCED, and PROFESSIONAL plans.",
      refresh: "Refresh",
      loading: "Loading plans...",
      tablePlan: "Plan",
      tablePrice: "Price",
      tableTotalBots: "Total bots",
      tablePaperLive: "PAPER / LIVE",
      tableBacktests: "Backtests",
      tableStatus: "Status",
      tableActions: "Actions",
      statusActive: "Active",
      statusInactive: "Inactive",
      edit: "Edit",
      editPlanTitlePrefix: "Edit plan:",
      editPlanFallback: "Plan",
      monthlyPrice: "Monthly price (minor units)",
      currency: "Currency",
      maxBotsTotal: "Max bots total",
      paperBotsLimit: "PAPER bots limit",
      liveBotsLimit: "LIVE bots limit",
      maxConcurrentBacktests: "Max concurrent backtests",
      cancel: "Cancel",
      save: "Save",
    },
    pl: {
      loadError: "Nie udalo sie pobrac planow subskrypcji.",
      numericValidation: "Wszystkie pola liczbowe musza byc poprawnymi liczbami calkowitymi.",
      nonNegativeValidation: "Cena i limity nie moga byc ujemne.",
      minBacktestsValidation: "Limit rownoleglych backtestow musi byc co najmniej 1.",
      modeLimitsValidation: "Limity trybow nie moga przekraczac limitu wszystkich botow.",
      currencyValidation: "Waluta musi byc 3-literowym kodem (np. USD).",
      saveError: "Nie udalo sie zapisac planu subskrypcji. Sprawdz dane i sprobuj ponownie.",
      title: "Panel subskrypcji",
      description: "Edytuj cennik i limity uprawnien dla planow FREE, ADVANCED i PROFESSIONAL.",
      refresh: "Odswiez",
      loading: "Ladowanie planow...",
      tablePlan: "Plan",
      tablePrice: "Cena",
      tableTotalBots: "Liczba botow",
      tablePaperLive: "PAPER / LIVE",
      tableBacktests: "Backtesty",
      tableStatus: "Status",
      tableActions: "Akcje",
      statusActive: "Aktywny",
      statusInactive: "Nieaktywny",
      edit: "Edytuj",
      editPlanTitlePrefix: "Edycja planu:",
      editPlanFallback: "Plan",
      monthlyPrice: "Cena miesieczna (jednostki minor)",
      currency: "Waluta",
      maxBotsTotal: "Maksymalna liczba botow",
      paperBotsLimit: "Limit botow PAPER",
      liveBotsLimit: "Limit botow LIVE",
      maxConcurrentBacktests: "Maksymalna liczba rownoleglych backtestow",
      cancel: "Anuluj",
      save: "Zapisz",
    },
    pt: {
      loadError: "Nao foi possivel carregar planos de subscricao.",
      numericValidation: "Todos os campos numericos devem conter inteiros validos.",
      nonNegativeValidation: "Preco e limites nao podem ser negativos.",
      minBacktestsValidation: "Limite de backtests concorrentes deve ser pelo menos 1.",
      modeLimitsValidation: "Limites por modo nao podem exceder o limite total de bots.",
      currencyValidation: "Moeda deve ter 3 letras (por exemplo USD).",
      saveError: "Nao foi possivel guardar plano de subscricao. Verifica os dados e tenta novamente.",
      title: "Painel de subscricoes",
      description: "Editar precos e limites de permissao para planos FREE, ADVANCED e PROFESSIONAL.",
      refresh: "Atualizar",
      loading: "A carregar planos...",
      tablePlan: "Plano",
      tablePrice: "Preco",
      tableTotalBots: "Bots totais",
      tablePaperLive: "PAPER / LIVE",
      tableBacktests: "Backtests",
      tableStatus: "Estado",
      tableActions: "Acoes",
      statusActive: "Ativo",
      statusInactive: "Inativo",
      edit: "Editar",
      editPlanTitlePrefix: "Editar plano:",
      editPlanFallback: "Plano",
      monthlyPrice: "Preco mensal (unidades minor)",
      currency: "Moeda",
      maxBotsTotal: "Maximo de bots",
      paperBotsLimit: "Limite de bots PAPER",
      liveBotsLimit: "Limite de bots LIVE",
      maxConcurrentBacktests: "Maximo de backtests concorrentes",
      cancel: "Cancelar",
      save: "Guardar",
    },
  } as const;
  const labels = copy[locale];

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

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getAdminSubscriptionPlans();
      setPlans(payload);
    } catch {
      setError(labels.loadError);
    } finally {
      setLoading(false);
    }
  }, [labels.loadError]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

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
      setFormError(labels.numericValidation);
      return;
    }
    if (monthlyPriceMinor < 0 || maxBotsTotal < 0 || paperBotsLimit < 0 || liveBotsLimit < 0) {
      setFormError(labels.nonNegativeValidation);
      return;
    }
    if (maxConcurrentBacktests < 1) {
      setFormError(labels.minBacktestsValidation);
      return;
    }
    if (paperBotsLimit > maxBotsTotal || liveBotsLimit > maxBotsTotal) {
      setFormError(labels.modeLimitsValidation);
      return;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      setFormError(labels.currencyValidation);
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
      setFormError(labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{labels.title}</h1>
          <p className="text-sm text-base-content/70">
            {labels.description}
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void loadPlans()} disabled={loading}>
          {labels.refresh}
        </button>
      </div>

      {loading && <div className="alert alert-info">{labels.loading}</div>}
      {!loading && error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-box border border-base-300/70">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>{labels.tablePlan}</th>
                <th>{labels.tablePrice}</th>
                <th>{labels.tableTotalBots}</th>
                <th>{labels.tablePaperLive}</th>
                <th>{labels.tableBacktests}</th>
                <th>{labels.tableStatus}</th>
                <th className="text-right">{labels.tableActions}</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlans.map((plan) => {
                const formattedPrice = priceFormatter(plan.currency, locale).format(plan.monthlyPriceMinor / 100);
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
                        {plan.isActive ? labels.statusActive : labels.statusInactive}
                      </span>
                    </td>
                    <td className="text-right">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => openEditModal(plan)}>
                        {labels.edit}
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
            {labels.editPlanTitlePrefix} {editingPlan?.displayName ?? labels.editPlanFallback}
          </h3>
          {editingPlan && (
            <form className="space-y-4" onSubmit={onSave}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="form-control">
                  <span className="label-text">{labels.monthlyPrice}</span>
                  <input
                    className="input input-bordered"
                    type="number"
                    min={0}
                    value={formState.monthlyPriceMinor}
                    onChange={(event) => updateField("monthlyPriceMinor", event.target.value)}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">{labels.currency}</span>
                  <input
                    className="input input-bordered uppercase"
                    maxLength={3}
                    value={formState.currency}
                    onChange={(event) => updateField("currency", event.target.value)}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">{labels.maxBotsTotal}</span>
                  <input
                    className="input input-bordered"
                    type="number"
                    min={0}
                    value={formState.maxBotsTotal}
                    onChange={(event) => updateField("maxBotsTotal", event.target.value)}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">{labels.paperBotsLimit}</span>
                  <input
                    className="input input-bordered"
                    type="number"
                    min={0}
                    value={formState.paperBotsLimit}
                    onChange={(event) => updateField("paperBotsLimit", event.target.value)}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">{labels.liveBotsLimit}</span>
                  <input
                    className="input input-bordered"
                    type="number"
                    min={0}
                    value={formState.liveBotsLimit}
                    onChange={(event) => updateField("liveBotsLimit", event.target.value)}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">{labels.maxConcurrentBacktests}</span>
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
                  {labels.cancel}
                </button>
                <button type="submit" className={`btn btn-primary ${saving ? "loading" : ""}`} disabled={saving}>
                  {labels.save}
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
