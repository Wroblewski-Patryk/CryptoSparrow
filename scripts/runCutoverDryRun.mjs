#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const operationsDir = path.resolve(process.cwd(), 'docs', 'operations');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    skipInfra: false,
    skipClient: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--skip-infra') options.skipInfra = true;
    if (arg === '--skip-client') options.skipClient = true;
  }

  return options;
};

const nowStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const runStep = (command, args, label) => {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const endedAt = new Date().toISOString();
  return {
    label,
    command: `${command} ${args.join(' ')}`,
    startedAt,
    endedAt,
    durationMs: Date.now() - startedMs,
    exitCode: typeof result.status === 'number' ? result.status : 1,
  };
};

const renderMarkdown = (report, jsonPath) => {
  const rows = report.steps
    .map(
      (step) =>
        `| ${step.label} | \`${step.command}\` | ${step.exitCode} | ${step.durationMs} | ${step.startedAt} | ${step.endedAt} |`
    )
    .join('\n');

  return `# V1 Local Cutover Dry-Run Report (${report.generatedAt.slice(0, 10)})

## Context
- Generated (UTC): ${report.generatedAt}
- Status: ${report.status}
- Raw JSON: \`${jsonPath}\`

## Step Results
| Step | Command | Exit | Duration (ms) | Started (UTC) | Ended (UTC) |
| --- | --- | --- | --- | --- | --- |
${rows}

## Summary
- Steps total: ${report.steps.length}
- Failed steps: ${report.steps.filter((step) => step.exitCode !== 0).length}
- Skip infra: ${report.options.skipInfra ? 'yes' : 'no'}
- Skip client: ${report.options.skipClient ? 'yes' : 'no'}
`;
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log('Usage: node scripts/runCutoverDryRun.mjs [--skip-infra] [--skip-client]');
    process.exit(0);
  }

  const steps = [];
  let infraStarted = false;
  let hasFailure = false;

  try {
    if (!options.skipInfra) {
      const infraUp = runStep('pnpm', ['run', 'go-live:infra:up'], 'infra-up');
      steps.push(infraUp);
      if (infraUp.exitCode !== 0) {
        hasFailure = true;
      } else {
        infraStarted = true;
      }
    }

    if (!hasFailure) {
      const generate = runStep('pnpm', ['--filter', 'api', 'exec', 'prisma', 'generate'], 'api-prisma-generate');
      steps.push(generate);
      if (generate.exitCode !== 0) {
        hasFailure = true;
      }
    }

    if (!hasFailure) {
      const migrate = runStep('pnpm', ['--filter', 'api', 'exec', 'prisma', 'migrate', 'deploy'], 'api-migrate-deploy');
      steps.push(migrate);
      if (migrate.exitCode !== 0) {
        hasFailure = true;
      }
    }

    if (!hasFailure) {
      const apiSuite = runStep(
        'pnpm',
        [
          '--filter',
          'api',
          'run',
          'test',
          'src/modules/engine/runtime-flow.e2e.test.ts',
          'src/modules/backtests/backtests.e2e.test.ts',
          'src/modules/engine/preTrade.e2e.test.ts',
          'src/modules/bots/bots.e2e.test.ts',
        ],
        'api-cutover-suite'
      );
      steps.push(apiSuite);
      if (apiSuite.exitCode !== 0) {
        hasFailure = true;
      }
    }

    if (!hasFailure && !options.skipClient) {
      const clientSuite = runStep(
        'pnpm',
        [
          '--filter',
          'web',
          'exec',
          'vitest',
          'run',
          'src/features/bots/components/BotsManagement.test.tsx',
          'src/features/logs/components/AuditTrailView.test.tsx',
        ],
        'web-cutover-suite'
      );
      steps.push(clientSuite);
      if (clientSuite.exitCode !== 0) {
        hasFailure = true;
      }
    }
  } finally {
    if (infraStarted && !options.skipInfra) {
      const infraDown = runStep('pnpm', ['run', 'go-live:infra:down'], 'infra-down');
      steps.push(infraDown);
      if (infraDown.exitCode !== 0) {
        hasFailure = true;
      }
    }
  }

  const generatedAt = new Date().toISOString();
  const stamp = nowStamp();
  const jsonFile = path.join(operationsDir, `_artifacts-cutover-dry-run-${stamp}.json`);
  const mdFile = path.join(operationsDir, `v1-local-cutover-dry-run-${stamp}.md`);
  const report = {
    generatedAt,
    status: hasFailure ? 'FAILED' : 'PASS',
    options,
    steps,
  };

  await mkdir(operationsDir, { recursive: true });
  await writeFile(jsonFile, JSON.stringify(report, null, 2));
  await writeFile(mdFile, renderMarkdown(report, path.relative(process.cwd(), jsonFile)));

  console.log(`Cutover dry-run JSON: ${path.relative(process.cwd(), jsonFile)}`);
  console.log(`Cutover dry-run report: ${path.relative(process.cwd(), mdFile)}`);
  process.exit(hasFailure ? 1 : 0);
};

main().catch((error) => {
  console.error('[ops:cutover:dry-run] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
