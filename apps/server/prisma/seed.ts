import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('Admin12#$', 10);

  await prisma.user.upsert({
    where: { email: 'wroblewskipatryk@gmail.com' },
    update: {},
    create: {
      email: 'wroblewskipatryk@gmail.com',
      password,
      role: 'ADMIN', // jeśli masz enum Role
    },
  });

  console.log('Seed: Admin user created!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
