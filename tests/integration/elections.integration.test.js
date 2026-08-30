/**
 * Elections — pruebas de integración HTTP (app + BD real)
 *
 * Cubre creación, validación de alcance y los sub-recursos anidados
 * (cargos, listas, candidaturas y reglas) contra PostgreSQL.
 *
 * Verifica lo que los tests unitarios no pueden ver, porque estos mockean
 * el repository: la FK compuesta de candidacies y los CHECK de la base.
 *
 * El workflow de estados vive en elections.workflow.integration.test.js.
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');

const PASSWORD = 'ElectionsTest123!';
const runId = Date.now();

const enDias = (dias) => new Date(Date.now() + dias * 86400000).toISOString();

let adminId;
let studentId;
let facultyId;
let periodId;
let adminToken;
let studentToken;

let electionId;
let positionId;
let listId;

const crearUsuario = async (rol, prefijo, programId) => {
  const hash = await bcrypt.hash(PASSWORD, 12);
  return prisma.user.create({
    data: {
      username: `elec.${prefijo}.${runId}`,
      email: `elec.${prefijo}.${runId}@campusvote.edu.pe`,
      password: hash,
      firstName: 'Test',
      lastName: rol,
      institutionalId: `E${prefijo.toUpperCase()}${runId}`,
      role: rol,
      authProvider: 'LOCAL',
      isVerified: true,
      status: 'ACTIVE',
      mustChangePassword: false,
      programId: programId ?? null,
      currentCycle: rol === 'STUDENT' ? 5 : null,
    },
  });
};

const token = async (email) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.token;
};

const comoAdmin = (metodo, url) =>
  request(app)[metodo](url).set('Authorization', `Bearer ${adminToken}`);

describe('Elections Integration (HTTP + DB)', () => {
  beforeAll(async () => {
    const faculty = await prisma.faculty.create({
      data: { name: `Facultad Test ${runId}`, code: `FT${runId}`.slice(0, 20) },
    });
    facultyId = faculty.id;

    const program = await prisma.program.create({
      data: {
        facultyId: faculty.id,
        name: `Programa Test ${runId}`.slice(0, 149),
        code: `PT${runId}`.slice(0, 20),
      },
    });

    const admin = await crearUsuario('ADMIN', 'admin');
    adminId = admin.id;
    const student = await crearUsuario('STUDENT', 'student', program.id);
    studentId = student.id;

    adminToken = await token(admin.email);
    studentToken = await token(student.email);

    const period = await prisma.academicPeriod.create({
      data: {
        name: `P-${runId}`.slice(0, 50),
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    periodId = period.id;
  });

  afterAll(async () => {
    // Las elecciones se borran primero: candidacies y elections referencian
    // users y faculties con ON DELETE RESTRICT.
    if (electionId) {
      await prisma.election.deleteMany({ where: { id: electionId } }).catch(() => {});
    }
    await prisma.academicPeriod.deleteMany({ where: { id: periodId } }).catch(() => {});
    await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    await prisma.user
      .deleteMany({ where: { id: { in: [adminId, studentId].filter(Boolean) } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  describe('Autenticación y permisos', () => {
    it('GET /api/elections sin token retorna 401', async () => {
      const res = await request(app).get('/api/elections');
      expect(res.status).toBe(401);
    });

    it('un STUDENT puede consultar elecciones', async () => {
      const res = await request(app)
        .get('/api/elections')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('un STUDENT no puede crear elecciones', async () => {
      const res = await request(app)
        .post('/api/elections')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'X' });
      expect(res.status).toBe(403);
    });
  });

  describe('Creación y validación de alcance', () => {
    it('rechaza UNIVERSITY con facultad (chk_elections_scope_integrity)', async () => {
      const res = await comoAdmin('post', '/api/elections').send({
        title: 'Scope inválido',
        scope_type: 'UNIVERSITY',
        faculty_id: facultyId,
        period_id: periodId,
        start_at: enDias(1),
        end_at: enDias(2),
      });

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('body.faculty_id');
    });

    it('rechaza fecha de fin anterior a la de inicio', async () => {
      const res = await comoAdmin('post', '/api/elections').send({
        title: 'Fechas inválidas',
        scope_type: 'UNIVERSITY',
        period_id: periodId,
        start_at: enDias(5),
        end_at: enDias(1),
      });

      expect(res.status).toBe(400);
    });

    it('rechaza un período inexistente con 400, no con 500', async () => {
      const res = await comoAdmin('post', '/api/elections').send({
        title: 'Periodo fantasma',
        scope_type: 'UNIVERSITY',
        period_id: '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d',
        start_at: enDias(1),
        end_at: enDias(2),
      });

      expect(res.status).toBe(400);
    });

    it('crea una elección FACULTY en estado DRAFT', async () => {
      const res = await comoAdmin('post', '/api/elections').send({
        title: `Elecciones Integración ${runId}`,
        scope_type: 'FACULTY',
        faculty_id: facultyId,
        period_id: periodId,
        start_at: enDias(1),
        end_at: enDias(2),
      });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.createdBy).toBe(adminId);
      electionId = res.body.data.id;
    });
  });

  describe('Sub-recursos anidados', () => {
    it('crea un cargo', async () => {
      const res = await comoAdmin(
        'post',
        `/api/elections/${electionId}/positions`
      ).send({ name: 'Presidente', seats: 1 });

      expect(res.status).toBe(201);
      positionId = res.body.data.id;
    });

    it('rechaza un cargo con nombre repetido (uq_positions_election_name)', async () => {
      const res = await comoAdmin(
        'post',
        `/api/elections/${electionId}/positions`
      ).send({ name: 'Presidente' });

      expect(res.status).toBe(409);
    });

    it('guarda acronym vacío como null (la BD no admite cadena en blanco)', async () => {
      const res = await comoAdmin(
        'post',
        `/api/elections/${electionId}/candidate-lists`
      ).send({ name: 'Unidad Estudiantil', acronym: '', motto: '   ' });

      expect(res.status).toBe(201);
      expect(res.body.data.acronym).toBeNull();
      expect(res.body.data.motto).toBeNull();
      listId = res.body.data.id;
    });

    it('registra una candidatura resolviendo la FK compuesta', async () => {
      const res = await comoAdmin(
        'post',
        `/api/elections/${electionId}/candidacies`
      ).send({
        candidate_list_id: listId,
        user_id: studentId,
        position_id: positionId,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.institutional_id).toBeDefined();
    });

    it('impide que el mismo usuario sea candidato dos veces', async () => {
      const res = await comoAdmin(
        'post',
        `/api/elections/${electionId}/candidacies`
      ).send({ candidate_list_id: listId, user_id: studentId });

      expect(res.status).toBe(409);
    });

    it('no borra un cargo que tiene candidaturas', async () => {
      const res = await comoAdmin(
        'delete',
        `/api/elections/${electionId}/positions/${positionId}`
      );

      expect(res.status).toBe(409);
    });

    it('devuelve el quórum como número, no como cadena', async () => {
      const res = await comoAdmin(
        'post',
        `/api/elections/${electionId}/rules`
      ).send({ min_turnout_percentage: 33.33 });

      expect(res.status).toBe(201);
      expect(typeof res.body.data.min_turnout_percentage).toBe('number');
      expect(res.body.data.min_turnout_percentage).toBe(33.33);
    });
  });
});
