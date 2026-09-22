/**
 * @file seed-organizaciones.js
 * @description Crea (o completa) las organizaciones de arranque con su feria.
 *
 * Por cada organización de ORGANIZACIONES:
 *   - La organización (si ya existe con ese código, la reutiliza sin tocarla).
 *   - Un ADMIN, un JURADO, un DOCENTE asesor y 6 ALUMNOS, todos ACTIVOS.
 *   - "Feria de Proyectos 2026-II" ABIERTA: empieza en 14 días y dura 2; la
 *     inscripción cierra 24 h antes del inicio (registration_deadline NULL).
 *   - El jurado asignado a esa feria.
 *   - 3 categorías, 4 stands y 4 proyectos APROBADOS con portada, categoría,
 *     stand, el docente como asesor y sus alumnos como expositores.
 *   - Rúbrica checklist de 3 criterios y el jurado asignado a todas las
 *     categorías (la rúbrica solo se configura en DRAFT: con la feria abierta
 *     ya no se podría agregar desde la web).
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
  { tipo: 'docente', role: 'TEACHER', firstName: 'Docente asesor' },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ tipo: `alumno${n}`, role: 'STUDENT', firstName: `Alumno ${n}` })),
];

const CATEGORIAS = ['Software', 'Robótica e IoT', 'Energía y ambiente'];
const CRITERIOS = ['Innovación', 'Viabilidad técnica', 'Presentación'];
const STANDS = ['A-01', 'A-02', 'A-03', 'A-04'];

const portada = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`;
const PORTADAS = {
  robot: portada('1485827404703-89b55fcc595e'),
  app: portada('1512941937669-90a1b58e7e9c'),
  solar: portada('1509391366360-2e959784a276'),
  datos: portada('1551288049-bebda4e38f71'),
};

const PROYECTOS = {
  unt: [
    {
      name: 'Robot recolector de residuos para playas de Huanchaco',
      description: 'Robot autónomo que recorre la orilla, detecta plásticos con una cámara y los recoge.',
      categoria: 'Robótica e IoT',
      cover: PORTADAS.robot,
      alumnos: ['alumno1', 'alumno2'],
    },
    {
      name: 'App de turismo cultural Chan Chan',
      description: 'Guía móvil con rutas, audios y realidad aumentada sobre la ciudadela de barro.',
      categoria: 'Software',
      cover: PORTADAS.app,
      alumnos: ['alumno3'],
    },
    {
      name: 'Secador solar de productos agrícolas',
      description: 'Secador de bajo costo que aprovecha la radiación solar para deshidratar frutas y granos.',
      categoria: 'Energía y ambiente',
      cover: PORTADAS.solar,
      alumnos: ['alumno4', 'alumno5'],
    },
    {
      name: 'Tablero de calidad del aire en Trujillo',
      description: 'Red de sensores de bajo costo con un tablero web que muestra PM2.5 y CO2 por distrito.',
      categoria: 'Software',
      cover: PORTADAS.datos,
      alumnos: ['alumno6'],
    },
  ],
  tecsup: [
    {
      name: 'Brazo robótico clasificador con visión artificial',
      description: 'Brazo de 4 ejes que clasifica piezas por color y forma usando una cámara y OpenCV.',
      categoria: 'Robótica e IoT',
      cover: PORTADAS.robot,
      alumnos: ['alumno1', 'alumno2'],
    },
    {
      name: 'App de asistencia con QR dinámico',
      description: 'Registro de asistencia por sesión con códigos QR que cambian cada 30 segundos.',
      categoria: 'Software',
      cover: PORTADAS.app,
      alumnos: ['alumno3'],
    },
    {
      name: 'Estación fotovoltaica monitoreada',
      description: 'Paneles solares con sensores que reportan en tiempo real la energía generada.',
      categoria: 'Energía y ambiente',
      cover: PORTADAS.solar,
      alumnos: ['alumno4', 'alumno5'],
    },
    {
      name: 'Mantenimiento predictivo de motores',
      description: 'Sensores de vibración y temperatura que anticipan fallas en motores industriales.',
      categoria: 'Robótica e IoT',
      cover: PORTADAS.datos,
      alumnos: ['alumno6'],
    },
  ],
};

const buscarOCrear = async (modelo, where, data) =>
  (await modelo.findFirst({ where })) ?? modelo.create({ data: { ...where, ...data } });

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
      // chk_users_scope_admin_only: todo ADMIN tiene alcance; el resto, ninguno.
      scopeLevel: role === 'ADMIN' ? 'ORG' : null,
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

      const asignacion = await buscarOCrear(
        prisma.fairJuryAssignment,
        { fairId: fair.id, userId: u.jurado.id },
        { assignedById: u.admin.id }
      );

      const categorias = {};
      for (const name of CATEGORIAS) {
        categorias[name] = await buscarOCrear(prisma.fairCategory, { fairId: fair.id, name }, {});
      }
      const stands = [];
      for (const code of STANDS) {
        stands.push(await buscarOCrear(prisma.fairStand, { fairId: fair.id, code }, {}));
      }

      // Rúbrica checklist (cumplido / no cumplido por criterio).
      const rubric = await buscarOCrear(prisma.fairRubric, { fairId: fair.id }, { name: 'Rúbrica 2026-II' });
      for (const [i, name] of CRITERIOS.entries()) {
        await buscarOCrear(prisma.rubricCriterion, { rubricId: rubric.id, position: i + 1 }, { name });
      }

      // Jurados por categoría: sin asignación el jurado no ve ningún proyecto.
      for (const categoria of Object.values(categorias)) {
        await buscarOCrear(prisma.fairJuryCategoryAssignment, {
          juryAssignmentId: asignacion.id,
          categoryId: categoria.id,
        }, {});
      }

      for (const [i, p] of PROYECTOS[org.clave].entries()) {
        const proyecto = await buscarOCrear(
          prisma.project,
          { fairId: fair.id, name: p.name },
          {
            organizationId: org.id,
            createdById: u.docente.id,
            description: p.description,
            coverUrl: p.cover,
            categoryId: categorias[p.categoria].id,
            standId: stands[i].id,
            status: 'APPROVED',
            submittedAt: new Date(),
            reviewedById: u.admin.id,
            reviewedAt: new Date(),
          }
        );
        const integrantes = [
          { userId: u.docente.id, role: 'ADVISOR' },
          ...p.alumnos.map((clave) => ({ userId: u[clave].id, role: 'EXPOSITOR' })),
        ];
        for (const m of integrantes) {
          await buscarOCrear(prisma.projectMember, { projectId: proyecto.id, userId: m.userId }, { role: m.role });
        }
      }

      const proyectos = await prisma.project.count({ where: { fairId: fair.id, status: 'APPROVED' } });
      resumen.push({ org, fair, u, proyectos, nueva: !existente });
    }

    console.log('');
    console.log('Organizaciones listas');
    for (const { org, fair, u, proyectos, nueva } of resumen) {
      console.log(`  ${org.name} (${org.code})${nueva ? '' : ' · ya existía'}`);
      console.log(`    Feria:  ${fair.name} · ${fair.status} · id ${fair.id}`);
      console.log(`            del ${fair.startsAt?.toISOString()} al ${fair.endsAt?.toISOString()}`);
      console.log(`            proyectos aprobados: ${proyectos}`);
      console.log(`    ADMIN   ${u.admin.email}`);
      console.log(`    JURY    ${u.jurado.email}`);
      console.log(`    TEACHER ${u.docente.email}`);
      console.log(`    STUDENT alumno1.${org.clave} … alumno6.${org.clave}@${DOMINIO}`);
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
