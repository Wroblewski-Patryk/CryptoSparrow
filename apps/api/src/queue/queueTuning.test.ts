import { describe, expect, it } from 'vitest';
import { getQueueTuning } from './queueTuning';

describe('queue tuning', () => {
  it('returns default profile tuning when overrides are missing', () => {
    expect(getQueueTuning('market-data', {})).toEqual({
      concurrency: 4,
      attempts: 3,
      backoffMs: 500,
      removeOnComplete: 500,
      removeOnFail: 1000,
    });
  });

  it('applies per-profile env overrides', () => {
    const tuning = getQueueTuning('execution', {
      WORKER_EXECUTION_CONCURRENCY: '3',
      WORKER_EXECUTION_ATTEMPTS: '7',
      WORKER_EXECUTION_BACKOFF_MS: '450',
      WORKER_EXECUTION_REMOVE_ON_COMPLETE: '1200',
      WORKER_EXECUTION_REMOVE_ON_FAIL: '2300',
    });

    expect(tuning).toEqual({
      concurrency: 3,
      attempts: 7,
      backoffMs: 450,
      removeOnComplete: 1200,
      removeOnFail: 2300,
    });
  });

  it('falls back to defaults for invalid override values', () => {
    const tuning = getQueueTuning('backtest', {
      WORKER_BACKTEST_CONCURRENCY: '0',
      WORKER_BACKTEST_ATTEMPTS: '-1',
      WORKER_BACKTEST_BACKOFF_MS: 'abc',
      WORKER_BACKTEST_REMOVE_ON_COMPLETE: '',
      WORKER_BACKTEST_REMOVE_ON_FAIL: '500',
    });

    expect(tuning).toEqual({
      concurrency: 2,
      attempts: 2,
      backoffMs: 1000,
      removeOnComplete: 200,
      removeOnFail: 500,
    });
  });
});
