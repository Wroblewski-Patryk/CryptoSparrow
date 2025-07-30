'use client';
import { useState } from "react";

import ProfileForm from "../components/BasicForm";
import ApiKeysList from "../components/ApiKeysList";
import Subscription from "../components/Subscription";
import Security from "../components/Security";

const tabs = [
    { label: "Profil użytkownika", key: "profile" },
    { label: "Klucze API do giełd", key: "api" },
    { label: "Subskrypcja", key: "sub" },
    { label: "Bezpieczeństwo", key: "security" },
];

export default function ProfilePage() {
    const [activeTab, setActiveTab] = useState("profile");

    return (
        <section className="w-full">  
            <div className="max-w-7xl mx-auto px-4 py-4">
                <div role="tablist" className="tabs tabs-border mb-4">
                    {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        role="tab"
                        className={`tab tab-bordered ${activeTab === tab.key ? "tab-active" : ""}`}
                        onClick={() => setActiveTab(tab.key)}
                        type="button"
                        >
                        {tab.label}
                    </button>
                    ))}
                </div>

                <div className="bg-base-200 rounded-xl shadow p-4">
                    {activeTab === "profile" && <ProfileForm />}
                    {activeTab === "api" && <ApiKeysList />}
                    {activeTab === "sub" && <Subscription />}
                    {activeTab === "security" && <Security />}
                </div>
            </div>
        </section>
    );
}
    