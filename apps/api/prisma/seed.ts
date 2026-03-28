import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const MARKET_UNIVERSE_SEED = [
  {
    name: 'Ulubione',
    marketType: 'FUTURES' as const,
    baseCurrency: 'USDT',
    filterRules: {
      minQuoteVolumeEnabled: false,
      minQuoteVolume24h: 0,
    },
    whitelist: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'] as string[],
    blacklist: [] as string[],
    autoExcludeRules: null,
  },
];

const STRATEGY_SEED = [
  {
    name: 'Trend Pulse (RSI + EMA)',
    description: 'Seed strategy pod szybki start backtestu na grupie rynkow futures.',
    interval: '5m',
    leverage: 15,
    walletRisk: 10,
    config: {
      open: {
        direction: 'both',
        indicatorsLong: [
          {
            group: 'Analiza techniczna',
            name: 'RSI',
            params: { period: 14 },
            condition: '>',
            value: 80,
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
            value: 20,
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
          { percent: 10, arm: 5 },
          { percent: 20, arm: 10 },
          { percent: 40, arm: 20 },
          { percent: 80, arm: 40 },
        ],
        tsl: [{ percent: -25, arm: 10 }],
      },
      additional: {
        dcaEnabled: true,
        dcaMode: 'advanced',
        dcaTimes: 2,
        dcaMultiplier: 1.5,
        dcaLevels: [
          { percent: -30, multiplier: 1 },
          { percent: -30, multiplier: 1 },
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
