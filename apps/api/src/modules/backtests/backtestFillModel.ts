import { PositionSide } from '@prisma/client';
import { simulateTrade } from '../engine/simulator.service';
import { SimulatorResult } from '../engine/simulator.types';

export type BacktestFillModel = {
  entryPrice: (price: number, side: PositionSide) => number;
  exitPrice: (price: number, side: PositionSide) => number;
  fee: (entry: number, exit: number, quantity: number, leverage: number) => number;
  settle: (input: {
    side: PositionSide;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    leverage: number;
  }) => SimulatorResult;
};

export type BacktestFillModelConfig = {
  feeRate?: number;
  slippageRate?: number;
  fundingRate?: number;
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
  const fundingRate =
    typeof config?.fundingRate === 'number' && Number.isFinite(config.fundingRate)
      ? config.fundingRate
      : 0;

  return {
    entryPrice: (price, side) => applySlippage(price, slippageRate, side, true),
    exitPrice: (price, side) => applySlippage(price, slippageRate, side, false),
    fee: (entry, exit, _quantity, leverage) => {
      // Keep V1 compatibility with previous backtest accounting semantics.
      return (entry + exit) * feeRate * Math.max(1, leverage);
    },
    settle: ({ side, entryPrice, exitPrice, quantity, leverage }) =>
      simulateTrade({
        side,
        entryPrice,
        exitPrice,
        quantity: quantity * Math.max(1, leverage),
        feeRate,
        slippageRate: 0,
        fundingRate,
      }),
  };
};
