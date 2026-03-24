#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    baseUrl: process.env.SLO_BASE_URL ?? 'http://localhost:4001',
    durationMinutes: process.env.SLO_DURATION_MINUTES ?? '5',
    intervalSeconds: process.env.SLO_INTERVAL_SECONDS ?? '15',
    authToken: process.env.SLO_AUTH_TOKEN ?? '',
    skipDbCheck: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--base-url') options.baseUrl = args[index + 1] ?? options.baseUrl;
    if (arg === '--duration-minutes') options.durationMinutes = args[index + 1] ?? options.durationMinutes;
    if (arg === '--interval-seconds') options.intervalSeconds = args[index + 1] ?? options.intervalSeconds;
    if (arg === '--auth-token') options.authToken = args[index + 1] ?? options.authToken;
    if (arg === '--skip-db-check') options.skipDbCheck = true;
  }

  return options;
};

const run = (label, command, args, env = {}) => {
  console.log(`[ops:rc:gates:local] ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
};

const main = () => {
  const options = parseArgs();
  if (options.help) {
    console.log(
      'Usage: node scripts/runLocalExternalGatesPipeline.mjs [--base-url <url>] [--duration-minutes <n>] [--interval-seconds <n>] [--auth-token <token>] [--skip-db-check]'
    );
    process.exit(0);
  }

  if (!options.skipDbCheck) {
    run('backup/restore local check', 'pnpm', ['run', 'ops:db:backup-restore:check-local']);
  }

  const sloArgs = [
    'run',
    'ops:slo:collect',
    '--',
    '--base-url',
    options.baseUrl,
    '--duration-minutes',
    String(options.durationMinutes),
    '--interval-seconds',
    String(options.intervalSeconds),
  ];
  if (options.authToken) {
    sloArgs.push('--auth-token', options.authToken);
  }
  run('SLO observation collector', 'pnpm', sloArgs);

  run('build RC external gates status', 'pnpm', ['run', 'ops:rc:gates:status']);
  console.log('[ops:rc:gates:local] done');
};

try {
  main();
} catch (error) {
  console.error('[ops:rc:gates:local] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

