import { PrismaClient } from '@prisma/client';
import { seedUsers } from '../database/seeds/user.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando proceso global de Seed...');

  await seedUsers(prisma);

  console.log('¡Sembrado de datos finalizado con éxito!');
}

main()
  .catch((e) => {
    console.error('Error durante la ejecución del Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });