// src/modules/auth/services/auth.helpers.js
// Helpers y constantes del módulo de autenticación.
// Incluye funciones de generación de tokens (JWT + refresh) reusadas por
// los sub-servicios (session, totp, lifecycle).

import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { ApiError } from '../../../shared/errors/ApiError.js';
import env from '../../../config/env.js';
import { formatUserResponse } from '../../../shared/utils/formatUserResponse.js';

export { formatUserResponse };

// Etapas del login por tipo de usuario.
export const LOGIN_STAGES = {
  CREDENTIALS_VALIDATED: 'CREDENTIALS_VALIDATED',
  MFA_PENDING: 'MFA_PENDING',
  ONBOARDING_PENDING: 'ONBOARDING_PENDING',
  FULL_AUTH: 'FULL_AUTH',
};

export const ACCOUNT_STATUS = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  SUSPENDED: 'SUSPENDED',
};

export const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  ACCOUNT_LOCKED: 'Cuenta bloqueada por intentos fallidos',
  ACCOUNT_SUSPENDED: 'Cuenta suspendida',
  MFA_REQUIRED: 'Se requiere 2FA',
  TOKEN_INVALID: 'Token inválido o expirado',
};

/** TTL de los tokens temporales de propósito limitado (segundos). */
export const PENDING_TOKEN_TTL = {
  TOTP_PENDING: 600,
  ONBOARDING: 1800,
};

/** Wrapper para errores de autenticación (401). */
export const authError = (message, code = 'UNAUTHORIZED') =>
  new ApiError(401, message, null, code);

/** Genera un Access Token JWT de vida corta. */
export const generateJwt = (user, expiresIn = env.JWT_EXPIRES_IN || '15m') =>
  jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      scopeLevel: user.scopeLevel ?? null,
      regionId: user.regionId ?? null,
      isSuperuser: user.isSuperuser,
      isStaff: user.isStaff,
    },
    env.JWT_SECRET,
    { expiresIn }
  );

/** Genera un refresh token opaco (no JWT) y devuelve (token, hash). */
export const generateRefreshToken = () => {
  const token = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
};

/** Genera un token temporal (TOTP_PENDING / ONBOARDING) de propósito limitado. */
export const generatePendingToken = ({
  userId,
  email,
  role = null,
  purpose,
  ttlSeconds,
}) =>
  jwt.sign(
    {
      userId,
      email,
      role,
      purpose,
    },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ttlSeconds }
  );
