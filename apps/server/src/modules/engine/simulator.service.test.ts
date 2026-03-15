import { describe, expect, it } from 'vitest';
import { simulateTrade } from './simulator.service';

describe('simulator', () => {
  it('calculates deterministic net PnL for LONG with fee/slippage/funding', () => {
    const result = simulateTrade({
      side: 'LONG',
      entryPrice: 100,
      exitPrice: 110,
      quantity: 2,
      feeRate: 0.001,
      slippageRate: 0.001,
      fundingRate: 0.0005,
    });

    expect(result.grossPnl).toBeCloseTo(19.58, 4);
    expect(result.fees).toBeCloseTo(0.41998, 4);
    expect(result.fundingCost).toBeCloseTo(0.1001, 4);
    expect(result.netPnl).toBeCloseTo(19.05992, 4);
  });

  it('calculates deterministic net PnL for SHORT', () => {
    const result = simulateTrade({
      side: 'SHORT',
      entryPrice: 100,
      exitPrice: 90,
      quantity: 3,
      feeRate: 0.001,
      slippageRate: 0.001,
      fundingRate: 0,
    });

    expect(result.grossPnl).toBeCloseTo(29.43, 4);
    expect(result.fees).toBeCloseTo(0.56997, 4);
    expect(result.netPnl).toBeCloseTo(28.86003, 4);
  });

  it('returns zero fees/slippage/funding when rates are zero', () => {
    const result = simulateTrade({
      side: 'LONG',
      entryPrice: 200,
      exitPrice: 210,
      quantity: 1,
    });

    expect(result.grossPnl).toBe(10);
    expect(result.fees).toBe(0);
    expect(result.slippageCost).toBe(0);
    expect(result.fundingCost).toBe(0);
    expect(result.netPnl).toBe(10);
  });
});
