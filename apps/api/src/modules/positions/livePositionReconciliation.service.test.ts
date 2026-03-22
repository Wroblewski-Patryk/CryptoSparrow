import { afterEach, describe, expect, it, vi } from 'vitest';
import { LivePositionReconciliationLoop } from './livePositionReconciliation.service';

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
