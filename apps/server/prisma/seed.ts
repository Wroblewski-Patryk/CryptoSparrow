import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const MARKET_UNIVERSE_SEED = [
  {
    name: 'Ulubione',
    marketType: 'FUTURES' as const,
    baseCurrency: 'USDT',
    filterRules: {
      minQuoteVolumeEnabled: true,
      minQuoteVolume24h: 102_765_635,
    },
    whitelist: [] as string[],
    blacklist: [] as string[],
    autoExcludeRules: null,
  },
];

const STRATEGY_SEED = [
  {
    name: 'Trend Pulse (RSI + EMA)',
    description: 'Seed strategy pod szybki start backtestu na grupie rynkow futures.',
    interval: '5m',
    leverage: 5,
    walletRisk: 1,
    config: {
      open: {
        direction: 'both',
        indicatorsLong: [
          {
            group: 'Analiza techniczna',
            name: 'EMA',
            params: { fast: 9, slow: 21 },
            condition: '>',
            value: 1,
            weight: 1,
          },
          {
            group: 'Analiza techniczna',
            name: 'RSI',
            params: { period: 14 },
            condition: '>',
            value: 55,
            weight: 1,
          },
        ],
        indicatorsShort: [
          {
            group: 'Analiza techniczna',
            name: 'EMA',
            params: { fast: 9, slow: 21 },
            condition: '<',
            value: 1,
            weight: 1,
          },
          {
            group: 'Analiza techniczna',
            name: 'RSI',
            params: { period: 14 },
            condition: '<',
            value: 45,
            weight: 1,
          },
        ],
      },
      close: {
        mode: 'basic',
        tp: 2.8,
        sl: 1.4,
        ttp: [{ percent: 1.5, arm: 1 }],
        tsl: [{ percent: -0.9, arm: 1 }],
      },
      additional: {
        dcaEnabled: true,
        dcaMode: 'basic',
        dcaTimes: 2,
        dcaMultiplier: 1.5,
        dcaLevels: [{ percent: -1.2, multiplier: 1.5 }],
        maxPositions: 2,
        maxOrders: 2,
        positionLifetime: 2,
        positionUnit: 'd',
        orderLifetime: 8,
        orderUnit: 'h',
        marginMode: 'CROSSED',
      },
    },
  },
];

async function main() {
  const password = await bcrypt.hash('Admin12#$', 10);

  const user = await prisma.user.upsert({
    where: { email: 'wroblewskipatryk@gmail.com' },
    update: {},
    create: {
      email: 'wroblewskipatryk@gmail.com',
      password,
      role: 'ADMIN',
    },
    select: { id: true },
  });

  for (const universe of MARKET_UNIVERSE_SEED) {
    const existing = await prisma.marketUniverse.findFirst({
      where: {
        userId: user.id,
        name: universe.name,
        marketType: universe.marketType,
        baseCurrency: universe.baseCurrency,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.marketUniverse.update({
        where: { id: existing.id },
        data: universe,
      });
    } else {
      await prisma.marketUniverse.create({
        data: {
          userId: user.id,
          ...universe,
        },
      });
    }
  }

  for (const strategy of STRATEGY_SEED) {
    const existing = await prisma.strategy.findFirst({
      where: {
        userId: user.id,
        name: strategy.name,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.strategy.update({
        where: { id: existing.id },
        data: strategy,
      });
    } else {
      await prisma.strategy.create({
        data: {
          userId: user.id,
          ...strategy,
        },
      });
    }
  }

  console.log('Seed: Admin user, market universes and strategy presets created!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
