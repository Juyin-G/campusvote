import('@prisma/client').then(async (m) => {
  const p = new m.PrismaClient({ log: ['query', 'error'] });
  const r = await p.organization.findFirst();
  console.log('OK:', r);
  await p.$disconnect();
}).catch((e) => console.error('err:', e.message));
