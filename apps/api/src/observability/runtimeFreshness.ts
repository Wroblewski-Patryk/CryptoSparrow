import { prisma } from '../prisma/client';
import { metricsStore } from './metrics';

type FreshnessStatus = 'PASS' | 'FAIL' | 'SKIP';

type FreshnessCheck = {
  status: FreshnessStatus;
  thresholdMs: number | null;
  ageMs: number | null;
  detail: string;
};

type RuntimeFreshnessSnapshot = {
  status: 'PASS' | 'FAIL';
  checkedAt: string;
  checks: {
    workerHeartbeat: FreshnessCheck;
    marketData: FreshnessCheck;
    runtimeSignalLag: FreshnessCheck;
    runtimeSessions: FreshnessCheck & {
      runningCount: number;
      staleSessionIds: string[];
    };
    latestSignal: FreshnessCheck & {
      required: boolean;
    };
  };
};

const parseEnvDate = (raw: string | undefined) => {
  const normalized = raw?.trim();
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const parsePositiveInt = (raw: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const computeTimeCheck = (input: {
  label: string;
  lastAtMs: number | null;
  nowMs: number;
  thresholdMs: number;
}): FreshnessCheck => {
  if (input.lastAtMs === null) {
    return {
      status: 'FAIL',
      thresholdMs: input.thresholdMs,
      ageMs: null,
      detail: `${input.label} timestamp missing`,
    };
  }

  const ageMs = Math.max(0, input.nowMs - input.lastAtMs);
  const status: FreshnessStatus = ageMs <= input.thresholdMs ? 'PASS' : 'FAIL';
  return {
    status,
    thresholdMs: input.thresholdMs,
    ageMs,
    detail:
      status === 'PASS'
        ? `${input.label} freshness within threshold`
        : `${input.label} stale by ${ageMs - input.thresholdMs}ms`,
  };
};

export const buildRuntimeFreshnessSnapshot = async (
  nowMs = Date.now()
): Promise<RuntimeFreshnessSnapshot> => {
  const workerHeartbeatThresholdMs = parsePositiveInt(
    process.env.RUNTIME_FRESHNESS_MAX_WORKER_HEARTBEAT_MS,
    60_000
  );
  const marketDataThresholdMs = parsePositiveInt(
    process.env.RUNTIME_FRESHNESS_MAX_MARKET_DATA_STALE_MS,
    120_000
  );
  const signalLagThresholdMs = parsePositiveInt(
    process.env.RUNTIME_FRESHNESS_MAX_SIGNAL_LAG_MS,
    90_000
  );
  const sessionHeartbeatThresholdMs = parsePositiveInt(
    process.env.RUNTIME_FRESHNESS_MAX_SESSION_HEARTBEAT_MS,
    120_000
  );
  const latestSignalThresholdMs = parsePositiveInt(
    process.env.RUNTIME_FRESHNESS_MAX_SIGNAL_AGE_MS,
    300_000
  );

  const workerHeartbeatCheck = computeTimeCheck({
    label: 'worker heartbeat',
    lastAtMs: parseEnvDate(process.env.WORKER_LAST_HEARTBEAT_AT),
    nowMs,
    thresholdMs: workerHeartbeatThresholdMs,
  });

  const marketDataCheck = computeTimeCheck({
    label: 'market data',
    lastAtMs: parseEnvDate(process.env.WORKER_LAST_MARKET_DATA_AT),
    nowMs,
    thresholdMs: marketDataThresholdMs,
  });

  const runtimeSignalLagMs = Math.max(0, metricsStore.snapshot().runtime.signalLag.lastMs);
  const runtimeSignalLagCheck: FreshnessCheck = {
    status: runtimeSignalLagMs <= signalLagThresholdMs ? 'PASS' : 'FAIL',
    thresholdMs: signalLagThresholdMs,
    ageMs: runtimeSignalLagMs,
    detail:
      runtimeSignalLagMs <= signalLagThresholdMs
        ? 'runtime signal lag within threshold'
        : 'runtime signal lag exceeded threshold',
  };

  const runningSessions = await prisma.botRuntimeSession.findMany({
    where: {
      status: 'RUNNING',
    },
    select: {
      id: true,
      lastHeartbeatAt: true,
    },
  });

  const staleSessionIds = runningSessions
    .filter((session) => {
      if (!session.lastHeartbeatAt) return true;
      return nowMs - session.lastHeartbeatAt.getTime() > sessionHeartbeatThresholdMs;
    })
    .map((session) => session.id);

  const runtimeSessionsCheck: RuntimeFreshnessSnapshot['checks']['runtimeSessions'] = {
    status: staleSessionIds.length === 0 ? 'PASS' : 'FAIL',
    thresholdMs: sessionHeartbeatThresholdMs,
    ageMs: null,
    runningCount: runningSessions.length,
    staleSessionIds,
    detail:
      staleSessionIds.length === 0
        ? 'runtime sessions heartbeat healthy'
        : `${staleSessionIds.length} running session(s) stale`,
  };

  const latestSignal = await prisma.signal.findFirst({
    select: {
      triggeredAt: true,
    },
    orderBy: {
      triggeredAt: 'desc',
    },
  });

  const requireSignalFreshness = runningSessions.length > 0;
  const latestSignalAgeMs = latestSignal ? Math.max(0, nowMs - latestSignal.triggeredAt.getTime()) : null;
  const latestSignalCheck: RuntimeFreshnessSnapshot['checks']['latestSignal'] = (() => {
    if (!requireSignalFreshness) {
      return {
        status: 'SKIP',
        thresholdMs: latestSignalThresholdMs,
        ageMs: latestSignalAgeMs,
        required: false,
        detail: 'no running sessions; latest signal freshness not required',
      };
    }
    if (latestSignalAgeMs === null) {
      return {
        status: 'FAIL',
        thresholdMs: latestSignalThresholdMs,
        ageMs: null,
        required: true,
        detail: 'latest signal missing for active runtime sessions',
      };
    }
    return {
      status: latestSignalAgeMs <= latestSignalThresholdMs ? 'PASS' : 'FAIL',
      thresholdMs: latestSignalThresholdMs,
      ageMs: latestSignalAgeMs,
      required: true,
      detail:
        latestSignalAgeMs <= latestSignalThresholdMs
          ? 'latest signal freshness within threshold'
          : 'latest signal is stale for active runtime sessions',
    };
  })();

  const checks = {
    workerHeartbeat: workerHeartbeatCheck,
    marketData: marketDataCheck,
    runtimeSignalLag: runtimeSignalLagCheck,
    runtimeSessions: runtimeSessionsCheck,
    latestSignal: latestSignalCheck,
  };
  const statuses = [
    checks.workerHeartbeat.status,
    checks.marketData.status,
    checks.runtimeSignalLag.status,
    checks.runtimeSessions.status,
    checks.latestSignal.status,
  ];
  const status = statuses.includes('FAIL') ? 'FAIL' : 'PASS';

  return {
    status,
    checkedAt: new Date(nowMs).toISOString(),
    checks,
  };
};
