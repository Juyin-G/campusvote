// prisma/seed.ts
// PASO 8.5 — Orquestador de seeds de desarrollo.
// Ejecuta en orden:
//   1. Contexto organizacional (organizations, periods, faculties, programs, careers).
//   2. Usuarios de desarrollo (roles ADMIN/TEACHER/STUDENT/JURY/COMMISSION/SUPERADMIN).
//
// Cada función seedX es idempotente (upsert por claves únicas).
//
// Comando: npm run db:seed

import { PrismaClient } from '@prisma/client';

import { seedOrganizations } from '../database/seeds/organization.js';
import { seedDevUsers, seedUsers } from '../database/seeds/user.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando proceso global de Seed (Paso 8.5)...');

  // 1) Contexto organizacional.
  const ctxOrg = await seedOrganizations(prisma);

  // 2) Usuarios de desarrollo (roles múltiples + SUPERADMIN legacy).
  //    Mantener seedUsers() evita romper consumidores externos del seed
  //    previo. La contraseña legacy (env SEED_SUPERADMIN_PASSWORD o
  //    '72314592') coexiste con la DEV_PASSWORD uniforme del seed 8.5.
  const ctxUsersLegacy = await seedUsers(prisma);
  const ctxUsersDev = await seedDevUsers(prisma, ctxOrg);

  // 3) Mapeo de usuarios sembrados por email → referencia rápida.
  const usersByEmail = {};
  for (const u of ctxUsersDev.users) usersByEmail[u.email] = u;
  // SUPERADMIN legacy (juan.ochoa) también existe, mantenemos referencia.
  if (ctxUsersLegacy?.superAdmin) {
    usersByEmail[ctxUsersLegacy.superAdmin.email] = ctxUsersLegacy.superAdmin;
  }

  console.log('¡Sembrado de datos de desarrollo finalizado con éxito!');
}

main()
  .catch((e) => {
    console.error('Error durante la ejecución del Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });