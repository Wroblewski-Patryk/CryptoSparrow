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
    allowOffline: false,
    skipSloCollect: false,
    skipWindowReport: false,
    windowDays: [7, 30],
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
    if (arg === '--allow-offline') options.allowOffline = true;
    if (arg === '--skip-slo-collect') options.skipSloCollect = true;
    if (arg === '--skip-window-report') options.skipWindowReport = true;
    if (arg === '--window-days') {
      const raw = args[index + 1] ?? '';
      options.windowDays = raw
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value) && value > 0);
    }
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

const canReachApi = async (baseUrl, authToken) => {
  try {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const res = await fetch(`${baseUrl}/health`, { headers });
    return res.ok;
  } catch {
    return false;
  }
};

const main = () => {
  const options = parseArgs();
  if (options.help) {
    console.log(
      'Usage: node scripts/runLocalExternalGatesPipeline.mjs [--base-url <url>] [--duration-minutes <n>] [--interval-seconds <n>] [--auth-token <token>] [--skip-db-check] [--skip-slo-collect] [--skip-window-report] [--window-days <csv>] [--allow-offline]'
    );
    process.exit(0);
  }

  Promise.resolve()
    .then(async () => {
      if (!options.skipDbCheck) {
        run('backup/restore local check', 'pnpm', ['run', 'ops:db:backup-restore:check-local']);
      }

      if (!options.skipSloCollect) {
        const reachable = await canReachApi(options.baseUrl, options.authToken);
        if (!reachable) {
          if (!options.allowOffline) {
            throw new Error(
              `API health check failed for ${options.baseUrl}. Start API or rerun with --allow-offline to generate template-only status.`
            );
          }
          console.warn(
            `[ops:rc:gates:local] API unavailable at ${options.baseUrl}; using template-only RC status output.`
          );
          run('build RC external gates status (template-only)', 'pnpm', [
            'run',
            'ops:rc:gates:status',
            '--',
            '--template-only',
          ]);
          console.log('[ops:rc:gates:local] done (offline mode)');
          return;
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

        if (!options.skipWindowReport) {
          for (const days of options.windowDays) {
            run(`SLO rolling window report (${days}d)`, 'pnpm', [
              'run',
              'ops:slo:window-report',
              '--',
              '--window-days',
              String(days),
            ]);
          }
        }
      }

      run('build RC external gates status', 'pnpm', ['run', 'ops:rc:gates:status']);
      console.log('[ops:rc:gates:local] done');
    })
    .catch((error) => {
      console.error('[ops:rc:gates:local] failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
};

main();
