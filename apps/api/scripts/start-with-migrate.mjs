import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const shouldRunMigrations = process.env.API_AUTO_MIGRATE !== 'false';

const runMigrations = () => {
  if (!shouldRunMigrations) {
    console.log('[api/start] API_AUTO_MIGRATE=false, skipping prisma migrate deploy');
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error('[api/start] DATABASE_URL is required when API_AUTO_MIGRATE is enabled');
    process.exit(1);
  }

  const prismaCliCandidates = [
    resolve(process.cwd(), 'node_modules/prisma/build/index.js'),
    resolve(process.cwd(), '../../node_modules/prisma/build/index.js'),
  ];
  const prismaCliPath = prismaCliCandidates.find((candidate) => existsSync(candidate));
  const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');

  if (!prismaCliPath) {
    console.error('[api/start] Prisma CLI not found in node_modules; cannot run migrations');
    process.exit(1);
  }

  console.log('[api/start] Running prisma migrate deploy...');
  const migrate = spawnSync(
    process.execPath,
    [prismaCliPath, 'migrate', 'deploy', '--schema', schemaPath],
    {
      stdio: 'inherit',
      env: process.env,
    }
  );

  if (migrate.status !== 0) {
    console.error(`[api/start] prisma migrate deploy failed with code ${migrate.status ?? 1}`);
    process.exit(migrate.status ?? 1);
  }

  console.log('[api/start] prisma migrate deploy finished successfully');
};

const startApi = () => {
  console.log('[api/start] Starting API server...');
  const api = spawn(process.execPath, ['dist/index.js'], {
    stdio: 'inherit',
    env: process.env,
  });

  const forwardSignal = (signal) => {
    if (!api.killed) {
      api.kill(signal);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  api.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
};

runMigrations();
startApi();
