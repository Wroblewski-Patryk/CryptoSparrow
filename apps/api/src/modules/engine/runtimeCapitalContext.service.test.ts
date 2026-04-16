import { describe, expect, it } from 'vitest';
import {
  resolvePaperRuntimeCapitalSnapshot,
  resolveRuntimeDcaFundsExhausted,
  resolveRuntimeReferenceBalance,
} from './runtimeCapitalContext.service';

describe('runtimeCapitalContext', () => {
  const buildDeps = (overrides?: Partial<any>) => ({
    getWalletContext: async () => null,
    getBotPaperStartBalance: async ({ fallback }: { fallback: number }) => fallback,
    listOpenBotManagedPositions: async () => [],
    sumClosedBotManagedRealizedPnl: async () => 0,
    getLiveApiKeyContext: async () => null,
    fetchLiveBalance: async () => null,
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
        exchange: 'BINANCE',
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

  it('uses wallet paper balance as source of truth when walletId is provided', async () => {
    const snapshot = await resolvePaperRuntimeCapitalSnapshot(
      {
        userId: 'u-wallet-paper',
        botId: 'b-wallet-paper',
        walletId: 'wallet-paper',
        paperStartBalance: 50_000,
      },
      buildDeps({
        getWalletContext: async () => ({
          id: 'wallet-paper',
          mode: 'PAPER',
          paperInitialBalance: 4_000,
          liveAllocationMode: null,
          liveAllocationValue: null,
          baseCurrency: 'USDT',
          exchange: 'BINANCE',
          apiKey: null,
        }),
        getBotPaperStartBalance: async () => {
          throw new Error('wallet-scoped paper path should not read bot paper balance');
        },
        sumClosedBotManagedRealizedPnl: async () => 250,
      }),
    );

    expect(snapshot.referenceBalance).toBe(4_250);
  });

  it('applies wallet LIVE allocation rules to runtime reference balance', async () => {
    const reference = await resolveRuntimeReferenceBalance(
      {
        userId: 'u-wallet-live',
        botId: 'b-wallet-live',
        walletId: 'wallet-live',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        paperStartBalance: 0,
        nowMs: 5_000,
      },
      buildDeps({
        getWalletContext: async () => ({
          id: 'wallet-live',
          mode: 'LIVE',
          paperInitialBalance: 0,
          liveAllocationMode: 'PERCENT',
          liveAllocationValue: 25,
          baseCurrency: 'USDT',
          exchange: 'BINANCE',
          apiKey: null,
        }),
        getLiveApiKeyContext: async () => ({ apiKey: 'k', apiSecret: 's' }),
        fetchLiveBalance: async () => 4_000,
      }),
    );

    expect(reference).toBe(1_000);
  });

  it('fails closed for wallet-scoped LIVE balance when wallet context is unavailable', async () => {
    const reference = await resolveRuntimeReferenceBalance(
      {
        userId: 'u-wallet-live-missing',
        botId: 'b-wallet-live-missing',
        walletId: 'wallet-missing',
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        paperStartBalance: 0,
        nowMs: 6_000,
      },
      buildDeps({
        getWalletContext: async () => null,
        getLiveApiKeyContext: async () => null,
      }),
    );

    expect(reference).toBe(0);
  });

  it('marks DCA as unaffordable when required margin is above free paper cash', async () => {
    const exhausted = await resolveRuntimeDcaFundsExhausted(
      {
        userId: 'u3',
        botId: 'b3',
        mode: 'PAPER',
        exchange: 'BINANCE',
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
        exchange: 'BINANCE',
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
