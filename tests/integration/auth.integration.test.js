/**
 * Auth — pruebas de integración HTTP (app + BD real)
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createAcademicFixture } from './academic.fixture.js';

jest.unstable_mockModule('../../src/shared/services/email.service.js', () => ({
  sendVerification: jest.fn().mockResolvedValue(true),
  sendReset: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
  userElectionLimiter: () => (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');

const TEST_PASSWORD = 'AuthTest123!';
const runId = Date.now();
const testEmail = `auth.test.${runId}@campusvote.edu.pe`;
const testUsername = `auth.test.${runId}`;

let testUserId;
let authToken;
let programId;

describe('Auth Integration (HTTP + DB)', () => {
  beforeAll(async () => {
    const { program } = await createAcademicFixture(runId);
    programId = program.id;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

    const user = await prisma.user.create({
      data: {
        username: testUsername,
        email: testEmail,
        password: passwordHash,
        firstName: 'Auth',
        lastName: 'Test',
        institutionalId: `AUTH${runId}`,
        role: 'STUDENT',
        authProvider: 'LOCAL',
        isVerified: true,
        status: 'ACTIVE',
        mustChangePassword: false,
        programId,
        currentCycle: 5,
      },
    });

    testUserId = user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('POST /api/auth/login', () => {
    it('Deberia rechazar body invalido con 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'no-es-email', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('Deberia rechazar credenciales incorrectas con 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('Deberia iniciar sesion exitosamente y retornar JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.requiresTotp).toBe(false);
      expect(res.body.data.user.email).toBe(testEmail);

      authToken = res.body.data.token;
    });
  });

  describe('GET /api/auth/me', () => {
    it('Deberia rechazar peticion sin token con 401', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('Deberia retornar perfil con token valido', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testEmail);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('Deberia cerrar sesion con token valido', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.loggedOut).toBe(true);
    });
  });

  describe('POST /api/auth/password/forgot', () => {
    it('Deberia responder 200 aunque el email exista (sin filtrar usuarios)', async () => {
      const res = await request(app)
        .post('/api/auth/password/forgot')
        .send({ email: testEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/register', () => {
    const registerEmail = `auth.register.${runId}@campusvote.edu.pe`;

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: registerEmail } }).catch(() => {});
    });

    it('Deberia registrar un usuario nuevo con 201', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: `register.${runId}`,
          email: registerEmail,
          password: 'Register123!',
          firstName: 'Nuevo',
          lastName: 'Usuario',
          institutionalId: `REG${runId}`,
          programId,
          currentCycle: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(registerEmail);
    });

    it('Deberia rechazar email duplicado con 409', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: `register.dup.${runId}`,
          email: registerEmail,
          password: 'Register123!',
          firstName: 'Otro',
          lastName: 'Usuario',
          institutionalId: `REGDUP${runId}`,
          programId,
          currentCycle: 3,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('Repositorio login SQL (VOID functions)', () => {
    it('registerSuccessfulLogin no deberia lanzar DATABASE_QUERY_FAILED', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.error?.code).not.toBe('DATABASE_QUERY_FAILED');
    });
  });
});