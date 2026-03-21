import { spawn } from 'node:child_process';

const rootDir = process.cwd();

const workerCommands = [
  {
    name: 'execution',
    args: ['--filter', 'server', 'dev:worker:execution'],
  },
  {
    name: 'market-stream',
    args: ['--filter', 'server', 'dev:worker:market-stream'],
  },
];

const children = [];

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

for (const worker of workerCommands) {
  const child = spawn('pnpm', worker.args, {
    cwd: rootDir,
    shell: process.platform === 'win32',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => prefixLog(worker.name, chunk));
  child.stderr.on('data', (chunk) => prefixLog(worker.name, chunk, true));
  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.stderr.write(`[worker/${worker.name}] exited with code ${code}\n`);
      for (const proc of children) {
        if (!proc.killed) proc.kill();
      }
      process.exit(code);
    }
  });

  children.push(child);
}

const shutdown = () => {
  for (const proc of children) {
    if (!proc.killed) proc.kill();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
