import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Crear planes
  const freePlan = await prisma.plan.upsert({
    where: { name: 'Free' },
    update: {},
    create: {
      name: 'Free',
      price: 0,
    },
  });

  const premiumPlan = await prisma.plan.upsert({
    where: { name: 'Premium' },
    update: {},
    create: {
      name: 'Premium',
      price: 19.99,
    },
  });

  console.log(`✅ Plans created: ${freePlan.name}, ${premiumPlan.name}`);

  const passwordHash = await bcrypt.hash('password', 10);

  // Admin
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: passwordHash,
      name: 'Administrator',
      planId: premiumPlan.id,
    },
  });

  // Usuarios Premium
  await prisma.user.upsert({
    where: { email: 'premium1@example.com' },
    update: {},
    create: {
      email: 'premium1@example.com',
      password: passwordHash,
      name: 'Premium User 1',
      planId: premiumPlan.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'premium2@example.com' },
    update: {},
    create: {
      email: 'premium2@example.com',
      password: passwordHash,
      name: 'Premium User 2',
      planId: premiumPlan.id,
    },
  });

  // Usuarios Free
  await prisma.user.upsert({
    where: { email: 'free1@example.com' },
    update: {},
    create: {
      email: 'free1@example.com',
      password: passwordHash,
      name: 'Free User 1',
      planId: freePlan.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'free2@example.com' },
    update: {},
    create: {
      email: 'free2@example.com',
      password: passwordHash,
      name: 'Free User 2',
      planId: freePlan.id,
    },
  });

  console.log('✅ Users created: admin + 2 premium + 2 free');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🌱 Seed finished.');
  });
