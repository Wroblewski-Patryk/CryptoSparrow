import { spawn } from 'node:child_process';

const rootDir = process.cwd();

console.log('[frontend/dev] Starting web app in watch mode...');

const child = spawn('pnpm', ['--filter', 'web', 'dev'], {
  stdio: 'inherit',
  cwd: rootDir,
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
