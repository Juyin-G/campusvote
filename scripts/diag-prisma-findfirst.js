import('../src/database/prisma.js').then(async (m) => {
  const prisma = m.prisma;
  console.log('Available models:', Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_')).slice(0, 20));
  try {
    const r = await prisma.organization.findFirst();
    console.log('OK:', r);
  } catch (e) {
    console.error('err:', e.message);
    console.error('meta:', JSON.stringify(e.meta, null, 2));
  }
  await prisma.$disconnect();
}).catch((e) => console.error('import err:', e.message));
