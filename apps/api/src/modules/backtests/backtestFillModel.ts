import { PositionSide } from '@prisma/client';

export type BacktestFillModel = {
  entryPrice: (price: number, side: PositionSide) => number;
  exitPrice: (price: number, side: PositionSide) => number;
  fee: (entry: number, exit: number, quantity: number, leverage: number) => number;
};

export type BacktestFillModelConfig = {
  feeRate?: number;
  slippageRate?: number;
};

const applySlippage = (price: number, slippageRate: number, side: PositionSide, isEntry: boolean) => {
  if (slippageRate <= 0) return price;

  if (side === 'LONG') {
    return isEntry ? price * (1 + slippageRate) : price * (1 - slippageRate);
  }
  return isEntry ? price * (1 - slippageRate) : price * (1 + slippageRate);
};

export const createHistoricalBacktestFillModel = (
  config?: BacktestFillModelConfig,
): BacktestFillModel => {
  const feeRate = typeof config?.feeRate === 'number' && Number.isFinite(config.feeRate) ? Math.max(0, config.feeRate) : 0.0004;
  const slippageRate =
    typeof config?.slippageRate === 'number' && Number.isFinite(config.slippageRate)
      ? Math.max(0, config.slippageRate)
      : 0;

  return {
    entryPrice: (price, side) => applySlippage(price, slippageRate, side, true),
    exitPrice: (price, side) => applySlippage(price, slippageRate, side, false),
    fee: (entry, exit, _quantity, leverage) => {
      // Keep V1 compatibility with previous backtest accounting semantics.
      return (entry + exit) * feeRate * Math.max(1, leverage);
    },
  };
};
