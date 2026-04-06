#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const run = (label, command, args) => {
  console.log(`[ops:rc:gates:refresh:summary:strict] ${label}`);
  return spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    requireProductionGate2: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    if (arg === '--require-production-gate2') options.requireProductionGate2 = true;
  }

  return options;
};

const main = () => {
  const options = parseArgs();
  if (options.help) {
    console.log(
      'Usage: node scripts/runRcRefreshSummaryStrict.mjs [--require-production-gate2]'
    );
    process.exit(0);
  }

  const refreshCommand = options.requireProductionGate2
    ? 'ops:rc:gates:refresh:strict:prod'
    : 'ops:rc:gates:refresh:strict';
  const strictResult = run('refresh strict', 'pnpm', ['run', refreshCommand]);
  run('summary', 'pnpm', ['run', 'ops:rc:gates:summary']);
  process.exit(typeof strictResult.status === 'number' ? strictResult.status : 1);
};

main();
