/**
 * Períodos académicos por institución — pruebas de integración HTTP + BD real.
 *
 * Antes los períodos eran de toda la plataforma: la restricción de fechas era
 * global, así que si una universidad activaba su 2026-II, ninguna otra podía
 * activar el suyo, y "marcar activo" apagaba el período de TODAS. Desde
 * academic/014 cada institución tiene los suyos.
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
  userElectionLimiter: () => (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');

const PASSWORD = 'PeriodosTest123!';
// Coste bajo a propósito: en pruebas solo hace falta que el hash valide, y
// 12 rondas por usuario saturan la CPU cuando corren todas las suites juntas.
const BCRYPT_ROUNDS = 4;
const runId = Date.now();

const tokens = {};
const users = {};
let orgA;
let orgB;
let periodoA;
let periodoB;

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.token;
};

const createAdmin = async ({ key, organizationId }) => {
  const user = await prisma.user.create({
    data: {
      username: `per.${key}.${runId}`,
      email: `per.${key}.${runId}@campusvote.edu.pe`,
      password: await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS),
      firstName: 'Periodo',
      lastName: key,
      institutionalId: `PER${key}${runId}`.slice(0, 50),
      role: 'ADMIN',
      scopeLevel: 'ORG',
      authProvider: 'LOCAL',
      isVerified: true,
      status: 'ACTIVE',
      mustChangePassword: false,
      organizationId,
    },
  });
  users[key] = user;
  tokens[key] = await login(user.email);
  return user;
};

const api = (method, url, key) => request(app)[method](url).set('Authorization', `Bearer ${tokens[key]}`);

describe('Períodos académicos por institución (HTTP + BD)', () => {
  beforeAll(async () => {
    orgA = await prisma.organization.create({
      data: { name: `Org Períodos A ${runId}`, code: `PEA${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org Períodos B ${runId}`, code: `PEB${runId}` },
    });
    await createAdmin({ key: 'adminA', organizationId: orgA.id });
    await createAdmin({ key: 'adminB', organizationId: orgB.id });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('dos instituciones pueden tener su 2026-II activo al mismo tiempo', async () => {
    const cuerpo = {
      name: `2026-II ${runId}`,
      start_date: '2026-08-01',
      end_date: '2026-12-20',
      is_active: true,
    };

    const resA = await api('post', '/api/academic/periods', 'adminA').send(cuerpo);
    expect(resA.status).toBe(201);
    periodoA = resA.body.data;

    const resB = await api('post', '/api/academic/periods', 'adminB').send(cuerpo);
    expect(resB.status).toBe(201);
    periodoB = resB.body.data;

    expect(periodoA.organizationId).toBe(orgA.id);
    expect(periodoB.organizationId).toBe(orgB.id);
    expect(periodoA.isActive).toBe(true);
    expect(periodoB.isActive).toBe(true);
  });

  it('activar el período de una institución no apaga el de la otra', async () => {
    const otro = await api('post', '/api/academic/periods', 'adminA').send({
      name: `2027-I ${runId}`,
      start_date: '2027-03-01',
      end_date: '2027-07-20',
    });
    expect(otro.status).toBe(201);

    const activado = await api(
      'patch',
      `/api/academic/periods/${otro.body.data.id}/active`,
      'adminA'
    );
    expect(activado.status).toBe(200);

    const deB = await prisma.academicPeriod.findUnique({ where: { id: periodoB.id } });
    expect(deB.isActive).toBe(true);

    const anteriorDeA = await prisma.academicPeriod.findUnique({ where: { id: periodoA.id } });
    expect(anteriorDeA.isActive).toBe(false);
  });

  it('dentro de la misma institución las fechas activas no se solapan (409)', async () => {
    const res = await api('post', '/api/academic/periods', 'adminA').send({
      name: `2027-I bis ${runId}`,
      start_date: '2027-04-01',
      end_date: '2027-06-30',
      is_active: true,
    });
    expect(res.status).toBe(409);
  });

  it('cada admin solo ve los períodos de su institución', async () => {
    const res = await api('get', '/api/academic/periods?take=100', 'adminB');
    expect(res.status).toBe(200);

    const nombres = res.body.data.map((p) => p.name);
    expect(nombres).toContain(`2026-II ${runId}`);
    expect(nombres).not.toContain(`2027-I ${runId}`);
  });

  it('un admin no puede abrir el período de otra institución (404)', async () => {
    const res = await api('get', `/api/academic/periods/${periodoA.id}`, 'adminB');
    expect(res.status).toBe(404);
  });

  it('la feria puede colgarse de un período de su propia institución', async () => {
    const res = await api('post', '/api/fairs', 'adminA').send({
      name: `Feria con período ${runId}`,
      academic_period_id: periodoA.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.academic_period.name).toBe(`2026-II ${runId}`);
  });

  it('pero no de uno ajeno (400)', async () => {
    const res = await api('post', '/api/fairs', 'adminA').send({
      name: `Feria con período ajeno ${runId}`,
      academic_period_id: periodoB.id,
    });
    expect(res.status).toBe(400);
  });

  it('un período con ferias no se puede eliminar (409)', async () => {
    const res = await api('delete', `/api/academic/periods/${periodoA.id}`, 'adminA');
    expect(res.status).toBe(409);
  });
});
