#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const operationsDir = path.resolve(process.cwd(), 'docs', 'operations');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    inputDir: operationsDir,
    windowDays: Number.parseInt(process.env.SLO_WINDOW_DAYS ?? '7', 10),
    outputPrefix: 'v1-slo-window-report',
    queueLagP95Threshold: Number.parseFloat(process.env.SLO_QUEUE_LAG_P95_THRESHOLD ?? '10'),
    queueLagMaxThreshold: Number.parseFloat(process.env.SLO_QUEUE_LAG_MAX_THRESHOLD ?? '20'),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--input-dir') options.inputDir = args[index + 1] ?? options.inputDir;
    if (arg === '--window-days') options.windowDays = Number.parseInt(args[index + 1] ?? '', 10);
    if (arg === '--output-prefix') options.outputPrefix = args[index + 1] ?? options.outputPrefix;
    if (arg === '--queue-lag-p95-threshold') {
      options.queueLagP95Threshold = Number.parseFloat(args[index + 1] ?? '');
    }
    if (arg === '--queue-lag-max-threshold') {
      options.queueLagMaxThreshold = Number.parseFloat(args[index + 1] ?? '');
    }
  }

  return options;
};

const asNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const toStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const pct = (value, digits = 2) => (value == null ? 'n/a' : `${value.toFixed(digits)}%`);

const avg = (values) => {
  if (values.length === 0) return null;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
};

const parseIso = (value) => {
  const ts = Date.parse(value ?? '');
  return Number.isFinite(ts) ? ts : null;
};

const loadArtifacts = async (inputDir) => {
  const entries = await readdir(inputDir);
  const names = entries
    .filter((name) => name.startsWith('_artifacts-slo-window-') && name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
  const artifacts = [];
  for (const name of names) {
    const fullPath = path.join(inputDir, name);
    const raw = await readFile(fullPath, 'utf8');
    const data = JSON.parse(raw);
    artifacts.push({
      fileName: name,
      fullPath,
      startedAtMs: parseIso(data.startedAt),
      endedAtMs: parseIso(data.endedAt),
      summary: data.summary ?? {},
      startedAt: data.startedAt ?? null,
      endedAt: data.endedAt ?? null,
    });
  }
  return artifacts;
};

const summarize = (artifacts, options) => {
  const nowMs = Date.now();
  const windowStartMs = nowMs - options.windowDays * 24 * 60 * 60 * 1000;
  const inWindow = artifacts.filter((artifact) => {
    if (artifact.endedAtMs == null) return false;
    return artifact.endedAtMs >= windowStartMs;
  });

  const probes = {
    health: [],
    ready: [],
    workersHealth: [],
    workersReady: [],
  };
  const httpErrorRatios = [];
  const queueLagP95 = [];
  const queueLagMax = [];
  const orderFailureRatios = [];

  const breaches = [];

  for (const artifact of inWindow) {
    const summary = artifact.summary ?? {};
    const ready = asNumber(summary?.probes?.readyAvailabilityPct);
    const workersReady = asNumber(summary?.probes?.workersReadyAvailabilityPct);
    const health = asNumber(summary?.probes?.healthAvailabilityPct);
    const workersHealth = asNumber(summary?.probes?.workersHealthAvailabilityPct);
    const errorRatio = asNumber(summary?.http?.errorRatioPct);
    const p95 = asNumber(summary?.queueLagExecution?.p95);
    const max = asNumber(summary?.queueLagExecution?.max);
    const orderFailure = asNumber(summary?.liveOrderPath?.failureRatioPct);

    if (health != null) probes.health.push(health);
    if (ready != null) probes.ready.push(ready);
    if (workersHealth != null) probes.workersHealth.push(workersHealth);
    if (workersReady != null) probes.workersReady.push(workersReady);
    if (errorRatio != null) httpErrorRatios.push(errorRatio);
    if (p95 != null) queueLagP95.push(p95);
    if (max != null) queueLagMax.push(max);
    if (orderFailure != null) orderFailureRatios.push(orderFailure);

    if (p95 != null && p95 > options.queueLagP95Threshold) {
      breaches.push({
        type: 'QUEUE_LAG_P95',
        value: p95,
        threshold: options.queueLagP95Threshold,
        endedAt: artifact.endedAt,
        artifact: artifact.fileName,
      });
    }
    if (max != null && max > options.queueLagMaxThreshold) {
      breaches.push({
        type: 'QUEUE_LAG_MAX',
        value: max,
        threshold: options.queueLagMaxThreshold,
        endedAt: artifact.endedAt,
        artifact: artifact.fileName,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    window: {
      days: options.windowDays,
      startUtc: new Date(windowStartMs).toISOString(),
      endUtc: new Date(nowMs).toISOString(),
    },
    source: {
      inputDir: path.relative(process.cwd(), options.inputDir),
      artifactsTotal: artifacts.length,
      artifactsInWindow: inWindow.length,
    },
    aggregates: {
      probes: {
        healthAvgPct: avg(probes.health),
        readyAvgPct: avg(probes.ready),
        workersHealthAvgPct: avg(probes.workersHealth),
        workersReadyAvgPct: avg(probes.workersReady),
      },
      api: {
        errorRatioAvgPct: avg(httpErrorRatios),
      },
      queueLagExecution: {
        p95Avg: avg(queueLagP95),
        p95Max: queueLagP95.length ? Math.max(...queueLagP95) : null,
        maxAvg: avg(queueLagMax),
        maxPeak: queueLagMax.length ? Math.max(...queueLagMax) : null,
      },
      liveOrderPath: {
        failureRatioAvgPct: avg(orderFailureRatios),
      },
    },
    thresholds: {
      queueLagP95Threshold: options.queueLagP95Threshold,
      queueLagMaxThreshold: options.queueLagMaxThreshold,
    },
    queueLagBreaches: breaches,
    artifactRefs: inWindow.map((artifact) => ({
      file: artifact.fileName,
      startedAt: artifact.startedAt,
      endedAt: artifact.endedAt,
      queueLagP95: asNumber(artifact.summary?.queueLagExecution?.p95),
      queueLagMax: asNumber(artifact.summary?.queueLagExecution?.max),
    })),
  };
};

const renderMarkdown = (report, jsonRelativePath) => {
  const rows = report.artifactRefs
    .map(
      (item) =>
        `| ${item.file} | ${item.startedAt ?? 'n/a'} | ${item.endedAt ?? 'n/a'} | ${item.queueLagP95 ?? 'n/a'} | ${
          item.queueLagMax ?? 'n/a'
        } |`
    )
    .join('\n');

  const breaches = report.queueLagBreaches
    .map(
      (item) =>
        `- ${item.endedAt ?? 'n/a'} | ${item.type}=${item.value} (threshold ${item.threshold}) from \`${item.artifact}\``
    )
    .join('\n');

  return `# V1 SLO Window Report (${report.window.days}d)

- Generated (UTC): ${report.generatedAt}
- Window: ${report.window.startUtc} -> ${report.window.endUtc}
- Source directory: \`${report.source.inputDir}\`
- Artifacts in window: ${report.source.artifactsInWindow}/${report.source.artifactsTotal}
- Raw JSON: \`${jsonRelativePath}\`

## Aggregate Snapshot
- /health availability avg: ${pct(report.aggregates.probes.healthAvgPct)}
- /ready availability avg: ${pct(report.aggregates.probes.readyAvgPct)}
- /workers/health availability avg: ${pct(report.aggregates.probes.workersHealthAvgPct)}
- /workers/ready availability avg: ${pct(report.aggregates.probes.workersReadyAvgPct)}
- API 5xx ratio avg: ${pct(report.aggregates.api.errorRatioAvgPct, 4)}
- execution queue lag p95 avg: ${report.aggregates.queueLagExecution.p95Avg ?? 'n/a'}
- execution queue lag p95 peak: ${report.aggregates.queueLagExecution.p95Max ?? 'n/a'}
- execution queue lag max avg: ${report.aggregates.queueLagExecution.maxAvg ?? 'n/a'}
- execution queue lag max peak: ${report.aggregates.queueLagExecution.maxPeak ?? 'n/a'}
- live order failure ratio avg: ${pct(report.aggregates.liveOrderPath.failureRatioAvgPct, 4)}

## Queue-Lag Breach Timeline
${breaches || '- none'}

## Artifact Timeline
| Artifact | Started (UTC) | Ended (UTC) | Queue p95 | Queue max |
| --- | --- | --- | --- | --- |
${rows || '| n/a | n/a | n/a | n/a | n/a |'}
`;
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log(
      'Usage: node scripts/buildSloWindowReport.mjs [--input-dir <path>] [--window-days <n>] [--output-prefix <name>] [--queue-lag-p95-threshold <n>] [--queue-lag-max-threshold <n>]'
    );
    process.exit(0);
  }

  if (!Number.isFinite(options.windowDays) || options.windowDays <= 0) {
    throw new Error('window-days must be a positive integer');
  }
  if (!Number.isFinite(options.queueLagP95Threshold) || options.queueLagP95Threshold <= 0) {
    throw new Error('queue-lag-p95-threshold must be a positive number');
  }
  if (!Number.isFinite(options.queueLagMaxThreshold) || options.queueLagMaxThreshold <= 0) {
    throw new Error('queue-lag-max-threshold must be a positive number');
  }

  options.inputDir = path.resolve(process.cwd(), options.inputDir);

  const artifacts = await loadArtifacts(options.inputDir);
  const report = summarize(artifacts, options);
  const stamp = toStamp();
  const basePath = path.join(options.inputDir, `${options.outputPrefix}-${options.windowDays}d-${stamp}`);
  const jsonPath = `${basePath}.json`;
  const mdPath = `${basePath}.md`;

  await mkdir(options.inputDir, { recursive: true });
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  await writeFile(mdPath, renderMarkdown(report, path.relative(process.cwd(), jsonPath)));

  console.log(`SLO window JSON: ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`SLO window report: ${path.relative(process.cwd(), mdPath)}`);
};

main().catch((error) => {
  console.error('[ops:slo:window-report] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
