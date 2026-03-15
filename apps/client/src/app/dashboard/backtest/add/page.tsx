'use client';

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import { BacktestsList } from "apps/client/src/features/backtest/components/BacktestsList";

export default function BacktestPage() {
    return (
        <section>
                <PageTitle
                    title="Nowy backtest"
                    breadcrumb={[
                        { label: "Dashboard", href: "/dashboard" },
                        { label: "Backtest", href: "/dashboard/backtest" },
                        { label: "Nowy backtest" }

                    ]}
                />
                <BacktestsList />
        </section>
    );
}  
