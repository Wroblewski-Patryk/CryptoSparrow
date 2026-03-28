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

  it('calculates fee using configured fee rate and leverage', () => {
    const model = createHistoricalBacktestFillModel({ feeRate: 0.001, slippageRate: 0 });
    expect(model.fee(100, 110, 1, 5)).toBeCloseTo(1.05);
  });
});
