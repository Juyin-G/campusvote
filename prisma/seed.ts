import { PrismaClient } from '@prisma/client';
import { seedUsers } from '../database/seeds/user';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando proceso global de Seed...');

  // Aquí agregas más módulos según vayas creando (ej: seedOrganizations, etc.)
  await seedUsers(prisma);

  console.log(' ¡Sembrado de datos finalizado con éxito!');
}

main()
  .catch((e) => {
    console.error('Error durante la ejecución del Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });