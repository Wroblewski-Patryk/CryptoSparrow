import { describe, expect, it } from 'vitest';
import { BacktestRunQueue } from './backtestRunQueue';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('BacktestRunQueue', () => {
  it('deduplicates queued run ids', async () => {
    const processed: string[] = [];
    const queue = new BacktestRunQueue(async (runId) => {
      processed.push(runId);
    });

    queue.enqueue('run-1');
    queue.enqueue('run-1');
    queue.enqueue('run-2');
    await wait(20);

    expect(processed).toEqual(['run-1', 'run-2']);
  });

  it('keeps execution order while worker is async', async () => {
    const processed: string[] = [];
    let releaseFirst: null | ((value?: void | PromiseLike<void>) => void) = null;

    const queue = new BacktestRunQueue(async (runId) => {
      processed.push(runId);
      if (runId === 'run-1') {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
    });

    queue.enqueue('run-1');
    queue.enqueue('run-2');
    await wait(20);
    expect(processed).toEqual(['run-1']);

    if (releaseFirst) {
      (releaseFirst as any)();
    }
    await wait(20);
    expect(processed).toEqual(['run-1', 'run-2']);
  });
});
