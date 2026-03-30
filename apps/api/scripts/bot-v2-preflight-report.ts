import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/prisma/client';

type CliOptions = {
  help: boolean;
  stdoutOnly: boolean;
  outputDir: string | null;
};

type LegacyBindingRow = {
  botStrategyId: string;
  botId: string;
  botName: string;
  botMode: 'PAPER' | 'LIVE' | 'LOCAL';
  userId: string;
  strategyId: string;
  strategyName: string;
  symbolGroupId: string;
  symbolGroupName: string;
  createdAt: string;
  mappedToBotMarketGroup: boolean;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    help: false,
    stdoutOnly: false,
    outputDir: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--stdout-only') {
      options.stdoutOnly = true;
      continue;
    }
    if (arg === '--output-dir') {
      options.outputDir = args[i + 1] ?? null;
      i += 1;
    }
  }

  return options;
};

const nowStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const buildArtifactDir = (outputDirArg: string | null) => {
  if (outputDirArg) return path.resolve(process.cwd(), outputDirArg);
  return path.resolve(process.cwd(), '..', '..', 'docs', 'operations');
};

const toIso = (value: Date) => value.toISOString();

const renderMarkdown = (report: {
  generatedAt: string;
  totals: {
    bots: number;
    localModeBots: number;
    legacyBotStrategies: number;
    legacyMapped: number;
    legacyUnmapped: number;
  };
  migrationReady: boolean;
  localBots: Array<{
    botId: string;
    name: string;
    userId: string;
    isActive: boolean;
    createdAt: string;
  }>;
  unmappedLegacyBindings: LegacyBindingRow[];
}) => {
  const localRows =
    report.localBots.length === 0
      ? '| none |'
      : report.localBots
          .map(
            (item) =>
              `| ${item.botId} | ${item.name} | ${item.userId} | ${item.isActive} | ${item.createdAt} |`
          )
          .join('\n');

  const unmappedRows =
    report.unmappedLegacyBindings.length === 0
      ? '| none |'
      : report.unmappedLegacyBindings
          .map(
            (item) =>
              `| ${item.botStrategyId} | ${item.botName} | ${item.botMode} | ${item.strategyName} | ${item.symbolGroupName} | ${item.userId} | ${item.createdAt} |`
          )
          .join('\n');

  return `# Bot V2 Preflight Report

Generated (UTC): ${report.generatedAt}

## Summary
- Total bots: ${report.totals.bots}
- Bots in LOCAL mode: ${report.totals.localModeBots}
- Legacy BotStrategy bindings: ${report.totals.legacyBotStrategies}
- Legacy mapped to BotMarketGroup/StrategyLink: ${report.totals.legacyMapped}
- Legacy unmapped bindings: ${report.totals.legacyUnmapped}
- Migration ready for LOCAL removal: ${report.migrationReady ? 'yes' : 'no'}

## LOCAL bots
| Bot ID | Name | User ID | Active | Created (UTC) |
| --- | --- | --- | --- | --- |
${localRows}

## Unmapped legacy BotStrategy bindings
| BotStrategy ID | Bot | Mode | Strategy | Symbol group | User ID | Created (UTC) |
| --- | --- | --- | --- | --- | --- | --- |
${unmappedRows}
`;
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log(
      'Usage: pnpm --filter api exec tsx scripts/bot-v2-preflight-report.ts [--stdout-only] [--output-dir <relative-path>]'
    );
    return;
  }

  const [totalBots, localBotsRaw, botStrategies, strategyLinks] = await Promise.all([
    prisma.bot.count(),
    prisma.bot.findMany({
      where: { mode: 'LOCAL' },
      select: {
        id: true,
        name: true,
        userId: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.botStrategy.findMany({
      select: {
        id: true,
        botId: true,
        strategyId: true,
        symbolGroupId: true,
        createdAt: true,
        bot: {
          select: {
            name: true,
            mode: true,
            userId: true,
          },
        },
        strategy: {
          select: {
            name: true,
          },
        },
        symbolGroup: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.marketGroupStrategyLink.findMany({
      select: {
        botId: true,
        strategyId: true,
        botMarketGroup: {
          select: {
            symbolGroupId: true,
          },
        },
      },
    }),
  ]);

  const mappedKeys = new Set(
    strategyLinks.map((item) => `${item.botId}:${item.strategyId}:${item.botMarketGroup.symbolGroupId}`)
  );

  const legacyRows: LegacyBindingRow[] = botStrategies.map((item) => {
    const key = `${item.botId}:${item.strategyId}:${item.symbolGroupId}`;
    const mappedToBotMarketGroup = mappedKeys.has(key);

    return {
      botStrategyId: item.id,
      botId: item.botId,
      botName: item.bot.name,
      botMode: item.bot.mode,
      userId: item.bot.userId,
      strategyId: item.strategyId,
      strategyName: item.strategy.name,
      symbolGroupId: item.symbolGroupId,
      symbolGroupName: item.symbolGroup.name,
      createdAt: toIso(item.createdAt),
      mappedToBotMarketGroup,
    };
  });

  const unmappedLegacyBindings = legacyRows.filter((item) => !item.mappedToBotMarketGroup);
  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      bots: totalBots,
      localModeBots: localBotsRaw.length,
      legacyBotStrategies: legacyRows.length,
      legacyMapped: legacyRows.length - unmappedLegacyBindings.length,
      legacyUnmapped: unmappedLegacyBindings.length,
    },
    migrationReady: localBotsRaw.length === 0 && unmappedLegacyBindings.length === 0,
    localBots: localBotsRaw.map((item) => ({
      botId: item.id,
      name: item.name,
      userId: item.userId,
      isActive: item.isActive,
      createdAt: toIso(item.createdAt),
    })),
    unmappedLegacyBindings,
  };

  if (options.stdoutOnly) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const artifactsDir = buildArtifactDir(options.outputDir);
  const stamp = nowStamp();
  const jsonPath = path.join(artifactsDir, `bot-v2-preflight-${stamp}.json`);
  const mdPath = path.join(artifactsDir, `bot-v2-preflight-${stamp}.md`);

  await mkdir(artifactsDir, { recursive: true });
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await writeFile(mdPath, renderMarkdown(report), 'utf8');

  console.log(`Bot V2 preflight JSON: ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`Bot V2 preflight report: ${path.relative(process.cwd(), mdPath)}`);
};

main()
  .catch((error) => {
    console.error('[bot-v2-preflight] failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
