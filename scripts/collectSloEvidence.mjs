#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TARGET_PROFILES = {
  MVP: {
    apiAvailabilityPct: 99.5,
    workerAvailabilityPct: 99.0,
    api5xxRatioPct: 1.0,
    apiAvgDurationMs: 400,
    queueLagExecutionThreshold: 20,
    queueLagExecutionCompliancePct: 99,
    liveOrderFailureRatioPct: 2.0,
  },
  V1: {
    apiAvailabilityPct: 99.9,
    workerAvailabilityPct: 99.5,
    api5xxRatioPct: 0.5,
    apiAvgDurationMs: 250,
    queueLagExecutionThreshold: 10,
    queueLagExecutionCompliancePct: 99,
    liveOrderFailureRatioPct: 1.0,
  },
};

const ALLOWED_ENVIRONMENTS = new Set(['local', 'stage', 'production']);

const parseOptionalNumber = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeEnvironment = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (ALLOWED_ENVIRONMENTS.has(normalized)) return normalized;
  return 'local';
};

const normalizeTargetProfile = (value) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized === 'MVP' || normalized === 'V1' ? normalized : 'V1';
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    baseUrl: process.env.SLO_BASE_URL ?? 'http://localhost:4001',
    durationMinutes: Number.parseInt(process.env.SLO_DURATION_MINUTES ?? '30', 10),
    intervalSeconds: Number.parseInt(process.env.SLO_INTERVAL_SECONDS ?? '30', 10),
    authToken: process.env.SLO_AUTH_TOKEN ?? '',
    environment: normalizeEnvironment(process.env.SLO_ENVIRONMENT ?? 'local'),
    targetProfile: normalizeTargetProfile(process.env.SLO_TARGET_PROFILE ?? 'V1'),
    apiAvailabilityPct: parseOptionalNumber(process.env.SLO_API_AVAILABILITY_PCT),
    workerAvailabilityPct: parseOptionalNumber(process.env.SLO_WORKER_AVAILABILITY_PCT),
    api5xxRatioPct: parseOptionalNumber(process.env.SLO_API_5XX_RATIO_PCT),
    apiAvgDurationMs: parseOptionalNumber(process.env.SLO_API_AVG_DURATION_MS),
    queueLagExecutionThreshold: parseOptionalNumber(process.env.SLO_QUEUE_LAG_EXEC_THRESHOLD),
    queueLagExecutionCompliancePct: parseOptionalNumber(process.env.SLO_QUEUE_LAG_EXEC_COMPLIANCE_PCT),
    liveOrderFailureRatioPct: parseOptionalNumber(process.env.SLO_LIVE_ORDER_FAILURE_RATIO_PCT),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--base-url') options.baseUrl = args[index + 1] ?? options.baseUrl;
    if (arg === '--duration-minutes') options.durationMinutes = Number.parseInt(args[index + 1] ?? '', 10);
    if (arg === '--interval-seconds') options.intervalSeconds = Number.parseInt(args[index + 1] ?? '', 10);
    if (arg === '--auth-token') options.authToken = args[index + 1] ?? options.authToken;
    if (arg === '--environment') options.environment = normalizeEnvironment(args[index + 1] ?? options.environment);
    if (arg === '--target-profile') options.targetProfile = normalizeTargetProfile(args[index + 1] ?? options.targetProfile);
    if (arg === '--api-availability-pct') options.apiAvailabilityPct = parseOptionalNumber(args[index + 1]);
    if (arg === '--worker-availability-pct') options.workerAvailabilityPct = parseOptionalNumber(args[index + 1]);
    if (arg === '--api-5xx-ratio-pct') options.api5xxRatioPct = parseOptionalNumber(args[index + 1]);
    if (arg === '--api-avg-duration-ms') options.apiAvgDurationMs = parseOptionalNumber(args[index + 1]);
    if (arg === '--queue-lag-exec-threshold') options.queueLagExecutionThreshold = parseOptionalNumber(args[index + 1]);
    if (arg === '--queue-lag-exec-compliance-pct') {
      options.queueLagExecutionCompliancePct = parseOptionalNumber(args[index + 1]);
    }
    if (arg === '--live-order-failure-ratio-pct') {
      options.liveOrderFailureRatioPct = parseOptionalNumber(args[index + 1]);
    }
  }

  const profileThresholds = TARGET_PROFILES[options.targetProfile] ?? TARGET_PROFILES.V1;
  options.thresholds = {
    apiAvailabilityPct: options.apiAvailabilityPct ?? profileThresholds.apiAvailabilityPct,
    workerAvailabilityPct: options.workerAvailabilityPct ?? profileThresholds.workerAvailabilityPct,
    api5xxRatioPct: options.api5xxRatioPct ?? profileThresholds.api5xxRatioPct,
    apiAvgDurationMs: options.apiAvgDurationMs ?? profileThresholds.apiAvgDurationMs,
    queueLagExecutionThreshold:
      options.queueLagExecutionThreshold ?? profileThresholds.queueLagExecutionThreshold,
    queueLagExecutionCompliancePct:
      options.queueLagExecutionCompliancePct ?? profileThresholds.queueLagExecutionCompliancePct,
    liveOrderFailureRatioPct:
      options.liveOrderFailureRatioPct ?? profileThresholds.liveOrderFailureRatioPct,
  };

  return options;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const percentile = (values, pct) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
};

const safeDelta = (start, end) => {
  if (typeof start !== 'number' || typeof end !== 'number') return null;
  return Math.max(0, end - start);
};

const toIsoStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const readCounter = (sample, pathParts) => {
  let value = sample;
  for (const key of pathParts) {
    if (!value || typeof value !== 'object') return null;
    value = value[key];
  }
  return typeof value === 'number' ? value : null;
};

const evaluateObjective = ({ id, label, comparator, threshold, observed, unit = '' }) => {
  if (observed == null || !Number.isFinite(observed)) {
    return {
      id,
      label,
      comparator,
      threshold,
      observed: null,
      unit,
      status: 'NO_DATA',
      passed: false,
    };
  }

  const passed = comparator === '>=' ? observed >= threshold : observed <= threshold;
  return {
    id,
    label,
    comparator,
    threshold,
    observed,
    unit,
    status: passed ? 'PASS' : 'FAIL',
    passed,
  };
};

const requestJson = async (baseUrl, endpoint, token) => {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const durationMs = Date.now() - startedAt;
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    return {
      endpoint,
      status: response.status,
      ok: response.ok,
      durationMs,
      payload,
      error: null,
      at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      endpoint,
      status: 0,
      ok: false,
      durationMs: Date.now() - startedAt,
      payload: null,
      error: error instanceof Error ? error.message : 'unknown_error',
      at: new Date().toISOString(),
    };
  }
};

const computeSummary = (samples, thresholds) => {
  const endpointSamples = (endpoint) => samples.map((sample) => sample[endpoint]).filter(Boolean);
  const successRatio = (endpoint) => {
    const points = endpointSamples(endpoint);
    if (points.length === 0) return null;
    const success = points.filter((point) => point.status === 200).length;
    return (success / points.length) * 100;
  };

  const queueLagPoints = endpointSamples('/metrics')
    .map((point) => readCounter(point.payload, ['worker', 'queueLag', 'execution']))
    .filter((value) => typeof value === 'number');
  const queueWithinThresholdCount = queueLagPoints.filter(
    (value) => value <= thresholds.queueLagExecutionThreshold
  ).length;
  const queueWithinThresholdPct =
    queueLagPoints.length > 0 ? (queueWithinThresholdCount / queueLagPoints.length) * 100 : null;

  const metricsSamples = endpointSamples('/metrics').filter((point) => point.status === 200);
  const firstMetrics = metricsSamples[0]?.payload ?? null;
  const lastMetrics = metricsSamples[metricsSamples.length - 1]?.payload ?? null;

  const requestsDelta = safeDelta(
    readCounter(firstMetrics, ['http', 'requestsTotal']),
    readCounter(lastMetrics, ['http', 'requestsTotal'])
  );
  const status5xxDelta = safeDelta(
    readCounter(firstMetrics, ['http', 'status5xx']),
    readCounter(lastMetrics, ['http', 'status5xx'])
  );
  const totalDurationDelta = safeDelta(
    readCounter(firstMetrics, ['http', 'totalDurationMs']),
    readCounter(lastMetrics, ['http', 'totalDurationMs'])
  );
  const orderAttemptsDelta = safeDelta(
    readCounter(firstMetrics, ['exchange', 'orderAttempts']),
    readCounter(lastMetrics, ['exchange', 'orderAttempts'])
  );
  const orderFailuresDelta = safeDelta(
    readCounter(firstMetrics, ['exchange', 'orderFailures']),
    readCounter(lastMetrics, ['exchange', 'orderFailures'])
  );

  const summary = {
    probes: {
      healthAvailabilityPct: successRatio('/health'),
      readyAvailabilityPct: successRatio('/ready'),
      workersHealthAvailabilityPct: successRatio('/workers/health'),
      workersReadyAvailabilityPct: successRatio('/workers/ready'),
    },
    http: {
      requestsDelta,
      status5xxDelta,
      errorRatioPct:
        requestsDelta && requestsDelta > 0 && status5xxDelta != null
          ? (status5xxDelta / requestsDelta) * 100
          : null,
      averageDurationMs:
        requestsDelta && requestsDelta > 0 && totalDurationDelta != null
          ? totalDurationDelta / requestsDelta
          : null,
    },
    queueLagExecution: {
      sampleCount: queueLagPoints.length,
      p50: percentile(queueLagPoints, 50),
      p95: percentile(queueLagPoints, 95),
      max: queueLagPoints.length ? Math.max(...queueLagPoints) : null,
      threshold: thresholds.queueLagExecutionThreshold,
      withinThresholdPct: queueWithinThresholdPct,
    },
    liveOrderPath: {
      orderAttemptsDelta,
      orderFailuresDelta,
      failureRatioPct:
        orderAttemptsDelta && orderAttemptsDelta > 0 && orderFailuresDelta != null
          ? (orderFailuresDelta / orderAttemptsDelta) * 100
          : null,
    },
  };

  const objectives = [
    evaluateObjective({
      id: 'SLO-1A',
      label: '/health availability',
      comparator: '>=',
      threshold: thresholds.apiAvailabilityPct,
      observed: summary.probes.healthAvailabilityPct,
      unit: '%',
    }),
    evaluateObjective({
      id: 'SLO-1B',
      label: '/ready availability',
      comparator: '>=',
      threshold: thresholds.apiAvailabilityPct,
      observed: summary.probes.readyAvailabilityPct,
      unit: '%',
    }),
    evaluateObjective({
      id: 'SLO-4A',
      label: '/workers/health availability',
      comparator: '>=',
      threshold: thresholds.workerAvailabilityPct,
      observed: summary.probes.workersHealthAvailabilityPct,
      unit: '%',
    }),
    evaluateObjective({
      id: 'SLO-4B',
      label: '/workers/ready availability',
      comparator: '>=',
      threshold: thresholds.workerAvailabilityPct,
      observed: summary.probes.workersReadyAvailabilityPct,
      unit: '%',
    }),
    evaluateObjective({
      id: 'SLO-2',
      label: 'API 5xx ratio',
      comparator: '<=',
      threshold: thresholds.api5xxRatioPct,
      observed: summary.http.errorRatioPct,
      unit: '%',
    }),
    evaluateObjective({
      id: 'SLO-3',
      label: 'API average duration',
      comparator: '<=',
      threshold: thresholds.apiAvgDurationMs,
      observed: summary.http.averageDurationMs,
      unit: 'ms',
    }),
    evaluateObjective({
      id: 'SLO-5',
      label: 'Execution queue lag compliance',
      comparator: '>=',
      threshold: thresholds.queueLagExecutionCompliancePct,
      observed: summary.queueLagExecution.withinThresholdPct,
      unit: '%',
    }),
    evaluateObjective({
      id: 'SLO-6',
      label: 'Live order failure ratio',
      comparator: '<=',
      threshold: thresholds.liveOrderFailureRatioPct,
      observed: summary.liveOrderPath.failureRatioPct,
      unit: '%',
    }),
  ];

  const hasFail = objectives.some((objective) => objective.status === 'FAIL');
  const hasNoData = objectives.some((objective) => objective.status === 'NO_DATA');
  summary.evaluation = {
    targetProfile: thresholds.targetProfile,
    thresholds: { ...thresholds },
    objectives,
    overallStatus: hasFail ? 'FAIL' : hasNoData ? 'NO_DATA' : 'PASS',
    failedObjectiveIds: objectives
      .filter((objective) => objective.status === 'FAIL')
      .map((objective) => objective.id),
    noDataObjectiveIds: objectives
      .filter((objective) => objective.status === 'NO_DATA')
      .map((objective) => objective.id),
  };

  return summary;
};

const renderMarkdown = ({ startedAt, endedAt, options, summary, artifacts }) => {
  const objectiveRows = summary.evaluation.objectives
    .map((objective) => {
      const observed =
        objective.observed == null ? 'n/a' : `${objective.observed.toFixed(objective.unit === 'ms' ? 2 : 4)}${objective.unit}`;
      const threshold = `${objective.comparator} ${objective.threshold}${objective.unit}`;
      return `| ${objective.id} | ${objective.label} | ${threshold} | ${observed} | ${objective.status} |`;
    })
    .join('\n');

  return `# V1 SLO Observation Window (${startedAt.slice(0, 10)})

## Run Context
- Started (UTC): ${startedAt}
- Ended (UTC): ${endedAt}
- Base URL: \`${options.baseUrl}\`
- Duration target (minutes): ${options.durationMinutes}
- Interval (seconds): ${options.intervalSeconds}
- Auth token provided: ${options.authToken ? 'yes' : 'no'}
- Environment: ${options.environment}
- Target profile: ${summary.evaluation.targetProfile}
- Raw artifact: \`${artifacts.jsonPath}\`

## Probe Availability
- /health availability: ${summary.probes.healthAvailabilityPct?.toFixed(2) ?? 'n/a'}%
- /ready availability: ${summary.probes.readyAvailabilityPct?.toFixed(2) ?? 'n/a'}%
- /workers/health availability: ${summary.probes.workersHealthAvailabilityPct?.toFixed(2) ?? 'n/a'}%
- /workers/ready availability: ${summary.probes.workersReadyAvailabilityPct?.toFixed(2) ?? 'n/a'}%

## API Reliability and Latency
- requests delta: ${summary.http.requestsDelta ?? 'n/a'}
- 5xx delta: ${summary.http.status5xxDelta ?? 'n/a'}
- 5xx ratio: ${summary.http.errorRatioPct?.toFixed(4) ?? 'n/a'}%
- avg duration: ${summary.http.averageDurationMs?.toFixed(2) ?? 'n/a'} ms

## Queue-Lag (execution)
- sample count: ${summary.queueLagExecution.sampleCount}
- p50: ${summary.queueLagExecution.p50 ?? 'n/a'}
- p95: ${summary.queueLagExecution.p95 ?? 'n/a'}
- max: ${summary.queueLagExecution.max ?? 'n/a'}
- compliance <= ${summary.queueLagExecution.threshold}: ${summary.queueLagExecution.withinThresholdPct?.toFixed(2) ?? 'n/a'}%

## Live Order Path
- order attempts delta: ${summary.liveOrderPath.orderAttemptsDelta ?? 'n/a'}
- order failures delta: ${summary.liveOrderPath.orderFailuresDelta ?? 'n/a'}
- failure ratio: ${summary.liveOrderPath.failureRatioPct?.toFixed(4) ?? 'n/a'}%

## Pass/Fail Evaluation
- Overall status: **${summary.evaluation.overallStatus}**
- Failed objectives: ${summary.evaluation.failedObjectiveIds.length ? summary.evaluation.failedObjectiveIds.join(', ') : 'none'}
- No-data objectives: ${summary.evaluation.noDataObjectiveIds.length ? summary.evaluation.noDataObjectiveIds.join(', ') : 'none'}

| Objective | Metric | Threshold | Observed | Status |
| --- | --- | --- | --- | --- |
${objectiveRows}

## Operator Follow-up
- Incident/alerts during window:
- Error-budget burn assessment:
- Remediation actions for FAIL/NO_DATA objectives:
`;
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log(
      'Usage: node scripts/collectSloEvidence.mjs [--base-url <url>] [--duration-minutes <n>] [--interval-seconds <n>] [--auth-token <token>] [--environment <local|stage|production>] [--target-profile <MVP|V1>] [--api-availability-pct <n>] [--worker-availability-pct <n>] [--api-5xx-ratio-pct <n>] [--api-avg-duration-ms <n>] [--queue-lag-exec-threshold <n>] [--queue-lag-exec-compliance-pct <n>] [--live-order-failure-ratio-pct <n>]'
    );
    process.exit(0);
  }

  if (!Number.isFinite(options.durationMinutes) || options.durationMinutes <= 0) {
    throw new Error('duration-minutes must be a positive number');
  }
  if (!Number.isFinite(options.intervalSeconds) || options.intervalSeconds <= 0) {
    throw new Error('interval-seconds must be a positive number');
  }
  const thresholdsToValidate = Object.entries(options.thresholds);
  for (const [key, value] of thresholdsToValidate) {
    if (key === 'targetProfile') continue;
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${key} must be a positive number`);
    }
  }

  const startedAt = new Date().toISOString();
  const durationMs = options.durationMinutes * 60_000;
  const intervalMs = options.intervalSeconds * 1_000;
  const deadline = Date.now() + durationMs;

  const endpoints = ['/health', '/ready', '/workers/health', '/workers/ready', '/metrics', '/alerts'];
  const samples = [];

  while (Date.now() <= deadline) {
    const sample = {};
    for (const endpoint of endpoints) {
      sample[endpoint] = await requestJson(options.baseUrl, endpoint, options.authToken);
    }
    samples.push(sample);
    if (Date.now() + intervalMs > deadline) break;
    await wait(intervalMs);
  }

  const endedAt = new Date().toISOString();
  const summary = computeSummary(samples, {
    targetProfile: options.targetProfile,
    ...options.thresholds,
  });

  const operationsDir = path.resolve(process.cwd(), 'docs', 'operations');
  const stamp = toIsoStamp();
  const jsonPath = path.join(operationsDir, `_artifacts-slo-window-${stamp}.json`);
  const mdPath = path.join(operationsDir, `v1-slo-observation-${stamp}.md`);

  await mkdir(operationsDir, { recursive: true });
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        startedAt,
        endedAt,
        options: {
          baseUrl: options.baseUrl,
          durationMinutes: options.durationMinutes,
          intervalSeconds: options.intervalSeconds,
          authTokenProvided: Boolean(options.authToken),
          environment: options.environment,
          targetProfile: options.targetProfile,
          thresholds: options.thresholds,
        },
        summary,
        samples,
      },
      null,
      2
    )
  );

  const markdown = renderMarkdown({
    startedAt,
    endedAt,
    options,
    summary,
    artifacts: { jsonPath: path.relative(process.cwd(), jsonPath) },
  });
  await writeFile(mdPath, markdown);

  console.log(`SLO evidence JSON: ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`SLO evidence report: ${path.relative(process.cwd(), mdPath)}`);
};

main().catch((error) => {
  console.error('[ops:slo:collect] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
