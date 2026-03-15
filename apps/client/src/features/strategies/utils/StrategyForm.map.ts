import {
  AdditionalState,
  CloseConditions,
  OpenConditions,
  StrategyDto,
  StrategyFormState,
} from "../types/StrategyForm.type";

type StrategyDtoLike = StrategyDto & {
  config?: {
    open?: OpenConditions;
    close?: CloseConditions;
    additional?: AdditionalState;
  };
};

const defaultAdditional: AdditionalState = {
  dcaEnabled: false,
  dcaMode: "basic",
  dcaTimes: 0,
  dcaMultiplier: 1,
  dcaLevels: [],
  maxPositions: 1,
  maxOrders: 1,
  positionLifetime: 1,
  positionUnit: "h",
  orderLifetime: 1,
  orderUnit: "h",
};

// backend DTO -> form state
export const dtoToForm = (s: StrategyDtoLike): StrategyFormState => ({
  name: s.name,
  description: s.description ?? "",
  interval: s.interval,
  leverage: s.leverage,
  walletRisk: s.walletRisk ?? 1,
  openConditions: s.config?.open ?? { direction: "both", indicatorsLong: [], indicatorsShort: [] },
  closeConditions: s.config?.close ?? { mode: "basic", tp: 3, sl: 2, ttp: [], tsl: [] },
  additional: s.config?.additional ?? defaultAdditional,
});

// form -> PATCH/POST payload
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
