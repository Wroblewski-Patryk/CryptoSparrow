#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const operationsDir = path.resolve(process.cwd(), 'docs', 'operations');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    profile: 'local',
    passthrough: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--profile') {
      options.profile = (args[index + 1] ?? options.profile).toLowerCase();
      index += 1;
      continue;
    }
    options.passthrough.push(arg);
  }

  return options;
};

const nowStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const readLatestByPrefix = async (prefix, ext) => {
  const files = (await readdir(operationsDir))
    .filter((name) => name.startsWith(prefix) && name.endsWith(ext))
    .sort((a, b) => b.localeCompare(a));
  if (files.length === 0) return null;
  return path.join(operationsDir, files[0]);
};

const run = (command, args) =>
  spawnSync(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  });

const printUsage = () => {
  console.log(
    'Usage: node scripts/runRestoreDrillEvidence.mjs [--profile <local|stage|prod>] [-- <extra backup-verify args>]'
  );
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  await mkdir(operationsDir, { recursive: true });

  const commandArgs = [
    'scripts/runBackupVerificationProfile.mjs',
    '--profile',
    options.profile,
    ...options.passthrough,
  ];
  const startedAt = new Date().toISOString();
  const result = run('node', commandArgs);
  const endedAt = new Date().toISOString();

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const latestRawArtifact = await readLatestByPrefix('_artifacts-db-restore-check-', '.txt');
  const latestReportArtifact = await readLatestByPrefix('v1-db-restore-check-', '.md');
  const latestRawContent = latestRawArtifact ? await readFile(latestRawArtifact, 'utf8') : '';
  const latestResultMatch = latestRawContent.match(/RESULT:\s*(PASS|FAIL)/i);
  const latestResult = latestResultMatch?.[1]?.toUpperCase() ?? 'UNKNOWN';

  const checks = {
    commandExitCodeZero: result.status === 0,
    rawArtifactPresent: Boolean(latestRawArtifact),
    markdownReportPresent: Boolean(latestReportArtifact),
    backupRestoreResultPass: latestResult === 'PASS',
  };
  const status = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';

  const stamp = nowStamp();
  const jsonOutput = path.join(
    operationsDir,
    `_artifacts-restore-drill-${options.profile}-${stamp}.json`
  );
  const mdOutput = path.join(operationsDir, `v1-restore-drill-${options.profile}-${stamp}.md`);

  const payload = {
    status,
    profile: options.profile,
    startedAt,
    endedAt,
    command: `node ${commandArgs.join(' ')}`,
    checks,
    backupRestore: {
      result: latestResult,
      rawArtifact: latestRawArtifact ? path.relative(process.cwd(), latestRawArtifact) : null,
      reportArtifact: latestReportArtifact ? path.relative(process.cwd(), latestReportArtifact) : null,
    },
    stdoutPreview: (result.stdout ?? '').trim().slice(0, 4000),
    stderrPreview: (result.stderr ?? '').trim().slice(0, 2000),
  };

  await writeFile(jsonOutput, `${JSON.stringify(payload, null, 2)}\n`);
  const markdown = `# V1 Restore Drill Evidence (${options.profile})

- Generated at (UTC): ${endedAt}
- Status: **${status}**
- Command: \`${payload.command}\`
- Raw artifact: \`${payload.backupRestore.rawArtifact ?? 'n/a'}\`
- Report artifact: \`${payload.backupRestore.reportArtifact ?? 'n/a'}\`

## Contract Checks
- commandExitCodeZero: ${checks.commandExitCodeZero ? 'PASS' : 'FAIL'}
- rawArtifactPresent: ${checks.rawArtifactPresent ? 'PASS' : 'FAIL'}
- markdownReportPresent: ${checks.markdownReportPresent ? 'PASS' : 'FAIL'}
- backupRestoreResultPass: ${checks.backupRestoreResultPass ? 'PASS' : 'FAIL'}

## Output Artifacts
- JSON: \`${path.relative(process.cwd(), jsonOutput)}\`
- Markdown: \`${path.relative(process.cwd(), mdOutput)}\`
`;
  await writeFile(mdOutput, markdown);

  console.log(`Restore drill JSON artifact: ${path.relative(process.cwd(), jsonOutput)}`);
  console.log(`Restore drill report: ${path.relative(process.cwd(), mdOutput)}`);
  if (status !== 'PASS') {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(
    '[ops:db:restore-drill] failed:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
