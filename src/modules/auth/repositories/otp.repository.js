import { prisma } from '../../../database/prisma.js';
import { decryptSecret, encryptSecret } from '../../../shared/utils/secretCrypto.js';
import { verifyBackupCode } from '../../../shared/utils/otp.util.js';

/**
 * Obtiene información de 2FA y credenciales de seguridad del usuario
 */
export const getUserWithTwoFactor = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      status: true,
      password: true, // Incluido para permitir validación en disableTotp
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });
  if (user?.twoFactorSecret) user.twoFactorSecret = decryptSecret(user.twoFactorSecret);
  return user;
};

/**
 * Guarda el secreto TOTP (pendiente de activación)
 */
export const saveTotpSecret = async (userId, secret) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: encryptSecret(secret),
      twoFactorEnabled: false,
    },
  });
};

/**
 * Habilita 2FA guardando los códigos de respaldo (hasheados)
 */
export const enableTwoFactor = async (userId, hashedBackupCodes) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: hashedBackupCodes,
    },
  });
};

export const completeOnboardingTwoFactor = async (userId, hashedBackupCodes, activateAccount) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: hashedBackupCodes,
      mustSetup2fa: false,
      ...(activateAccount ? { status: 'ACTIVE' } : {}),
    },
  });
};

/**
 * Deshabilita 2FA completamente limpiando secretos y códigos
 */
export const disableTwoFactor = async (userId) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  });
};

/**
 * Actualiza la lista de códigos de respaldo al consumir uno
 */
export const updateBackupCodes = async (userId, backupCodes) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorBackupCodes: backupCodes,
    },
  });
};

export const consumeBackupCode = async (userId, backupCode) =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT two_factor_backup_codes
      FROM users
      WHERE id = ${userId}::uuid
      FOR UPDATE
    `;
    const codes = rows[0]?.two_factor_backup_codes;
    const result = verifyBackupCode(backupCode, codes);
    if (!result.valid) return { valid: false, remainingCodes: Array.isArray(codes) ? codes.length : 0 };
    const updatedCodes = [...codes];
    updatedCodes.splice(result.index, 1);
    await tx.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: updatedCodes },
    });
    return { valid: true, remainingCodes: updatedCodes.length };
  });

export default {
  getUserWithTwoFactor,
  saveTotpSecret,
  enableTwoFactor,
  completeOnboardingTwoFactor,
  disableTwoFactor,
  updateBackupCodes,
  consumeBackupCode,
};