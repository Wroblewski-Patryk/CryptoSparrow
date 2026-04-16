import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type CountRow = { count: number };
type PgIndexRow = { indexname: string };
type PgColumnRow = { table_name: string; column_name: string };

const prisma = new PrismaClient();

const toStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const requiredWalletIdColumns = [
  { table: 'Bot', column: 'walletId' },
  { table: 'Position', column: 'walletId' },
  { table: 'Order', column: 'walletId' },
  { table: 'Trade', column: 'walletId' },
] as const;

const requiredIndexes = [
  'Wallet_userId_idx',
  'Wallet_apiKeyId_idx',
  'Wallet_userId_exchange_marketType_baseCurrency_idx',
  'Bot_walletId_idx',
  'Position_walletId_idx',
  'Order_walletId_idx',
  'Trade_walletId_idx',
] as const;

const requiredConstraints = [
  'Bot_walletId_fkey',
  'Position_walletId_fkey',
  'Order_walletId_fkey',
  'Trade_walletId_fkey',
] as const;

const readCount = async (sql: string) => {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(sql);
  const value = rows[0]?.count;
  return Number.isFinite(value) ? value : 0;
};

const main = async () => {
  const startedAt = new Date().toISOString();

  const totalBots = await prisma.bot.count();
  const totalWallets = await prisma.wallet.count();
  const botsWithoutWallet = await prisma.bot.count({
    where: { walletId: null },
  });

  const orphanBotWalletRefs = await readCount(`
    SELECT COUNT(*)::int AS count
    FROM "Bot" b
    LEFT JOIN "Wallet" w ON w."id" = b."walletId"
    WHERE b."walletId" IS NOT NULL
      AND w."id" IS NULL
  `);

  const orphanPositionWalletRefs = await readCount(`
    SELECT COUNT(*)::int AS count
    FROM "Position" p
    LEFT JOIN "Wallet" w ON w."id" = p."walletId"
    WHERE p."walletId" IS NOT NULL
      AND w."id" IS NULL
  `);

  const orphanOrderWalletRefs = await readCount(`
    SELECT COUNT(*)::int AS count
    FROM "Order" o
    LEFT JOIN "Wallet" w ON w."id" = o."walletId"
    WHERE o."walletId" IS NOT NULL
      AND w."id" IS NULL
  `);

  const orphanTradeWalletRefs = await readCount(`
    SELECT COUNT(*)::int AS count
    FROM "Trade" t
    LEFT JOIN "Wallet" w ON w."id" = t."walletId"
    WHERE t."walletId" IS NOT NULL
      AND w."id" IS NULL
  `);

  const columnRows = await prisma.$queryRaw<PgColumnRow[]>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Bot', 'Position', 'Order', 'Trade')
      AND column_name = 'walletId'
    ORDER BY table_name
  `;

  const indexRows = await prisma.$queryRaw<PgIndexRow[]>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'Wallet_userId_idx',
        'Wallet_apiKeyId_idx',
        'Wallet_userId_exchange_marketType_baseCurrency_idx',
        'Bot_walletId_idx',
        'Position_walletId_idx',
        'Order_walletId_idx',
        'Trade_walletId_idx'
      )
    ORDER BY indexname
  `;

  const constraintRows = await prisma.$queryRaw<{ conname: string }[]>`
    SELECT conname
    FROM pg_constraint
    WHERE conname IN (
      'Bot_walletId_fkey',
      'Position_walletId_fkey',
      'Order_walletId_fkey',
      'Trade_walletId_fkey'
    )
    ORDER BY conname
  `;

  const existingColumns = new Set(columnRows.map((row) => `${row.table_name}.${row.column_name}`));
  const existingIndexes = new Set(indexRows.map((row) => row.indexname));
  const existingConstraints = new Set(constraintRows.map((row) => row.conname));

  const missingColumns = requiredWalletIdColumns
    .map((item) => `${item.table}.${item.column}`)
    .filter((key) => !existingColumns.has(key));
  const missingIndexes = requiredIndexes.filter((name) => !existingIndexes.has(name));
  const missingConstraints = requiredConstraints.filter((name) => !existingConstraints.has(name));

  const walletCoveragePct =
    totalBots === 0 ? 100 : Number((((totalBots - botsWithoutWallet) / totalBots) * 100).toFixed(2));

  const checks = {
    walletModelPresent: totalWallets >= 0,
    walletIdColumnsPresent: missingColumns.length === 0,
    walletIndexesPresent: missingIndexes.length === 0,
    walletForeignKeysPresent: missingConstraints.length === 0,
    botWalletBackfillCoverage: totalBots === 0 || botsWithoutWallet === 0,
    orphanWalletReferences:
      orphanBotWalletRefs === 0 &&
      orphanPositionWalletRefs === 0 &&
      orphanOrderWalletRefs === 0 &&
      orphanTradeWalletRefs === 0,
  };

  const failingChecks = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  const overallStatus = failingChecks.length > 0 ? 'FAIL' : 'PASS';

  const endedAt = new Date().toISOString();
  const stamp = toStamp();
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const operationsDir = path.join(repoRoot, 'docs', 'operations');
  const jsonPath = path.join(operationsDir, `_artifacts-wallet-db-foundation-${stamp}.json`);
  const mdPath = path.join(operationsDir, `wallet-db-foundation-verification-${stamp}.md`);

  const payload = {
    startedAt,
    endedAt,
    migrationId: '20260407121500_add_wallet_module',
    summary: {
      overallStatus,
      failingChecks,
      totalBots,
      totalWallets,
      botsWithoutWallet,
      walletCoveragePct,
      orphanBotWalletRefs,
      orphanPositionWalletRefs,
      orphanOrderWalletRefs,
      orphanTradeWalletRefs,
    },
    checks,
    schema: {
      requiredWalletIdColumns,
      missingColumns,
      requiredIndexes,
      missingIndexes,
      requiredConstraints,
      missingConstraints,
    },
    rollbackNotes: [
      'Primary rollback path: restore database from pre-migration backup/snapshot.',
      'Emergency degrade path: keep schema, disable wallet-first writes at application layer, and pause LIVE bot activation.',
      'Before rollback/degrade, export Bot->walletId mapping and current Wallet rows for incident evidence.',
    ],
  };

  const markdown = `# Wallet DB Foundation Verification

## Context
- Started (UTC): ${startedAt}
- Ended (UTC): ${endedAt}
- Migration: \`20260407121500_add_wallet_module\`
- Status: **${overallStatus}**
- Raw artifact: \`${path.relative(repoRoot, jsonPath)}\`

## Core Checks
- Total bots: ${totalBots}
- Total wallets: ${totalWallets}
- Bots without walletId: ${botsWithoutWallet}
- Bot wallet coverage: ${walletCoveragePct}%
- Orphan refs (Bot/Position/Order/Trade): ${orphanBotWalletRefs}/${orphanPositionWalletRefs}/${orphanOrderWalletRefs}/${orphanTradeWalletRefs}
- Missing walletId columns: ${missingColumns.length ? missingColumns.join(', ') : 'none'}
- Missing indexes: ${missingIndexes.length ? missingIndexes.join(', ') : 'none'}
- Missing FKs: ${missingConstraints.length ? missingConstraints.join(', ') : 'none'}

## Rollback Notes
1. Restore DB from pre-migration backup/snapshot.
2. If restore is not immediately possible, keep schema and disable wallet-first writes at app layer; pause LIVE bot activation.
3. Export \`Bot.id -> walletId\` and \`Wallet\` rows before rollback/degrade for incident traceability.
`;

  await mkdir(operationsDir, { recursive: true });
  await writeFile(jsonPath, JSON.stringify(payload, null, 2));
  await writeFile(mdPath, markdown);

  console.log(`Wallet DB artifact: ${path.relative(repoRoot, jsonPath)}`);
  console.log(`Wallet DB report: ${path.relative(repoRoot, mdPath)}`);
  console.log(`Wallet DB status: ${overallStatus}`);

  if (overallStatus !== 'PASS') {
    process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error(
      '[verifyWalletDbFoundation] failed:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
