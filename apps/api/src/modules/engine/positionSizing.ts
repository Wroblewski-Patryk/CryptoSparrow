const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number, precision = 8) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export const normalizeWalletRiskPercent = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, 0.01, 100);
};

export const computeRiskBasedOrderQuantity = (input: {
  price: number;
  walletRiskPercent: number;
  referenceBalance: number;
  leverage: number;
  minQuantity?: number;
}) => {
  const price = Math.max(0, Number(input.price));
  const referenceBalance = Math.max(0, Number(input.referenceBalance));
  const leverage = Math.max(1, Number(input.leverage));
  const walletRiskPercent = normalizeWalletRiskPercent(input.walletRiskPercent);
  const minQuantity = Math.max(0.000001, Number(input.minQuantity ?? 0.000001));

  if (price <= 0 || referenceBalance <= 0) return minQuantity;

  const marginBudget = referenceBalance * (walletRiskPercent / 100);
  const notional = marginBudget * leverage;
  const quantity = notional / price;
  if (!Number.isFinite(quantity) || quantity <= 0) return minQuantity;
  return Math.max(minQuantity, round(quantity));
};

