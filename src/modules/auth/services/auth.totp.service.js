import bcrypt from 'bcryptjs';
import * as otpRepository from '../repositories/otp.repository.js';
import * as authRepository from '../repositories/auth.repository.js';
import * as otpUtil from '../../../shared/utils/otp.util.js';
import OTP_CONSTANTS from '../../../constants/otp.constants.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import auditService from '../../audit/audit.service.js';
import logger from '../../../config/logger.js';
import { generateJwt, generateRefreshToken, formatUserResponse } from './auth.helpers.js';
import env from '../../../config/env.js';

const REFRESH_DURATION_RE = /^(\d+)\s*(ms|s|m|h|d)?$/i;
const durationToMs = (duration) => {
  const str = String(duration ?? '').trim();
  if (!str) return 7 * 24 * 60 * 60 * 1000;
  const match = str.match(REFRESH_DURATION_RE);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();
  const units = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * units[unit];
};

const issueSession = async (userId, { ipAddress = null, userAgent = null } = {}) => {
  const user = await authRepository.findById(userId);
  if (!user) throw ApiError.notFound('Usuario no encontrado');

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
    token,
    refreshToken,
    user: formatUserResponse(user),
  };
};

const log2FASuccess = async (userId, method) => {
  try {
    await auditService.logAction({
      actorId: userId,
      action: 'VERIFY_2FA',
      metadata: { method },
    });
  } catch (error) {
    logger.warn('No se pudo registrar VERIFY_2FA en auditoría', { error: error.message });
  }
};

/**
 * Inicia el proceso de configuración de 2FA
 */
export const setupTotp = async (userId) => {
  const user = await otpRepository.getUserWithTwoFactor(userId);

  if (!user) {
    throw ApiError.notFound('Usuario no encontrado');
  }

  if (user.twoFactorEnabled) {
    throw ApiError.conflict(OTP_CONSTANTS.MESSAGES.OTP_ALREADY_ENABLED);
  }

  const secret = otpUtil.generateTotpSecret();
  const uri = otpUtil.generateTotpUri(secret, user.email, user.username);

  // Guardamos el secreto temporalmente (aún no habilitado)
  await otpRepository.saveTotpSecret(userId, secret);

  return {
    secret,
    uri,
    qrCode: await otpUtil.generateQrCode(uri),
  };
};

/**
 * Verifica el código TOTP y habilita 2FA
 */
export const verifyAndEnableTotp = async (userId, totpCode) => {
  const user = await otpRepository.getUserWithTwoFactor(userId);

  if (!user || !user.twoFactorSecret) {
    throw ApiError.badRequest('Primero debes iniciar la configuración de 2FA');
  }

  const isValid = otpUtil.verifyTotp(totpCode, user.twoFactorSecret);

  if (!isValid) {
    throw ApiError.badRequest(OTP_CONSTANTS.MESSAGES.OTP_CODE_INVALID);
  }

  // Generamos códigos de respaldo definitivos
  const plainBackupCodes = otpUtil.generateBackupCodes();
  const hashedBackupCodes = plainBackupCodes.map((code) =>
    otpUtil.hashBackupCode(code)
  );

  await otpRepository.completeOnboardingTwoFactor(
    userId,
    hashedBackupCodes,
    user.status === 'PENDING_ACTIVATION'
  );

  return {
    message: OTP_CONSTANTS.MESSAGES.OTP_ENABLED,
    backupCodes: plainBackupCodes,
  };
};

// Alias para compatibilidad con auth.service.js
export const verifyTotp = verifyAndEnableTotp;

/**
 * Verifica código de respaldo durante login
 */
export const verifyBackupCodeLogin = async (userId, backupCode, meta = {}) => {
  const user = await otpRepository.getUserWithTwoFactor(userId);

  if (!user?.twoFactorEnabled) {
    throw ApiError.badRequest(OTP_CONSTANTS.MESSAGES.OTP_NOT_ENABLED);
  }

  const { valid, index } = otpUtil.verifyBackupCode(
    backupCode,
    user.twoFactorBackupCodes
  );

  if (!valid) {
    throw ApiError.badRequest(OTP_CONSTANTS.MESSAGES.BACKUP_CODE_INVALID);
  }

  // Eliminamos el código consumido
  const updatedCodes = [...user.twoFactorBackupCodes];
  updatedCodes.splice(index, 1);
  await otpRepository.updateBackupCodes(userId, updatedCodes);

  await log2FASuccess(userId, 'backup_code');

  const session = await issueSession(userId, meta);
  return { ...session, remainingCodes: updatedCodes.length };
};

/**
 * Manejador unificado de 2FA para Login (TOTP o Backup Code)
 */
export const verifyLoginTotp = async (userId, payload, meta = {}) => {
  const { code, backupCode } = typeof payload === 'object' ? payload : { code: payload };

  if (backupCode) {
    return verifyBackupCodeLogin(userId, backupCode, meta);
  }

  if (!code) {
    throw ApiError.badRequest('Debes proporcionar un código TOTP o un código de respaldo');
  }

  const user = await otpRepository.getUserWithTwoFactor(userId);

  if (!user?.twoFactorEnabled) {
    throw ApiError.badRequest(OTP_CONSTANTS.MESSAGES.OTP_NOT_ENABLED);
  }

  const isValid = otpUtil.verifyTotp(code, user.twoFactorSecret);

  if (!isValid) {
    throw ApiError.badRequest(OTP_CONSTANTS.MESSAGES.OTP_CODE_INVALID);
  }

  await log2FASuccess(userId, 'totp');

  return issueSession(userId, meta);
};

/**
 * Deshabilita 2FA (Verifica la contraseña del usuario)
 */
export const disableTotp = async (userId, password) => {
  const user = await otpRepository.getUserWithTwoFactor(userId);

  if (!user?.twoFactorEnabled) {
    throw ApiError.badRequest(OTP_CONSTANTS.MESSAGES.OTP_NOT_ENABLED);
  }

  if (!password) {
    throw ApiError.badRequest('Se requiere la contraseña para deshabilitar 2FA');
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw ApiError.unauthorized('Contraseña incorrecta');
  }

  await otpRepository.disableTwoFactor(userId);

  return { message: OTP_CONSTANTS.MESSAGES.OTP_DISABLED };
};

/**
 * Estado del 2FA del usuario autenticado.
 * Devuelve `two_factor_enabled` y el número de códigos de respaldo restantes
 * (nunca expone los códigos en sí, solo el conteo — spec §4.3).
 */
export const getTwoFactorStatus = async (userId) => {
  const user = await otpRepository.getUserWithTwoFactor(userId);

  if (!user) {
    throw ApiError.notFound('Usuario no encontrado');
  }

  const backupCodes = Array.isArray(user.twoFactorBackupCodes)
    ? user.twoFactorBackupCodes
    : [];

  return {
    twoFactorEnabled: user.twoFactorEnabled,
    backupCodesRemaining: user.twoFactorEnabled ? backupCodes.length : 0,
  };
};

export default {
  setupTotp,
  verifyAndEnableTotp,
  verifyTotp,
  verifyLoginTotp,
  verifyBackupCodeLogin,
  disableTotp,
  getTwoFactorStatus,
};