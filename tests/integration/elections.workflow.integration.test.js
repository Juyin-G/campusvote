/**
 * Elections — workflow de estados, integración HTTP (app + BD real)
 *
 * Recorre DRAFT → SCHEDULED → OPEN → CLOSED → CERTIFIED → PUBLISHED contra
 * PostgreSQL, incluida la función SQL certify_election(). Los tests unitarios
 * no llegan aquí porque mockean el repository.
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

const PASSWORD = 'ElectionsFlow123!';
const runId = Date.now();

const enDias = (dias) => new Date(Date.now() + dias * 86400000).toISOString();

let adminId;
let facultyId;
let periodId;
let adminToken;
let electionId;

const comoAdmin = (metodo, url) =>
  request(app)[metodo](url).set('Authorization', `Bearer ${adminToken}`);

const cambiar = (status) =>
  comoAdmin('patch', `/api/elections/${electionId}/status`).send({ status });

describe('Elections Workflow Integration (HTTP + DB)', () => {
  beforeAll(async () => {
    const admin = await prisma.user.create({
      data: {
        username: `flow.admin.${runId}`,
        email: `flow.admin.${runId}@campusvote.edu.pe`,
        password: await bcrypt.hash(PASSWORD, 12),
        firstName: 'Flow',
        lastName: 'Admin',
        institutionalId: `FADM${runId}`,
        role: 'ADMIN',
        authProvider: 'LOCAL',
        isVerified: true,
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    adminId = admin.id;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: PASSWORD });
    expect(login.status).toBe(200);
    adminToken = login.body.data.token;

    const faculty = await prisma.faculty.create({
      data: { name: `Facultad Flow ${runId}`, code: `FF${runId}`.slice(0, 20) },
    });
    facultyId = faculty.id;

    const period = await prisma.academicPeriod.create({
      data: {
        name: `PF-${runId}`.slice(0, 50),
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    periodId = period.id;

    const eleccion = await comoAdmin('post', '/api/elections').send({
      title: `Workflow ${runId}`,
      scope_type: 'FACULTY',
      faculty_id: facultyId,
      period_id: periodId,
      start_at: enDias(1),
      end_at: enDias(2),
    });
    expect(eleccion.status).toBe(201);
    electionId = eleccion.body.data.id;
  });

  afterAll(async () => {
    if (electionId) {
      await prisma.election.deleteMany({ where: { id: electionId } }).catch(() => {});
    }
    await prisma.academicPeriod.deleteMany({ where: { id: periodId } }).catch(() => {});
    await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: adminId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('no permite saltarse estados (DRAFT -> PUBLISHED)', async () => {
    const res = await cambiar('PUBLISHED');
    expect(res.status).toBe(409);
  });

  it('no deja programar una elección sin cargos definidos', async () => {
    const res = await cambiar('SCHEDULED');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('cargos');
  });

  it('DRAFT -> SCHEDULED una vez que existe al menos un cargo', async () => {
    const cargo = await comoAdmin(
      'post',
      `/api/elections/${electionId}/positions`
    ).send({ name: 'Presidente', seats: 1 });
    expect(cargo.status).toBe(201);

    const res = await cambiar('SCHEDULED');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SCHEDULED');
  });

  // EDITABLE_STATUSES admite DRAFT y SCHEDULED: mientras la votación no haya
  // empezado, la elección todavía se puede corregir.
  it('en SCHEDULED la elección todavía se puede editar', async () => {
    const res = await comoAdmin('patch', `/api/elections/${electionId}`).send({
      title: `Workflow ${runId} (corregido)`,
    });
    expect(res.status).toBe(200);
  });

  it('en SCHEDULED todavía se pueden añadir cargos', async () => {
    const res = await comoAdmin(
      'post',
      `/api/elections/${electionId}/positions`
    ).send({ name: 'Secretario' });
    expect(res.status).toBe(201);
  });

  it('SCHEDULED -> OPEN', async () => {
    const res = await cambiar('OPEN');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('OPEN');
  });

  // A partir de OPEN la papeleta queda congelada: ya hay gente votando.
  it('con la votación abierta ya no se puede editar la elección', async () => {
    const res = await comoAdmin('patch', `/api/elections/${electionId}`).send({
      title: 'No debería cambiar',
    });
    expect(res.status).toBe(409);
  });

  it('con la votación abierta ya no se pueden añadir cargos', async () => {
    const res = await comoAdmin(
      'post',
      `/api/elections/${electionId}/positions`
    ).send({ name: 'Tesorero' });
    expect(res.status).toBe(409);
  });

  it('OPEN -> CLOSED', async () => {
    const res = await cambiar('CLOSED');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CLOSED');
  });

  it('CLOSED -> PUBLISHED sigue sin permitirse (falta certificar)', async () => {
    const res = await cambiar('PUBLISHED');
    expect(res.status).toBe(409);
  });

  it('CLOSED -> CERTIFIED ejecuta certify_election y genera el acta', async () => {
    const res = await cambiar('CERTIFIED');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CERTIFIED');

    const acta = await prisma.electionResult.findUnique({
      where: { electionId },
    });
    expect(acta).not.toBeNull();
    expect(acta.certifiedAt).not.toBeNull();
  });

  it('CERTIFIED -> PUBLISHED cierra el ciclo', async () => {
    const res = await cambiar('PUBLISHED');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PUBLISHED');
  });

  it('PUBLISHED es estado final', async () => {
    const res = await cambiar('CLOSED');
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('final');
  });
});
