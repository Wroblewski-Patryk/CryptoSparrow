'use client';

import { TranslationKey } from "../../../../i18n/translations";
import { LuBot, LuLayoutDashboard, LuSparkles } from "react-icons/lu";

type BotsTab = "bots" | "monitoring" | "assistant";

type BotsManagementTabsProps = {
  activeTab: BotsTab;
  onChange: (tab: BotsTab) => void;
  t: (key: TranslationKey) => string;
};

export function BotsManagementTabs({ activeTab, onChange, t }: BotsManagementTabsProps) {
  const tabs = [
    { key: "bots" as const, label: t("dashboard.bots.tabs.bots"), icon: <LuBot className="h-3.5 w-3.5" /> },
    {
      key: "monitoring" as const,
      label: t("dashboard.bots.tabs.monitoring"),
      icon: <LuLayoutDashboard className="h-3.5 w-3.5" />,
    },
    {
      key: "assistant" as const,
      label: t("dashboard.bots.tabs.assistant"),
      icon: <LuSparkles className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div role="tablist" className="tabs tabs-boxed grid w-full max-w-3xl grid-cols-3 gap-1 rounded-xl border border-base-300/60 bg-base-200/60 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          className={`tab h-9 gap-1.5 rounded-lg text-xs font-semibold md:text-sm ${activeTab === tab.key ? "tab-active shadow-sm" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.icon}
          <span className="truncate">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
