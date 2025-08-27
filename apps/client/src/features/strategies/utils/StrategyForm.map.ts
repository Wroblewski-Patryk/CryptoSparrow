import { StrategyFormState } from "../types/StrategyForm.type";

// z backendu (Strategy DTO) -> StrategyFormState
export const dtoToForm = (s: any): StrategyFormState => ({
    name: s.name,
    description: s.description ?? "",
    interval: s.interval,
    leverage: s.leverage,
    walletRisk: s.walletRisk,
    openConditions: s.config?.open ?? { direction: "both", indicatorsLong: [], indicatorsShort: [] },
    closeConditions: s.config?.close ?? { mode: "basic", tp: 3, sl: 2, ttp: [], tsl: [] },
    additional: s.config?.additional ?? {/* domyślne jak w hooku */ },
});

// form -> payload do PATCH/POST
export const formToPayload = (f: StrategyFormState) => ({
    name: f.name,
    description: f.description,
    interval: f.interval,
    leverage: f.leverage,
    walletRisk: f.walletRisk,
    config: {
        open: f.openConditions,
        close: f.closeConditions,
        additional: f.additional,
    },
});
