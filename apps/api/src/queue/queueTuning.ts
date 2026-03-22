export type QueueProfile = 'market-data' | 'backtest' | 'execution';

export type QueueTuning = {
  concurrency: number;
  attempts: number;
  backoffMs: number;
  removeOnComplete: number;
  removeOnFail: number;
};

const queueProfiles: Record<QueueProfile, QueueTuning> = {
  'market-data': {
    concurrency: 4,
    attempts: 3,
    backoffMs: 500,
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
  backtest: {
    concurrency: 2,
    attempts: 2,
    backoffMs: 1000,
    removeOnComplete: 200,
    removeOnFail: 500,
  },
  execution: {
    concurrency: 1,
    attempts: 5,
    backoffMs: 300,
    removeOnComplete: 1000,
    removeOnFail: 2000,
  },
};

const envPrefixes: Record<QueueProfile, string> = {
  'market-data': 'WORKER_MARKET_DATA',
  backtest: 'WORKER_BACKTEST',
  execution: 'WORKER_EXECUTION',
};

const parsePositiveInteger = (rawValue: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

type QueueTuningEnv = Partial<Record<string, string | undefined>>;

const readOverridesFromEnv = (profile: QueueProfile, env: QueueTuningEnv): QueueTuning => {
  const base = queueProfiles[profile];
  const prefix = envPrefixes[profile];

  return {
    concurrency: parsePositiveInteger(env[`${prefix}_CONCURRENCY`], base.concurrency),
    attempts: parsePositiveInteger(env[`${prefix}_ATTEMPTS`], base.attempts),
    backoffMs: parsePositiveInteger(env[`${prefix}_BACKOFF_MS`], base.backoffMs),
    removeOnComplete: parsePositiveInteger(
      env[`${prefix}_REMOVE_ON_COMPLETE`],
      base.removeOnComplete
    ),
    removeOnFail: parsePositiveInteger(env[`${prefix}_REMOVE_ON_FAIL`], base.removeOnFail),
  };
};

export const getQueueTuning = (
  profile: QueueProfile,
  envOverrides?: QueueTuningEnv
): QueueTuning => {
  return readOverridesFromEnv(profile, envOverrides ?? process.env);
};
