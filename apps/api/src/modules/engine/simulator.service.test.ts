import { describe, expect, it } from 'vitest';
import { simulateTrade } from './simulator.service';

describe('simulator', () => {
  it('is deterministic for the same input across repeated runs', () => {
    const input = {
      side: 'LONG' as const,
      entryPrice: 123.45,
      exitPrice: 137.89,
      quantity: 0.75,
      feeRate: 0.0008,
      slippageRate: 0.0012,
      fundingRate: 0.0003,
    };

    const first = simulateTrade(input);
    for (let i = 0; i < 10; i += 1) {
      expect(simulateTrade(input)).toEqual(first);
    }
  });

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

  it('keeps accounting identity netPnl = grossPnl - fees - fundingCost', () => {
    const result = simulateTrade({
      side: 'LONG',
      entryPrice: 250,
      exitPrice: 240,
      quantity: 1.5,
      feeRate: 0.001,
      slippageRate: 0.002,
      fundingRate: 0.0007,
    });

    expect(result.netPnl).toBeCloseTo(result.grossPnl - result.fees - result.fundingCost, 4);
  });

  it('calculates slippageCost from entry and exit absolute drift', () => {
    const result = simulateTrade({
      side: 'SHORT',
      entryPrice: 500,
      exitPrice: 450,
      quantity: 2,
      slippageRate: 0.0025,
      feeRate: 0,
      fundingRate: 0,
    });

    // Entry drift: 500 * 0.0025 * 2 = 2.5, exit drift: 450 * 0.0025 * 2 = 2.25
    expect(result.slippageCost).toBeCloseTo(4.75, 5);
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
