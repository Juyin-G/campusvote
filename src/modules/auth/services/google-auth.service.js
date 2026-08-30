// src/modules/auth/services/google-auth.service.js
// Flujo OAuth 2.0 con Google (login con cuenta de Google).
// Usa fetch nativo de Node (>=20) para el intercambio de código/token y la
// obtención del perfil, sin dependencias extra.

import * as authRepository from '../repositories/auth.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { generateJwt, generateRefreshToken } from './auth.helpers.js';
import { formatUserResponse } from '../../../shared/utils/formatUserResponse.js';
import env from '../../../config/env.js';
import logger from '../../../config/logger.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const durationToMs = (duration) => {
  const str = String(duration ?? '').trim();
  if (!str) return 7 * 24 * 60 * 60 * 1000;
  const match = str.match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();
  const units = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * units[unit];
};

/**
 * Verifica que la autenticación con Google esté configurada.
 */
const assertGoogleConfigured = () => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) {
    throw ApiError.serviceUnavailable(
      'Google OAuth no está configurado en el servidor',
      null,
      'GOOGLE_NOT_CONFIGURED'
    );
  }
};

/**
 * Build la URL de autorización para redirigir al navegador.
 * @param {string} state - token anti-CSRF
 */
export const getAuthUrl = (state) => {
  assertGoogleConfigured();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    state: state || '',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

/**
 * Intercambia el código de autorización por un perfil de Google.
 * @param {string} code
 */
export const getGoogleProfile = async (code) => {
  assertGoogleConfigured();

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    logger.error('Google token exchange failed', {
      status: tokenResponse.status,
    });
    throw ApiError.unauthorized('No se pudo intercambiar el código de Google');
  }

  const tokens = await tokenResponse.json();

  const userResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userResponse.ok) {
    throw ApiError.unauthorized('No se pudo obtener el perfil de Google');
  }

  return userResponse.json();
};

/**
 * Emite la sesión (access + refresh) para un usuario ya existente.
 */
const issueSession = async (user) => {
  const token = generateJwt(user);

  const { rawToken: refreshToken, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN));

  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  await authRepository.updateLastLogin(user.id);

  return {
    token,
    refreshToken,
    user: formatUserResponse(user),
  };
};

/**
 * Resuelve un usuario por su correo (que debe existir en la base de datos).
 * Si el usuario existe pero no tiene googleId, lo vincula (si el correo coincide).
 * @param {Object} profile - perfil de Google { id, email, name, ... }
 */
const resolveUser = async (profile) => {
  if (!profile?.email) {
    throw ApiError.unauthorized('Google no devolvió un correo válido');
  }

  const cleanEmail = profile.email.toLowerCase().trim();

  // Buscar por googleId o por email.
  let user = await authRepository.findByGoogleId(String(profile.id));
  if (!user) {
    user = await authRepository.findByEmail(cleanEmail);
  }

  if (!user) {
    throw ApiError.forbidden(
      'No existe una cuenta con este correo. Pídele a tu administrador que te registre.'
    );
  }

  // Vincular el googleId al usuario si aún no estaba vinculado.
  const needsGoogleId =
    (!user.googleId || user.googleId !== String(profile.id)) &&
    user.authProvider === 'LOCAL';

  if (needsGoogleId) {
    user = await authRepository.linkGoogleIdentity(user.id, String(profile.id));
  }

  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('La cuenta no está activa');
  }

  return user;
};

/**
 * Procesa el callback de Google: intercambia el código y devuelve la sesión.
 * @param {string} code
 */
export const authenticateWithGoogle = async (code) => {
  const profile = await getGoogleProfile(code);
  const user = await resolveUser(profile);
  return issueSession(user);
};

export default {
  getAuthUrl,
  authenticateWithGoogle,
  getGoogleProfile,
};
