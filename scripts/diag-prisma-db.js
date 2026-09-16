import('@prisma/client').then(async (m) => {
  const p = new m.PrismaClient();
  const r = await p.$queryRaw`SELECT current_database(), current_schema()`;
  console.log('DB/schema:', r);
  await p.$disconnect();
}).catch((e) => console.error('err:', e.message));
