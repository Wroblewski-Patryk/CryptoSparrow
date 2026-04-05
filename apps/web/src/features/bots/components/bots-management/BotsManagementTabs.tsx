'use client';

import { TranslationKey } from "../../../../i18n/translations";

type BotsTab = "bots" | "monitoring" | "assistant";

type BotsManagementTabsProps = {
  activeTab: BotsTab;
  onChange: (tab: BotsTab) => void;
  t: (key: TranslationKey) => string;
};

export function BotsManagementTabs({ activeTab, onChange, t }: BotsManagementTabsProps) {
  return (
    <div role="tablist" className="tabs tabs-boxed inline-flex gap-1">
      <button
        type="button"
        role="tab"
        className={`tab ${activeTab === "bots" ? "tab-active" : ""}`}
        onClick={() => onChange("bots")}
      >
        {t("dashboard.bots.tabs.bots")}
      </button>
      <button
        type="button"
        role="tab"
        className={`tab ${activeTab === "monitoring" ? "tab-active" : ""}`}
        onClick={() => onChange("monitoring")}
      >
        {t("dashboard.bots.tabs.monitoring")}
      </button>
      <button
        type="button"
        role="tab"
        className={`tab ${activeTab === "assistant" ? "tab-active" : ""}`}
        onClick={() => onChange("assistant")}
      >
        {t("dashboard.bots.tabs.assistant")}
      </button>
    </div>
  );
}

