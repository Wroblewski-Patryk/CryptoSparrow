'use client';
import { useRouter } from "next/navigation";

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import { BacktestForm } from "apps/client/src/features/backtest/components/BacktestForm";

export default function BacktestPage() {
    const router = useRouter();

    return (
        <section className="bg-base-100 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <PageTitle
                    title="Strategie"
                    breadcrumb={[
                        { label: "Dashboard", href: "/dashboard" },
                        { label: "Backtest", href: "/dashboard/backtest" },
                        { label: "Nowy backtest", href: "/dashboard/backtest/add" }

                    ]}
                    onAdd={() => router.push("/dashboard/backtest/add")}
                    addLabel="Nowy backtest"
                />
                <BacktestForm />
            </div>
        </section>
    );
}  