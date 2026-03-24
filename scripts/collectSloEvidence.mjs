#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    baseUrl: process.env.SLO_BASE_URL ?? 'http://localhost:4001',
    durationMinutes: Number.parseInt(process.env.SLO_DURATION_MINUTES ?? '30', 10),
    intervalSeconds: Number.parseInt(process.env.SLO_INTERVAL_SECONDS ?? '30', 10),
    authToken: process.env.SLO_AUTH_TOKEN ?? '',
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
  }

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

const computeSummary = (samples) => {
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

  return {
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
};

const renderMarkdown = ({ startedAt, endedAt, options, summary, artifacts }) => {
  return `# V1 SLO Observation Window (${startedAt.slice(0, 10)})

## Run Context
- Started (UTC): ${startedAt}
- Ended (UTC): ${endedAt}
- Base URL: \`${options.baseUrl}\`
- Duration target (minutes): ${options.durationMinutes}
- Interval (seconds): ${options.intervalSeconds}
- Auth token provided: ${options.authToken ? 'yes' : 'no'}
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

## Live Order Path
- order attempts delta: ${summary.liveOrderPath.orderAttemptsDelta ?? 'n/a'}
- order failures delta: ${summary.liveOrderPath.orderFailuresDelta ?? 'n/a'}
- failure ratio: ${summary.liveOrderPath.failureRatioPct?.toFixed(4) ?? 'n/a'}%

## Operator Notes
- Incident/alerts during window:
- Error-budget burn assessment:
- Pass/fail per SLO:
`;
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log('Usage: node scripts/collectSloEvidence.mjs [--base-url <url>] [--duration-minutes <n>] [--interval-seconds <n>] [--auth-token <token>]');
    process.exit(0);
  }

  if (!Number.isFinite(options.durationMinutes) || options.durationMinutes <= 0) {
    throw new Error('duration-minutes must be a positive number');
  }
  if (!Number.isFinite(options.intervalSeconds) || options.intervalSeconds <= 0) {
    throw new Error('interval-seconds must be a positive number');
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
  const summary = computeSummary(samples);

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

