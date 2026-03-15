import { DegradedState, EmptyState } from "apps/client/src/ui/components/ViewState";

export function BacktestsList() {

    return (
        <div className="space-y-3">
            <DegradedState
                title="Historia backtestow jest tymczasowo uproszczona"
                description="Widok listy zostanie podpiety pod backend i metryki raportow w kolejnym kroku."
            />
            <EmptyState
                title="Brak uruchomionych backtestow"
                description="Po uruchomieniu pierwszego testu jego historia pojawi sie tutaj."
            />
        </div>
    );
}
