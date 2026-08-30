// src/modules/auth/services/auth.helpers.js

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../../../config/env.js';
import { formatUserResponse } from '../../../shared/utils/formatUserResponse.js';

export { formatUserResponse };

/**
 * Genera un Access Token JWT de vida corta (15m por defecto)
 */
export const generateJwt = (user, expiresIn = env.JWT_EXPIRES_IN || '15m') => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      isSuperuser: user.isSuperuser,
      isStaff: user.isStaff,
    },
    env.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Genera un Refresh Token aleatorio de alta entropía y su hash SHA-256 para guardar en BD
 */
export const generateRefreshToken = () => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  return { rawToken, tokenHash };
};

/**
 * Hash de un Refresh Token para búsquedas en BD
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export default {
  generateJwt,
  generateRefreshToken,
  hashToken,
  formatUserResponse,
};