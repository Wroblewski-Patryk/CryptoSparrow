import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const rootDir = process.cwd();
const serverDir = path.join(rootDir, 'apps', 'server');
const serverEnvPath = path.join(rootDir, 'apps', 'server', '.env');

const readEnvValue = (key) => {
  try {
    const content = readFileSync(serverEnvPath, 'utf8');
    const line = content
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith(`${key}=`));
    if (!line) return undefined;
    const raw = line.slice(line.indexOf('=') + 1).trim();
    return raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  } catch {
    return undefined;
  }
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: rootDir,
    shell: process.platform === 'win32',
    ...options,
  });
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
};

const runPrisma = (args, options = {}) => {
  const { allowEngineLockFallback = false } = options;
  const result = spawnSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: serverDir,
    shell: process.platform === 'win32',
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if ((result.status ?? 1) !== 0) {
    const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (combined.includes('Command "prisma" not found')) {
      console.error(
        '[backend/dev] Prisma CLI not found in apps/server.\n' +
          'Run `pnpm install` in repository root and retry.'
      );
      process.exit(result.status ?? 1);
    }

    if (combined.includes('EPERM') && combined.includes('query_engine-windows.dll.node')) {
      if (allowEngineLockFallback) {
        console.warn(
          '[backend/dev] Prisma engine file is locked on Windows.\n' +
            'Skipping hard regenerate and continuing with existing Prisma client.'
        );
        return;
      }
      console.error(
        '[backend/dev] Prisma engine file is locked on Windows.\n' +
          'Close running Node/server processes and retry this command.'
      );
    }
    process.exit(result.status ?? 1);
  }
};

const checkTcpPort = (host, port, timeoutMs = 2000) =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
    socket.connect(port, host);
  });

const parseDatabaseUrl = (databaseUrl) => {
  try {
    const parsed = new URL(databaseUrl);
    return {
      host: parsed.hostname || 'localhost',
      port: Number(parsed.port || '5432'),
    };
  } catch {
    return {
      host: 'localhost',
      port: 5432,
    };
  }
};

const dockerAvailable = () => {
  const check = spawnSync('docker', ['info'], {
    stdio: 'ignore',
    cwd: rootDir,
    shell: process.platform === 'win32',
  });
  return check.status === 0;
};

const main = async () => {
  console.log('[backend/dev] Preparing local backend environment...');

  const databaseUrl =
    process.env.DATABASE_URL ||
    readEnvValue('DATABASE_URL') ||
    'postgresql://postgres:password@localhost:5432/cryptosparrow?schema=public';
  const redisUrl = process.env.REDIS_URL || readEnvValue('REDIS_URL') || 'redis://localhost:6379';

  const db = parseDatabaseUrl(databaseUrl);
  const redis = (() => {
    try {
      const parsed = new URL(redisUrl);
      return { host: parsed.hostname || 'localhost', port: Number(parsed.port || '6379') };
    } catch {
      return { host: 'localhost', port: 6379 };
    }
  })();

  let dbReady = await checkTcpPort(db.host, db.port);
  let redisReady = await checkTcpPort(redis.host, redis.port);

  if (!dbReady || !redisReady) {
    console.log('[backend/dev] Database or Redis is not reachable. Trying Docker Compose...');
    if (!dockerAvailable()) {
      console.error(
        '[backend/dev] Docker is required to auto-start postgres/redis but Docker is unavailable.\n' +
          'Start Docker Desktop (or run Postgres/Redis manually), then retry.'
      );
      process.exit(1);
    }
    run('docker', ['compose', 'up', '-d', 'postgres', 'redis']);
    dbReady = await checkTcpPort(db.host, db.port, 5000);
    redisReady = await checkTcpPort(redis.host, redis.port, 5000);
    if (!dbReady || !redisReady) {
      console.error('[backend/dev] Postgres/Redis still unavailable after docker compose up.');
      process.exit(1);
    }
  }

  console.log('[backend/dev] Running Prisma generate...');
  runPrisma(['generate'], { allowEngineLockFallback: true });
  console.log('[backend/dev] Running Prisma migrations...');
  runPrisma(['migrate', 'deploy']);

  console.log('[backend/dev] Starting server in watch mode...');
  const child = spawn('pnpm', ['--filter', 'server', 'dev'], {
    stdio: 'inherit',
    cwd: rootDir,
    shell: process.platform === 'win32',
  });
  child.on('exit', (code) => process.exit(code ?? 0));
};

void main();
