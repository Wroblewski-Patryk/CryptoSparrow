'use client';
import { useEffect, useState } from "react";

import BasicForm from "../components/BasicForm";
import ApiKeysList from "../components/ApiKeysList";
import Subscription from "../components/Subscription";
import Security from "../components/Security";

const tabs = [
    { label: "Profil użytkownika", key: "basic" },
    { label: "Klucze API do giełd", key: "api" },
    { label: "Subskrypcja", key: "subscription" },
    { label: "Bezpieczeństwo", key: "security" },
];

export default function ProfilePage() {
    const [activeTab, setActiveTab] = useState("basic");
    useEffect(() => {
        if (window.location.hash) {
            const hash = window.location.hash.replace("#", "");
            if (tabs.some(tab => tab.key === hash)) setActiveTab(hash);
        }

        const onHashChange = () => {
            const hash = window.location.hash.replace("#", "");
            if (tabs.some(tab => tab.key === hash)) setActiveTab(hash);
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
            <div className="max-w-7xl mx-auto px-4 py-4">
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
                    {activeTab === "api" && <ApiKeysList />}
                    {activeTab === "subscription" && <Subscription />}
                    {activeTab === "security" && <Security />}
                </div>
            </div>
        </section>
    );
}
    