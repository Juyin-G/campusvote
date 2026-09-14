/**
 * Auth Service — login, password reset, verificación de email
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as authRepository from '../repositories/auth.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { sendReset, sendVerification } from '../../../shared/services/email.service.js';
import { generateJwt, formatUserResponse, generateRefreshToken, hashToken } from './auth.helpers.js';
import MESSAGES from '../../../constants/messages.js';
import env from '../../../config/env.js';
import logger from '../../../config/logger.js';
import auditService from '../../audit/audit.service.js';
import { prisma } from '../../../database/prisma.js';

export { setupTotp, verifyTotp, verifyLoginTotp } from './auth.totp.service.js';

const SALT_ROUNDS = 12;
// Hash dummy precalculado para mitigar ataques de timing en login
const DUMMY_HASH = '$2a$12$eImiTXuWVxfM37uY4JANjOL.88KV7VO594dK/WJv5gT2d.B/Xo89a';

// Convierte una duración estilo jsonwebtoken ('30d', '7h', '15m', '3600') a milisegundos
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

export const login = async ({ email, password, ipAddress = null, userAgent = null }) => {
  const cleanEmail = email.toLowerCase().trim();

  const user = await authRepository.findByEmail(cleanEmail);

  // Prevenir enumeración de usuarios mediante comparación de tiempo simulada
  if (!user || user.authProvider !== 'LOCAL') {
    await bcrypt.compare(password, DUMMY_HASH);
    throw ApiError.unauthorized(MESSAGES.AUTH.LOGIN_FAILED);
  }

  // login_is_allowed rechaza por dos motivos distintos: bloqueo temporal por
  // intentos fallidos, o cuenta no ACTIVE (pendiente, suspendida...).
  const isAllowed = await authRepository.loginIsAllowed(user.email);
  if (!isAllowed) {
    const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;
    if (lockedUntil && lockedUntil > new Date()) {
      const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
      throw new ApiError(
        423,
        MESSAGES.AUTH.LOGIN_LOCKED.replace('{minutes}', String(minutes)),
        null,
        'ACCOUNT_LOCKED'
      );
    }
    // Cuenta no activa: solo se informa a quien conoce la contraseña, para no
    // revelar el estado de una cuenta ajena.
    const passwordMatches = await bcrypt.compare(password, user.password || DUMMY_HASH);
    if (!passwordMatches) {
      throw ApiError.unauthorized(MESSAGES.AUTH.LOGIN_FAILED);
    }
    throw new ApiError(
      403,
      'Tu cuenta no está activa. Contacta al administrador de tu institución.',
      null,
      'ACCOUNT_INACTIVE'
    );
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    await authRepository.registerFailedLogin(user.email);
    throw ApiError.unauthorized(MESSAGES.AUTH.LOGIN_FAILED);
  }

  if (!user.isVerified) {
    throw ApiError.forbidden(MESSAGES.AUTH.LOGIN_EMAIL_NOT_VERIFIED);
  }

  if (user.twoFactorEnabled) {
    const tempToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'TOTP_PENDING' },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return {
      requiresTotp: true,
      tempToken,
      mustChangePassword: user.mustChangePassword,
    };
  }

  if (user.mustSetup2fa) {
    const tempToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'ONBOARDING' },
      env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    return {
      requiresOnboarding: true,
      requiresTotp: false,
      tempToken,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
    };
  }

  // Registrar login exitoso enviando metadata de auditoría a Postgres
  await authRepository.registerSuccessfulLogin(user.email, ipAddress, userAgent);

  const token = generateJwt(user);

  try {
    await auditService.logAction({
      actorId: user.id,
      electionId: null,
      action: 'LOGIN',
      ipAddress,
      metadata: { method: 'password', must_change_password: user.mustChangePassword },
    });
  } catch (error) {
    logger.warn('No se pudo registrar el login en auditoría', { error: error.message });
  }

  // Persistir el refresh token para la sesión actual (flujo completo)
  const { rawToken: refreshToken, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN));
  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return {
    requiresTotp: false,
    token,
    refreshToken,
    mustChangePassword: user.mustChangePassword,
    user: formatUserResponse(user),
  };
};

export const activateAccount = async (rawToken, newPassword) => {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const rows = await prisma.$queryRaw`
    SELECT activate_organization_request(
      ${rawToken}::text,
      ${passwordHash}::text
    ) AS user_id
  `;
  const userId = rows[0]?.user_id;

  if (!userId) {
    throw ApiError.badRequest('El enlace de activación es inválido o expiró.');
  }

  const user = await authRepository.findById(userId);
  if (!user) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  const tempToken = jwt.sign(
    { userId: user.id, email: user.email, purpose: 'ONBOARDING' },
    env.JWT_SECRET,
    { expiresIn: '30m' }
  );

  return {
    requiresOnboarding: true,
    tempToken,
    user: formatUserResponse(user),
  };
};

export const finalizeOnboarding = async (
  userId,
  { ipAddress = null, userAgent = null } = {}
) => {
  const user = await authRepository.findById(userId);

  if (!user) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  if (!user.twoFactorEnabled || user.status !== 'ACTIVE') {
    throw ApiError.forbidden(
      'Completa la configuración de autenticación antes de continuar.'
    );
  }

  const token = generateJwt(user);
  const { rawToken: refreshToken, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN));

  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return {
    requiresOnboarding: false,
    token,
    refreshToken,
    mustChangePassword: false,
    user: formatUserResponse(user),
  };
};

export const logout = async ({ userId, tokenHash, refreshToken }) => {
  if (refreshToken) {
    // Invalida la sesión concreta asociada al refresh token proporcionado
    await authRepository.revokeRefreshToken(hashToken(refreshToken));
  } else if (tokenHash) {
    // Invalida la sesión activa en refresh_tokens
    await authRepository.revokeRefreshToken(tokenHash);
  } else if (userId) {
    // Invalida todas las sesiones activas del usuario
    await authRepository.revokeAllUserRefreshTokens(userId);
  }

  logger.info('Logout efectuado correctamente', { userId });
  return { loggedOut: true };
};

/**
 * Renueva la sesión a partir de un refresh token válido y no revocado.
 */
export const refreshSession = async (refreshToken) => {
  const tokenHash = hashToken(refreshToken);
  const stored = await authRepository.findRefreshToken(tokenHash);

  const invalid = !stored ||
    stored.revokedAt ||
    !stored.user ||
    stored.user.status !== 'ACTIVE' ||
    (stored.expiresAt && new Date(stored.expiresAt) < new Date());

  if (invalid) {
    throw ApiError.unauthorized(MESSAGES.AUTH.TOKEN_INVALID);
  }

  const user = stored.user;
  const token = generateJwt(user);

  return {
    token,
    refreshToken,
    user: formatUserResponse(user),
  };
};

export const getProfile = async (userId) => {
  const user = await authRepository.findById(userId);
  if (!user) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  return formatUserResponse(user);
};

export const requestPasswordReset = async (email) => {
  const cleanEmail = email.toLowerCase().trim();
  const token = await authRepository.generatePasswordResetToken(cleanEmail);

  if (token) {
    try {
      await sendReset({ email: cleanEmail, token });
      logger.info('Correo de restablecimiento enviado exitosamente');
    } catch (error) {
      logger.error('Token de restablecimiento generado pero falló el envío del correo', {
        error: error.message,
      });
      throw ApiError.serviceUnavailable(
        MESSAGES.AUTH.EMAIL_SEND_FAILED,
        null,
        'EMAIL_SEND_FAILED'
      );
    }
  } else {
    logger.info('Solicitud de restablecimiento procesada');
  }

  return {
    message: MESSAGES.AUTH.PASSWORD_RESET_REQUESTED,
  };
};

export const resetPassword = async (token, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const success = await authRepository.resetPasswordWithToken(token, hashedPassword);

  if (!success) {
    throw ApiError.badRequest(MESSAGES.AUTH.PASSWORD_RESET_INVALID_TOKEN);
  }

  logger.info('Contraseña restablecida exitosamente');

  return { message: MESSAGES.AUTH.PASSWORD_RESET_SUCCESS };
};

export const verifyEmail = async (token) => {
  const success = await authRepository.verifyEmailWithToken(token);

  if (!success) {
    throw ApiError.badRequest(MESSAGES.AUTH.EMAIL_VERIFICATION_INVALID);
  }

  logger.info('Correo verificado exitosamente');

  return { message: MESSAGES.AUTH.EMAIL_VERIFIED_SUCCESS };
};

export const resendVerification = async (email) => {
  const cleanEmail = email.toLowerCase().trim();
  const user = await authRepository.findByEmail(cleanEmail);

  // Siempre responde lo mismo para no revelar qué correos están registrados.
  if (!user || user.isVerified) {
    return { message: MESSAGES.AUTH.EMAIL_VERIFICATION_SENT };
  }

  const token = await authRepository.generateEmailVerificationToken(user.id);

  if (!token) {
    return { message: MESSAGES.AUTH.EMAIL_VERIFICATION_SENT };
  }

  try {
    await sendVerification({
      email: cleanEmail,
      token,
      firstName: user.firstName,
    });
  } catch (error) {
    logger.error('Reenvío de verificación falló', {
      userId: user.id,
      error: error.message,
    });
    throw ApiError.serviceUnavailable(
      MESSAGES.AUTH.EMAIL_SEND_FAILED,
      null,
      'EMAIL_SEND_FAILED'
    );
  }

  return { message: MESSAGES.AUTH.EMAIL_VERIFICATION_SENT };
};