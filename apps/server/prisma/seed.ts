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

  console.log('Seed: Admin user and market universes created!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
