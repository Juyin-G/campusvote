/**
 * Auth TOTP Service — configuración y verificación 2FA en login
 */
import * as authRepository from '../repositories/auth.repository.js';
import * as otpUtil from '../../../shared/utils/otp.util.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { generateJwt, formatUserResponse } from './auth.helpers.js';
import MESSAGES from '../../../constants/messages.js';
import logger from '../../../config/logger.js';

export const setupTotp = async (userId) => {
  const user = await authRepository.findById(userId);
  if (!user) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  if (user.twoFactorEnabled) {
    throw ApiError.conflict(
      MESSAGES.AUTH.TWO_FACTOR_ALREADY_CONFIGURED || 'El 2FA ya está activado',
    );
  }

  const secret = otpUtil.generateTotpSecret();
  const uri = otpUtil.generateTotpUri(secret, user.email, 'CampusVote');
  const qrCode = await otpUtil.generateQrCode(uri);

  await authRepository.saveTwoFactorSecret(userId, secret);

  return { secret, uri, qrCode };
};

export const verifyTotp = async (userId, code) => {
  const baseUser = await authRepository.findById(userId);
  if (!baseUser) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  const user = await authRepository.findByEmail(baseUser.email);

  if (!user?.twoFactorSecret) {
    throw ApiError.badRequest('Primero debes iniciar la configuración 2FA');
  }

  if (user.twoFactorEnabled) {
    throw ApiError.conflict('El 2FA ya se encuentra activado');
  }

  const isValid = otpUtil.verifyTotp(code, user.twoFactorSecret);
  if (!isValid) {
    throw ApiError.unauthorized(MESSAGES.AUTH.TWO_FACTOR_INVALID_CODE);
  }

  const plainBackupCodes = otpUtil.generateBackupCodes();
  const hashedBackupCodes = plainBackupCodes.map((c) => otpUtil.hashBackupCode(c));

  await authRepository.enableTwoFactor(userId, hashedBackupCodes);

  logger.info(`2FA activado exitosamente para el usuario: ${userId}`);

  return {
    enabled: true,
    backupCodes: plainBackupCodes,
  };
};

export const verifyLoginTotp = async (userId, code) => {
  const baseUser = await authRepository.findById(userId);
  if (!baseUser) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  const user = await authRepository.findByEmail(baseUser.email);

  if (!user?.twoFactorEnabled || !user?.twoFactorSecret) {
    throw ApiError.badRequest(MESSAGES.AUTH.TWO_FACTOR_NOT_CONFIGURED);
  }

  const isTotpValid = otpUtil.verifyTotp(code, user.twoFactorSecret);

  if (!isTotpValid) {
    const backupResult = otpUtil.verifyBackupCode(
      code,
      user.twoFactorBackupCodes || [],
    );

    if (!backupResult.valid) {
      throw ApiError.unauthorized(MESSAGES.AUTH.TWO_FACTOR_INVALID_CODE);
    }

    const updatedCodes = [...(user.twoFactorBackupCodes || [])];
    updatedCodes.splice(backupResult.index, 1);
    await authRepository.updateBackupCodes(userId, updatedCodes);
  }

  await authRepository.registerSuccessfulLogin(user.email);
  await authRepository.updateLastLogin(user.id);

  return {
    token: generateJwt(user),
    user: formatUserResponse(user),
  };
};