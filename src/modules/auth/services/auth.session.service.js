// src/modules/auth/services/auth.session.service.js
// Login + logout + refresh.

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '../../../database/prisma.js';
import { ROLES } from '../../../constants/roles.js';
import {
  AUTH_MESSAGES,
  authError,
  generateJwt,
  generateRefreshToken,
  generatePendingToken,
  formatUserResponse,
  PENDING_TOKEN_TTL,
  ACCESS_TOKEN_TTL_SECONDS,
} from './auth.helpers.js';
import env from '../../../config/env.js';
import logger from '../../../config/logger.js';
import * as authRepository from '../repositories/auth.repository.js';
import auditService from '../../audit/audit.service.js';

const validateCredentials = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user || !user.password) {
    throw authError(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  const matches = await bcrypt.compare(password, user.password);

  if (!matches) {
    throw authError(AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  return user;
};

export const login = async ({
  email,
  password,
  ipAddress = null,
  userAgent = null,
}) => {
  const user = await validateCredentials(email, password);

  if (
    user.status === 'SUSPENDED' ||
    (user.lockedUntil && user.lockedUntil > new Date())
  ) {
    throw authError(AUTH_MESSAGES.ACCOUNT_LOCKED);
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  // Regla de negocio: solo SUPERADMIN obtiene sesión completa con credenciales.
  // Cualquier otro rol debe tener 2FA configurado y completarlo antes de recibir
  // un JWT definitivo. El rol siempre proviene de la BD (nunca del cliente).
  if (user.role !== ROLES.SUPERADMIN) {
    if (!user.twoFactorEnabled) {
      const tempToken = generatePendingToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        purpose: 'ONBOARDING',
        ttlSeconds: PENDING_TOKEN_TTL.ONBOARDING,
      });

      return {
        requiresOnboarding: true,
        tempToken,
        email: user.email,
        mustChangePassword: true,
        user: formatUserResponse(user),
      };
    }

    const tempToken = generatePendingToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      purpose: 'TOTP_PENDING',
      ttlSeconds: PENDING_TOKEN_TTL.TOTP_PENDING,
    });

    return {
      requiresTotp: true,
      tempToken,
      mustChangePassword: user.mustChangePassword ?? false,
      user: formatUserResponse(user),
    };
  }

  // SUPERADMIN: sesión completa tras validar credenciales.
  const token = generateJwt(user);

  // Refresh token opaco + hash para persistencia.
  const {
    token: refreshToken,
    tokenHash,
  } = generateRefreshToken();

  await authRepository.createSession({
    userId: user.id,
    tokenHash,
    ipAddress,
    userAgent,
    ttlSeconds:
      env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLogin: new Date(),
    },
  });

  try {
    await auditService.logAction({
      actorId: user.id,
      action: 'LOGIN',
      metadata: {
        ip: ipAddress,
        user_agent: userAgent,
      },
    });
  } catch (err) {
    // El fallo de auditoría no debe impedir el login.
    logger.warn('No se pudo registrar LOGIN en auditoría', {
      error: err.message,
    });
  }

  return {
    requiresTotp: false,
    token,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    mustChangePassword: user.mustChangePassword ?? false,
    user: formatUserResponse(user),
  };
};

export const logout = async ({
  userId,
  tokenHash,
  refreshToken,
}) => {
  if (refreshToken) {
    const hash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await authRepository.revokeSession(userId, hash);
  } else if (tokenHash) {
    await authRepository.revokeSession(userId, tokenHash);
  }

  return {
    loggedOut: true,
  };
};

export const refreshSession = async (refreshToken) => {
  const tokenHash = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');

  const session = await authRepository.findRefreshToken(tokenHash);

  if (!session || session.revokedAt) {
    throw authError(AUTH_MESSAGES.TOKEN_INVALID);
  }

  if (session.expiresAt < new Date()) {
    throw authError(AUTH_MESSAGES.TOKEN_INVALID);
  }

  // Generar un JWT real para que auth.middleware.js pueda
  // validarlo mediante jwt.verify().
  const token = generateJwt(session.user);

  return {
    token,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: formatUserResponse(session.user),
  };
};