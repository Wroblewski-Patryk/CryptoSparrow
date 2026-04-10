#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const PROFILE_CONFIG = {
  local: {
    envContainers: ['DB_CHECK_CONTAINER'],
    envUsers: ['DB_CHECK_USER'],
    envNames: ['DB_CHECK_NAME'],
  },
  stage: {
    envContainers: ['STAGE_DB_CHECK_CONTAINER'],
    envUsers: ['STAGE_DB_CHECK_USER'],
    envNames: ['STAGE_DB_CHECK_NAME'],
  },
  prod: {
    envContainers: ['PROD_DB_CHECK_CONTAINER', 'PRODUCTION_DB_CHECK_CONTAINER'],
    envUsers: ['PROD_DB_CHECK_USER', 'PRODUCTION_DB_CHECK_USER'],
    envNames: ['PROD_DB_CHECK_NAME', 'PRODUCTION_DB_CHECK_NAME'],
  },
};

const firstNonEmptyEnv = (keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return '';
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    profile: 'local',
    container: '',
    dbUser: '',
    dbName: '',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--profile') options.profile = (args[index + 1] ?? options.profile).toLowerCase();
    if (arg === '--container') options.container = args[index + 1] ?? options.container;
    if (arg === '--db-user') options.dbUser = args[index + 1] ?? options.dbUser;
    if (arg === '--db-name') options.dbName = args[index + 1] ?? options.dbName;
  }

  return options;
};

const printUsage = () => {
  console.log(
    'Usage: node scripts/runBackupVerificationProfile.mjs [--profile <local|stage|prod>] [--container <name>] [--db-user <user>] [--db-name <name>]'
  );
};

const run = (command, args) =>
  spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

const resolveOptions = (input) => {
  const profileConfig = PROFILE_CONFIG[input.profile];
  if (!profileConfig) {
    throw new Error(`Unsupported profile: ${input.profile}. Expected one of: local, stage, prod.`);
  }

  const container = input.container || firstNonEmptyEnv(profileConfig.envContainers) || '';
  const dbUser = input.dbUser || firstNonEmptyEnv(profileConfig.envUsers) || 'postgres';
  const dbName = input.dbName || firstNonEmptyEnv(profileConfig.envNames) || 'cryptosparrow';

  if (input.profile !== 'local' && !container) {
    throw new Error(
      `Missing container for profile "${input.profile}". Set --container or one of: ${profileConfig.envContainers.join(', ')}.`
    );
  }

  return {
    profile: input.profile,
    container,
    dbUser,
    dbName,
  };
};

const main = () => {
  const options = parseArgs();
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const resolved = resolveOptions(options);

  const scriptArgs = ['scripts/verifyLocalBackupRestore.mjs'];
  if (resolved.container) scriptArgs.push('--container', resolved.container);
  if (resolved.dbUser) scriptArgs.push('--db-user', resolved.dbUser);
  if (resolved.dbName) scriptArgs.push('--db-name', resolved.dbName);

  console.log(
    `[ops:db:backup-verify] profile=${resolved.profile} container=${resolved.container || 'auto-detect'} db=${resolved.dbName} user=${resolved.dbUser}`
  );
  const result = run('node', scriptArgs);
  if (result.status !== 0) {
    throw new Error(`[ops:db:backup-verify] profile=${resolved.profile} failed.`);
  }
  console.log(`[ops:db:backup-verify] profile=${resolved.profile} PASS`);
};

try {
  main();
} catch (error) {
  console.error(
    '[ops:db:backup-verify] failed:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
}
