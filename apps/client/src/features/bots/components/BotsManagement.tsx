'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";

import StatusBadge from "../../../ui/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState, SuccessState } from "../../../ui/components/ViewState";
import { createBot, deleteBot, listBots, updateBot } from "../services/bots.service";
import { Bot, BotMode } from "../types/bot.type";

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
  const [bots, setBots] = useState<Bot[]>([]);
  const [serverSnapshot, setServerSnapshot] = useState<Record<string, Bot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [mode, setMode] = useState<BotMode>("PAPER");
  const [maxOpenPositions, setMaxOpenPositions] = useState(1);

  const loadBots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBots();
      setBots(data);
      setServerSnapshot(Object.fromEntries(data.map((bot) => [bot.id, bot])));
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? "Nie udalo sie pobrac botow.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBots();
  }, [loadBots]);

  const canCreate = useMemo(() => name.trim().length > 0 && !creating, [creating, name]);

  const confirmLiveRisk = (message: string) => window.confirm(message);

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
        isActive: false,
        liveOptIn: false,
        consentTextVersion: null,
        maxOpenPositions,
      });
      setBots((prev) => [created, ...prev]);
      setServerSnapshot((prev) => ({ ...prev, [created.id]: created }));
      setName("");
      setMode("PAPER");
      setMaxOpenPositions(1);
      toast.success("Bot utworzony");
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
        isActive: bot.isActive,
        liveOptIn: bot.liveOptIn,
        consentTextVersion: bot.liveOptIn ? LIVE_CONSENT_TEXT_VERSION : null,
        maxOpenPositions: bot.maxOpenPositions,
      });
      patchBot(bot.id, updated);
      setServerSnapshot((prev) => ({ ...prev, [bot.id]: updated }));
      toast.success("Bot zaktualizowany");
    } catch (err: unknown) {
      toast.error("Nie udalo sie zapisac zmian", { description: getAxiosMessage(err) });
      void loadBots();
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteBot(id);
      setBots((prev) => prev.filter((bot) => bot.id !== id));
      toast.success("Bot usuniety");
    } catch (err: unknown) {
      toast.error("Nie udalo sie usunac bota", { description: getAxiosMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleCreate} className="rounded-xl border border-base-300 bg-base-200 p-4">
        <h2 className="text-lg font-semibold">Nowy bot</h2>
        <p className="text-sm opacity-70">
          Dodaj bota i ustaw tryb uruchomienia. LIVE wymaga opt-in.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
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
          onRetry={() => void loadBots()}
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
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Status</th>
                  <th>Tryb</th>
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
                            onClick={() => void handleDelete(bot.id)}
                          >
                            {deletingId === bot.id ? "Usuwanie..." : "Usun"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
