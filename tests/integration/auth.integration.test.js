/**
 * Auth — pruebas de integración HTTP (app + BD real)
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createAcademicFixture } from './academic.fixture.js';

jest.unstable_mockModule('../../src/shared/services/email.service.js', () => {
  const hasEmailConfigured = jest.fn().mockReturnValue(false);
  const sendVerification = jest.fn().mockResolvedValue(true);
  const sendReset = jest.fn().mockResolvedValue(true);
  const sendAdminActivation = jest.fn().mockResolvedValue(true);
  const sendActivation = jest.fn().mockResolvedValue(true);
  const sendRequestReceived = jest.fn().mockResolvedValue(true);
  return {
    hasEmailConfigured,
    sendVerification,
    sendReset,
    sendActivation,
    sendAdminActivation,
    sendRequestReceived,
    default: {
      hasEmailConfigured,
      sendVerification,
      sendReset,
      sendActivation,
      sendAdminActivation,
      sendRequestReceived,
    },
  };
});

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');
const env = (await import('../../src/config/env.js')).default;

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

    // Política 2FA: el login de un rol sin 2FA devuelve staging (onboarding),
    // no un JWT. Para ejercitar rutas protegidas firmamos el token directo.
    authToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        scopeLevel: user.scopeLevel ?? null,
        regionId: user.regionId ?? null,
        isSuperuser: user.isSuperuser ?? false,
        isStaff: user.isStaff ?? false,
      },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
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

    it('Deberia iniciar sesion y retornar etapa de onboarding (politica 2FA)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Roles no-SUPERADMIN sin 2FA no reciben sesión directa: staging.
      expect(res.body.data.email).toBe(testEmail);
      expect(res.body.data.requiresOnboarding).toBe(true);
      expect(res.body.data.tempToken).toBeDefined();
      expect(res.body.data.token).toBeUndefined();
      expect(res.body.data.refreshToken).toBeUndefined();
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
    it('no existe auto-registro: la peticion es rechazada (401 sin sesion)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: `register.${runId}`,
          email: `auth.register.${runId}@campusvote.edu.pe`,
          password: 'Register123!',
          firstName: 'Nuevo',
          lastName: 'Usuario',
          institutionalId: `REG${runId}`,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
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