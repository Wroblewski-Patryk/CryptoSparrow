'use client';

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import { BacktestForm } from "apps/client/src/features/backtest/components/BacktestForm";

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
                <BacktestForm />
        </section>
    );
}  
