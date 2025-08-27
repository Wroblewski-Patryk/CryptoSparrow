import { useState } from "react";
import { StrategyFormState, OpenConditions, CloseConditions, AdditionalState } from "../types/StrategyForm.type";

const defaultState: StrategyFormState = {
    name: "New strategy",
    description: "Some description as indicators or what do you want.",
    interval: "5m",
    leverage: 10,
    walletRisk: 1,
    openConditions: {
        direction: "both",
        indicatorsLong: [],
        indicatorsShort: [],
    },
    closeConditions: {
        mode: "basic",
        tp: 3,
        sl: 2,
        ttp: [{ percent: 5, arm: 2 }],
        tsl: [{ percent: -2, arm: 1 }],
    },
    additional: {
        dcaEnabled: true,
        dcaMode: "advanced",
        dcaTimes: 1,
        dcaMultiplier: 2,
        dcaLevels: [{ percent: -2, multiplier: 2 }],

        maxPositions: 1,
        maxOrders: 1,

        positionLifetime: 7,
        positionUnit: "d",
        orderLifetime: 10,
        orderUnit: "min",
    },
};

export function useStrategyForm(init?: Partial<StrategyFormState>) {
    const [form, setForm] = useState<StrategyFormState>({ ...defaultState, ...init });

    const setBasic = (updater: (prev: StrategyFormState) => StrategyFormState) =>
        setForm(prev => updater(prev));

    const setOpenConditions = (updater: (prev: OpenConditions) => OpenConditions) =>
        setForm(prev => ({
            ...prev,
            openConditions: updater(prev.openConditions),
        }));

    const setCloseConditions = (updater: (prev: CloseConditions) => CloseConditions) =>
        setForm(prev => ({
            ...prev,
            closeConditions: updater(prev.closeConditions),
        }));

    const setAdditional = (updater: (prev: AdditionalState) => AdditionalState) =>
        setForm(prev => ({
            ...prev,
            additional: updater(prev.additional)
        }));

    return {
        form,
        setForm,
        setBasic,
        setOpenConditions,
        setCloseConditions,
        setAdditional,
    };
}
