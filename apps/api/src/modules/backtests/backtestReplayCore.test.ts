import { describe, expect, it } from 'vitest';
import { simulateTradesForSymbolReplay } from './backtestReplayCore';

const candle = (index: number, close: number) => ({
  openTime: 1_700_000_000_000 + index * 60_000,
  closeTime: 1_700_000_030_000 + index * 60_000,
  open: close,
  high: close * 1.001,
  low: close * 0.999,
  close,
  volume: 1000,
});

describe('simulateTradesForSymbolReplay', () => {
  it('opens/closes using shared decision thresholds and no-flip behavior', () => {
    const candles = [
      candle(0, 100),
      candle(1, 102), // LONG
      candle(2, 101.9), // EXIT
      candle(3, 99), // SHORT
      candle(4, 99.05), // EXIT
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
    });

    expect(result.trades.length).toBeGreaterThanOrEqual(2);
    expect(result.trades[0].side).toBe('LONG');
    expect(result.trades[0].entryPrice).toBe(102);
    expect(result.trades[1].side).toBe('SHORT');
    expect(result.liquidations).toBe(0);
  });

  it('counts isolated liquidation when adverse move exceeds leverage threshold', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.2), // LONG open
      candle(2, 80), // forced EXIT + liquidation region for lev=5
      candle(3, 80),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 5,
      marginMode: 'ISOLATED',
    });

    expect(result.liquidations).toBeGreaterThanOrEqual(1);
  });
});
