'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TranslationKey } from "../../../i18n/translations";
import {
  deleteBotSubagentConfig,
  getBotAssistantConfig,
  runBotAssistantDryRun,
  upsertBotAssistantConfig,
  upsertBotSubagentConfig,
} from "../services/bots.service";
import { AssistantDecisionTrace, Bot, BotSubagentConfig } from "../types/bot.type";
import { getAxiosMessage } from '@/lib/getAxiosMessage';

const interpolateTemplate = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, token) => String(values[token] ?? ""));

type UseBotsAssistantControllerArgs = {
  activeTab: "bots" | "monitoring" | "assistant";
  bots: Bot[];
  preferredBotId: string | null;
  t: (key: TranslationKey) => string;
};

export const useBotsAssistantController = ({
  activeTab,
  bots,
  preferredBotId,
  t,
}: UseBotsAssistantControllerArgs) => {
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
      toast.error(t("dashboard.bots.assistant.toasts.loadFailed"), { description: getAxiosMessage(err) });
      setAssistantSubagents([]);
    } finally {
      setAssistantLoading(false);
    }
  }, [t]);

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
      toast.success(t("dashboard.bots.assistant.toasts.mainSaved"));
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.assistant.toasts.mainSaveFailed"), { description: getAxiosMessage(err) });
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
      toast.success(interpolateTemplate(t("dashboard.bots.assistant.toasts.slotSaved"), { slot: slot.slotIndex }));
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.assistant.toasts.slotSaveFailed"), { description: getAxiosMessage(err) });
    } finally {
      setAssistantSaving(false);
    }
  };

  const handleClearSubagent = async (slotIndex: number) => {
    if (!assistantBotId) return;
    setAssistantSaving(true);
    try {
      await deleteBotSubagentConfig(assistantBotId, slotIndex);
      toast.success(interpolateTemplate(t("dashboard.bots.assistant.toasts.slotDeleted"), { slot: slotIndex }));
      await loadAssistant(assistantBotId);
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.assistant.toasts.slotDeleteFailed"), { description: getAxiosMessage(err) });
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
      toast.success(t("dashboard.bots.assistant.toasts.dryRunReady"));
    } catch (err: unknown) {
      toast.error(t("dashboard.bots.assistant.toasts.dryRunFailed"), { description: getAxiosMessage(err) });
    } finally {
      setAssistantDryRunRunning(false);
    }
  };

  useEffect(() => {
    if (bots.length === 0) return;
    const preferredCandidate =
      preferredBotId && bots.some((bot) => bot.id === preferredBotId) ? preferredBotId : null;
    const fallbackBotId = preferredCandidate ?? bots[0].id;
    if (!assistantBotId) {
      setAssistantBotId(fallbackBotId);
      return;
    }
    const exists = bots.some((bot) => bot.id === assistantBotId);
    if (!exists || (preferredCandidate && assistantBotId !== preferredCandidate)) {
      setAssistantBotId(fallbackBotId);
    }
  }, [assistantBotId, bots, preferredBotId]);

  useEffect(() => {
    if (!assistantBotId || activeTab !== "assistant") return;
    void loadAssistant(assistantBotId);
  }, [activeTab, assistantBotId, loadAssistant]);

  return {
    assistantBotId,
    assistantDryRunInterval,
    assistantDryRunRunning,
    assistantDryRunSymbol,
    assistantLatencyMs,
    assistantLoading,
    assistantMainEnabled,
    assistantMandate,
    assistantModelProfile,
    assistantSafetyMode,
    assistantSaving,
    assistantSlots,
    assistantSubagents,
    assistantTrace,
    handleClearSubagent,
    handleRunAssistantDryRun,
    handleSaveAssistantMain,
    handleSaveSubagent,
    setAssistantBotId,
    setAssistantDryRunInterval,
    setAssistantDryRunSymbol,
    setAssistantLatencyMs,
    setAssistantMainEnabled,
    setAssistantMandate,
    setAssistantModelProfile,
    setAssistantSafetyMode,
    setAssistantSubagents,
  };
};
