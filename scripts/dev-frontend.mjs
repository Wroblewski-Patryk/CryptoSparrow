import { spawn } from 'node:child_process';

const rootDir = process.cwd();

console.log('[frontend/dev] Starting client in watch mode...');

const child = spawn('pnpm', ['--filter', 'client', 'dev'], {
  stdio: 'inherit',
  cwd: rootDir,
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
