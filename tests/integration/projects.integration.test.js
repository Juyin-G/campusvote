/**
 * Projects — pruebas de integración HTTP + BD real (PostgreSQL).
 *
 * Flujo de inscripción de proyectos de feria:
 *   - El DOCENTE inscribe el proyecto (queda como ADVISOR) y agrega a sus
 *     alumnos por correo institucional; el estudiante no crea proyectos.
 *   - Catálogo de ferias con la inscripción abierta.
 *   - Cierre de inscripción (registration_deadline o 24 h antes del inicio).
 *   - Un estudiante participa en un solo proyecto por feria.
 *   - El ADMIN revisa la inscripción (puede corregir la categoría) y asigna
 *     el stand solo a proyectos aprobados.
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createAcademicFixture } from './academic.fixture.js';

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
  userElectionLimiter: () => (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');

const PASSWORD = 'ProjectsTest123!';
const runId = Date.now();
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

const tokens = {};
const users = {};
let fair;
let fairCerrada;
let otraFeria;
let categoria1;
let categoria2;
let categoriaAjena;
let stand1;
let standAjeno;
let proyecto1Id;
let proyecto2Id;

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.token;
};

const createUser = async ({ key, role, organizationId, facultyId = null }) => {
  const user = await prisma.user.create({
    data: {
      username: `pj.${key}.${runId}`,
      email: `pj.${key}.${runId}@campusvote.edu.pe`,
      password: await bcrypt.hash(PASSWORD, 12),
      firstName: 'Proyecto',
      lastName: key,
      institutionalId: `PJ${key}${runId}`.slice(0, 50),
      role,
      // chk_users_scope_admin_only: todo ADMIN tiene alcance; el resto, ninguno.
      scopeLevel: role === 'ADMIN' ? 'ORG' : null,
      authProvider: 'LOCAL',
      isVerified: true,
      status: 'ACTIVE',
      mustChangePassword: false,
      organizationId,
      facultyId,
    },
  });
  users[key] = user;
  tokens[key] = await login(user.email);
  return user;
};

const api = (method, url, key) => {
  const req = request(app)[method](url);
  return key ? req.set('Authorization', `Bearer ${tokens[key]}`) : req;
};

describe('Projects Integration (HTTP + DB)', () => {
  beforeAll(async () => {
    const orgA = await prisma.organization.create({
      data: { name: `Org Proyectos A ${runId}`, code: `PJA${runId}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org Proyectos B ${runId}`, code: `PJB${runId}` },
    });
    const { faculty } = await createAcademicFixture(`PJ${runId}`);

    await createUser({ key: 'admin', role: 'ADMIN', organizationId: orgA.id });
    await createUser({ key: 'docente1', role: 'TEACHER', organizationId: orgA.id, facultyId: faculty.id });
    await createUser({ key: 'docente2', role: 'TEACHER', organizationId: orgA.id, facultyId: faculty.id });
    await createUser({ key: 'alumno1', role: 'STUDENT', organizationId: orgA.id });
    await createUser({ key: 'alumno2', role: 'STUDENT', organizationId: orgA.id });
    await createUser({ key: 'alumno3', role: 'STUDENT', organizationId: orgA.id });
    await createUser({ key: 'alumnoB', role: 'STUDENT', organizationId: orgB.id });

    fair = await prisma.fair.create({
      data: {
        organizationId: orgA.id,
        name: `Feria abierta ${runId}`,
        status: 'OPEN',
        startsAt: new Date(Date.now() + 10 * DIA),
        endsAt: new Date(Date.now() + 11 * DIA),
      },
    });
    // Empieza en 12 h: el cierre por defecto (24 h antes) ya pasó.
    fairCerrada = await prisma.fair.create({
      data: {
        organizationId: orgA.id,
        name: `Feria con inscripción cerrada ${runId}`,
        status: 'OPEN',
        startsAt: new Date(Date.now() + 12 * HORA),
      },
    });
    otraFeria = await prisma.fair.create({
      data: { organizationId: orgA.id, name: `Otra feria ${runId}`, status: 'OPEN' },
    });

    categoria1 = await prisma.fairCategory.create({ data: { fairId: fair.id, name: 'Software' } });
    categoria2 = await prisma.fairCategory.create({ data: { fairId: fair.id, name: 'Robótica' } });
    categoriaAjena = await prisma.fairCategory.create({ data: { fairId: otraFeria.id, name: 'Otra' } });
    stand1 = await prisma.fairStand.create({ data: { fairId: fair.id, code: 'A-01' } });
    standAjeno = await prisma.fairStand.create({ data: { fairId: otraFeria.id, code: 'Z-99' } });
    // Crea siete usuarios con bcrypt: con toda la suite en paralelo supera los
    // 30 s por defecto aunque sola tarde unos pocos.
  }, 120000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Catálogo de inscripción', () => {
    it('el docente ve las ferias con la inscripción abierta y sus categorías', async () => {
      const res = await api('get', '/api/projects/catalog', 'docente1');

      expect(res.status).toBe(200);
      const ids = res.body.data.map((f) => f.id);
      expect(ids).toContain(fair.id);
      expect(ids).not.toContain(fairCerrada.id);

      const abierta = res.body.data.find((f) => f.id === fair.id);
      expect(abierta.categories.map((c) => c.name).sort()).toEqual(['Robótica', 'Software']);
      expect(new Date(abierta.registration_closes_at).getTime()).toBe(
        new Date(fair.startsAt).getTime() - DIA
      );
    });

    it('un estudiante no accede al catálogo (403)', async () => {
      const res = await api('get', '/api/projects/catalog', 'alumno1');
      expect(res.status).toBe(403);
    });
  });

  describe('Inscripción por el docente', () => {
    it('un estudiante no puede inscribir proyectos (403)', async () => {
      const res = await api('post', '/api/projects', 'alumno1').send({
        fair_id: fair.id,
        name: 'Proyecto de alumno',
      });
      expect(res.status).toBe(403);
    });

    it('el docente inscribe el proyecto y queda como ADVISOR', async () => {
      const res = await api('post', '/api/projects', 'docente1').send({
        fair_id: fair.id,
        category_id: categoria1.id,
        name: 'Brazo robótico',
        description: 'Brazo controlado por visión artificial',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.category_id).toBe(categoria1.id);
      proyecto1Id = res.body.data.id;

      const miembros = await api('get', `/api/projects/${proyecto1Id}/members`, 'docente1');
      expect(miembros.status).toBe(200);
      expect(miembros.body.data.members).toEqual([
        expect.objectContaining({ user_id: users.docente1.id, role: 'ADVISOR' }),
      ]);
    });

    it('rechaza una categoría de otra feria (400)', async () => {
      const res = await api('post', '/api/projects', 'docente1').send({
        fair_id: fair.id,
        category_id: categoriaAjena.id,
        name: 'Proyecto mal clasificado',
      });
      expect(res.status).toBe(400);
    });

    it('rechaza inscribir cuando la inscripción ya cerró (409)', async () => {
      const res = await api('post', '/api/projects', 'docente1').send({
        fair_id: fairCerrada.id,
        name: 'Proyecto tardío',
      });
      expect(res.status).toBe(409);
    });
  });

  describe('Integrantes por correo institucional', () => {
    it('agrega a un estudiante como EXPOSITOR por su correo', async () => {
      const res = await api('post', `/api/projects/${proyecto1Id}/members`, 'docente1').send({
        email: users.alumno1.email.toUpperCase(),
        role: 'EXPOSITOR',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.user_id).toBe(users.alumno1.id);
    });

    it('un docente no puede ser EXPOSITOR ni un estudiante ADVISOR (400)', async () => {
      const docente = await api('post', `/api/projects/${proyecto1Id}/members`, 'docente1').send({
        email: users.docente2.email,
        role: 'EXPOSITOR',
      });
      expect(docente.status).toBe(400);

      const alumno = await api('post', `/api/projects/${proyecto1Id}/members`, 'docente1').send({
        email: users.alumno2.email,
        role: 'ADVISOR',
      });
      expect(alumno.status).toBe(400);
    });

    it('rechaza a un estudiante de otra organización (400) y un correo inexistente (404)', async () => {
      const ajeno = await api('post', `/api/projects/${proyecto1Id}/members`, 'docente1').send({
        email: users.alumnoB.email,
      });
      expect(ajeno.status).toBe(400);

      const inexistente = await api('post', `/api/projects/${proyecto1Id}/members`, 'docente1').send({
        email: `nadie.${runId}@campusvote.edu.pe`,
      });
      expect(inexistente.status).toBe(404);
    });

    it('un estudiante participa en un solo proyecto por feria (409)', async () => {
      const creado = await api('post', '/api/projects', 'docente2').send({
        fair_id: fair.id,
        category_id: categoria2.id,
        name: 'Huerto inteligente',
      });
      expect(creado.status).toBe(201);
      proyecto2Id = creado.body.data.id;

      const res = await api('post', `/api/projects/${proyecto2Id}/members`, 'docente2').send({
        email: users.alumno1.email,
      });
      expect(res.status).toBe(409);
    });

    it('no se puede quitar al docente que inscribió el proyecto (409)', async () => {
      const res = await api(
        'delete',
        `/api/projects/${proyecto1Id}/members/${users.docente1.id}`,
        'docente1'
      );
      expect(res.status).toBe(409);
    });
  });

  describe('Visibilidad del borrador', () => {
    it('el integrante ve el proyecto aunque no esté aprobado', async () => {
      const detalle = await api('get', `/api/projects/${proyecto1Id}`, 'alumno1');
      expect(detalle.status).toBe(200);

      const lista = await api('get', '/api/projects', 'alumno1');
      expect(lista.status).toBe(200);
      expect(lista.body.data.map((p) => p.id)).toContain(proyecto1Id);
    });

    it('un estudiante ajeno no ve el borrador (403)', async () => {
      const res = await api('get', `/api/projects/${proyecto1Id}`, 'alumno3');
      expect(res.status).toBe(403);
    });

    it('un integrante no puede editar el proyecto (403)', async () => {
      const res = await api('put', `/api/projects/${proyecto1Id}`, 'alumno1').send({ name: 'Otro nombre' });
      expect(res.status).toBe(403);
    });
  });

  describe('Envío y revisión de la inscripción', () => {
    it('no se envía sin al menos un expositor (400)', async () => {
      const res = await api('post', `/api/projects/${proyecto2Id}/submit`, 'docente2');
      expect(res.status).toBe(400);
    });

    it('el docente envía la inscripción completa', async () => {
      const res = await api('post', `/api/projects/${proyecto1Id}/submit`, 'docente1');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUBMITTED');
    });

    it('el admin aprueba y corrige la categoría', async () => {
      const res = await api('post', `/api/projects/${proyecto1Id}/review`, 'admin').send({
        decision: 'APPROVED',
        category_id: categoria2.id,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.category_id).toBe(categoria2.id);
    });
  });

  describe('Asignación de stand', () => {
    it('solo se asigna stand a proyectos aprobados (409)', async () => {
      const res = await api('put', `/api/projects/${proyecto2Id}/stand`, 'admin').send({
        stand_id: stand1.id,
      });
      expect(res.status).toBe(409);
    });

    it('el docente no asigna stands (403)', async () => {
      const res = await api('put', `/api/projects/${proyecto1Id}/stand`, 'docente1').send({
        stand_id: stand1.id,
      });
      expect(res.status).toBe(403);
    });

    it('rechaza un stand de otra feria (400)', async () => {
      const res = await api('put', `/api/projects/${proyecto1Id}/stand`, 'admin').send({
        stand_id: standAjeno.id,
      });
      expect(res.status).toBe(400);
    });

    it('el admin asigna el stand al proyecto aprobado', async () => {
      const res = await api('put', `/api/projects/${proyecto1Id}/stand`, 'admin').send({
        stand_id: stand1.id,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.stand).toEqual({ id: stand1.id, code: 'A-01' });
    });

    it('un stand ocupado no se asigna a otro proyecto (409)', async () => {
      const agregar = await api('post', `/api/projects/${proyecto2Id}/members`, 'docente2').send({
        email: users.alumno2.email,
      });
      expect(agregar.status).toBe(201);
      expect((await api('post', `/api/projects/${proyecto2Id}/submit`, 'docente2')).status).toBe(200);
      expect(
        (await api('post', `/api/projects/${proyecto2Id}/review`, 'admin').send({ decision: 'APPROVED' }))
          .status
      ).toBe(200);

      const res = await api('put', `/api/projects/${proyecto2Id}/stand`, 'admin').send({
        stand_id: stand1.id,
      });
      expect(res.status).toBe(409);
    });
  });

  describe('Cierre de inscripción', () => {
    it('la feria no acepta un cierre posterior a su inicio (400)', async () => {
      const res = await api('put', `/api/fairs/${fair.id}`, 'admin').send({
        registration_deadline: new Date(new Date(fair.startsAt).getTime() + HORA).toISOString(),
      });
      expect(res.status).toBe(400);
    });

    it('pasado el cierre configurado ya no se edita ni se cambian integrantes (409)', async () => {
      const borrador = await api('post', '/api/projects', 'docente2').send({
        fair_id: fair.id,
        name: 'Proyecto que se queda fuera',
      });
      expect(borrador.status).toBe(201);

      const cierre = await api('put', `/api/fairs/${fair.id}`, 'admin').send({
        registration_deadline: new Date(Date.now() - HORA).toISOString(),
      });
      expect(cierre.status).toBe(200);
      expect(cierre.body.data.registration_deadline).not.toBeNull();

      const editar = await api('put', `/api/projects/${borrador.body.data.id}`, 'docente2').send({
        name: 'Cambio tardío',
      });
      expect(editar.status).toBe(409);

      const integrante = await api('post', `/api/projects/${borrador.body.data.id}/members`, 'docente2').send({
        email: users.alumno3.email,
      });
      expect(integrante.status).toBe(409);
    });
  });
});
