#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    container: process.env.DB_CHECK_CONTAINER ?? '',
    dbUser: process.env.DB_CHECK_USER ?? 'postgres',
    dbName: process.env.DB_CHECK_NAME ?? 'cryptosparrow',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--container') options.container = args[index + 1] ?? options.container;
    if (arg === '--db-user') options.dbUser = args[index + 1] ?? options.dbUser;
    if (arg === '--db-name') options.dbName = args[index + 1] ?? options.dbName;
  }

  return options;
};

const run = (command, args) =>
  execFileSync(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim();

const nowStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const detectPostgresContainer = () => {
  const rows = run('docker', ['ps', '--format', '{{.Names}}']).split(/\r?\n/).filter(Boolean);
  const prioritized = rows.find((name) => name.includes('cryptosparrow-postgres'));
  if (prioritized) return prioritized;
  const postgresLike = rows.find((name) => name.includes('postgres'));
  return postgresLike ?? null;
};

const dockerExecSh = (container, script) => run('docker', ['exec', container, 'sh', '-lc', script]);

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log('Usage: node scripts/verifyLocalBackupRestore.mjs [--container <name>] [--db-user <user>] [--db-name <name>]');
    process.exit(0);
  }

  const container = options.container || detectPostgresContainer();
  if (!container) {
    throw new Error('Cannot detect postgres container. Start Docker and pass --container <name>.');
  }

  const stamp = nowStamp();
  const restoreDb = `${options.dbName}_restore_check_${stamp.slice(0, 16).replace(/-/g, '').toLowerCase()}`;
  const backupPath = `/tmp/${options.dbName}_backup_${stamp}.dump`;

  const operationsDir = path.resolve(process.cwd(), 'docs', 'operations');
  await mkdir(operationsDir, { recursive: true });
  const artifactTxt = path.join(operationsDir, `_artifacts-db-restore-check-${stamp}.txt`);
  const reportMd = path.join(operationsDir, `v1-db-restore-check-${stamp}.md`);

  const lines = [];
  const push = (line) => lines.push(line);
  push(`Container: ${container}`);
  push(`DB user: ${options.dbUser}`);
  push(`Primary DB: ${options.dbName}`);
  push(`Restore DB: ${restoreDb}`);
  push('');

  try {
    push('[1/6] Creating compressed backup with pg_dump');
    dockerExecSh(container, `pg_dump -U ${options.dbUser} -d ${options.dbName} -Fc -f ${backupPath}`);
    push(`Backup created: ${backupPath}`);
    push('');

    push('[2/6] Recreating restore database');
    dockerExecSh(
      container,
      `psql -U ${options.dbUser} -d postgres -c "DROP DATABASE IF EXISTS \\"${restoreDb}\\";" && psql -U ${options.dbUser} -d postgres -c "CREATE DATABASE \\"${restoreDb}\\";"`
    );
    push('Restore database created.');
    push('');

    push('[3/6] Restoring backup into restore database');
    dockerExecSh(container, `pg_restore -U ${options.dbUser} -d ${restoreDb} ${backupPath}`);
    push('Restore completed.');
    push('');

    push('[4/6] Running key table validation counts');
    const counts = dockerExecSh(
      container,
      `psql -U ${options.dbUser} -d ${restoreDb} -t -A -F"," -c "SELECT 'User', count(*) FROM \\"User\\" UNION ALL SELECT 'Bot', count(*) FROM \\"Bot\\" UNION ALL SELECT 'Order', count(*) FROM \\"Order\\" UNION ALL SELECT 'Position', count(*) FROM \\"Position\\" UNION ALL SELECT 'Log', count(*) FROM \\"Log\\";"`
    );
    push('Validation counts (table,count):');
    push(counts || '(no rows)');
    push('');

    push('[5/6] Cleaning restore database');
    dockerExecSh(container, `psql -U ${options.dbUser} -d postgres -c "DROP DATABASE IF EXISTS \\"${restoreDb}\\";"`);
    push('Restore database dropped.');
    push('');

    push('[6/6] Cleaning backup artifact inside container');
    dockerExecSh(container, `rm -f ${backupPath}`);
    push('Temporary backup file removed.');
    push('');
    push('RESULT: PASS');
  } catch (error) {
    push('');
    push(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    push('RESULT: FAIL');
    try {
      dockerExecSh(container, `psql -U ${options.dbUser} -d postgres -c "DROP DATABASE IF EXISTS \\"${restoreDb}\\";"`);
    } catch {
      // best-effort cleanup
    }
    try {
      dockerExecSh(container, `rm -f ${backupPath}`);
    } catch {
      // best-effort cleanup
    }
  }

  const content = lines.join('\n');
  await writeFile(artifactTxt, content);

  const markdown = `# V1 DB Backup/Restore Check (${stamp.slice(0, 10)})

- Generated at (UTC): ${new Date().toISOString()}
- Container: \`${container}\`
- DB user: \`${options.dbUser}\`
- DB name: \`${options.dbName}\`
- Raw artifact: \`${path.relative(process.cwd(), artifactTxt)}\`

\`\`\`text
${content}
\`\`\`
`;

  await writeFile(reportMd, markdown);

  const isPass = content.includes('RESULT: PASS');
  console.log(`DB restore artifact: ${path.relative(process.cwd(), artifactTxt)}`);
  console.log(`DB restore report: ${path.relative(process.cwd(), reportMd)}`);
  if (!isPass) process.exit(1);
};

main().catch((error) => {
  console.error('[ops:db:backup-restore:check-local] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});

