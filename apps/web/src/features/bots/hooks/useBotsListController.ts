'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TranslationKey } from "../../../i18n/translations";
import { listMarketUniverses } from "../../markets/services/markets.service";
import { MarketUniverse } from "../../markets/types/marketUniverse.type";
import { listStrategies } from "../../strategies/api/strategies.api";
import { StrategyDto } from "../../strategies/types/StrategyForm.type";
import { listWallets } from "../../wallets/services/wallets.service";
import { Wallet } from "../../wallets/types/wallet.type";
import { createBot, deleteBot, listBots, updateBot } from "../services/bots.service";
import { Bot, TradeMarket } from "../types/bot.type";
import { getAxiosMessage } from '@/lib/getAxiosMessage';

const LIVE_CONSENT_TEXT_VERSION = "mvp-v1";
const DUPLICATE_ACTIVE_BOT_ERROR = "active bot already exists for this strategy + market group pair";

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

type UseBotsListControllerArgs = {
  confirmLiveRisk: (message: string) => Promise<boolean>;
  t: (key: TranslationKey) => string;
};

export const useBotsListController = ({ confirmLiveRisk, t }: UseBotsListControllerArgs) => {
  const [bots, setBots] = useState<Bot[]>([]);
  const [serverSnapshot, setServerSnapshot] = useState<Record<string, Bot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [marketGroups, setMarketGroups] = useState<MarketUniverse[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  const [name, setName] = useState("");
  const [walletId, setWalletId] = useState<string>("");
  const [marketFilter, setMarketFilter] = useState<"ALL" | TradeMarket>("ALL");
  const [strategyId, setStrategyId] = useState<string>("");
  const [marketGroupId, setMarketGroupId] = useState<string>("");

  const loadBots = useCallback(async (filter: "ALL" | TradeMarket) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBots(filter === "ALL" ? undefined : filter);
      setBots(data);
      setServerSnapshot(Object.fromEntries(data.map((bot) => [bot.id, bot])));
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? t("dashboard.bots.errors.loadBots"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadBots(marketFilter);
  }, [loadBots, marketFilter]);

  useEffect(() => {
    let mounted = true;
    const loadStrategyOptions = async () => {
      try {
        const items = await listStrategies();
        if (!mounted) return;
        setStrategies(items);
        setStrategyId((prev) => prev || items[0]?.id || "");
      } catch {
        if (!mounted) return;
        setStrategies([]);
        setStrategyId("");
      }
    };
    void loadStrategyOptions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadMarketGroupOptions = async () => {
      try {
        const items = await listMarketUniverses();
        if (!mounted) return;
        setMarketGroups(items);
        setMarketGroupId((prev) => prev || items[0]?.id || "");
      } catch (err: unknown) {
        if (!mounted) return;
        setMarketGroups([]);
        toast.error(t("dashboard.bots.toasts.marketGroupsLoadFailed"), { description: getAxiosMessage(err) });
      }
    };
    void loadMarketGroupOptions();
    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    let mounted = true;
    const loadWalletOptions = async () => {
      try {
        const items = await listWallets();
        if (!mounted) return;
        setWallets(items);
        setWalletId((prev) => prev || items[0]?.id || "");
      } catch (err: unknown) {
        if (!mounted) return;
        setWallets([]);
        toast.error("Wallets load failed", { description: getAxiosMessage(err) });
      }
    };
    void loadWalletOptions();
    return () => {
      mounted = false;
    };
  }, []);

  const canCreate = useMemo(
    () =>
      name.trim().length > 0 &&
      walletId.trim().length > 0 &&
      strategyId.trim().length > 0 &&
      marketGroupId.trim().length > 0 &&
      !creating,
    [creating, marketGroupId, name, strategyId, walletId]
  );

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === strategyId) ?? null,
    [strategies, strategyId]
  );
  const selectedMarketGroup = useMemo(
    () => marketGroups.find((group) => group.id === marketGroupId) ?? null,
    [marketGroupId, marketGroups]
  );
  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === walletId) ?? null,
    [walletId, wallets]
  );
  const selectedStrategyMaxOpenPositions = useMemo(
    () => deriveStrategyMaxOpenPositions(selectedStrategy),
    [selectedStrategy]
  );

  const patchBot = (id: string, patch: Partial<Bot>) => {
    setBots((prev) => prev.map((bot) => (bot.id === id ? { ...bot, ...patch } : bot)));
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setCreating(true);
    try {
      const createMode = selectedWallet?.mode ?? "PAPER";
      if (createMode === "LIVE") {
        const accepted = await confirmLiveRisk(t("dashboard.bots.confirms.liveCreate"));
        if (!accepted) return;
      }

      const created = await createBot({
        name: name.trim(),
        walletId,
        strategyId,
        marketGroupId,
        isActive: createMode === "PAPER",
        liveOptIn: false,
        consentTextVersion: null,
      });
      setBots((prev) => [created, ...prev]);
      setServerSnapshot((prev) => ({ ...prev, [created.id]: created }));
      setName("");
      setWalletId((prev) => prev || wallets[0]?.id || "");
      setStrategyId((prev) => prev || strategies[0]?.id || "");
      setMarketGroupId((prev) => prev || marketGroups[0]?.id || "");
      toast.success(t("dashboard.bots.toasts.created"));
      await loadBots(marketFilter);
    } catch (err: unknown) {
      const message = getAxiosMessage(err);
      if (message === DUPLICATE_ACTIVE_BOT_ERROR) {
        toast.error(t("dashboard.bots.toasts.duplicateActiveTitle"), {
          description: t("dashboard.bots.toasts.duplicateActiveDescription"),
        });
      } else {
        toast.error(t("dashboard.bots.toasts.createFailed"), { description: message });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (bot: Bot) => {
    const previous = serverSnapshot[bot.id];
    const effectiveLiveOptIn = bot.mode === "LIVE" ? bot.liveOptIn : false;
    const enteringLiveMode = !!previous && previous.mode !== "LIVE" && bot.mode === "LIVE";
    const enablingLiveOptIn = !!previous && !previous.liveOptIn && effectiveLiveOptIn;
    const activatingLiveBot =
      !!previous && !previous.isActive && bot.isActive && (bot.mode === "LIVE" || effectiveLiveOptIn);

    if (enteringLiveMode || enablingLiveOptIn || activatingLiveBot) {
      const accepted = await confirmLiveRisk(t("dashboard.bots.confirms.liveSave"));
      if (!accepted) {
        patchBot(bot.id, previous);
        return;
      }
    }

    setSavingId(bot.id);
    try {
      const updated = await updateBot(bot.id, {
        name: bot.name,
        walletId: bot.walletId ?? null,
        isActive: bot.isActive,
        liveOptIn: effectiveLiveOptIn,
        consentTextVersion: effectiveLiveOptIn ? LIVE_CONSENT_TEXT_VERSION : null,
        strategyId: bot.strategyId ?? null,
      });
      patchBot(bot.id, updated);
      setServerSnapshot((prev) => ({ ...prev, [bot.id]: updated }));
      toast.success(t("dashboard.bots.toasts.updated"));
    } catch (err: unknown) {
      const message = getAxiosMessage(err);
      if (message === DUPLICATE_ACTIVE_BOT_ERROR) {
        toast.error(t("dashboard.bots.toasts.activeConflictTitle"), {
          description: t("dashboard.bots.toasts.activeConflictDescription"),
        });
      } else {
        toast.error(t("dashboard.bots.toasts.saveFailed"), { description: message });
      }
      void loadBots(marketFilter);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (bot: Bot) => {
    if (bot.mode === "LIVE" || bot.liveOptIn || bot.isActive) {
      const accepted = await confirmLiveRisk(t("dashboard.bots.confirms.liveDelete"));
      if (!accepted) return;
    }

    setDeletingId(bot.id);
    try {
      await deleteBot(bot.id);
      await loadBots(marketFilter);
      toast.success(t("dashboard.bots.toasts.deleted"));
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.toasts.deleteFailed"), { description: getAxiosMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  return {
    bots,
    canCreate,
    creating,
    deletingId,
    error,
    handleCreate,
    handleDelete,
    handleSave,
    loadBots,
    loading,
    marketFilter,
    marketGroupId,
    marketGroups,
    name,
    patchBot,
    savingId,
    selectedMarketGroup,
    selectedStrategy,
    selectedStrategyMaxOpenPositions,
    selectedWallet,
    setMarketFilter,
    setMarketGroupId,
    setName,
    setStrategyId,
    setWalletId,
    strategyId,
    strategies,
    walletId,
    wallets,
  };
};
