// src/modules/auth/services/auth.session.service.js
// Login + logout + refresh.

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '../../../database/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { AUTH_MESSAGES, LOGIN_STAGES, authError } from './auth.helpers.js';
import env from '../../../config/env.js';
import * as authRepository from '../repositories/auth.repository.js';
import auditService from '../../audit/audit.service.js';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1h

/**
 * Valida credenciales y devuelve el estado del flujo de autenticación.
 * NO emite tokens todavía: si el usuario requiere MFA o onboarding, el
 * controller devolverá un token TOTP_PENDING/ONBOARDING en lugar del token
 * principal.
 */
const validateCredentials = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.password) {
    throw authError(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }
  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    throw authError(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }
  return user;
};

export const login = async ({ email, password, ipAddress = null, userAgent = null }) => {
  const user = await validateCredentials(email, password);

  if (user.status === 'SUSPENDED' || user.lockedUntil && user.lockedUntil > new Date()) {
    throw authError(AUTH_MESSAGES.ACCOUNT_LOCKED);
  }

  // Resetear intentos fallidos en login exitoso.
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  // MFA pendiente: emitir token TOTP_PENDING (limitado).
  if (user.twoFactorEnabled && !user.twoFactorBackupCodes) {
    const pendingToken = await authRepository.createPendingSession({
      userId: user.id,
      ipAddress,
      userAgent,
      purpose: 'TOTP_PENDING',
      ttlSeconds: 600,
    });
    return {
      stage: LOGIN_STAGES.MFA_PENDING,
      pendingToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // Onboarding pendiente (debe configurar 2FA).
  if (user.mustSetup2fa) {
    const pendingToken = await authRepository.createPendingSession({
      userId: user.id,
      ipAddress,
      userAgent,
      purpose: 'ONBOARDING',
      ttlSeconds: 1800,
    });
    return {
      stage: LOGIN_STAGES.ONBOARDING_PENDING,
      pendingToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // Login completo: emitir access + refresh.
  const accessToken = crypto.randomBytes(32).toString('hex');
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await authRepository.createSession({
    userId: user.id,
    tokenHash,
    ipAddress,
    userAgent,
    ttlSeconds: env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  try {
    await auditService.logAction({
      actorId: user.id,
      action: 'LOGIN',
      metadata: { ip: ipAddress, user_agent: userAgent },
    });
  } catch (err) {
    /* auditoría no bloqueante */
  }

  return {
    stage: LOGIN_STAGES.FULL_AUTH,
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: { id: user.id, email: user.email, role: user.role },
  };
};

export const logout = async ({ userId, tokenHash, refreshToken }) => {
  if (refreshToken) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await authRepository.revokeSession(userId, hash);
  } else if (tokenHash) {
    await authRepository.revokeSession(userId, tokenHash);
  }
  return { loggedOut: true };
};

export const refreshSession = async (refreshToken) => {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const session = await authRepository.findSessionByHash(tokenHash);
  if (!session || session.revokedAt) {
    throw authError(AUTH_MESSAGES.TOKEN_INVALID);
  }
  if (session.expiresAt < new Date()) {
    throw authError(AUTH_MESSAGES.TOKEN_INVALID);
  }
  // Emite nuevo access token; opcionalmente rota el refresh.
  return {
    accessToken: crypto.randomBytes(32).toString('hex'),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: { id: session.userId },
  };
};
