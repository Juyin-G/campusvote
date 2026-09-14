/**
 * @file seed-demo-jurado.js
 * @description Datos de demostración para probar la app del jurado (iOS).
 *
 * Crea (o actualiza) una institución de DEMO aislada de los datos reales:
 *   - Institución "CampusVote Demo (Laboratorio)" con su admin.
 *   - 1 docente asesor, 6 alumnos y 3 jurados, todos ACTIVOS.
 *   - "Feria Demo Laboratorio" ABIERTA e INICIADA (el jurado ya puede evaluar)
 *     durante 7 días, con 3 categorías, 4 stands, rúbrica de 3 criterios y
 *     los 3 jurados asignados.
 *   - 4 proyectos APROBADOS con portada, descripción, categoría, stand e
 *     integrantes.
 * No crea declaraciones ni evaluaciones: eso lo hace el jurado desde la app.
 *
 * Es idempotente: volver a correrlo no duplica nada; reabre la feria por
 * otros 7 días y restablece la contraseña de las cuentas demo.
 *
 * Uso (PowerShell):
 *   $env:DEMO_DATABASE_URL="<cadena de conexión>"   # por defecto DATABASE_URL
 *   $env:DEMO_PASSWORD="<contraseña para las cuentas demo, 10+ caracteres>"
 *   node scripts/seed-demo-jurado.js --confirmar
 *   node scripts/seed-demo-jurado.js --confirmar --reiniciar   # borra evaluaciones y declaraciones
 *
 * Requiere que las migraciones ya estén aplicadas (scripts/apply-sql.js).
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const args = new Set(process.argv.slice(2));
const CONFIRMADO = args.has('--confirmar');
const REINICIAR = args.has('--reiniciar');

const DOMINIO = 'demo.campusvote.edu.pe';
const ORG_CODE = 'DEMO_LAB';
const FERIA = 'Feria Demo Laboratorio';
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

const portada = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`;

const CATEGORIAS = ['Software', 'Robótica e IoT', 'Energía'];
const STANDS = ['A-01', 'A-02', 'A-03', 'A-04'];
const CRITERIOS = ['Innovación', 'Viabilidad técnica', 'Presentación'];

const PROYECTOS = [
  {
    name: 'Brazo robótico con visión artificial',
    description: 'Brazo de 4 ejes que clasifica piezas por color y forma usando una cámara y OpenCV.',
    categoria: 'Robótica e IoT',
    stand: 'A-01',
    cover: portada('1485827404703-89b55fcc595e'),
    alumnos: ['alumno1', 'alumno2'],
  },
  {
    name: 'App de asistencia con QR dinámico',
    description: 'Registro de asistencia por sesión con códigos QR que cambian cada 30 segundos.',
    categoria: 'Software',
    stand: 'A-02',
    cover: portada('1512941937669-90a1b58e7e9c'),
    alumnos: ['alumno3'],
  },
  {
    name: 'Panel solar monitoreado',
    description: 'Estación fotovoltaica con sensores que reporta en tiempo real la energía generada.',
    categoria: 'Energía',
    stand: 'A-03',
    cover: portada('1509391366360-2e959784a276'),
    alumnos: ['alumno4', 'alumno5'],
  },
  {
    name: 'Chatbot de orientación académica',
    description: 'Asistente que responde dudas sobre trámites, horarios y mallas curriculares.',
    categoria: 'Software',
    stand: 'A-04',
    cover: portada('1551288049-bebda4e38f71'),
    alumnos: ['alumno6'],
  },
];

const USUARIOS = [
  { clave: 'admin', role: 'ADMIN', firstName: 'Admin', lastName: 'Demo' },
  { clave: 'docente', role: 'TEACHER', firstName: 'Carla', lastName: 'Asesora' },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    clave: `alumno${n}`,
    role: 'STUDENT',
    firstName: `Alumno ${n}`,
    lastName: 'Demo',
  })),
  ...[1, 2, 3].map((n) => ({
    clave: `jurado${n}`,
    role: 'JURY',
    firstName: `Jurado ${n}`,
    lastName: 'Demo',
  })),
];

const conSsl = (url) => {
  const u = new URL(url);
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (!local && !u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require');
  return u.toString();
};

const buscarOCrear = async (modelo, where, data) =>
  (await modelo.findFirst({ where })) ?? modelo.create({ data: { ...where, ...data } });

async function main() {
  const url = process.env.DEMO_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Define DEMO_DATABASE_URL (o DATABASE_URL).');

  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error('Define DEMO_PASSWORD con al menos 10 caracteres.');
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

    // ── Institución ──────────────────────────────────────────────────
    const org = await prisma.organization.upsert({
      where: { code: ORG_CODE },
      update: { isActive: true },
      create: {
        name: 'CampusVote Demo (Laboratorio)',
        code: ORG_CODE,
        orgType: 'INSTITUTE',
        country: 'Perú',
      },
    });

    // ── Usuarios ─────────────────────────────────────────────────────
    const u = {};
    for (const { clave, role, firstName, lastName } of USUARIOS) {
      const email = `${clave}@${DOMINIO}`;
      // Sin upsert: en la BD el email es único por índice parcial, no por
      // constraint, y ON CONFLICT no lo reconoce.
      const actual = await prisma.user.findFirst({ where: { email } });
      if (actual) {
        u[clave] = await prisma.user.update({
          where: { id: actual.id },
          data: { password: passwordHash, status: 'ACTIVE', lockedUntil: null, failedLoginAttempts: 0 },
        });
        continue;
      }
      u[clave] = await prisma.user.create({
        data: {
          username: `demo.${clave}`,
          email,
          password: passwordHash,
          firstName,
          lastName,
          institutionalId: `DEMO-${clave.toUpperCase()}`,
          role,
          organizationId: org.id,
          authProvider: 'LOCAL',
          isVerified: true,
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      });
    }

    // ── Feria abierta e iniciada ─────────────────────────────────────
    const fechas = {
      status: 'OPEN',
      startsAt: new Date(Date.now() - HORA),
      endsAt: new Date(Date.now() + 7 * DIA),
    };
    const existente = await prisma.fair.findFirst({ where: { organizationId: org.id, name: FERIA } });
    const fair = existente
      ? await prisma.fair.update({ where: { id: existente.id }, data: fechas })
      : await prisma.fair.create({
          data: {
            organizationId: org.id,
            name: FERIA,
            description: 'Feria de prueba para la app del jurado.',
            ...fechas,
          },
        });

    const categorias = {};
    for (const name of CATEGORIAS) {
      categorias[name] = await buscarOCrear(prisma.fairCategory, { fairId: fair.id, name }, {});
    }
    const stands = {};
    for (const code of STANDS) {
      stands[code] = await buscarOCrear(prisma.fairStand, { fairId: fair.id, code }, {});
    }

    const rubric = await buscarOCrear(prisma.fairRubric, { fairId: fair.id }, { name: 'Rúbrica demo' });
    for (const [i, name] of CRITERIOS.entries()) {
      await buscarOCrear(
        prisma.rubricCriterion,
        { rubricId: rubric.id, position: i + 1 },
        { name, minScore: 0, maxScore: 10 }
      );
    }

    for (const clave of ['jurado1', 'jurado2', 'jurado3']) {
      await buscarOCrear(
        prisma.fairJuryAssignment,
        { fairId: fair.id, userId: u[clave].id },
        { assignedById: u.admin.id }
      );
    }

    // ── Proyectos aprobados ──────────────────────────────────────────
    for (const p of PROYECTOS) {
      const proyecto = await buscarOCrear(
        prisma.project,
        { fairId: fair.id, name: p.name },
        {
          organizationId: org.id,
          createdById: u.docente.id,
          description: p.description,
          coverUrl: p.cover,
          categoryId: categorias[p.categoria].id,
          standId: stands[p.stand].id,
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

    // ── Reinicio opcional para volver a probar desde cero ────────────
    if (REINICIAR) {
      const evals = await prisma.fairEvaluation.deleteMany({ where: { fairId: fair.id } });
      const decl = await prisma.fairJuryDeclaration.deleteMany({ where: { fairId: fair.id } });
      console.log(`Reinicio: ${evals.count} evaluaciones y ${decl.count} declaraciones eliminadas.`);
    }

    const [proyectos, evaluaciones] = await Promise.all([
      prisma.project.count({ where: { fairId: fair.id, status: 'APPROVED' } }),
      prisma.fairEvaluation.count({ where: { fairId: fair.id } }),
    ]);

    console.log('');
    console.log('Datos demo listos');
    console.log(`  Institución: ${org.name} (${org.code})`);
    console.log(`  Feria:       ${fair.name} · ${fair.status} · id ${fair.id}`);
    console.log(`               abierta hasta ${fair.endsAt.toISOString()}`);
    console.log(`  Proyectos aprobados: ${proyectos} · evaluaciones: ${evaluaciones}`);
    console.log('  Cuentas (contraseña: la de DEMO_PASSWORD):');
    for (const clave of ['jurado1', 'jurado2', 'jurado3', 'admin', 'docente']) {
      console.log(`    ${u[clave].role.padEnd(8)} ${u[clave].email}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(1);
});
