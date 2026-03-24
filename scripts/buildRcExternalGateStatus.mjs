#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const operationsDir = path.resolve(process.cwd(), 'docs', 'operations');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    input: '',
    output: path.join(operationsDir, 'v1-rc-external-gates-status.md'),
    templateOnly: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--input') options.input = args[index + 1] ?? options.input;
    if (arg === '--output') options.output = args[index + 1] ?? options.output;
    if (arg === '--template-only') options.templateOnly = true;
  }

  return options;
};

const asNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const pct = (value) => (value == null ? 'n/a' : `${value.toFixed(2)}%`);

const findLatestSloArtifact = async () => {
  const entries = await readdir(operationsDir);
  const candidates = entries
    .filter((name) => name.startsWith('_artifacts-slo-window-') && name.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));
  if (candidates.length === 0) return null;
  return path.join(operationsDir, candidates[0]);
};

const statusLabel = (passed) => (passed ? 'PASS' : 'OPEN');

const buildGateRows = (summary) => {
  const ready = asNumber(summary?.probes?.readyAvailabilityPct);
  const workersReady = asNumber(summary?.probes?.workersReadyAvailabilityPct);
  const errorRatio = asNumber(summary?.http?.errorRatioPct);
  const executionP95 = asNumber(summary?.queueLagExecution?.p95);
  const executionMax = asNumber(summary?.queueLagExecution?.max);

  const queueLagPass = executionP95 != null && executionP95 <= 10 && executionMax != null && executionMax <= 20;
  const probePass = ready != null && ready >= 99.9 && workersReady != null && workersReady >= 99.5;
  const reliabilityPass = errorRatio != null && errorRatio <= 0.5;

  return {
    probePass,
    reliabilityPass,
    queueLagPass,
    details: {
      ready,
      workersReady,
      errorRatio,
      executionP95,
      executionMax,
      orderAttempts: asNumber(summary?.liveOrderPath?.orderAttemptsDelta),
      orderFailures: asNumber(summary?.liveOrderPath?.orderFailuresDelta),
      orderFailureRatio: asNumber(summary?.liveOrderPath?.failureRatioPct),
    },
  };
};

const renderReport = ({ artifactPath, artifact, evaluation }) => {
  const generatedAt = new Date().toISOString();
  const artifactRel = path.relative(process.cwd(), artifactPath);
  const output = `# V1 RC External Gates Status

Generated at (UTC): ${generatedAt}

Source artifact: \`${artifactRel}\`
Observation window:
- started: ${artifact.startedAt ?? 'n/a'}
- ended: ${artifact.endedAt ?? 'n/a'}

## Gate Status Snapshot
- Gate 1 (Backup snapshot + restore validation): ${statusLabel(false)} (manual evidence required)
- Gate 2 (Queue-lag baseline review): ${statusLabel(evaluation.queueLagPass)}
- Gate 3 (Incident contacts + escalation confirmation): ${statusLabel(false)} (manual evidence required)
- Gate 4 (Formal RC sign-offs): ${statusLabel(false)} (manual evidence required)

## Derived Metrics (from SLO artifact)
- /ready availability: ${pct(evaluation.details.ready)}
- /workers/ready availability: ${pct(evaluation.details.workersReady)}
- API 5xx ratio: ${pct(evaluation.details.errorRatio)}
- execution queue lag p95: ${evaluation.details.executionP95 ?? 'n/a'}
- execution queue lag max: ${evaluation.details.executionMax ?? 'n/a'}
- exchange order attempts delta: ${evaluation.details.orderAttempts ?? 'n/a'}
- exchange order failures delta: ${evaluation.details.orderFailures ?? 'n/a'}
- exchange order failure ratio: ${pct(evaluation.details.orderFailureRatio)}

## Suggested Checklist Updates
- Runtime and Operations Gates:
  - Queue lag metrics reviewed and within baseline -> ${statusLabel(evaluation.queueLagPass)}
- Exit Evidence Workpack:
  - ops(slo): define SLO targets and collect production observation window evidence -> ${statusLabel(
    evaluation.probePass && evaluation.reliabilityPass
  )}

## Manual Follow-ups (Required)
1. Fill backup/restore evidence in \`docs/operations/v1-rc-external-gates-runbook.md\`.
2. Fill on-call/escalation confirmation in runbook.
3. Complete sign-offs in \`docs/operations/v1-rc-signoff-record.md\`.
4. Reflect final gate states in \`docs/operations/v1-release-candidate-checklist.md\`.
`;
  return output;
};

const renderTemplateOnly = () => {
  const generatedAt = new Date().toISOString();
  return `# V1 RC External Gates Status

Generated at (UTC): ${generatedAt}

Source artifact: not provided (template-only mode)

## Gate Status Snapshot
- Gate 1 (Backup snapshot + restore validation): OPEN
- Gate 2 (Queue-lag baseline review): OPEN
- Gate 3 (Incident contacts + escalation confirmation): OPEN
- Gate 4 (Formal RC sign-offs): OPEN

## Required Inputs
1. Run SLO collector:
   - \`pnpm run ops:slo:collect -- --base-url https://<target-api> --duration-minutes 30 --interval-seconds 30 --auth-token <ADMIN_JWT>\`
2. Rebuild status from latest artifact:
   - \`pnpm run ops:rc:gates:status\`

## Manual Follow-ups (Required)
1. Fill backup/restore evidence in \`docs/operations/v1-rc-external-gates-runbook.md\`.
2. Fill on-call/escalation confirmation in runbook.
3. Complete sign-offs in \`docs/operations/v1-rc-signoff-record.md\`.
4. Reflect final gate states in \`docs/operations/v1-release-candidate-checklist.md\`.
`;
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log('Usage: node scripts/buildRcExternalGateStatus.mjs [--input <artifact.json>] [--output <status.md>] [--template-only]');
    process.exit(0);
  }

  if (options.templateOnly) {
    const outputPath = path.resolve(process.cwd(), options.output);
    await writeFile(outputPath, renderTemplateOnly());
    console.log(`RC external gates template written to: ${path.relative(process.cwd(), outputPath)}`);
    process.exit(0);
  }

  const inputPath = options.input
    ? path.resolve(process.cwd(), options.input)
    : await findLatestSloArtifact();

  if (!inputPath) {
    throw new Error('No SLO artifact found. Run `pnpm run ops:slo:collect` first.');
  }

  const raw = await readFile(inputPath, 'utf8');
  const artifact = JSON.parse(raw);
  const evaluation = buildGateRows(artifact.summary ?? {});
  const report = renderReport({ artifactPath: inputPath, artifact, evaluation });

  const outputPath = path.resolve(process.cwd(), options.output);
  await writeFile(outputPath, report);
  console.log(`RC external gates status written to: ${path.relative(process.cwd(), outputPath)}`);
};

main().catch((error) => {
  console.error('[ops:rc:gates:status] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
