#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const PROFILE_CONFIG = {
  local: {
    envContainer: 'DB_CHECK_CONTAINER',
    envUser: 'DB_CHECK_USER',
    envName: 'DB_CHECK_NAME',
  },
  stage: {
    envContainer: 'STAGE_DB_CHECK_CONTAINER',
    envUser: 'STAGE_DB_CHECK_USER',
    envName: 'STAGE_DB_CHECK_NAME',
  },
  prod: {
    envContainer: 'PROD_DB_CHECK_CONTAINER',
    envUser: 'PROD_DB_CHECK_USER',
    envName: 'PROD_DB_CHECK_NAME',
  },
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

  const container = input.container || process.env[profileConfig.envContainer] || '';
  const dbUser = input.dbUser || process.env[profileConfig.envUser] || 'postgres';
  const dbName = input.dbName || process.env[profileConfig.envName] || 'cryptosparrow';

  if (input.profile !== 'local' && !container) {
    throw new Error(
      `Missing container for profile "${input.profile}". Set --container or ${profileConfig.envContainer}.`
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
