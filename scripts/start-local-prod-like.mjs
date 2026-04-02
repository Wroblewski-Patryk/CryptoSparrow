import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();

const requiredEnvFiles = [
  path.resolve(rootDir, 'apps', 'api', '.env'),
  path.resolve(rootDir, 'apps', 'web', '.env.local'),
];

for (const envPath of requiredEnvFiles) {
  if (!fs.existsSync(envPath)) {
    process.stderr.write(`[prod-like] missing required env file: ${envPath}\n`);
    process.stderr.write(
      '[prod-like] bootstrap with:\n' +
        '  Copy-Item apps/api/.env.example apps/api/.env -ErrorAction SilentlyContinue\n' +
        '  Copy-Item apps/web/.env.example apps/web/.env.local -ErrorAction SilentlyContinue\n',
    );
    process.exit(1);
  }
}

const runStep = (label, command, args) =>
  new Promise((resolve, reject) => {
    process.stdout.write(`[prod-like] ${label}\n`);
    const child = spawn(command, args, {
      cwd: rootDir,
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with code ${code ?? 1}`));
    });

    child.on('error', (error) => reject(error));
  });

try {
  await runStep('build api', 'pnpm', ['--filter', 'api', 'build']);
  await runStep('build web', 'pnpm', ['--filter', 'web', 'build']);
} catch (error) {
  process.stderr.write(`[prod-like] preflight failed: ${error.message}\n`);
  process.exit(1);
}

const runtimeEntries = [
  { name: 'api', command: 'pnpm', args: ['--filter', 'api', 'start'] },
  { name: 'web', command: 'pnpm', args: ['--filter', 'web', 'start'] },
  { name: 'workers', command: 'pnpm', args: ['run', 'workers/prod'] },
];

const children = [];
let shuttingDown = false;

const prefixLog = (name, chunk, isError = false) => {
  const lines = chunk.toString().split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const prefixed = `[prod-like/${name}] ${line}`;
    if (isError) {
      process.stderr.write(`${prefixed}\n`);
    } else {
      process.stdout.write(`${prefixed}\n`);
    }
  }
};

const stopAll = (signal = 'SIGTERM') => {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
};

for (const entry of runtimeEntries) {
  const child = spawn(entry.command, entry.args, {
    cwd: rootDir,
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  });

  child.stdout.on('data', (chunk) => prefixLog(entry.name, chunk));
  child.stderr.on('data', (chunk) => prefixLog(entry.name, chunk, true));
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const readable = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    process.stderr.write(`[prod-like/${entry.name}] exited with ${readable}\n`);
    shuttingDown = true;
    stopAll();
    process.exit(code ?? 1);
  });

  children.push(child);
}

process.stdout.write('[prod-like] api/web/workers started\n');

const gracefulShutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write('[prod-like] shutdown requested\n');
  stopAll();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
