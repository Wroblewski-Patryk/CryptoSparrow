'use client';
import { useEffect, useState } from "react";

import BasicForm from "../components/BasicForm";
import Subscription from "../components/Subscription";
import Security from "../components/Security";
import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import ExchangeConnectionsView from "../../exchanges/components/ExchangeConnectionsView";

const tabs = [
  { label: "Profil uzytkownika", key: "basic" },
  { label: "Integracje i API keys", key: "api" },
  { label: "Subskrypcja", key: "subscription" },
  { label: "Bezpieczenstwo", key: "security" },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("basic");

  useEffect(() => {
    if (window.location.hash) {
      const hash = window.location.hash.replace("#", "");
      if (tabs.some((tab) => tab.key === hash)) setActiveTab(hash);
    }

    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (tabs.some((tab) => tab.key === hash)) setActiveTab(hash);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (!activeTab) return null;

  const handleTab = (key: string) => {
    setActiveTab(key);
    window.location.hash = key;
  };

  return (
    <section className="w-full">
      <div className="py-1">
        <PageTitle
          title="Profil"
          breadcrumb={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Profil" },
          ]}
        />

        <div role="tablist" className="tabs tabs-border mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              className={`tab tab-bordered ${activeTab === tab.key ? "tab-active" : ""}`}
              onClick={() => handleTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-base-200 rounded-xl shadow p-4">
          {activeTab === "basic" && <BasicForm />}
          {activeTab === "api" && <ExchangeConnectionsView />}
          {activeTab === "subscription" && <Subscription />}
          {activeTab === "security" && <Security />}
        </div>
      </div>
    </section>
  );
}
