import('../src/database/prisma.js').then(async (m) => {
  const prisma = m.prisma;
  try {
    const r = await prisma.organization.findFirst();
    console.log('OK:', r);
  } catch (e) {
    console.log('err:', e.message);
  }
  await prisma.$disconnect();
}).catch((e) => console.error('import err:', e.message));
