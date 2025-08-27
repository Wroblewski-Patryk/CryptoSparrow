import api from "apps/client/src/lib/api";
import { IndicatorMeta, StrategyDto, StrategyFormState } from "../types/StrategyForm.type";
import { formToPayload } from "../utils/StrategyForm.map";

export const listStrategies = async () => {
    const { data } = await api.get<StrategyDto[]>("/dashboard/strategies");
    return data;
}

export const getStrategy = async (id: string) => {
    const { data } = await api.get<StrategyDto>(`/dashboard/strategies/${id}`);
    return data;
};

export const createStrategy = async (form: StrategyFormState) => {
    const payload = formToPayload(form);
    const { data } = await api.post<StrategyDto>("/dashboard/strategies", payload);
    return data;
};

export const updateStrategy = async (id: string, form: StrategyFormState) => {
    const payload = formToPayload(form);
    const { data } = await api.put<StrategyDto>(`/dashboard/strategies/${id}`, payload);
    return data;
};

export const listStrategyIndicators = async () => {
    const { data } = await api.get<IndicatorMeta[]>("/dashboard/strategies/indicators");
    return data;
}