import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { ensureSubscriptionCatalog, OWNER_ACCOUNT_EMAIL, setActiveSubscriptionForUser } from '../src/modules/subscriptions/subscriptions.service';

const prisma = new PrismaClient();

const MARKET_UNIVERSE_SEED = [
  {
    name: 'Ulubione',
    exchange: 'BINANCE' as const,
    marketType: 'FUTURES' as const,
    baseCurrency: 'USDT',
    filterRules: {
      minQuoteVolumeEnabled: true,
      minQuoteVolume24h: 239_150_000,
    },
    whitelist: [
      'BTCUSDT',
      'DOGEUSDT',
      'EDGEUSDT',
      'ETHUSDT',
      'PIPPINUSDT',
      'SIRENUSDT',
      'SOLUSDT',
      'STOUSDT',
      'XRPUSDT',
      'ZECUSDT',
    ] as string[],
    blacklist: [] as string[],
    autoExcludeRules: null,
  },
];

const SYMBOL_GROUP_SEED = [
  {
    marketUniverseName: 'Ulubione',
    name: 'Ulubione Group',
    symbols: [
      'BTCUSDT',
      'DOGEUSDT',
      'EDGEUSDT',
      'ETHUSDT',
      'PIPPINUSDT',
      'SIRENUSDT',
      'SOLUSDT',
      'STOUSDT',
      'XRPUSDT',
      'ZECUSDT',
    ] as string[],
  },
];

const STRATEGY_SEED = [
  {
    name: 'Test RSI',
    description: 'Seed strategy pod szybki start backtestu na grupie rynkow futures.',
    interval: '5m',
    leverage: 25,
    walletRisk: 2.5,
    config: {
      open: {
        direction: 'both',
        indicatorsLong: [
          {
            group: 'Analiza techniczna',
            name: 'RSI',
            params: { period: 14 },
            condition: '>',
            value: 55,
            weight: 1,
            expanded: true,
          },
        ],
        indicatorsShort: [
          {
            group: 'Analiza techniczna',
            name: 'RSI',
            params: { period: 14 },
            condition: '<',
            value: 45,
            weight: 1,
            expanded: true,
          },
        ],
      },
      close: {
        mode: 'advanced',
        tp: 2.8,
        sl: 1.4,
        ttp: [
          { percent: 5, arm: 2.5 },
          { percent: 10, arm: 5 },
          { percent: 20, arm: 10 },
          { percent: 40, arm: 20 },
        ],
        tsl: [{ percent: -25, arm: 10 }],
      },
      additional: {
        dcaEnabled: true,
        dcaMode: 'advanced',
        dcaTimes: 3,
        dcaMultiplier: 1.5,
        dcaLevels: [
          { percent: -10, multiplier: 1 },
          { percent: -20, multiplier: 1 },
          { percent: -30, multiplier: 1 },
        ],
        maxPositions: 10,
        maxOrders: 10,
        positionLifetime: 2,
        positionUnit: 'd',
        orderLifetime: 8,
        orderUnit: 'h',
        marginMode: 'ISOLATED',
      },
    },
  },
];

const BOT_SEED = [
  {
    name: 'Test Bot',
    mode: 'PAPER' as const,
    paperStartBalance: 10000,
    exchange: 'BINANCE' as const,
    marketType: 'FUTURES' as const,
    positionMode: 'ONE_WAY' as const,
    isActive: true,
    liveOptIn: false,
    maxOpenPositions: 1,
    marketGroups: [
      {
        symbolGroupName: 'Ulubione Group',
        lifecycleStatus: 'ACTIVE' as const,
        executionOrder: 100,
        maxOpenPositions: 1,
        isEnabled: true,
        strategyLinks: [
          {
            strategyName: 'Test RSI',
            priority: 100,
            weight: 1,
            isEnabled: true,
          },
        ],
      },
    ],
  },
];

async function main() {
  const password = await bcrypt.hash('Admin12#$', 10);

  await ensureSubscriptionCatalog(prisma, { seedDefaults: true });

  const user = await prisma.user.upsert({
    where: { email: OWNER_ACCOUNT_EMAIL },
    update: {},
    create: {
      email: OWNER_ACCOUNT_EMAIL,
      password,
      role: 'ADMIN',
    },
    select: { id: true },
  });

  await setActiveSubscriptionForUser(prisma, {
    userId: user.id,
    planCode: 'PROFESSIONAL',
    source: 'ADMIN_OVERRIDE',
    autoRenew: false,
    metadata: {
      reason: 'seed_owner_bootstrap',
      updatedBy: 'seed',
    },
  });

  const marketUniverseIds = new Map<string, string>();
  for (const universe of MARKET_UNIVERSE_SEED) {
    const existing = await prisma.marketUniverse.findFirst({
      where: {
        userId: user.id,
        name: universe.name,
        exchange: universe.exchange,
        marketType: universe.marketType,
        baseCurrency: universe.baseCurrency,
      },
      select: { id: true },
    });

    const key = `${universe.name}|${universe.exchange}|${universe.marketType}|${universe.baseCurrency}`;

    if (existing) {
      const updated = await prisma.marketUniverse.update({
        where: { id: existing.id },
        data: universe,
      });
      marketUniverseIds.set(key, updated.id);
    } else {
      const created = await prisma.marketUniverse.create({
        data: {
          userId: user.id,
          ...universe,
        },
      });
      marketUniverseIds.set(key, created.id);
    }
  }

  const symbolGroupIds = new Map<string, string>();
  for (const symbolGroup of SYMBOL_GROUP_SEED) {
    const universe = MARKET_UNIVERSE_SEED.find((item) => item.name === symbolGroup.marketUniverseName);
    if (!universe) {
      continue;
    }
    const universeKey = `${universe.name}|${universe.exchange}|${universe.marketType}|${universe.baseCurrency}`;
    const marketUniverseId = marketUniverseIds.get(universeKey);
    if (!marketUniverseId) {
      continue;
    }

    const existing = await prisma.symbolGroup.findFirst({
      where: {
        userId: user.id,
        marketUniverseId,
        name: symbolGroup.name,
      },
      select: { id: true },
    });

    if (existing) {
      const updated = await prisma.symbolGroup.update({
        where: { id: existing.id },
        data: {
          symbols: symbolGroup.symbols,
        },
      });
      symbolGroupIds.set(symbolGroup.name, updated.id);
    } else {
      const created = await prisma.symbolGroup.create({
        data: {
          userId: user.id,
          marketUniverseId,
          name: symbolGroup.name,
          symbols: symbolGroup.symbols,
        },
      });
      symbolGroupIds.set(symbolGroup.name, created.id);
    }
  }

  const strategyIds = new Map<string, string>();
  for (const strategy of STRATEGY_SEED) {
    const existing = await prisma.strategy.findFirst({
      where: {
        userId: user.id,
        name: strategy.name,
      },
      select: { id: true },
    });

    if (existing) {
      const updated = await prisma.strategy.update({
        where: { id: existing.id },
        data: strategy,
      });
      strategyIds.set(strategy.name, updated.id);
    } else {
      const created = await prisma.strategy.create({
        data: {
          userId: user.id,
          ...strategy,
        },
      });
      strategyIds.set(strategy.name, created.id);
    }
  }

  for (const botSeed of BOT_SEED) {
    const existingBot = await prisma.bot.findFirst({
      where: {
        userId: user.id,
        name: botSeed.name,
      },
      select: { id: true },
    });

    const botData = {
      name: botSeed.name,
      mode: botSeed.mode,
      paperStartBalance: botSeed.paperStartBalance,
      exchange: botSeed.exchange,
      marketType: botSeed.marketType,
      positionMode: botSeed.positionMode,
      isActive: botSeed.isActive,
      liveOptIn: botSeed.liveOptIn,
      maxOpenPositions: botSeed.maxOpenPositions,
      apiKeyId: null,
    };

    const bot = existingBot
      ? await prisma.bot.update({
          where: { id: existingBot.id },
          data: botData,
          select: { id: true },
        })
      : await prisma.bot.create({
          data: {
            userId: user.id,
            ...botData,
          },
          select: { id: true },
        });

    for (const marketGroupSeed of botSeed.marketGroups) {
      const symbolGroupId = symbolGroupIds.get(marketGroupSeed.symbolGroupName);
      if (!symbolGroupId) {
        continue;
      }

      const botMarketGroup = await prisma.botMarketGroup.upsert({
        where: {
          botId_symbolGroupId: {
            botId: bot.id,
            symbolGroupId,
          },
        },
        update: {
          lifecycleStatus: marketGroupSeed.lifecycleStatus,
          executionOrder: marketGroupSeed.executionOrder,
          maxOpenPositions: marketGroupSeed.maxOpenPositions,
          isEnabled: marketGroupSeed.isEnabled,
        },
        create: {
          userId: user.id,
          botId: bot.id,
          symbolGroupId,
          lifecycleStatus: marketGroupSeed.lifecycleStatus,
          executionOrder: marketGroupSeed.executionOrder,
          maxOpenPositions: marketGroupSeed.maxOpenPositions,
          isEnabled: marketGroupSeed.isEnabled,
        },
        select: { id: true },
      });

      for (const linkSeed of marketGroupSeed.strategyLinks) {
        const strategyId = strategyIds.get(linkSeed.strategyName);
        if (!strategyId) {
          continue;
        }

        await prisma.marketGroupStrategyLink.upsert({
          where: {
            botMarketGroupId_strategyId: {
              botMarketGroupId: botMarketGroup.id,
              strategyId,
            },
          },
          update: {
            priority: linkSeed.priority,
            weight: linkSeed.weight,
            isEnabled: linkSeed.isEnabled,
          },
          create: {
            userId: user.id,
            botId: bot.id,
            botMarketGroupId: botMarketGroup.id,
            strategyId,
            priority: linkSeed.priority,
            weight: linkSeed.weight,
            isEnabled: linkSeed.isEnabled,
          },
        });

        await prisma.botStrategy.upsert({
          where: {
            botId_strategyId_symbolGroupId: {
              botId: bot.id,
              strategyId,
              symbolGroupId,
            },
          },
          update: {
            isEnabled: linkSeed.isEnabled,
          },
          create: {
            botId: bot.id,
            strategyId,
            symbolGroupId,
            isEnabled: linkSeed.isEnabled,
          },
        });
      }
    }
  }

  console.log('Seed: Admin user, market presets, strategies and bot presets created!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
