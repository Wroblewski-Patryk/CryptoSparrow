import { describe, expect, it } from 'vitest';
import {
  resolvePaperRuntimeCapitalSnapshot,
  resolveRuntimeDcaFundsExhausted,
  resolveRuntimeReferenceBalance,
} from './runtimeCapitalContext.service';

describe('runtimeCapitalContext', () => {
  const buildDeps = (overrides?: Partial<any>) => ({
    getBotPaperStartBalance: async ({ fallback }: { fallback: number }) => fallback,
    listOpenBotManagedPositions: async () => [],
    sumClosedBotManagedRealizedPnl: async () => 0,
    getLatestBinanceApiKey: async () => null,
    fetchLiveUsdtBalance: async () => null,
    ...overrides,
  });

  it('computes paper reference/free cash from start balance, realized pnl and reserved margin', async () => {
    const snapshot = await resolvePaperRuntimeCapitalSnapshot(
      {
        userId: 'u1',
        botId: 'b1',
        paperStartBalance: 10_000,
      },
      buildDeps({
        sumClosedBotManagedRealizedPnl: async () => 500,
        listOpenBotManagedPositions: async () => [
          { entryPrice: 100, quantity: 10, leverage: 2 }, // 500 margin
          { entryPrice: 200, quantity: 10, leverage: 2 }, // 1000 margin
        ],
      }),
    );

    expect(snapshot.referenceBalance).toBe(10_500);
    expect(snapshot.reservedMargin).toBe(1_500);
    expect(snapshot.freeCash).toBe(9_000);
  });

  it('uses dynamic paper reference balance in runtime resolver', async () => {
    const reference = await resolveRuntimeReferenceBalance(
      {
        userId: 'u2',
        botId: 'b2',
        mode: 'PAPER',
        marketType: 'FUTURES',
        paperStartBalance: 2_000,
        nowMs: 1_000,
      },
      buildDeps({
        sumClosedBotManagedRealizedPnl: async () => -250,
      }),
    );

    expect(reference).toBe(1_750);
  });

  it('marks DCA as unaffordable when required margin is above free paper cash', async () => {
    const exhausted = await resolveRuntimeDcaFundsExhausted(
      {
        userId: 'u3',
        botId: 'b3',
        mode: 'PAPER',
        marketType: 'FUTURES',
        paperStartBalance: 1_000,
        markPrice: 100,
        addedQuantity: 5,
        leverage: 1,
        nowMs: 2_000,
      },
      buildDeps({
        listOpenBotManagedPositions: async () => [
          { entryPrice: 200, quantity: 2, leverage: 1 }, // reserved 400 => free 600
        ],
      }),
    );

    // required margin = 500, free cash = 600 => still affordable
    expect(exhausted).toBe(false);

    const exhaustedHigh = await resolveRuntimeDcaFundsExhausted(
      {
        userId: 'u3',
        botId: 'b3',
        mode: 'PAPER',
        marketType: 'FUTURES',
        paperStartBalance: 1_000,
        markPrice: 100,
        addedQuantity: 7,
        leverage: 1,
        nowMs: 2_000,
      },
      buildDeps({
        listOpenBotManagedPositions: async () => [
          { entryPrice: 200, quantity: 2, leverage: 1 }, // reserved 400 => free 600
        ],
      }),
    );

    // required margin = 700, free cash = 600
    expect(exhaustedHigh).toBe(true);
  });
});

