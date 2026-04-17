import { describe, expect, it, vi } from 'vitest';
import { createBacktestRunJob } from './backtestRunJob';

describe('createBacktestRunJob', () => {
  it('persists trades and report metrics for processed symbols', async () => {
    const safeUpdateRun = vi.fn(async () => true);
    const createBacktestTrades = vi.fn(async () => undefined);
    const upsertBacktestReportForRun = vi.fn(async () => undefined);

    const runJob = createBacktestRunJob({
      findBacktestRunById: vi.fn(async () => ({
        id: 'run-1',
        userId: 'user-1',
        symbol: 'BTCUSDT',
        timeframe: '1m',
        strategyId: null,
        seedConfig: {
          symbols: ['BTCUSDT'],
          marketType: 'FUTURES',
          leverage: 3,
          marginMode: 'CROSSED',
          initialBalance: 10_000,
          maxCandles: 300,
        },
      })),
      safeUpdateRun,
      uniqueSorted: (values) => [...new Set(values)].sort(),
      computeAdaptiveMaxCandles: () => 300,
      resolveIndicatorWarmupCandles: () => 0,
      normalizeWalletRiskPercent: () => 1,
      parseStrategySignalRules: () => null,
      findOwnedStrategySignalConfig: vi.fn(async () => null),
      fetchKlines: vi.fn(async () => [
        {
          openTime: 0,
          closeTime: 59_000,
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: 1_000,
        },
        {
          openTime: 60_000,
          closeTime: 119_000,
          open: 101,
          high: 102,
          low: 100,
          close: 101,
          volume: 1_100,
        },
      ]),
      fetchSupplementalSeries: vi.fn(async () => ({
        fundingRates: [],
        openInterest: [],
        orderBook: [],
      })),
      simulateInterleavedPortfolio: vi.fn(
        () =>
          ({
            perSymbol: {
              BTCUSDT: {
                trades: [
                  {
                    symbol: 'BTCUSDT',
                    side: 'LONG',
                    entryPrice: 100,
                    exitPrice: 110,
                    quantity: 1,
                    openedAt: new Date('2026-01-01T00:00:00.000Z'),
                    closedAt: new Date('2026-01-01T00:01:00.000Z'),
                    pnl: 10,
                    fee: 0.5,
                    exitReason: 'SIGNAL_EXIT',
                    liquidated: false,
                  },
                ],
                liquidations: 0,
                eventCounts: {
                  ENTRY: 1,
                  EXIT: 1,
                  DCA: 0,
                  TP: 0,
                  TTP: 0,
                  SL: 0,
                  TRAILING: 0,
                  LIQUIDATION: 0,
                },
                decisionTrace: [],
              },
            },
            finalBalance: 10_010,
          }) as any,
      ),
      createBacktestTrades,
      countWinningBacktestTrades: vi.fn(async () => 1),
      countLosingBacktestTrades: vi.fn(async () => 0),
      upsertBacktestReportForRun,
      computeSourceWindowMs: () => 14 * 24 * 60 * 60 * 1000,
      maxDrawdownFromPnlSeries: () => 0,
    });

    await runJob('run-1');

    expect(createBacktestTrades).toHaveBeenCalledTimes(1);
    expect(upsertBacktestReportForRun).toHaveBeenCalledTimes(1);
    const reportCalls = (upsertBacktestReportForRun as any).mock.calls as any[];
    const reportPayload = reportCalls[0]?.[0] as any;
    expect(reportPayload).toBeDefined();
    expect(reportPayload.create.totalTrades).toBe(1);
    expect(reportPayload.create.netPnl).toBe(10);
    expect(reportPayload.create.winningTrades).toBe(1);

    const updateCalls = (safeUpdateRun as any).mock.calls as any[];
    const lastRunUpdate = updateCalls[updateCalls.length - 1]?.[1] as { status: string } | undefined;
    expect(lastRunUpdate).toBeDefined();
    expect(lastRunUpdate?.status).toBe('COMPLETED');
  });

  it('reuses persisted effectiveMaxCandles without applying adaptive reduction twice', async () => {
    const safeUpdateRun = vi.fn(async () => true);
    const fetchKlines = vi.fn(async () => [
      {
        openTime: 0,
        closeTime: 59_000,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1_000,
      },
      {
        openTime: 60_000,
        closeTime: 119_000,
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1_200,
      },
    ]);
    const computeAdaptiveMaxCandles = vi.fn(() => 120);

    const runJob = createBacktestRunJob({
      findBacktestRunById: vi.fn(async () => ({
        id: 'run-2',
        userId: 'user-1',
        symbol: 'BTCUSDT',
        timeframe: '1m',
        strategyId: null,
        seedConfig: {
          symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
          marketType: 'FUTURES',
          leverage: 2,
          marginMode: 'CROSSED',
          initialBalance: 10_000,
          requestedMaxCandles: 600,
          effectiveMaxCandles: 400,
          maxCandles: 400,
        },
      })),
      safeUpdateRun,
      uniqueSorted: (values) => [...new Set(values)].sort(),
      computeAdaptiveMaxCandles,
      resolveIndicatorWarmupCandles: () => 0,
      normalizeWalletRiskPercent: () => 1,
      parseStrategySignalRules: () => null,
      findOwnedStrategySignalConfig: vi.fn(async () => null),
      fetchKlines,
      fetchSupplementalSeries: vi.fn(async () => ({
        fundingRates: [],
        openInterest: [],
        orderBook: [],
      })),
      simulateInterleavedPortfolio: vi.fn(
        () =>
          ({
            perSymbol: {},
            finalBalance: 10_000,
          }) as any,
      ),
      createBacktestTrades: vi.fn(async () => undefined),
      countWinningBacktestTrades: vi.fn(async () => 0),
      countLosingBacktestTrades: vi.fn(async () => 0),
      upsertBacktestReportForRun: vi.fn(async () => undefined),
      computeSourceWindowMs: () => 14 * 24 * 60 * 60 * 1000,
      maxDrawdownFromPnlSeries: () => 0,
    });

    await runJob('run-2');

    expect(fetchKlines).toHaveBeenCalled();
    const fetchCalls = (fetchKlines as any).mock.calls as Array<any[]>;
    expect(fetchCalls[0]?.[3]).toBe(400);
    expect(computeAdaptiveMaxCandles).not.toHaveBeenCalled();
  });
});
