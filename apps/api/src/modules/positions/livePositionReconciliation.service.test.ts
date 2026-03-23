import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LivePositionReconciliationLoop,
  reconcileExternalPositionsFromExchange,
} from './livePositionReconciliation.service';

afterEach(() => {
  vi.useRealTimers();
});

describe('LivePositionReconciliationLoop', () => {
  it('updates heartbeat status on run', async () => {
    const loop = new LivePositionReconciliationLoop(
      vi.fn().mockResolvedValue({ openPositionsSeen: 3 }),
      10_000
    );

    await loop.runOnce();

    const status = loop.getStatus();
    expect(status.iterations).toBe(1);
    expect(status.lastRunAt).toBeTruthy();
    expect(status.openPositionsSeen).toBe(3);
    expect(status.lastError).toBeNull();
  });

  it('runs periodically when started', async () => {
    vi.useFakeTimers();
    const reconcile = vi.fn().mockResolvedValue({ openPositionsSeen: 1 });
    const loop = new LivePositionReconciliationLoop(reconcile, 1_000);

    loop.start();
    await vi.advanceTimersByTimeAsync(3_100);
    loop.stop();

    expect(reconcile).toHaveBeenCalledTimes(4);
    expect(loop.getStatus().running).toBe(false);
  });
});

describe('reconcileExternalPositionsFromExchange', () => {
  it('creates/updates synced positions and closes stale ones', async () => {
    const createSyncedPosition = vi.fn(async () => undefined);
    const updateSyncedPosition = vi.fn(async () => undefined);
    const closeStaleSyncedPosition = vi.fn(async () => undefined);

    const result = await reconcileExternalPositionsFromExchange({
      listSyncedApiKeys: vi.fn(async () => [
        {
          id: 'key-1',
          userId: 'user-1',
          manageExternalPositions: true,
        },
      ]),
      fetchPositionsForApiKey: vi.fn(async () => ({
        positions: [
          {
            symbol: 'BTC/USDT:USDT',
            side: 'long',
            contracts: 0.01,
            entryPrice: 50000,
            markPrice: 50100,
            unrealizedPnl: 10,
            leverage: 5,
            timestamp: '2026-03-23T00:00:00.000Z',
          },
        ],
      })),
      findOpenSyncedPositionByExternalId: vi.fn(async ({ externalId }) =>
        externalId === 'key-1:BTCUSDT:LONG' ? { id: 'pos-open-1' } : null
      ),
      updateSyncedPosition,
      createSyncedPosition,
      listOpenSyncedPositionsForApiKey: vi.fn(async () => [
        { id: 'pos-open-1', externalId: 'key-1:BTCUSDT:LONG' },
        { id: 'pos-open-stale', externalId: 'key-1:ADAUSDT:LONG' },
      ]),
      closeStaleSyncedPosition,
      now: () => new Date('2026-03-23T00:00:01.000Z'),
    });

    expect(result.openPositionsSeen).toBe(1);
    expect(updateSyncedPosition).toHaveBeenCalledWith(
      'pos-open-1',
      expect.objectContaining({
        symbol: 'BTCUSDT',
        side: 'LONG',
        managementMode: 'BOT_MANAGED',
      })
    );
    expect(createSyncedPosition).not.toHaveBeenCalled();
    expect(closeStaleSyncedPosition).toHaveBeenCalledWith(
      'pos-open-stale',
      new Date('2026-03-23T00:00:01.000Z')
    );
  });

  it('creates MANUAL_MANAGED position when external management is disabled', async () => {
    const createSyncedPosition = vi.fn(async () => undefined);

    const result = await reconcileExternalPositionsFromExchange({
      listSyncedApiKeys: vi.fn(async () => [
        {
          id: 'key-2',
          userId: 'user-2',
          manageExternalPositions: false,
        },
      ]),
      fetchPositionsForApiKey: vi.fn(async () => ({
        positions: [
          {
            symbol: 'ETH/USDT:USDT',
            side: 'short',
            contracts: 0.2,
            entryPrice: 2000,
            markPrice: 2010,
            unrealizedPnl: -5,
            leverage: 3,
            timestamp: null,
          },
        ],
      })),
      findOpenSyncedPositionByExternalId: vi.fn(async () => null),
      updateSyncedPosition: vi.fn(async () => undefined),
      createSyncedPosition,
      listOpenSyncedPositionsForApiKey: vi.fn(async () => []),
      closeStaleSyncedPosition: vi.fn(async () => undefined),
      now: () => new Date('2026-03-23T00:10:00.000Z'),
    });

    expect(result.openPositionsSeen).toBe(1);
    expect(createSyncedPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        symbol: 'ETHUSDT',
        side: 'SHORT',
        managementMode: 'MANUAL_MANAGED',
      })
    );
  });
});
