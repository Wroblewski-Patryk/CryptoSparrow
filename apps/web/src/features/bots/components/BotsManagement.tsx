'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";

import StatusBadge from "../../../ui/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState, SuccessState } from "../../../ui/components/ViewState";
import {
  createBot,
  deleteBot,
  deleteBotSubagentConfig,
  getBotAssistantConfig,
  listBots,
  runBotAssistantDryRun,
  updateBot,
  upsertBotAssistantConfig,
  upsertBotSubagentConfig,
} from "../services/bots.service";
import {
  Bot,
  AssistantDecisionTrace,
  BotMode,
  BotSubagentConfig,
  PositionMode,
  TradeMarket,
} from "../types/bot.type";
import { listStrategies } from "../../strategies/api/strategies.api";
import { StrategyDto } from "../../strategies/types/StrategyForm.type";

const LIVE_CONSENT_TEXT_VERSION = "mvp-v1";

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

const toModeBadge = (mode: BotMode) => {
  if (mode === "LIVE") return "live";
  if (mode === "LOCAL") return "local";
  return "paper";
};

const toRiskBadge = (bot: Bot) => {
  if (bot.mode === "LIVE" && bot.liveOptIn) return { value: "danger", label: "LIVE enabled" } as const;
  if (bot.mode === "LIVE" && !bot.liveOptIn) return { value: "warning", label: "LIVE blocked" } as const;
  return { value: "safe", label: "Safe mode" } as const;
};

export default function BotsManagement() {
  const [activeTab, setActiveTab] = useState<"bots" | "assistant">("bots");
  const [bots, setBots] = useState<Bot[]>([]);
  const [serverSnapshot, setServerSnapshot] = useState<Record<string, Bot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<StrategyDto[]>([]);

  const [name, setName] = useState("");
  const [mode, setMode] = useState<BotMode>("PAPER");
  const [paperStartBalance, setPaperStartBalance] = useState(10_000);
  const [marketType, setMarketType] = useState<TradeMarket>("FUTURES");
  const [positionMode, setPositionMode] = useState<PositionMode>("ONE_WAY");
  const [marketFilter, setMarketFilter] = useState<"ALL" | TradeMarket>("ALL");
  const [maxOpenPositions, setMaxOpenPositions] = useState(1);
  const [strategyId, setStrategyId] = useState<string>("");
  const [assistantBotId, setAssistantBotId] = useState<string>("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantSaving, setAssistantSaving] = useState(false);
  const [assistantMainEnabled, setAssistantMainEnabled] = useState(false);
  const [assistantMandate, setAssistantMandate] = useState("");
  const [assistantModelProfile, setAssistantModelProfile] = useState("balanced");
  const [assistantSafetyMode, setAssistantSafetyMode] = useState<"STRICT" | "BALANCED" | "EXPERIMENTAL">("STRICT");
  const [assistantLatencyMs, setAssistantLatencyMs] = useState(2500);
  const [assistantSubagents, setAssistantSubagents] = useState<BotSubagentConfig[]>([]);
  const [assistantTrace, setAssistantTrace] = useState<AssistantDecisionTrace | null>(null);
  const [assistantDryRunSymbol, setAssistantDryRunSymbol] = useState("BTCUSDT");
  const [assistantDryRunInterval, setAssistantDryRunInterval] = useState("5m");
  const [assistantDryRunRunning, setAssistantDryRunRunning] = useState(false);

  const loadBots = useCallback(async (filter: "ALL" | TradeMarket) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBots(filter === "ALL" ? undefined : filter);
      setBots(data);
      setServerSnapshot(Object.fromEntries(data.map((bot) => [bot.id, bot])));
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac botow.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBots(marketFilter);
  }, [loadBots, marketFilter]);

  useEffect(() => {
    let mounted = true;
    const loadStrategyOptions = async () => {
      try {
        const items = await listStrategies();
        if (mounted) setStrategies(items);
      } catch {
        if (mounted) setStrategies([]);
      }
    };
    void loadStrategyOptions();
    return () => {
      mounted = false;
    };
  }, []);

  const canCreate = useMemo(
    () =>
      name.trim().length > 0 &&
      Number.isFinite(paperStartBalance) &&
      paperStartBalance >= 0 &&
      !creating,
    [creating, name, paperStartBalance]
  );

  const assistantSlots = useMemo(
    () =>
      [1, 2, 3, 4].map((slotIndex) => {
        const existing = assistantSubagents.find((slot) => slot.slotIndex === slotIndex);
        return (
          existing ?? {
            id: `slot-${slotIndex}`,
            userId: "",
            botId: assistantBotId,
            slotIndex,
            role: "GENERAL",
            enabled: false,
            modelProfile: "balanced",
            timeoutMs: 1200,
            safetyMode: "STRICT" as const,
          }
        );
      }),
    [assistantBotId, assistantSubagents]
  );

  const confirmLiveRisk = (message: string) => window.confirm(message);

  const loadAssistant = useCallback(async (botId: string) => {
    setAssistantLoading(true);
    try {
      const config = await getBotAssistantConfig(botId);
      setAssistantMainEnabled(config.assistant?.mainAgentEnabled ?? false);
      setAssistantMandate(config.assistant?.mandate ?? "");
      setAssistantModelProfile(config.assistant?.modelProfile ?? "balanced");
      setAssistantSafetyMode(config.assistant?.safetyMode ?? "STRICT");
      setAssistantLatencyMs(config.assistant?.maxDecisionLatencyMs ?? 2500);
      setAssistantSubagents(config.subagents ?? []);
    } catch (err: unknown) {
      toast.error("Nie udalo sie pobrac konfiguracji asystenta", { description: getAxiosMessage(err) });
      setAssistantSubagents([]);
    } finally {
      setAssistantLoading(false);
    }
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setCreating(true);
    try {
      if (mode === "LIVE") {
        const accepted = confirmLiveRisk(
          "Potwierdzenie LIVE: ten bot bedzie tworzony w trybie LIVE. Kontynuowac?"
        );
        if (!accepted) return;
      }

      const created = await createBot({
        name: name.trim(),
        mode,
        paperStartBalance,
        marketType,
        positionMode,
        strategyId: strategyId || null,
        isActive: false,
        liveOptIn: false,
        consentTextVersion: null,
        maxOpenPositions,
      });
      setBots((prev) => [created, ...prev]);
      setServerSnapshot((prev) => ({ ...prev, [created.id]: created }));
      setName("");
      setMode("PAPER");
      setPaperStartBalance(10_000);
      setMarketType("FUTURES");
      setPositionMode("ONE_WAY");
      setStrategyId("");
      setMaxOpenPositions(1);
      toast.success("Bot utworzony");
      await loadBots(marketFilter);
    } catch (err: unknown) {
      toast.error("Nie udalo sie utworzyc bota", { description: getAxiosMessage(err) });
    } finally {
      setCreating(false);
    }
  };

  const patchBot = (id: string, patch: Partial<Bot>) => {
    setBots((prev) => prev.map((bot) => (bot.id === id ? { ...bot, ...patch } : bot)));
  };

  const handleSave = async (bot: Bot) => {
    const previous = serverSnapshot[bot.id];
    const enteringLiveMode = !!previous && previous.mode !== "LIVE" && bot.mode === "LIVE";
    const enablingLiveOptIn = !!previous && !previous.liveOptIn && bot.liveOptIn;
    const activatingLiveBot =
      !!previous && !previous.isActive && bot.isActive && (bot.mode === "LIVE" || bot.liveOptIn);

    if (enteringLiveMode || enablingLiveOptIn || activatingLiveBot) {
      const accepted = confirmLiveRisk(
        "Potwierdzenie LIVE: zapis aktywuje ryzyko handlu na zywo. Kontynuowac?"
      );
      if (!accepted) {
        patchBot(bot.id, previous);
        return;
      }
    }

    setSavingId(bot.id);
    try {
      const updated = await updateBot(bot.id, {
        name: bot.name,
        mode: bot.mode,
        marketType: bot.marketType,
        positionMode: bot.positionMode,
        isActive: bot.isActive,
        liveOptIn: bot.liveOptIn,
        consentTextVersion: bot.liveOptIn ? LIVE_CONSENT_TEXT_VERSION : null,
        paperStartBalance: bot.paperStartBalance,
        maxOpenPositions: bot.maxOpenPositions,
        strategyId: bot.strategyId ?? null,
      });
      patchBot(bot.id, updated);
      setServerSnapshot((prev) => ({ ...prev, [bot.id]: updated }));
      toast.success("Bot zaktualizowany");
    } catch (err: unknown) {
      toast.error("Nie udalo sie zapisac zmian", { description: getAxiosMessage(err) });
      void loadBots(marketFilter);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (bot: Bot) => {
    if (bot.mode === "LIVE" || bot.liveOptIn || bot.isActive) {
      const accepted = confirmLiveRisk(
        "Potwierdzenie LIVE: usuniecie tego bota zatrzyma aktywna konfiguracje tradingowa. Kontynuowac?"
      );
      if (!accepted) return;
    }

    setDeletingId(bot.id);
    try {
      await deleteBot(bot.id);
      await loadBots(marketFilter);
      toast.success("Bot usuniety");
    } catch (err: unknown) {
      toast.error("Nie udalo sie usunac bota", { description: getAxiosMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveAssistantMain = async () => {
    if (!assistantBotId) return;
    setAssistantSaving(true);
    try {
      await upsertBotAssistantConfig(assistantBotId, {
        mainAgentEnabled: assistantMainEnabled,
        mandate: assistantMandate || null,
        modelProfile: assistantModelProfile,
        safetyMode: assistantSafetyMode,
        maxDecisionLatencyMs: assistantLatencyMs,
      });
      toast.success("Konfiguracja main asystenta zapisana");
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error("Nie udalo sie zapisac konfiguracji asystenta", { description: getAxiosMessage(err) });
    } finally {
      setAssistantSaving(false);
    }
  };

  const handleSaveSubagent = async (slot: BotSubagentConfig) => {
    if (!assistantBotId) return;
    setAssistantSaving(true);
    try {
      await upsertBotSubagentConfig(assistantBotId, slot.slotIndex, {
        role: slot.role,
        enabled: slot.enabled,
        modelProfile: slot.modelProfile,
        timeoutMs: slot.timeoutMs,
        safetyMode: slot.safetyMode,
      });
      toast.success(`Slot ${slot.slotIndex} zapisany`);
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error("Nie udalo sie zapisac slotu subagenta", { description: getAxiosMessage(err) });
    } finally {
      setAssistantSaving(false);
    }
  };

  const handleClearSubagent = async (slotIndex: number) => {
    if (!assistantBotId) return;
    setAssistantSaving(true);
    try {
      await deleteBotSubagentConfig(assistantBotId, slotIndex);
      toast.success(`Slot ${slotIndex} usuniety`);
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error("Nie udalo sie usunac slotu subagenta", { description: getAxiosMessage(err) });
    } finally {
      setAssistantSaving(false);
    }
  };

  const handleRunAssistantDryRun = async () => {
    if (!assistantBotId) return;
    setAssistantDryRunRunning(true);
    try {
      const trace = await runBotAssistantDryRun(assistantBotId, {
        symbol: assistantDryRunSymbol,
        intervalWindow: assistantDryRunInterval,
        mode: "PAPER",
      });
      setAssistantTrace(trace);
      toast.success("Assistant dry-run gotowy");
    } catch (err: unknown) {
      toast.error("Nie udalo sie wykonac dry-run asystenta", { description: getAxiosMessage(err) });
    } finally {
      setAssistantDryRunRunning(false);
    }
  };

  useEffect(() => {
    if (bots.length === 0) return;
    if (!assistantBotId) {
      setAssistantBotId(bots[0].id);
      return;
    }
    const exists = bots.some((bot) => bot.id === assistantBotId);
    if (!exists) setAssistantBotId(bots[0].id);
  }, [bots, assistantBotId]);

  useEffect(() => {
    if (!assistantBotId || activeTab !== "assistant") return;
    void loadAssistant(assistantBotId);
  }, [assistantBotId, activeTab, loadAssistant]);

  return (
    <div className="space-y-5">
      <div role="tablist" className="tabs tabs-boxed inline-flex gap-1">
        <button
          type="button"
          role="tab"
          className={`tab ${activeTab === "bots" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("bots")}
        >
          Bots
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${activeTab === "assistant" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("assistant")}
        >
          Assistant
        </button>
      </div>

      {activeTab === "bots" && (
        <>
      <form onSubmit={handleCreate} className="rounded-xl border border-base-300 bg-base-200 p-4">
        <h2 className="text-lg font-semibold">Nowy bot</h2>
        <p className="text-sm opacity-70">
          Dodaj bota i ustaw tryb uruchomienia. LIVE wymaga opt-in.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-7">
          <label className="form-control">
            <span className="label-text">Nazwa</span>
            <input
              className="input input-bordered"
              placeholder="Momentum Runner"
              aria-label="Nazwa bota"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Tryb</span>
            <select
              className="select select-bordered"
              aria-label="Tryb bota"
              value={mode}
              onChange={(event) => setMode(event.target.value as BotMode)}
            >
              <option value="PAPER">PAPER</option>
              <option value="LIVE">LIVE</option>
              <option value="LOCAL">LOCAL</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Rynek</span>
            <select
              className="select select-bordered"
              aria-label="Rynek bota"
              value={marketType}
              onChange={(event) => setMarketType(event.target.value as TradeMarket)}
            >
              <option value="FUTURES">FUTURES</option>
              <option value="SPOT">SPOT</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Paper start balance</span>
            <input
              type="number"
              min={0}
              max={100000000}
              className="input input-bordered"
              aria-label="Paper start balance"
              value={paperStartBalance}
              onChange={(event) =>
                setPaperStartBalance(Number.isFinite(Number(event.target.value)) ? Number(event.target.value) : 0)
              }
              disabled={mode === "LIVE"}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Pozycja</span>
            <select
              className="select select-bordered"
              aria-label="Tryb pozycji bota"
              value={positionMode}
              onChange={(event) => setPositionMode(event.target.value as PositionMode)}
            >
              <option value="ONE_WAY">ONE_WAY</option>
              <option value="HEDGE">HEDGE</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Max open positions</span>
            <input
              type="number"
              min={1}
              max={100}
              className="input input-bordered"
              aria-label="Max open positions"
              value={maxOpenPositions}
              onChange={(event) => setMaxOpenPositions(Number(event.target.value))}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Strategia</span>
            <select
              className="select select-bordered"
              aria-label="Strategia bota"
              value={strategyId}
              onChange={(event) => setStrategyId(event.target.value)}
            >
              <option value="">Brak</option>
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn btn-primary btn-sm" disabled={!canCreate}>
            {creating ? "Tworzenie..." : "Dodaj bota"}
          </button>
        </div>
      </form>

      {loading && <LoadingState title="Ladowanie botow" />}
      {!loading && error && (
        <ErrorState
          title="Nie udalo sie pobrac botow"
          description={error}
          retryLabel="Sprobuj ponownie"
          onRetry={() => void loadBots(marketFilter)}
        />
      )}
      {!loading && !error && bots.length === 0 && (
        <EmptyState
          title="Brak botow"
          description="Dodaj pierwszego bota, aby kontrolowac tryb PAPER/LIVE i limity."
        />
      )}

      {!loading && !error && bots.length > 0 && (
        <div className="space-y-3">
          <SuccessState
            title="Bots control center aktywny"
            description={`Skonfigurowano ${bots.length} ${bots.length === 1 ? "bota" : "botow"}.`}
          />
          <div className="flex justify-end">
            <label className="form-control w-48">
              <span className="label-text text-xs">Filtr rynku</span>
              <select
                className="select select-bordered select-sm"
                aria-label="Filtr rynku botow"
                value={marketFilter}
                onChange={(event) => setMarketFilter(event.target.value as "ALL" | TradeMarket)}
              >
                <option value="ALL">Wszystkie</option>
                <option value="FUTURES">FUTURES</option>
                <option value="SPOT">SPOT</option>
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Rynek</th>
                  <th>Pozycja</th>
                  <th>Strategia</th>
                  <th>Status</th>
                  <th>Tryb</th>
                  <th>Paper balance</th>
                  <th>Max positions</th>
                  <th>Live opt-in</th>
                  <th>Aktywny</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot) => {
                  const risk = toRiskBadge(bot);
                  return (
                    <tr key={bot.id}>
                      <td>
                        <input
                          className="input input-bordered input-sm w-full min-w-40"
                          value={bot.name}
                          onChange={(event) => patchBot(bot.id, { name: event.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          className="select select-bordered select-xs w-full"
                          value={bot.marketType}
                          onChange={(event) =>
                            patchBot(bot.id, { marketType: event.target.value as TradeMarket })
                          }
                        >
                          <option value="FUTURES">FUTURES</option>
                          <option value="SPOT">SPOT</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="select select-bordered select-xs w-full"
                          value={bot.positionMode}
                          onChange={(event) =>
                            patchBot(bot.id, { positionMode: event.target.value as PositionMode })
                          }
                        >
                          <option value="ONE_WAY">ONE_WAY</option>
                          <option value="HEDGE">HEDGE</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="select select-bordered select-xs w-full min-w-48"
                          value={bot.strategyId ?? ""}
                          onChange={(event) =>
                            patchBot(bot.id, { strategyId: event.target.value || null })
                          }
                        >
                          <option value="">Brak</option>
                          {strategies.map((strategy) => (
                            <option key={strategy.id} value={strategy.id}>
                              {strategy.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <StatusBadge kind="risk" value={risk.value} label={risk.label} />
                      </td>
                      <td>
                        <div className="space-y-1">
                          <StatusBadge kind="mode" value={toModeBadge(bot.mode)} label={`Mode: ${bot.mode}`} />
                          <select
                            className="select select-bordered select-xs w-full"
                            value={bot.mode}
                            onChange={(event) => patchBot(bot.id, { mode: event.target.value as BotMode })}
                          >
                            <option value="PAPER">PAPER</option>
                            <option value="LIVE">LIVE</option>
                            <option value="LOCAL">LOCAL</option>
                          </select>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={100000000}
                          className="input input-bordered input-sm w-28"
                          value={bot.paperStartBalance}
                          disabled={bot.mode === "LIVE"}
                          onChange={(event) =>
                            patchBot(bot.id, {
                              paperStartBalance: Number.isFinite(Number(event.target.value))
                                ? Number(event.target.value)
                                : 0,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className="input input-bordered input-sm w-24"
                          value={bot.maxOpenPositions}
                          onChange={(event) =>
                            patchBot(bot.id, { maxOpenPositions: Number(event.target.value) })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="toggle toggle-warning toggle-sm"
                          checked={bot.liveOptIn}
                          onChange={(event) => patchBot(bot.id, { liveOptIn: event.target.checked })}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="toggle toggle-success toggle-sm"
                          checked={bot.isActive}
                          onChange={(event) => patchBot(bot.id, { isActive: event.target.checked })}
                        />
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            disabled={savingId === bot.id}
                            onClick={() => void handleSave(bot)}
                          >
                            {savingId === bot.id ? "Zapisywanie..." : "Zapisz"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-error btn-xs"
                            disabled={deletingId === bot.id}
                            onClick={() => void handleDelete(bot)}
                          >
                            {deletingId === bot.id ? "Usuwanie..." : "Usun"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {bots.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center text-sm opacity-70">
                      Brak botow dla wybranego rynku.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {activeTab === "assistant" && (
        <div className="space-y-4 rounded-xl border border-base-300 bg-base-200 p-4">
          <h2 className="text-lg font-semibold">Assistant Config</h2>
          <p className="text-sm opacity-70">
            Konfiguracja glownego asystenta i 4 slotow subagentow per bot.
          </p>

          {bots.length === 0 ? (
            <EmptyState
              title="Brak botow"
              description="Utworz najpierw bota, aby skonfigurowac Assistant."
            />
          ) : (
            <>
              <label className="form-control max-w-sm">
                <span className="label-text">Bot</span>
                <select
                  className="select select-bordered"
                  value={assistantBotId}
                  onChange={(event) => setAssistantBotId(event.target.value)}
                >
                  {bots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name}
                    </option>
                  ))}
                </select>
              </label>

              {assistantLoading ? (
                <LoadingState title="Ladowanie konfiguracji asystenta" />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-5">
                    <label className="form-control">
                      <span className="label-text">Main enabled</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-success"
                        checked={assistantMainEnabled}
                        onChange={(event) => setAssistantMainEnabled(event.target.checked)}
                      />
                    </label>
                    <label className="form-control md:col-span-2">
                      <span className="label-text">Mandate</span>
                      <input
                        className="input input-bordered"
                        value={assistantMandate}
                        onChange={(event) => setAssistantMandate(event.target.value)}
                        placeholder="Trade only with clear risk-adjusted edge"
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text">Model profile</span>
                      <input
                        className="input input-bordered"
                        value={assistantModelProfile}
                        onChange={(event) => setAssistantModelProfile(event.target.value)}
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text">Safety mode</span>
                      <select
                        className="select select-bordered"
                        value={assistantSafetyMode}
                        onChange={(event) =>
                          setAssistantSafetyMode(event.target.value as "STRICT" | "BALANCED" | "EXPERIMENTAL")
                        }
                      >
                        <option value="STRICT">STRICT</option>
                        <option value="BALANCED">BALANCED</option>
                        <option value="EXPERIMENTAL">EXPERIMENTAL</option>
                      </select>
                    </label>
                  </div>
                  <label className="form-control max-w-xs">
                    <span className="label-text">Main latency (ms)</span>
                    <input
                      type="number"
                      className="input input-bordered"
                      min={200}
                      max={30000}
                      value={assistantLatencyMs}
                      onChange={(event) => setAssistantLatencyMs(Number(event.target.value))}
                    />
                  </label>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={assistantSaving || !assistantBotId}
                      onClick={() => void handleSaveAssistantMain()}
                    >
                      {assistantSaving ? "Zapisywanie..." : "Zapisz main config"}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {assistantSlots.map((slot) => (
                      <div key={slot.slotIndex} className="rounded-lg border border-base-300 p-3">
                        <div className="mb-2 font-medium">Subagent slot {slot.slotIndex}</div>
                        <div className="grid gap-3 md:grid-cols-5">
                          <label className="form-control">
                            <span className="label-text">Enabled</span>
                            <input
                              type="checkbox"
                              className="toggle toggle-sm"
                              checked={slot.enabled}
                              onChange={(event) =>
                                setAssistantSubagents((prev) => {
                                  const next = [...prev];
                                  const idx = next.findIndex((item) => item.slotIndex === slot.slotIndex);
                                  const updated = { ...slot, enabled: event.target.checked };
                                  if (idx >= 0) next[idx] = updated;
                                  else next.push(updated);
                                  return next;
                                })
                              }
                            />
                          </label>
                          <label className="form-control">
                            <span className="label-text">Role</span>
                            <input
                              className="input input-bordered input-sm"
                              value={slot.role}
                              onChange={(event) =>
                                setAssistantSubagents((prev) => {
                                  const next = [...prev];
                                  const idx = next.findIndex((item) => item.slotIndex === slot.slotIndex);
                                  const updated = { ...slot, role: event.target.value };
                                  if (idx >= 0) next[idx] = updated;
                                  else next.push(updated);
                                  return next;
                                })
                              }
                            />
                          </label>
                          <label className="form-control">
                            <span className="label-text">Profile</span>
                            <input
                              className="input input-bordered input-sm"
                              value={slot.modelProfile}
                              onChange={(event) =>
                                setAssistantSubagents((prev) => {
                                  const next = [...prev];
                                  const idx = next.findIndex((item) => item.slotIndex === slot.slotIndex);
                                  const updated = { ...slot, modelProfile: event.target.value };
                                  if (idx >= 0) next[idx] = updated;
                                  else next.push(updated);
                                  return next;
                                })
                              }
                            />
                          </label>
                          <label className="form-control">
                            <span className="label-text">Timeout (ms)</span>
                            <input
                              type="number"
                              min={100}
                              max={15000}
                              className="input input-bordered input-sm"
                              value={slot.timeoutMs}
                              onChange={(event) =>
                                setAssistantSubagents((prev) => {
                                  const next = [...prev];
                                  const idx = next.findIndex((item) => item.slotIndex === slot.slotIndex);
                                  const updated = { ...slot, timeoutMs: Number(event.target.value) };
                                  if (idx >= 0) next[idx] = updated;
                                  else next.push(updated);
                                  return next;
                                })
                              }
                            />
                          </label>
                          <label className="form-control">
                            <span className="label-text">Safety</span>
                            <select
                              className="select select-bordered select-sm"
                              value={slot.safetyMode}
                              onChange={(event) =>
                                setAssistantSubagents((prev) => {
                                  const next = [...prev];
                                  const idx = next.findIndex((item) => item.slotIndex === slot.slotIndex);
                                  const updated = {
                                    ...slot,
                                    safetyMode: event.target.value as "STRICT" | "BALANCED" | "EXPERIMENTAL",
                                  };
                                  if (idx >= 0) next[idx] = updated;
                                  else next.push(updated);
                                  return next;
                                })
                              }
                            >
                              <option value="STRICT">STRICT</option>
                              <option value="BALANCED">BALANCED</option>
                              <option value="EXPERIMENTAL">EXPERIMENTAL</option>
                            </select>
                          </label>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            disabled={assistantSaving || !assistantBotId}
                            onClick={() => void handleSaveSubagent(slot)}
                          >
                            Zapisz slot
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            disabled={assistantSaving || !assistantBotId}
                            onClick={() => void handleClearSubagent(slot.slotIndex)}
                          >
                            Usun slot
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-base-300 p-3">
                    <div className="mb-2 font-medium">Decision Timeline (dry-run)</div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <label className="form-control">
                        <span className="label-text">Symbol</span>
                        <input
                          className="input input-bordered input-sm"
                          value={assistantDryRunSymbol}
                          onChange={(event) => setAssistantDryRunSymbol(event.target.value.toUpperCase())}
                        />
                      </label>
                      <label className="form-control">
                        <span className="label-text">Interval</span>
                        <input
                          className="input input-bordered input-sm"
                          value={assistantDryRunInterval}
                          onChange={(event) => setAssistantDryRunInterval(event.target.value)}
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={assistantDryRunRunning || !assistantBotId}
                          onClick={() => void handleRunAssistantDryRun()}
                        >
                          {assistantDryRunRunning ? "Uruchamianie..." : "Uruchom dry-run"}
                        </button>
                      </div>
                    </div>

                    {assistantTrace && (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-md border border-base-300 p-2 text-sm">
                          <div>Request: {assistantTrace.requestId}</div>
                          <div>Mode: {assistantTrace.mode}</div>
                          <div>Final decision: {assistantTrace.finalDecision}</div>
                          <div>Reason: {assistantTrace.finalReason}</div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="table table-xs">
                            <thead>
                              <tr>
                                <th>Slot</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Latency (ms)</th>
                                <th>Msg</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assistantTrace.statuses.map((status) => (
                                <tr key={`${status.slotIndex}-${status.role}`}>
                                  <td>{status.slotIndex}</td>
                                  <td>{status.role}</td>
                                  <td>{status.status}</td>
                                  <td>{status.latencyMs}</td>
                                  <td>{status.message ?? "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
