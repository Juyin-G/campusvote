/**
 * Integration Test: activación de administrador proveniente de la aprobación
 * de una solicitud de organización.
 *
 * El approve genera el `activationToken` (SQL `approve_request_for_admin_activation`,
 * almacenado en organization_requests.activation_token_hash) que solo consume
 * `activate_organization_request`. Se verifica:
 * 1. approve 200 con `_debugToken` (solo en entornos no-producción).
 * 2. /onboarding/activate consume el token, crea org + ADMIN y emite un
 *    tempToken con purpose=ONBOARDING (contrato requiereOnboarding).
 * 3. /onboarding/totp/setup → verify → /finalize entrega la sesión completa.
 * 4. Un token ya usado o inválido falla con 401 (Token inválido o expirado).
 */
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { generateSync } from 'otplib';

/** Genera el TOTP actual (otplib v13: generateSync(options)). */
const generateTotpCode = (secret) =>
  generateSync({ secret, digits: 6, period: 30, epoch: Math.floor(Date.now() / 1000) });

jest.unstable_mockModule('../../src/shared/services/email.service.js', () => {
  const hasEmailConfigured = jest.fn().mockReturnValue(false);
  const sendVerification = jest.fn().mockResolvedValue(true);
  const sendReset = jest.fn().mockResolvedValue(true);
  const sendAdminActivation = jest.fn().mockResolvedValue(true);
  const sendRequestReceived = jest.fn().mockResolvedValue(true);
  return {
    hasEmailConfigured,
    sendVerification,
    sendReset,
    sendAdminActivation,
    sendActivation: sendAdminActivation,
    sendRequestReceived,
    default: {
      hasEmailConfigured,
      sendVerification,
      sendReset,
      sendAdminActivation,
      sendActivation: sendAdminActivation,
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

const TEST_PASSWORD = 'OrgActivation123!';
const runId = Date.now();
const adminEmail = `orgact.admin.${runId}@campusvote.edu.pe`;

let superAdmin;
let organizationRequest;
let approvedAdmin;
let authorizationToken;
let activationToken;
let onboardingToken;

const loginSuperAdmin = async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: superAdmin.email, password: TEST_PASSWORD });

  expect(res.status).toBe(200);
  return res.body.data.token;
};

describe('Auth: activación de admin aprobado (solicitud de organización)', () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

    // Revisor: SUPERADMIN con is_staff = TRUE (lo exige approve_request_for_admin_activation)
    superAdmin = await prisma.user.create({
      data: {
        username: `orgact.super.${runId}`,
        email: `orgact.super.${runId}@campusvote.edu.pe`,
        password: passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        institutionalId: `ORGACTSUPER${runId}`,
        role: 'SUPERADMIN',
        authProvider: 'LOCAL',
        isVerified: true,
        status: 'ACTIVE',
        mustChangePassword: false,
        twoFactorEnabled: false,
        isStaff: true,
      },
    });

    organizationRequest = await prisma.organizationRequest.create({
      data: {
        institutionName: `Instituto_${runId}`,
        institutionType: 'UNIVERSITY',
        country: 'PE',
        estimatedMembers: 500,
        contactEmail: adminEmail,
        status: 'PENDING',
      },
    });

    authorizationToken = await loginSuperAdmin();

    const approveRes = await request(app)
      .patch(`/api/organizations/requests/${organizationRequest.id}/approve`)
      .set('Authorization', `Bearer ${authorizationToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');
    expect(approveRes.body.data._debugToken).toBeDefined();
    activationToken = approveRes.body.data._debugToken;
  });

  afterAll(async () => {
    if (approvedAdmin?.id) {
      await prisma.user.delete({ where: { id: approvedAdmin.id } }).catch(() => {});
    }
    if (approvedAdmin?.organizationId) {
      await prisma.organization
        .delete({ where: { id: approvedAdmin.organizationId } })
        .catch(() => {});
    }
    if (organizationRequest?.id) {
      await prisma.organizationRequest
        .delete({ where: { id: organizationRequest.id } })
        .catch(() => {});
    }
    if (superAdmin?.id) {
      await prisma.user.delete({ where: { id: superAdmin.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('activa la cuenta con el token del approve: crea ADMIN PENDING_ACTIVATION y emite tempToken ONBOARDING', async () => {
    const res = await request(app)
      .post('/api/auth/onboarding/activate')
      .send({
        token: activationToken,
        new_password: 'ClaveDeAdminSegura123!',
      });

expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activated).toBe(true);
    expect(res.body.data.requiresOnboarding).toBe(true);
    expect(res.body.data.tempToken).toBeDefined();
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.user.status).toBe('PENDING_ACTIVATION');

    const decoded = jwt.verify(res.body.data.tempToken, env.JWT_SECRET);
    expect(decoded.purpose).toBe('ONBOARDING');

    // El admin creado debe existir con el email de la solicitud.
    approvedAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    expect(approvedAdmin).not.toBeNull();
    expect(approvedAdmin.role).toBe('ADMIN');
    expect(approvedAdmin.status).toBe('PENDING_ACTIVATION');
    expect(approvedAdmin.mustSetup2fa).toBe(true);

    onboardingToken = res.body.data.tempToken;
  });

  it('completa el onboarding: setup → verify TOTP → finalize entrega sesión completa', async () => {
    const setupRes = await request(app)
      .post('/api/auth/onboarding/totp/setup')
      .set('Authorization', `Bearer ${onboardingToken}`);

    expect(setupRes.status).toBe(200);
    expect(setupRes.body.data.secret).toBeDefined();

    const code = generateTotpCode(setupRes.body.data.secret);

    const verifyRes = await request(app)
      .post('/api/auth/onboarding/totp/verify')
      .set('Authorization', `Bearer ${onboardingToken}`)
      .send({ code });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.backupCodes).toBeDefined();

    const finalizeRes = await request(app)
      .post('/api/auth/onboarding/finalize')
      .set('Authorization', `Bearer ${onboardingToken}`);

    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.body.data.onboarded).toBe(true);
    expect(finalizeRes.body.data.token).toBeDefined();
    expect(finalizeRes.body.data.refreshToken).toBeDefined();

    const decoded = jwt.verify(finalizeRes.body.data.token, env.JWT_SECRET);
    expect(decoded.userId).toBe(approvedAdmin.id);

    const refreshed = await prisma.user.findUnique({ where: { id: approvedAdmin.id } });
    expect(refreshed.status).toBe('ACTIVE');
    expect(refreshed.twoFactorEnabled).toBe(true);
    expect(refreshed.mustSetup2fa).toBe(false);
  });

  it('rechaza el mismo token ya usado con 401 (Token inválido o expirado)', async () => {
    const res = await request(app)
      .post('/api/auth/onboarding/activate')
      .send({
        token: activationToken,
        new_password: 'OtraClaveSegura123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toContain('Token inválido o expirado');
  });

  it('rechaza un token inexistente con 401 (Token inválido o expirado)', async () => {
    const res = await request(app)
      .post('/api/auth/onboarding/activate')
      .send({
        token: 'a'.repeat(64),
        new_password: 'OtraClaveSegura123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});