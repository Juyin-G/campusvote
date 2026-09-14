/**
 * @file seed-organizaciones.js
 * @description Crea (o completa) las organizaciones de arranque con su feria.
 *
 * Por cada organización de ORGANIZACIONES:
 *   - La organización (si ya existe con ese código, la reutiliza sin tocarla).
 *   - Un ADMIN y un JURADO, ambos ACTIVOS.
 *   - "Feria de Proyectos 2026-II" ABIERTA: empieza en 14 días y dura 2; la
 *     inscripción cierra 24 h antes del inicio (registration_deadline NULL).
 *   - El jurado asignado a esa feria.
 *
 * Es idempotente: volver a correrlo no duplica nada ni mueve las fechas de
 * una feria ya creada; solo restablece la contraseña de sus cuentas.
 *
 * Uso (PowerShell):
 *   $env:SEED_DATABASE_URL="<cadena de conexión>"   # por defecto DATABASE_URL
 *   $env:SEED_PASSWORD="<contraseña para las cuentas, 10+ caracteres>"
 *   node scripts/seed-organizaciones.js --confirmar
 *
 * En Render (plan gratis, sin Shell): definir SEED_PASSWORD en Environment y
 * usar temporalmente como Start Command
 *   npm run db:migrate && node scripts/seed-organizaciones.js --confirmar && npm start
 * Luego devolverlo a `npm start`.
 *
 * Requiere que las migraciones ya estén aplicadas (scripts/apply-sql.js).
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const CONFIRMADO = process.argv.includes('--confirmar');

const DOMINIO = 'demo.campusvote.edu.pe';
const FERIA = 'Feria de Proyectos 2026-II';
const DIA = 24 * 60 * 60 * 1000;

const ORGANIZACIONES = [
  { clave: 'unt', code: 'UNT', name: 'Universidad Nacional de Trujillo', orgType: 'UNIVERSITY' },
  { clave: 'tecsup', code: 'TECSUP', name: 'Tecsup', orgType: 'INSTITUTE' },
];

const CUENTAS = [
  { tipo: 'admin', role: 'ADMIN', firstName: 'Admin' },
  { tipo: 'jurado', role: 'JURY', firstName: 'Jurado' },
];

// El host interno de Render (dpg-xxxx-a) no lleva puntos y se usa tal cual,
// igual que la API. El externo (…render.com) exige SSL.
const conSsl = (url) => {
  const u = new URL(url);
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (!local && u.hostname.includes('.') && !u.searchParams.has('sslmode')) {
    u.searchParams.set('sslmode', 'require');
  }
  return u.toString();
};

// Sin upsert: en la BD el email es único por índice parcial, no por
// constraint, y ON CONFLICT no lo reconoce.
async function cuenta(prisma, org, { tipo, role, firstName }, passwordHash) {
  const email = `${tipo}.${org.clave}@${DOMINIO}`;
  const actual = await prisma.user.findFirst({ where: { email } });
  if (actual) {
    return prisma.user.update({
      where: { id: actual.id },
      data: { password: passwordHash, status: 'ACTIVE', lockedUntil: null, failedLoginAttempts: 0 },
    });
  }
  return prisma.user.create({
    data: {
      username: `seed.${tipo}.${org.clave}`,
      email,
      password: passwordHash,
      firstName,
      lastName: org.name,
      institutionalId: `SEED-${tipo.toUpperCase()}-${org.code}`,
      role,
      organizationId: org.id,
      authProvider: 'LOCAL',
      isVerified: true,
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });
}

async function main() {
  const url = process.env.SEED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Define SEED_DATABASE_URL (o DATABASE_URL).');

  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error('Define SEED_PASSWORD con al menos 10 caracteres.');
  }

  const destino = new URL(url);
  console.log(`Base de datos destino: ${destino.hostname}${destino.pathname}`);
  if (!CONFIRMADO) {
    console.log('Revisa el destino y vuelve a correr con --confirmar para escribir los datos.');
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: conSsl(url) } } });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const resumen = [];

    for (const def of ORGANIZACIONES) {
      const existente = await prisma.organization.findUnique({ where: { code: def.code } });
      const org = {
        ...def,
        ...(existente ??
          (await prisma.organization.create({
            data: { name: def.name, code: def.code, orgType: def.orgType, country: 'Perú' },
          }))),
        clave: def.clave,
      };

      const u = {};
      for (const c of CUENTAS) u[c.tipo] = await cuenta(prisma, org, c, passwordHash);

      const inicio = new Date(Date.now() + 14 * DIA);
      const fair =
        (await prisma.fair.findFirst({ where: { organizationId: org.id, name: FERIA } })) ??
        (await prisma.fair.create({
          data: {
            organizationId: org.id,
            name: FERIA,
            description: `Feria de proyectos del semestre 2026-II · ${org.name}.`,
            status: 'OPEN',
            startsAt: inicio,
            endsAt: new Date(inicio.getTime() + 2 * DIA),
          },
        }));

      const asignado = await prisma.fairJuryAssignment.findFirst({
        where: { fairId: fair.id, userId: u.jurado.id },
      });
      if (!asignado) {
        await prisma.fairJuryAssignment.create({
          data: { fairId: fair.id, userId: u.jurado.id, assignedById: u.admin.id },
        });
      }

      resumen.push({ org, fair, u, nueva: !existente });
    }

    console.log('');
    console.log('Organizaciones listas');
    for (const { org, fair, u, nueva } of resumen) {
      console.log(`  ${org.name} (${org.code})${nueva ? '' : ' · ya existía'}`);
      console.log(`    Feria:  ${fair.name} · ${fair.status} · id ${fair.id}`);
      console.log(`            del ${fair.startsAt?.toISOString()} al ${fair.endsAt?.toISOString()}`);
      console.log(`    ADMIN   ${u.admin.email}`);
      console.log(`    JURY    ${u.jurado.email}`);
    }
    console.log('  Contraseña de las cuentas: la de SEED_PASSWORD.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(1);
});
