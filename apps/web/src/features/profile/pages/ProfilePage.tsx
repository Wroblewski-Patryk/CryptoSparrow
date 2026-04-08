'use client';
import type { ReactNode } from "react";
import { useState } from "react";
import { LuKey, LuSettings, LuSubscript, LuUser, LuUserRound } from "react-icons/lu";
import { useI18n } from "../../../i18n/I18nProvider";

import BasicForm from "../components/BasicForm";
import Subscription from "../components/Subscription";
import Security from "../components/Security";
import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import ExchangeConnectionsView from "../../exchanges/components/ExchangeConnectionsView";
import Tabs from "@/ui/components/Tabs";
import { TAB_CONTENT_FRAME_CLASS, TAB_CONTENT_INNER_CLASS } from "@/ui/components/tabContentFrame";

type ProfileTabKey = "basic" | "api" | "subscription" | "security";

export default function ProfilePage() {
  const { locale } = useI18n();
  const copy = locale === 'pl'
    ? {
        title: "Moje konto",
        breadcrumbDashboard: "Dashboard",
        breadcrumbCurrent: "Moje konto",
        tabs: {
          basic: "Profil uzytkownika",
          api: "Integracje i API keys",
          subscription: "Subskrypcja",
          security: "Bezpieczenstwo",
        },
      }
    : {
        title: "My account",
        breadcrumbDashboard: "Dashboard",
        breadcrumbCurrent: "My account",
        tabs: {
          basic: "User profile",
          api: "Integrations and API keys",
          subscription: "Subscription",
          security: "Security",
        },
      };

  const tabs: { label: string; key: ProfileTabKey; hash: string; icon: ReactNode }[] = [
    { label: copy.tabs.basic, key: "basic", hash: "basic", icon: <LuUser className="h-4 w-4" aria-hidden /> },
    { label: copy.tabs.api, key: "api", hash: "api", icon: <LuKey className="h-4 w-4" aria-hidden /> },
    {
      label: copy.tabs.subscription,
      key: "subscription",
      hash: "subscription",
      icon: <LuSubscript className="h-4 w-4" aria-hidden />,
    },
    { label: copy.tabs.security, key: "security", hash: "security", icon: <LuSettings className="h-4 w-4" aria-hidden /> },
  ];

  const [activeTab, setActiveTab] = useState<ProfileTabKey>("basic");

  return (
    <section className="w-full">
      <div className="py-1">
        <PageTitle
          title={copy.title}
          icon={<LuUserRound className="h-5 w-5" />}
          breadcrumb={[
            { label: copy.breadcrumbDashboard, href: "/dashboard" },
            { label: copy.breadcrumbCurrent },
          ]}
        />

        <Tabs
          items={tabs}
          value={activeTab}
          onChange={setActiveTab}
          variant="border"
          className="overflow-x-auto whitespace-nowrap"
          tabClassName="shrink-0"
          syncWithHash
        />

        <section className={TAB_CONTENT_FRAME_CLASS}>
          <div className={`${TAB_CONTENT_INNER_CLASS} p-4`}>
            {activeTab === "basic" && <BasicForm />}
            {activeTab === "api" && <ExchangeConnectionsView />}
            {activeTab === "subscription" && <Subscription />}
            {activeTab === "security" && <Security />}
          </div>
        </section>
      </div>
    </section>
  );
}

