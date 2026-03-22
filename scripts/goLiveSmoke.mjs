import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const targetArg = args.find((arg) => arg.startsWith('--target='));
const rawTarget = targetArg?.split('=')[1] ?? 'full';
const target = rawTarget === 'server' ? 'api' : rawTarget;

if (!['api', 'full'].includes(target)) {
  console.error(`Unsupported target "${rawTarget}". Use --target=api or --target=full.`);
  process.exit(1);
}

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (typeof result.status === 'number') {
    return result.status;
  }
  return 1;
};

let exitCode = 0;
let infraStarted = false;

try {
  exitCode = run('pnpm', ['run', 'go-live:infra:up']);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
  infraStarted = true;

  exitCode = run('pnpm', ['--filter', 'api', 'exec', 'prisma', 'migrate', 'deploy']);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  exitCode = run('pnpm', ['run', 'test:go-live:api']);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  if (target === 'full') {
    exitCode = run('pnpm', ['run', 'test:go-live:client']);
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }
} finally {
  if (infraStarted) {
    const downCode = run('pnpm', ['run', 'go-live:infra:down']);
    if (exitCode === 0 && downCode !== 0) {
      exitCode = downCode;
    }
  }
}

process.exit(exitCode);
