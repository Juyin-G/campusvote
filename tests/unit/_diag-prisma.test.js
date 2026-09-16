import { jest } from '@jest/globals';

test('prisma connected to test DB', async () => {
  const { prisma } = await import('../../src/database/prisma.js');
  const r = await prisma.$queryRaw`SELECT current_database() AS db`;
  console.log('DB:', r);
  const org = await prisma.organization.findFirst();
  console.log('Org:', org);
  await prisma.$disconnect();
});
