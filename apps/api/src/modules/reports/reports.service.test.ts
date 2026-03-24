import { describe, expect, it } from 'vitest';
import { aggregateModePerformance } from './reports.service';

describe('aggregateModePerformance', () => {
  it('aggregates backtest reports with weighted win rate', () => {
    const result = aggregateModePerformance('BACKTEST', {
      backtestReports: [
        {
          totalTrades: 10,
          winningTrades: 6,
          losingTrades: 4,
          netPnl: 120,
          grossProfit: 180,
          grossLoss: -60,
        },
        {
          totalTrades: 20,
          winningTrades: 8,
          losingTrades: 12,
          netPnl: -50,
          grossProfit: 90,
          grossLoss: -140,
        },
      ],
    });

    expect(result.totalTrades).toBe(30);
    expect(result.winningTrades).toBe(14);
    expect(result.losingTrades).toBe(16);
    expect(result.netPnl).toBe(70);
    expect(result.grossProfit).toBe(270);
    expect(result.grossLoss).toBe(200);
    expect(result.winRate).toBeCloseTo((14 / 30) * 100, 5);
  });

  it('aggregates paper/live trades from realized pnl values', () => {
    const result = aggregateModePerformance('PAPER', {
      trades: [{ realizedPnl: 10 }, { realizedPnl: -7 }, { realizedPnl: 0 }, { realizedPnl: null }],
    });

    expect(result.totalTrades).toBe(4);
    expect(result.winningTrades).toBe(1);
    expect(result.losingTrades).toBe(1);
    expect(result.netPnl).toBe(3);
    expect(result.grossProfit).toBe(10);
    expect(result.grossLoss).toBe(7);
    expect(result.winRate).toBe(25);
  });
});

