#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const run = (label, command, args) => {
  console.log(`[ops:rc:gates:refresh:summary:strict] ${label}`);
  return spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
};

const main = () => {
  const strictResult = run('refresh strict', 'pnpm', ['run', 'ops:rc:gates:refresh:strict']);
  run('summary', 'pnpm', ['run', 'ops:rc:gates:summary']);
  process.exit(typeof strictResult.status === 'number' ? strictResult.status : 1);
};

main();

