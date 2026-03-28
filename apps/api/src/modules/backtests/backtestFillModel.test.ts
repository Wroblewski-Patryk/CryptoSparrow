import { describe, expect, it } from 'vitest';
import { createHistoricalBacktestFillModel } from './backtestFillModel';

describe('createHistoricalBacktestFillModel', () => {
  it('applies directional slippage for long and short entry/exit', () => {
    const model = createHistoricalBacktestFillModel({ slippageRate: 0.01, feeRate: 0.0004 });

    expect(model.entryPrice(100, 'LONG')).toBeCloseTo(101);
    expect(model.exitPrice(100, 'LONG')).toBeCloseTo(99);

    expect(model.entryPrice(100, 'SHORT')).toBeCloseTo(99);
    expect(model.exitPrice(100, 'SHORT')).toBeCloseTo(101);
  });

  it('calculates fee from traded notional without leverage multiplier', () => {
    const model = createHistoricalBacktestFillModel({ feeRate: 0.001, slippageRate: 0 });
    expect(model.fee(100, 110, 1, 5)).toBeCloseTo(0.21);
  });

  it('settles trade via shared simulator accounting (fees + funding)', () => {
    const model = createHistoricalBacktestFillModel({
      feeRate: 0.001,
      slippageRate: 0,
      fundingRate: 0.0005,
    });

    const result = model.settle({
      side: 'LONG',
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      leverage: 3,
    });

    expect(result.grossPnl).toBeCloseTo(10, 4);
    expect(result.fees).toBeCloseTo(0.21, 4);
    expect(result.fundingCost).toBeCloseTo(0.05, 4);
    expect(result.netPnl).toBeCloseTo(9.74, 4);
  });
});
