/**
 * Security Test: TOTP-pending JWT bypass vulnerability
 * 
 * This test suite verifies that the MFA bypass vulnerability is properly mitigated.
 * The vulnerability allowed users with 2FA enabled to use a TOTP_PENDING token
 * (issued after password validation but before TOTP verification) to access
 * ordinary authenticated routes like /api/users/me and /api/users/me/password.
 * 
 * The fix ensures that:
 * 1. The standard `authenticate` middleware rejects TOTP_PENDING tokens
 * 2. Only the TOTP verification route accepts TOTP_PENDING tokens via `authenticateAllowPending`
 * 3. State-changing operations (password change, profile update) require completed MFA
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { generateSync } from 'otplib';

/** Genera el TOTP actual (otplib v13: generateSync(options) con secret >= 16 bytes base32). */
const generateTotpCode = (secret) =>
  generateSync({ secret, digits: 6, period: 30, epoch: Math.floor(Date.now() / 1000) });
import { createAcademicFixture } from './academic.fixture.js';

// Mock email service to prevent actual emails
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

// Mock rate limiters to avoid rate limiting during tests
jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');
const env = (await import('../../src/config/env.js')).default;

const TEST_PASSWORD = 'TotpBypass123!';
const USER_TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // Test TOTP secret (20 bytes base32)
const runId = Date.now();

let userWith2FA;
let userWithout2FA;
let baselineUser;
let superAdmin;
let totpPendingToken;
let validToken;

/** Flujo real paso 2 del login: login → tempToken → verificación TOTP → token. */
const completeTotpLogin = async (user) => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: TEST_PASSWORD });

  if (!loginRes.body?.data?.tempToken) {
    throw new Error('Login no emitió tempToken TOTP_PENDING');
  }

  const totpCode = generateTotpCode(USER_TOTP_SECRET);

  const verifyRes = await request(app)
    .post('/api/auth/otp/verify-login')
    .set('Authorization', `Bearer ${loginRes.body.data.tempToken}`)
    .send({ code: totpCode });

  return verifyRes.body?.data?.token;
};

describe('Security: TOTP-pending JWT bypass mitigation', () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
    const { program } = await createAcademicFixture(runId);

    // Create user WITH 2FA enabled
    userWith2FA = await prisma.user.create({
      data: {
        username: `totp.bypass.2fa.${runId}`,
        email: `totp.bypass.2fa.${runId}@campusvote.edu.pe`,
        password: passwordHash,
        firstName: 'TOTP',
        lastName: 'Enabled',
        institutionalId: `TOTP2FA${runId}`,
        role: 'STUDENT',
        authProvider: 'LOCAL',
        isVerified: true,
        status: 'ACTIVE',
        mustChangePassword: false,
        twoFactorEnabled: true,
        twoFactorSecret: USER_TOTP_SECRET, // Test TOTP secret
        programId: program.id,
        currentCycle: 5,
      },
    });

    // Usuario STUDENT con 2FA listo para completar TOTP (baseline de sesión válida)
    baselineUser = await prisma.user.create({
      data: {
        username: `totp.bypass.base.${runId}`,
        email: `totp.bypass.base.${runId}@campusvote.edu.pe`,
        password: passwordHash,
        firstName: 'Base',
        lastName: 'Line',
        institutionalId: `BASELINE${runId}`,
        role: 'STUDENT',
        authProvider: 'LOCAL',
        isVerified: true,
        status: 'ACTIVE',
        mustChangePassword: false,
        twoFactorEnabled: true,
        twoFactorSecret: USER_TOTP_SECRET,
        programId: program.id,
        currentCycle: 5,
      },
    });

    // Usuario SUPERADMIN sin 2FA (escenario A: exento de 2FA)
    superAdmin = await prisma.user.create({
      data: {
        username: `totp.bypass.super.${runId}`,
        email: `totp.bypass.super.${runId}@campusvote.edu.pe`,
        password: passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        institutionalId: `SUPER${runId}`,
        role: 'SUPERADMIN',
        authProvider: 'LOCAL',
        isVerified: true,
        status: 'ACTIVE',
        mustChangePassword: false,
        twoFactorEnabled: false,
      },
    });

    // Create user WITHOUT 2FA for comparison
    userWithout2FA = await prisma.user.create({
      data: {
        username: `totp.bypass.no2fa.${runId}`,
        email: `totp.bypass.no2fa.${runId}@campusvote.edu.pe`,
        password: passwordHash,
        firstName: 'No',
        lastName: 'TOTP',
        institutionalId: `NOTOTP${runId}`,
        role: 'STUDENT',
        authProvider: 'LOCAL',
        isVerified: true,
        status: 'ACTIVE',
        mustChangePassword: false,
        twoFactorEnabled: false,
        programId: program.id,
        currentCycle: 5,
      },
    });

    // Generate a TOTP_PENDING token (simulating what login returns for 2FA users)
    totpPendingToken = jwt.sign(
      { 
        userId: userWith2FA.id, 
        email: userWith2FA.email, 
        purpose: 'TOTP_PENDING' 
      },
      env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    // Get a valid, full-session token completing the real TOTP flow (escenario C)
    validToken = await completeTotpLogin(baselineUser);
  });

  afterAll(async () => {
    const idsToDelete = [
      userWith2FA?.id,
      userWithout2FA?.id,
      baselineUser?.id,
      superAdmin?.id,
    ].filter(Boolean);
    if (idsToDelete.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: idsToDelete } },
      }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('Exploit scenario: TOTP_PENDING token on ordinary routes', () => {
    it('should reject TOTP_PENDING token on GET /api/users/me with 403', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${totpPendingToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('verificación de dos factores');
    });

    it('should reject TOTP_PENDING token on PUT /api/users/me with 403', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${totpPendingToken}`)
        .send({ 
          first_name: 'Hacked', 
          last_name: 'Profile' 
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('verificación de dos factores');
    });

    it('should reject TOTP_PENDING token on POST /api/users/me/password with 403', async () => {
      const res = await request(app)
        .post('/api/users/me/password')
        .set('Authorization', `Bearer ${totpPendingToken}`)
        .send({ 
          current_password: TEST_PASSWORD,
          new_password: 'NewHackedPassword123!' 
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('verificación de dos factores');
    });

    it('should reject TOTP_PENDING token on GET /api/auth/me with 403', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${totpPendingToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Valid token behavior (baseline)', () => {
    it('should allow valid token on GET /api/users/me', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(baselineUser.id);
    });

    it('should allow valid token on PUT /api/users/me', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ 
          first_name: 'Updated', 
          last_name: 'Name' 
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name).toBe('Updated');
    });

    it('should allow valid token on POST /api/users/me/password', async () => {
  const res = await request(app)
    .post('/api/users/me/password')
    .set('Authorization', `Bearer ${validToken}`)
    .send({
      current_password: TEST_PASSWORD,
      new_password: 'NewValidPassword123!',
    });

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  await prisma.user.update({
    where: { id: baselineUser.id },
    data: {
      password: passwordHash,
    },
  });
});
  });


  describe('Login flow with 2FA enabled', () => {
    it('should return TOTP_PENDING token when logging in with 2FA enabled', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ 
          email: userWith2FA.email, 
          password: TEST_PASSWORD 
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresTotp).toBe(true);
      expect(res.body.data.tempToken).toBeDefined();
      expect(res.body.data.token).toBeUndefined();
      
      // Verify the tempToken has TOTP_PENDING purpose
      const decoded = jwt.verify(res.body.data.tempToken, env.JWT_SECRET);
      expect(decoded.purpose).toBe('TOTP_PENDING');
      expect(decoded.userId).toBe(userWith2FA.id);
    });

    it('should require onboarding (tempToken ONBOARDING) when logging in without 2FA (regla: no SUPERADMIN sin 2FA no recibe sesión)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ 
          email: userWithout2FA.email, 
          password: TEST_PASSWORD 
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresOnboarding).toBe(true);
      expect(res.body.data.tempToken).toBeDefined();
      expect(res.body.data.email).toBe(userWithout2FA.email);
      expect(res.body.data.token).toBeUndefined();
      expect(res.body.data.refreshToken).toBeUndefined();
      
      // Verify the tempToken has ONBOARDING purpose
      const decoded = jwt.verify(res.body.data.tempToken, env.JWT_SECRET);
      expect(decoded.purpose).toBe('ONBOARDING');
      expect(decoded.userId).toBe(userWithout2FA.id);
    });
  });

  describe('TOTP verification route (should accept TOTP_PENDING)', () => {
    it('should accept TOTP_PENDING token on POST /api/auth/totp/login-verify', async () => {
      // This should accept the token but fail on TOTP validation (expected)
      const res = await request(app)
        .post('/api/auth/totp/login-verify')
        .set('Authorization', `Bearer ${totpPendingToken}`)
        .send({ totp_code: '000000' }); // Invalid code

      // Should NOT be 403 (forbidden due to token type)
      // Should be 400 or 401 (invalid TOTP code)
      expect(res.status).not.toBe(403);
      expect([400, 401]).toContain(res.status);
    });

    it('should reject normal token on POST /api/auth/totp/login-verify', async () => {
      const res = await request(app)
        .post('/api/auth/totp/login-verify')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ totp_code: '000000' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('sesión temporal de verificación TOTP');
    });
  });

  describe('Token purpose validation', () => {
    it('should reject token with missing Authorization header', async () => {
      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject token with invalid Bearer format', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', totpPendingToken); // Missing "Bearer "

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject expired TOTP_PENDING token', async () => {
      const expiredToken = jwt.sign(
        { 
          userId: userWith2FA.id, 
          email: userWith2FA.email, 
          purpose: 'TOTP_PENDING' 
        },
        env.JWT_SECRET,
        { expiresIn: '-1s' } // Already expired
      );

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
      expect(res.body.error.message).toContain('expiró');
    });

    it('should reject malformed JWT', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Cross-route consistency', () => {
    const protectedRoutes = [
      { method: 'get', path: '/api/users/me' },
      { method: 'put', path: '/api/users/me', body: { first_name: 'Test' } },
      { method: 'post', path: '/api/users/me/password', body: { current_password: TEST_PASSWORD, new_password: 'New123!' } },
      { method: 'get', path: '/api/auth/me' },
    ];

    protectedRoutes.forEach(({ method, path, body }) => {
      it(`should consistently reject TOTP_PENDING on ${method.toUpperCase()} ${path}`, async () => {
        const req = request(app)[method](path)
          .set('Authorization', `Bearer ${totpPendingToken}`);
        
        if (body) {
          req.send(body);
        }

        const res = await req;

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
        expect(res.body.error.message).toContain('verificación de dos factores');
      });
    });
  });

  describe('Security property: MFA completion required', () => {
    it('should enforce that TOTP_PENDING tokens cannot perform state-changing operations', async () => {
      // Attempt multiple state-changing operations with TOTP_PENDING token
      const operations = [
        request(app)
          .put('/api/users/me')
          .set('Authorization', `Bearer ${totpPendingToken}`)
          .send({ first_name: 'Hacked' }),
        
        request(app)
          .post('/api/users/me/password')
          .set('Authorization', `Bearer ${totpPendingToken}`)
          .send({ current_password: TEST_PASSWORD, new_password: 'Hacked123!' }),
      ];

      const results = await Promise.all(operations);

      // All should be rejected with 403
      results.forEach(res => {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      // Verify user data was NOT modified
      const user = await prisma.user.findUnique({
        where: { id: userWith2FA.id },
      });

      expect(user.firstName).toBe('TOTP'); // Original value
      
      // Verify password was NOT changed
      const passwordValid = await bcrypt.compare(TEST_PASSWORD, user.password);
      expect(passwordValid).toBe(true);
    });

    it('should enforce that only completed MFA sessions can access protected resources', async () => {
      // TOTP_PENDING token should not be able to read sensitive data
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${totpPendingToken}`);

      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
      
      // Verify no user data was leaked
      expect(res.body).not.toHaveProperty('data.email');
      expect(res.body).not.toHaveProperty('data.id');
    });
  });

  describe('Middleware behavior verification', () => {
    it('should verify authenticate middleware rejects TOTP_PENDING by default', async () => {
      // Test that the standard authenticate middleware is being used
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${totpPendingToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('verificación de dos factores');
    });

    it('should verify authenticateAllowPending is only used on TOTP verification route', async () => {
      // TOTP verification route should accept TOTP_PENDING
      const totpRes = await request(app)
        .post('/api/auth/totp/login-verify')
        .set('Authorization', `Bearer ${totpPendingToken}`)
        .send({ totp_code: '000000' });

      // Should not be 403 (token type rejection)
      expect(totpRes.status).not.toBe(403);

      // Other routes should reject TOTP_PENDING
      const otherRes = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${totpPendingToken}`);

      expect(otherRes.status).toBe(403);
    });
  });

  describe('Business rule: 2FA por rol (escenarios A-G)', () => {
    it('A: SUPERADMIN sin 2FA → sesión completa (token + refreshToken, sin tempToken)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: superAdmin.email, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresTotp).toBe(false);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.tempToken).toBeUndefined();

      const decoded = jwt.verify(res.body.data.token, env.JWT_SECRET);
      expect(decoded.purpose).toBeUndefined();
      expect(decoded.userId).toBe(superAdmin.id);
    });

    it('B: rol con 2FA → requiresTotp + tempToken, NUNCA token antes de 2FA', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: userWith2FA.email, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.data.requiresTotp).toBe(true);
      expect(res.body.data.tempToken).toBeDefined();
      expect(res.body.data.token).toBeUndefined();
      expect(res.body.data.refreshToken).toBeUndefined();
    });

    it('C: TOTP correcto → token + refreshToken + user', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: userWith2FA.email, password: TEST_PASSWORD });

      const code = generateTotpCode(USER_TOTP_SECRET);

      const verifyRes = await request(app)
        .post('/api/auth/otp/verify-login')
        .set('Authorization', `Bearer ${loginRes.body.data.tempToken}`)
        .send({ code });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.token).toBeDefined();
      expect(verifyRes.body.data.refreshToken).toBeDefined();
      expect(verifyRes.body.data.user).toBeDefined();
      // remainingCodes solo aplica al flujo de backup code.
      expect(verifyRes.body.data.remainingCodes).toBeUndefined();
    });

    it('D: TOTP incorrecto → 400 y sin sesión', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: userWith2FA.email, password: TEST_PASSWORD });

      const verifyRes = await request(app)
        .post('/api/auth/otp/verify-login')
        .set('Authorization', `Bearer ${loginRes.body.data.tempToken}`)
        .send({ code: '000000' });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.data).toBeUndefined();
      expect(verifyRes.body.success).toBe(false);
    });

    it('E+F: sin 2FA → ONBOARDING tempToken rechazado en rutas protegidas (403)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: userWithout2FA.email, password: TEST_PASSWORD });

      expect(loginRes.body.data.requiresOnboarding).toBe(true);
      expect(loginRes.body.data.token).toBeUndefined();

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${loginRes.body.data.tempToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('G: rol/userId/organizationId del body son ignorados', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userWith2FA.email,
          password: TEST_PASSWORD,
          role: 'SUPERADMIN',
          userId: 'spoofed-id',
          organizationId: 'spoofed-org',
        });

      // Sigue siendo STUDENT con 2FA → requiere TOTP; jamás sesión completa.
      expect(res.status).toBe(200);
      expect(res.body.data.requiresTotp).toBe(true);
      expect(res.body.data.token).toBeUndefined();
    });
  });
});
