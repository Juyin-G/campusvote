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

  if (user.two_factor_enabled) {
    throw ApiError.conflict(OTP_CONSTANTS.MESSAGES.OTP_ALREADY_ENABLED);
  }

  const secret = otpUtil.generateTotpSecret();
  const uri = otpUtil.generateTotpUri(secret, user.email, user.username);

  // Guardamos el secreto temporalmente (aún no habilitado)
  await otpRepository.saveTotpSecret(userId, secret);

  return {
    secret,
    uri,
    backupCodes: otpUtil.generateBackupCodes(), // Preview, se regeneran al verificar
  };
};

/**
 * Verifica el código TOTP y habilita 2FA
 */
export const verifyAndEnableTotp = async (userId, totpCode) => {
  const user = await otpRepository.getUserWithTwoFactor(userId);

  if (!user || !user.two_factor_secret) {
    throw ApiError.badRequest('Primero debes iniciar la configuración de 2FA');
  }

  const isValid = otpUtil.verifyTotp(totpCode, user.two_factor_secret);

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
    backupCodes: plainBackupCodes, // Solo se muestran UNA VEZ
  };
};

/**
 * Verifica código TOTP durante login
 */
export const verifyLoginTotp = async (userId, totpCode) => {
  const user = await otpRepository.getUserWithTwoFactor(userId);

  if (!user?.two_factor_enabled) {
    throw ApiError.badRequest(OTP_CONSTANTS.MESSAGES.OTP_NOT_ENABLED);
  }

  const isValid = otpUtil.verifyTotp(totpCode, user.two_factor_secret);

  if (!isValid) {
    throw ApiError.badRequest(OTP_CONSTANTS.MESSAGES.OTP_CODE_INVALID);
  }

  return { valid: true };
};

/**
 * Verifica código de respaldo durante login
 */
export const verifyBackupCodeLogin = async (userId, backupCode) => {
  const user = await otpRepository.getUserWithTwoFactor(userId);

  if (!user?.two_factor_enabled) {
    throw ApiError.badRequest(OTP_CONSTANTS.MESSAGES.OTP_NOT_ENABLED);
  }

  const { valid, index } = otpUtil.verifyBackupCode(
    backupCode,
    user.two_factor_backup_codes
  );

  if (!valid) {
    throw ApiError.badRequest(OTP_CONSTANTS.MESSAGES.BACKUP_CODE_INVALID);
  }

  // Eliminamos el código usado
  const updatedCodes = [...user.two_factor_backup_codes];
  updatedCodes.splice(index, 1);
  await otpRepository.updateBackupCodes(userId, updatedCodes);

  return { 
    valid: true, 
    remainingCodes: updatedCodes.length 
  };
};

/**
 * Deshabilita 2FA
 */
export const disableTotp = async (userId) => {
  const user = await otpRepository.getUserWithTwoFactor(userId);

  if (!user?.two_factor_enabled) {
    throw ApiError.badRequest(OTP_CONSTANTS.MESSAGES.OTP_NOT_ENABLED);
  }

  await otpRepository.disableTwoFactor(userId);

  return { message: OTP_CONSTANTS.MESSAGES.OTP_DISABLED };
};

export default {
  setupTotp,
  verifyAndEnableTotp,
  verifyLoginTotp,
  verifyBackupCodeLogin,
  disableTotp,
};