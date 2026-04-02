import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const apiDistDir = path.resolve(rootDir, 'apps', 'api', 'dist', 'workers');

const workerEntries = [
  { name: 'market-data', file: 'marketData.worker.js' },
  { name: 'market-stream', file: 'marketStream.worker.js' },
  { name: 'backtest', file: 'backtest.worker.js' },
  { name: 'execution', file: 'execution.worker.js' },
];

const missing = workerEntries
  .map((entry) => path.join(apiDistDir, entry.file))
  .filter((workerPath) => !fs.existsSync(workerPath));

if (missing.length > 0) {
  process.stderr.write('[workers/prod] missing built worker files:\n');
  for (const workerPath of missing) {
    process.stderr.write(`  - ${workerPath}\n`);
  }
  process.stderr.write('[workers/prod] run "pnpm --filter api build" before starting workers.\n');
  process.exit(1);
}

const children = [];
let shuttingDown = false;

const prefixLog = (name, chunk, isError = false) => {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const prefixed = `[worker/${name}] ${line}`;
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

for (const worker of workerEntries) {
  const scriptPath = path.join(apiDistDir, worker.file);
  const child = spawn('node', [scriptPath], {
    cwd: rootDir,
    shell: false,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  });

  child.stdout.on('data', (chunk) => prefixLog(worker.name, chunk));
  child.stderr.on('data', (chunk) => prefixLog(worker.name, chunk, true));
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const readable = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    process.stderr.write(`[worker/${worker.name}] exited with ${readable}\n`);
    shuttingDown = true;
    stopAll();
    process.exit(code ?? 1);
  });

  children.push(child);
}

const gracefulShutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write('[workers/prod] shutdown requested\n');
  stopAll();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
