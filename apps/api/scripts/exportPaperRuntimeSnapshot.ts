import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();

type SnapshotPayload = {
  schemaVersion: 1;
  exportedAt: string;
  source: {
    email: string;
  };
  data: {
    marketUniverses: Array<{
      id: string;
      name: string;
      marketType: 'FUTURES' | 'SPOT';
      baseCurrency: string;
      filterRules: unknown;
      whitelist: string[];
      blacklist: string[];
      autoExcludeRules: unknown;
      createdAt: string;
      updatedAt: string;
    }>;
    symbolGroups: Array<{
      id: string;
      marketUniverseId: string;
      name: string;
      symbols: string[];
      createdAt: string;
      updatedAt: string;
    }>;
    strategies: Array<{
      id: string;
      name: string;
      description: string | null;
      interval: string;
      leverage: number;
      walletRisk: number;
      config: unknown;
      createdAt: string;
      updatedAt: string;
    }>;
    bots: Array<{
      id: string;
      name: string;
      mode: 'PAPER' | 'LIVE';
      paperStartBalance: number;
      marketType: 'FUTURES' | 'SPOT';
      positionMode: 'ONE_WAY' | 'HEDGE';
      isActive: boolean;
      liveOptIn: boolean;
      consentTextVersion: string | null;
      maxOpenPositions: number;
      createdAt: string;
      updatedAt: string;
    }>;
    botStrategies: Array<{
      id: string;
      botId: string;
      strategyId: string;
      symbolGroupId: string;
      isEnabled: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    botMarketGroups: Array<{
      id: string;
      botId: string;
      symbolGroupId: string;
      lifecycleStatus: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
      executionOrder: number;
      maxOpenPositions: number;
      isEnabled: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    marketGroupStrategyLinks: Array<{
      id: string;
      botId: string;
      botMarketGroupId: string;
      strategyId: string;
      priority: number;
      weight: number;
      isEnabled: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    openPositions: Array<{
      id: string;
      botId: string | null;
      strategyId: string | null;
      externalId: string | null;
      origin: 'BOT' | 'MANUAL' | 'SYNC';
      managementMode: 'BOT_MANAGED' | 'MANUAL_MANAGED' | 'EXTERNAL_MANAGED';
      syncState: 'IN_SYNC' | 'PENDING_SYNC' | 'SYNC_ERROR' | 'REMOTE_ONLY';
      symbol: string;
      side: 'LONG' | 'SHORT';
      status: 'OPEN' | 'CLOSED';
      entryPrice: number;
      quantity: number;
      leverage: number;
      stopLoss: number | null;
      takeProfit: number | null;
      openedAt: string;
      closedAt: string | null;
      realizedPnl: number | null;
      unrealizedPnl: number | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

const toIso = (value: Date) => value.toISOString();

async function main() {
  const email = process.env.SNAPSHOT_EMAIL ?? 'wroblewskipatryk@gmail.com';
  const outputPath =
    process.env.SNAPSHOT_OUTPUT ??
    path.resolve(process.cwd(), 'prisma', 'snapshots', 'paper-runtime-snapshot.json');

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new Error(`SNAPSHOT_USER_NOT_FOUND: ${email}`);
  }

  const [
    marketUniverses,
    symbolGroups,
    strategies,
    bots,
    botStrategies,
    botMarketGroups,
    marketGroupStrategyLinks,
    openPositions,
  ] = await Promise.all([
    prisma.marketUniverse.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.symbolGroup.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.strategy.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.bot.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.botStrategy.findMany({
      where: {
        bot: {
          userId: user.id,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.botMarketGroup.findMany({
      where: { userId: user.id },
      orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.marketGroupStrategyLink.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.position.findMany({
      where: {
        userId: user.id,
        status: 'OPEN',
      },
      orderBy: [{ openedAt: 'asc' }],
    }),
  ]);

  const snapshot: SnapshotPayload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    source: { email: user.email },
    data: {
      marketUniverses: marketUniverses.map((item) => ({
        id: item.id,
        name: item.name,
        marketType: item.marketType,
        baseCurrency: item.baseCurrency,
        filterRules: item.filterRules,
        whitelist: item.whitelist,
        blacklist: item.blacklist,
        autoExcludeRules: item.autoExcludeRules,
        createdAt: toIso(item.createdAt),
        updatedAt: toIso(item.updatedAt),
      })),
      symbolGroups: symbolGroups.map((item) => ({
        id: item.id,
        marketUniverseId: item.marketUniverseId,
        name: item.name,
        symbols: item.symbols,
        createdAt: toIso(item.createdAt),
        updatedAt: toIso(item.updatedAt),
      })),
      strategies: strategies.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        interval: item.interval,
        leverage: item.leverage,
        walletRisk: item.walletRisk,
        config: item.config,
        createdAt: toIso(item.createdAt),
        updatedAt: toIso(item.updatedAt),
      })),
      bots: bots.map((item) => ({
        id: item.id,
        name: item.name,
        mode: item.mode,
        paperStartBalance: item.paperStartBalance,
        marketType: item.marketType,
        positionMode: item.positionMode,
        isActive: item.isActive,
        liveOptIn: item.liveOptIn,
        consentTextVersion: item.consentTextVersion,
        maxOpenPositions: item.maxOpenPositions,
        createdAt: toIso(item.createdAt),
        updatedAt: toIso(item.updatedAt),
      })),
      botStrategies: botStrategies.map((item) => ({
        id: item.id,
        botId: item.botId,
        strategyId: item.strategyId,
        symbolGroupId: item.symbolGroupId,
        isEnabled: item.isEnabled,
        createdAt: toIso(item.createdAt),
        updatedAt: toIso(item.updatedAt),
      })),
      botMarketGroups: botMarketGroups.map((item) => ({
        id: item.id,
        botId: item.botId,
        symbolGroupId: item.symbolGroupId,
        lifecycleStatus: item.lifecycleStatus,
        executionOrder: item.executionOrder,
        maxOpenPositions: item.maxOpenPositions,
        isEnabled: item.isEnabled,
        createdAt: toIso(item.createdAt),
        updatedAt: toIso(item.updatedAt),
      })),
      marketGroupStrategyLinks: marketGroupStrategyLinks.map((item) => ({
        id: item.id,
        botId: item.botId,
        botMarketGroupId: item.botMarketGroupId,
        strategyId: item.strategyId,
        priority: item.priority,
        weight: item.weight,
        isEnabled: item.isEnabled,
        createdAt: toIso(item.createdAt),
        updatedAt: toIso(item.updatedAt),
      })),
      openPositions: openPositions.map((item) => ({
        id: item.id,
        botId: item.botId,
        strategyId: item.strategyId,
        externalId: item.externalId,
        origin: item.origin,
        managementMode: item.managementMode,
        syncState: item.syncState,
        symbol: item.symbol,
        side: item.side,
        status: item.status,
        entryPrice: item.entryPrice,
        quantity: item.quantity,
        leverage: item.leverage,
        stopLoss: item.stopLoss,
        takeProfit: item.takeProfit,
        openedAt: toIso(item.openedAt),
        closedAt: item.closedAt ? toIso(item.closedAt) : null,
        realizedPnl: item.realizedPnl,
        unrealizedPnl: item.unrealizedPnl,
        createdAt: toIso(item.createdAt),
        updatedAt: toIso(item.updatedAt),
      })),
    },
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`Snapshot saved: ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        marketUniverses: snapshot.data.marketUniverses.length,
        symbolGroups: snapshot.data.symbolGroups.length,
        strategies: snapshot.data.strategies.length,
        bots: snapshot.data.bots.length,
        botStrategies: snapshot.data.botStrategies.length,
        botMarketGroups: snapshot.data.botMarketGroups.length,
        marketGroupStrategyLinks: snapshot.data.marketGroupStrategyLinks.length,
        openPositions: snapshot.data.openPositions.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

