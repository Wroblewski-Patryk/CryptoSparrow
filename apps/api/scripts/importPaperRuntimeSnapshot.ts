import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();

type SnapshotPayload = {
  schemaVersion: number;
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
    }>;
    symbolGroups: Array<{
      id: string;
      marketUniverseId: string;
      name: string;
      symbols: string[];
    }>;
    strategies: Array<{
      id: string;
      name: string;
      description: string | null;
      interval: string;
      leverage: number;
      walletRisk: number;
      config: unknown;
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
    }>;
    botStrategies: Array<{
      id: string;
      botId: string;
      strategyId: string;
      symbolGroupId: string;
      isEnabled: boolean;
    }>;
    botMarketGroups: Array<{
      id: string;
      botId: string;
      symbolGroupId: string;
      lifecycleStatus: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
      executionOrder: number;
      maxOpenPositions: number;
      isEnabled: boolean;
    }>;
    marketGroupStrategyLinks: Array<{
      id: string;
      botId: string;
      botMarketGroupId: string;
      strategyId: string;
      priority: number;
      weight: number;
      isEnabled: boolean;
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
    }>;
  };
};

async function ensureUser(email: string) {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return existing.id;

  const password = process.env.SNAPSHOT_USER_PASSWORD ?? 'Admin12#$';
  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      role: 'ADMIN',
    },
    select: { id: true },
  });
  return created.id;
}

async function main() {
  const inputPath =
    process.env.SNAPSHOT_INPUT ??
    path.resolve(process.cwd(), 'prisma', 'snapshots', 'paper-runtime-snapshot.json');

  const raw = await readFile(inputPath, 'utf8');
  const snapshot = JSON.parse(raw) as SnapshotPayload;

  if (snapshot.schemaVersion !== 1) {
    throw new Error(`UNSUPPORTED_SNAPSHOT_SCHEMA_VERSION: ${snapshot.schemaVersion}`);
  }

  const userId = await ensureUser(snapshot.source.email);

  const botIds = snapshot.data.bots.map((item) => item.id);

  await prisma.$transaction(async (tx) => {
    if (botIds.length > 0) {
      await tx.marketGroupStrategyLink.deleteMany({
        where: {
          userId,
          botId: { in: botIds },
        },
      });
      await tx.botStrategy.deleteMany({
        where: {
          botId: { in: botIds },
        },
      });
      await tx.botMarketGroup.deleteMany({
        where: {
          userId,
          botId: { in: botIds },
        },
      });
      await tx.position.deleteMany({
        where: {
          userId,
          botId: { in: botIds },
          status: 'OPEN',
        },
      });
    }

    for (const item of snapshot.data.marketUniverses) {
      await tx.marketUniverse.upsert({
        where: { id: item.id },
        update: {
          userId,
          name: item.name,
          marketType: item.marketType,
          baseCurrency: item.baseCurrency,
          filterRules: item.filterRules,
          whitelist: item.whitelist,
          blacklist: item.blacklist,
          autoExcludeRules: item.autoExcludeRules,
        },
        create: {
          id: item.id,
          userId,
          name: item.name,
          marketType: item.marketType,
          baseCurrency: item.baseCurrency,
          filterRules: item.filterRules,
          whitelist: item.whitelist,
          blacklist: item.blacklist,
          autoExcludeRules: item.autoExcludeRules,
        },
      });
    }

    for (const item of snapshot.data.symbolGroups) {
      await tx.symbolGroup.upsert({
        where: { id: item.id },
        update: {
          userId,
          marketUniverseId: item.marketUniverseId,
          name: item.name,
          symbols: item.symbols,
        },
        create: {
          id: item.id,
          userId,
          marketUniverseId: item.marketUniverseId,
          name: item.name,
          symbols: item.symbols,
        },
      });
    }

    for (const item of snapshot.data.strategies) {
      await tx.strategy.upsert({
        where: { id: item.id },
        update: {
          userId,
          name: item.name,
          description: item.description,
          interval: item.interval,
          leverage: item.leverage,
          walletRisk: item.walletRisk,
          config: item.config,
        },
        create: {
          id: item.id,
          userId,
          name: item.name,
          description: item.description,
          interval: item.interval,
          leverage: item.leverage,
          walletRisk: item.walletRisk,
          config: item.config,
        },
      });
    }

    for (const item of snapshot.data.bots) {
      await tx.bot.upsert({
        where: { id: item.id },
        update: {
          userId,
          name: item.name,
          mode: item.mode,
          paperStartBalance: item.paperStartBalance,
          marketType: item.marketType,
          positionMode: item.positionMode,
          isActive: item.isActive,
          liveOptIn: item.liveOptIn,
          consentTextVersion: item.consentTextVersion,
          maxOpenPositions: item.maxOpenPositions,
        },
        create: {
          id: item.id,
          userId,
          name: item.name,
          mode: item.mode,
          paperStartBalance: item.paperStartBalance,
          marketType: item.marketType,
          positionMode: item.positionMode,
          isActive: item.isActive,
          liveOptIn: item.liveOptIn,
          consentTextVersion: item.consentTextVersion,
          maxOpenPositions: item.maxOpenPositions,
        },
      });
    }

    for (const item of snapshot.data.botMarketGroups) {
      await tx.botMarketGroup.upsert({
        where: { id: item.id },
        update: {
          userId,
          botId: item.botId,
          symbolGroupId: item.symbolGroupId,
          lifecycleStatus: item.lifecycleStatus,
          executionOrder: item.executionOrder,
          maxOpenPositions: item.maxOpenPositions,
          isEnabled: item.isEnabled,
        },
        create: {
          id: item.id,
          userId,
          botId: item.botId,
          symbolGroupId: item.symbolGroupId,
          lifecycleStatus: item.lifecycleStatus,
          executionOrder: item.executionOrder,
          maxOpenPositions: item.maxOpenPositions,
          isEnabled: item.isEnabled,
        },
      });
    }

    for (const item of snapshot.data.botStrategies) {
      await tx.botStrategy.upsert({
        where: { id: item.id },
        update: {
          botId: item.botId,
          strategyId: item.strategyId,
          symbolGroupId: item.symbolGroupId,
          isEnabled: item.isEnabled,
        },
        create: {
          id: item.id,
          botId: item.botId,
          strategyId: item.strategyId,
          symbolGroupId: item.symbolGroupId,
          isEnabled: item.isEnabled,
        },
      });
    }

    for (const item of snapshot.data.marketGroupStrategyLinks) {
      await tx.marketGroupStrategyLink.upsert({
        where: { id: item.id },
        update: {
          userId,
          botId: item.botId,
          botMarketGroupId: item.botMarketGroupId,
          strategyId: item.strategyId,
          priority: item.priority,
          weight: item.weight,
          isEnabled: item.isEnabled,
        },
        create: {
          id: item.id,
          userId,
          botId: item.botId,
          botMarketGroupId: item.botMarketGroupId,
          strategyId: item.strategyId,
          priority: item.priority,
          weight: item.weight,
          isEnabled: item.isEnabled,
        },
      });
    }

    for (const item of snapshot.data.openPositions) {
      await tx.position.upsert({
        where: { id: item.id },
        update: {
          userId,
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
          openedAt: new Date(item.openedAt),
          closedAt: item.closedAt ? new Date(item.closedAt) : null,
          realizedPnl: item.realizedPnl,
          unrealizedPnl: item.unrealizedPnl,
        },
        create: {
          id: item.id,
          userId,
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
          openedAt: new Date(item.openedAt),
          closedAt: item.closedAt ? new Date(item.closedAt) : null,
          realizedPnl: item.realizedPnl,
          unrealizedPnl: item.unrealizedPnl,
        },
      });
    }
  });

  console.log(`Snapshot imported for ${snapshot.source.email}`);
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

