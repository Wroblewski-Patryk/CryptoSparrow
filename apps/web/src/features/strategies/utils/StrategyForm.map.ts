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

const normalizeInterval = (value?: string | null) => {
  if (!value) return "5m";
  const raw = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    "1 min": "1m",
    "3 min": "3m",
    "5 min": "5m",
    "10 min": "10m",
    "15 min": "15m",
    "30 min": "30m",
    "60 min": "1h",
  };
  return aliases[raw] ?? raw;
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
  marginMode: "CROSSED",
};

// backend DTO -> form state
export const dtoToForm = (s: StrategyDtoLike): StrategyFormState => ({
  name: s.name,
  description: s.description ?? "",
  interval: normalizeInterval(s.interval),
  leverage: s.leverage,
  walletRisk: s.walletRisk ?? 1,
  openConditions: s.config?.open ?? { direction: "both", indicatorsLong: [], indicatorsShort: [] },
  closeConditions: s.config?.close ?? { mode: "basic", tp: 3, sl: 2, ttp: [], tsl: [] },
  additional: { ...defaultAdditional, ...(s.config?.additional ?? {}) },
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
