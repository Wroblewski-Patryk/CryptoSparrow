import { SimulatorInput, SimulatorInputSchema, SimulatorResult } from './simulator.types';

const round = (value: number) => Math.round(value * 100_000) / 100_000;

const applySlippage = (price: number, slippageRate: number, side: 'LONG' | 'SHORT', isEntry: boolean) => {
  if (slippageRate === 0) return price;

  // Long: worse entry is higher, worse exit is lower. Short: opposite.
  if (side === 'LONG') {
    return isEntry ? price * (1 + slippageRate) : price * (1 - slippageRate);
  }
  return isEntry ? price * (1 - slippageRate) : price * (1 + slippageRate);
};

export const simulateTrade = (input: SimulatorInput): SimulatorResult => {
  const parsed = SimulatorInputSchema.parse(input);

  const effectiveEntry = applySlippage(parsed.entryPrice, parsed.slippageRate, parsed.side, true);
  const effectiveExit = applySlippage(parsed.exitPrice, parsed.slippageRate, parsed.side, false);

  const grossPnl =
    parsed.side === 'LONG'
      ? (effectiveExit - effectiveEntry) * parsed.quantity
      : (effectiveEntry - effectiveExit) * parsed.quantity;

  const notionalEntry = effectiveEntry * parsed.quantity;
  const notionalExit = effectiveExit * parsed.quantity;
  const fees = (notionalEntry + notionalExit) * parsed.feeRate;
  const fundingCost = notionalEntry * parsed.fundingRate;
  const slippageCost =
    Math.abs(parsed.entryPrice - effectiveEntry) * parsed.quantity +
    Math.abs(parsed.exitPrice - effectiveExit) * parsed.quantity;

  const netPnl = grossPnl - fees - fundingCost;

  return {
    grossPnl: round(grossPnl),
    fees: round(fees),
    slippageCost: round(slippageCost),
    fundingCost: round(fundingCost),
    netPnl: round(netPnl),
  };
};
