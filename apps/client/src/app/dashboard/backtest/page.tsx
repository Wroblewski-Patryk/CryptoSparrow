'use client';
import { useRouter } from "next/navigation";

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import { BacktestsList } from "apps/client/src/features/backtest/components/BacktestsList";

export default function BacktestPage() {
    const router = useRouter();

    return (
        <section className="bg-base-100 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <PageTitle
                    title="Strategie"
                    breadcrumb={[
                        { label: "Dashboard", href: "/dashboard" },
                        { label: "Backtest", href: "/dashboard/backtest" }
                    ]}
                    onAdd={() => router.push("/dashboard/backtest/add")}
                    addLabel="Nowy backtest"
                />

                <div> SOME CONTENT HERE</div>
                <BacktestsList />

            </div>
        </section>
    );
}  