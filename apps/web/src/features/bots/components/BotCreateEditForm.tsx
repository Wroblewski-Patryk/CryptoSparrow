'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { useI18n } from "@/i18n/I18nProvider";
import { EmptyState, ErrorState, LoadingState } from "@/ui/components/ViewState";
import { listMarketUniverses } from "@/features/markets/services/markets.service";
import { MarketUniverse } from "@/features/markets/types/marketUniverse.type";
import { listStrategies } from "@/features/strategies/api/strategies.api";
import { StrategyDto } from "@/features/strategies/types/StrategyForm.type";
import {
  createBot,
  getBot,
  getBotRuntimeGraph,
  updateBot,
} from "../services/bots.service";
import { BotMode } from "../types/bot.type";

const LIVE_CONSENT_TEXT_VERSION = "mvp-v1";
const DUPLICATE_ACTIVE_BOT_ERROR = "active bot already exists for this strategy + market group pair";

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const payload = err.response?.data as
    | {
        message?: string;
        error?: { message?: string; details?: Array<{ message?: string }> | unknown };
      }
    | undefined;

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  if (typeof payload?.error?.message === "string" && payload.error.message.trim()) {
    return payload.error.message.trim();
  }

  if (Array.isArray(payload?.error?.details)) {
    const detailMessages = payload.error.details
      .map((item) =>
        item && typeof item === "object" && "message" in item
          ? (item as { message?: unknown }).message
          : undefined
      )
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (detailMessages.length > 0) {
      return detailMessages.join("; ");
    }
  }

  return undefined;
};

const deriveStrategyMaxOpenPositions = (strategy: StrategyDto | null): number => {
  if (!strategy?.config || typeof strategy.config !== "object") return 1;
  const config = strategy.config as {
    additional?: {
      maxPositions?: unknown;
      maxOpenPositions?: unknown;
    };
  };
  const raw = config.additional?.maxPositions ?? config.additional?.maxOpenPositions;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
};

type BotFormState = {
  name: string;
  mode: BotMode;
  paperStartBalance: number;
  strategyId: string;
  marketGroupId: string;
  isActive: boolean;
  liveOptIn: boolean;
};

const buildDefaultForm = (params: {
  strategies: StrategyDto[];
  marketGroups: MarketUniverse[];
}): BotFormState => ({
  name: "",
  mode: "PAPER",
  paperStartBalance: 10_000,
  strategyId: params.strategies[0]?.id ?? "",
  marketGroupId: params.marketGroups[0]?.id ?? "",
  isActive: true,
  liveOptIn: false,
});

type BotCreateEditFormProps = {
  editId?: string | null;
};

export default function BotCreateEditForm({ editId = null }: BotCreateEditFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const isEditMode = Boolean(editId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [marketGroups, setMarketGroups] = useState<MarketUniverse[]>([]);
  const [form, setForm] = useState<BotFormState>({
    name: "",
    mode: "PAPER",
    paperStartBalance: 10_000,
    strategyId: "",
    marketGroupId: "",
    isActive: true,
    liveOptIn: false,
  });

  const loadFormData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [strategyRows, marketGroupRows] = await Promise.all([
        listStrategies(),
        listMarketUniverses(),
      ]);
      setStrategies(strategyRows);
      setMarketGroups(marketGroupRows);

      if (!isEditMode || !editId) {
        setForm(buildDefaultForm({ strategies: strategyRows, marketGroups: marketGroupRows }));
        return;
      }

      const [bot, runtimeGraph] = await Promise.all([getBot(editId), getBotRuntimeGraph(editId)]);
      const selectedGroup =
        runtimeGraph.marketGroups.find((group) => group.isEnabled) ?? runtimeGraph.marketGroups[0];
      const selectedGroupId =
        selectedGroup?.symbolGroup?.marketUniverseId ??
        marketGroupRows[0]?.id ??
        "";
      const selectedStrategyId =
        selectedGroup?.strategies.find((strategy) => strategy.isEnabled)?.strategyId ??
        bot.strategyId ??
        strategyRows[0]?.id ??
        "";

      setForm({
        name: bot.name,
        mode: bot.mode,
        paperStartBalance: bot.paperStartBalance,
        strategyId: selectedStrategyId,
        marketGroupId: selectedGroupId,
        isActive: bot.isActive,
        liveOptIn: bot.liveOptIn,
      });
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? t("dashboard.bots.errors.loadBots"));
    } finally {
      setLoading(false);
    }
  }, [editId, isEditMode, t]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  useEffect(() => {
    if (form.mode === "LIVE") return;
    if (!form.liveOptIn) return;
    setForm((prev) => ({ ...prev, liveOptIn: false }));
  }, [form.liveOptIn, form.mode]);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === form.strategyId) ?? null,
    [strategies, form.strategyId]
  );
  const selectedMarketGroup = useMemo(
    () => marketGroups.find((group) => group.id === form.marketGroupId) ?? null,
    [marketGroups, form.marketGroupId]
  );

  const submitLabel = submitting
    ? t("dashboard.bots.create.creatingCta")
    : isEditMode
      ? t("dashboard.bots.list.save")
      : t("dashboard.bots.create.createCta");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.strategyId || !form.marketGroupId) {
      toast.error(t("dashboard.bots.create.description"));
      return;
    }

    const needsLiveConfirm = form.mode === "LIVE";
    if (needsLiveConfirm) {
      const message = isEditMode
        ? t("dashboard.bots.confirms.liveSave")
        : t("dashboard.bots.confirms.liveCreate");
      if (!window.confirm(message)) return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        mode: form.mode,
        paperStartBalance: form.paperStartBalance,
        strategyId: form.strategyId,
        marketGroupId: form.marketGroupId,
        isActive: form.isActive,
        liveOptIn: form.liveOptIn,
        consentTextVersion: form.liveOptIn ? LIVE_CONSENT_TEXT_VERSION : null,
      };

      if (isEditMode && editId) {
        await updateBot(editId, payload);
        toast.success(t("dashboard.bots.toasts.updated"));
        await loadFormData();
      } else {
        const created = await createBot(payload);
        toast.success(t("dashboard.bots.toasts.created"));
        router.replace(`/dashboard/bots/create?editId=${created.id}`);
      }
    } catch (err: unknown) {
      const message = getAxiosMessage(err);
      if (message === DUPLICATE_ACTIVE_BOT_ERROR) {
        toast.error(t("dashboard.bots.toasts.duplicateActiveTitle"), {
          description: t("dashboard.bots.toasts.duplicateActiveDescription"),
        });
      } else {
        toast.error(
          isEditMode ? t("dashboard.bots.toasts.saveFailed") : t("dashboard.bots.toasts.createFailed"),
          { description: message }
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState title={t("dashboard.bots.states.loadingBots")} />;
  }

  if (error) {
    return (
      <ErrorState
        title={t("dashboard.bots.states.loadBotsFailedTitle")}
        description={error}
        retryLabel={t("dashboard.bots.states.retry")}
        onRetry={() => void loadFormData()}
      />
    );
  }

  if (strategies.length === 0 || marketGroups.length === 0) {
    return (
      <EmptyState
        title={t("dashboard.bots.states.emptyTitle")}
        description={t("dashboard.bots.states.emptyDescription")}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-box border border-base-300/60 bg-base-100/80 p-4">
      <section className="space-y-3 rounded-box border border-base-300/60 bg-base-200/55 p-3">
        <h2 className="text-base font-semibold">{t("dashboard.bots.create.sectionBasics")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control gap-1">
            <span className="label-text">{t("dashboard.bots.create.nameLabel")}</span>
            <input
              className="input input-bordered"
              aria-label={t("dashboard.bots.create.nameAria")}
              placeholder={t("dashboard.bots.create.namePlaceholder")}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>

          <label className="form-control gap-1">
            <span className="label-text">{t("dashboard.bots.create.modeLabel")}</span>
            <select
              className="select select-bordered"
              aria-label={t("dashboard.bots.create.modeAria")}
              value={form.mode}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, mode: event.target.value as BotMode }))
              }
            >
              <option value="PAPER">PAPER</option>
              <option value="LIVE">LIVE</option>
            </select>
          </label>

          {form.mode === "PAPER" ? (
            <label className="form-control gap-1">
              <span className="label-text">{t("dashboard.bots.create.paperBalanceLabel")}</span>
              <input
                type="number"
                min={100}
                step={0.01}
                className="input input-bordered"
                aria-label={t("dashboard.bots.create.paperBalanceAria")}
                value={form.paperStartBalance}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, paperStartBalance: Number(event.target.value) || 0 }))
                }
              />
            </label>
          ) : null}

          <label className="form-control gap-1">
            <span className="label-text">{t("dashboard.bots.list.columns.active")}</span>
            <input
              type="checkbox"
              className="toggle toggle-success"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
          </label>

          {form.mode === "LIVE" ? (
            <label className="form-control gap-1">
              <span className="label-text">{t("dashboard.bots.list.columns.liveOptIn")}</span>
              <input
                type="checkbox"
                className="toggle toggle-warning"
                checked={form.liveOptIn}
                onChange={(event) => setForm((prev) => ({ ...prev, liveOptIn: event.target.checked }))}
              />
            </label>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-box border border-base-300/60 bg-base-200/55 p-3">
        <h2 className="text-base font-semibold">{t("dashboard.bots.create.sectionMarket")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control gap-1">
            <span className="label-text">{t("dashboard.bots.create.marketGroupLabel")}</span>
            <select
              className="select select-bordered"
              aria-label={t("dashboard.bots.create.marketGroupAria")}
              value={form.marketGroupId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, marketGroupId: event.target.value }))
              }
            >
              {marketGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-box border border-base-300/60 bg-base-100/70 px-3 py-2 text-xs">
            <p className="text-[11px] uppercase tracking-wide opacity-60">{t("dashboard.bots.create.marketSummaryLabel")}</p>
            <p className="mt-1 font-medium">
              {selectedMarketGroup?.exchange ?? "BINANCE"} / {selectedMarketGroup?.marketType ?? "-"}
            </p>
            <p className="mt-1 opacity-70">
              Base: {selectedMarketGroup?.baseCurrency ?? "-"} | {t("dashboard.bots.create.whitelistLabel")}:{" "}
              {selectedMarketGroup?.whitelist.length ?? 0} | {t("dashboard.bots.create.blacklistLabel")}:{" "}
              {selectedMarketGroup?.blacklist.length ?? 0}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-box border border-base-300/60 bg-base-200/55 p-3">
        <h2 className="text-base font-semibold">{t("dashboard.bots.create.sectionStrategy")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control gap-1">
            <span className="label-text">{t("dashboard.bots.create.strategyLabel")}</span>
            <select
              className="select select-bordered"
              aria-label={t("dashboard.bots.create.strategyAria")}
              value={form.strategyId}
              onChange={(event) => setForm((prev) => ({ ...prev, strategyId: event.target.value }))}
            >
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-box border border-base-300/60 bg-base-100/70 px-3 py-2 text-xs">
            <p className="text-[11px] uppercase tracking-wide opacity-60">{t("dashboard.bots.create.strategyLabel")}</p>
            <div className="mt-1 grid gap-1">
              <p className="flex items-center justify-between gap-3">
                <span className="opacity-70">{t("dashboard.bots.create.intervalLabel")}</span>
                <span className="font-medium">{selectedStrategy?.interval ?? "-"}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="opacity-70">{t("dashboard.bots.create.leverageLabel")}</span>
                <span className="font-medium">{selectedStrategy?.leverage ?? 1}x</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="opacity-70">{t("dashboard.bots.create.maxOpenLabel")}</span>
                <span className="font-medium">{deriveStrategyMaxOpenPositions(selectedStrategy)}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push("/dashboard/bots")}
          disabled={submitting}
        >
          {t("dashboard.nav.botsList")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

