'use client';
import { useRouter } from "next/navigation";

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import { BacktestsList } from "apps/client/src/features/backtest/components/BacktestsList";

export default function BacktestPage() {
    const router = useRouter();

    return (
        <section>
                <PageTitle
                    title="Backtesty"
                    breadcrumb={[
                        { label: "Dashboard", href: "/dashboard" },
                        { label: "Backtesty" }
                    ]}
                    onAdd={() => router.push("/dashboard/backtest/add")}
                    addLabel="Nowy backtest"
                />

                <BacktestsList />
        </section>
    );
}  
