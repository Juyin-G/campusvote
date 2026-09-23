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
const emailService = await import('../../src/shared/services/email.service.js');
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

  // resendVerification usaba sendVerification sin importarla: cualquier
  // reenvío terminaba en un 500 (ReferenceError).
  describe('POST /api/auth/verify-email/resend', () => {
    const pendienteEmail = `auth.unverified.${runId}@campusvote.edu.pe`;

    beforeAll(async () => {
      await prisma.user.create({
        data: {
          username: `auth.unverified.${runId}`,
          email: pendienteEmail,
          password: await bcrypt.hash(TEST_PASSWORD, 12),
          firstName: 'Sin',
          lastName: 'Verificar',
          institutionalId: `AUNV${runId}`,
          role: 'STUDENT',
          authProvider: 'LOCAL',
          isVerified: false,
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      });
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: pendienteEmail } }).catch(() => {});
    });

    it('reenvía el correo de verificación a un usuario sin verificar (200)', async () => {
      emailService.sendVerification.mockClear();

      const res = await request(app)
        .post('/api/auth/verify-email/resend')
        .send({ email: pendienteEmail.toUpperCase() });

      expect(res.status).toBe(200);
      expect(emailService.sendVerification).toHaveBeenCalledTimes(1);
      expect(emailService.sendVerification).toHaveBeenCalledWith(
        expect.objectContaining({ email: pendienteEmail, token: expect.any(String) })
      );
    });

    it('responde igual con un correo inexistente, sin enviar nada (no revela cuentas)', async () => {
      emailService.sendVerification.mockClear();

      const res = await request(app)
        .post('/api/auth/verify-email/resend')
        .send({ email: `nadie.${runId}@campusvote.edu.pe` });

      expect(res.status).toBe(200);
      expect(emailService.sendVerification).not.toHaveBeenCalled();
    });
  });

  // login_is_allowed rechaza tanto un bloqueo temporal como una cuenta no
  // ACTIVE; antes ambos casos respondían "bloqueada ... en {minutes} minutos".
  describe('POST /api/auth/login con cuenta bloqueada o inactiva', () => {
    const crear = async (sufijo, extra) =>
      prisma.user.create({
        data: {
          username: `auth.${sufijo}.${runId}`,
          email: `auth.${sufijo}.${runId}@campusvote.edu.pe`,
          password: await bcrypt.hash(TEST_PASSWORD, 12),
          firstName: 'Estado',
          lastName: sufijo,
          institutionalId: `AST${sufijo}${runId}`.slice(0, 50),
          role: 'STUDENT',
          authProvider: 'LOCAL',
          isVerified: true,
          mustChangePassword: false,
          ...extra,
        },
      });

    let suspendido;
    let bloqueado;

    beforeAll(async () => {
      suspendido = await crear('suspendido', { status: 'SUSPENDED' });
      bloqueado = await crear('bloqueado', {
        status: 'ACTIVE',
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      });
    });

    afterAll(async () => {
      await prisma.user
        .deleteMany({ where: { id: { in: [suspendido.id, bloqueado.id] } } })
        .catch(() => {});
    });

    it('una cuenta suspendida con la contraseña correcta recibe 403 ACCOUNT_INACTIVE', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: suspendido.email, password: TEST_PASSWORD });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('con contraseña incorrecta no revela que la cuenta está inactiva (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: suspendido.email, password: 'Incorrecta123!' });

      expect(res.status).toBe(401);
    });

    it('una cuenta bloqueada recibe 423 con los minutos reales, sin el marcador {minutes}', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: bloqueado.email, password: TEST_PASSWORD });

      expect(res.status).toBe(423);
      expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
      expect(res.body.error.message).not.toContain('{minutes}');
      expect(res.body.error.message).toMatch(/en 10 minutos/);
    });
  });
});
