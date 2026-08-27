import bcrypt from 'bcryptjs';
import * as otpRepository from '../repositories/otp.repository.js';
import * as otpUtil from '../../../shared/utils/otp.util.js';
import OTP_CONSTANTS from '../../../constants/otp.constants.js';
import { ApiError } from '../../../shared/errors/ApiError.js';

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
    backupCodes: otpUtil.generateBackupCodes(),
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

  await otpRepository.enableTwoFactor(userId, hashedBackupCodes);

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
export const verifyBackupCodeLogin = async (userId, backupCode) => {
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

  return { 
    valid: true, 
    remainingCodes: updatedCodes.length 
  };
};

/**
 * Manejador unificado de 2FA para Login (TOTP o Backup Code)
 */
export const verifyLoginTotp = async (userId, payload) => {
  const { code, backupCode } = typeof payload === 'object' ? payload : { code: payload };

  if (backupCode) {
    return verifyBackupCodeLogin(userId, backupCode);
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

  return { valid: true };
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

export default {
  setupTotp,
  verifyAndEnableTotp,
  verifyTotp,
  verifyLoginTotp,
  verifyBackupCodeLogin,
  disableTotp,
};