import { prisma } from '../../../database/prisma.js';

/**
 * Obtiene información 2FA del usuario
 */
export const getUserWithTwoFactor = async (userId) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });
};

/**
 * Guarda el secreto TOTP (pendiente de activación)
 */
export const saveTotpSecret = async (userId, secret) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
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

/**
 * Deshabilita 2FA completamente
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
 * Actualiza los códigos de respaldo (ej. al consumir uno)
 */
export const updateBackupCodes = async (userId, backupCodes) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorBackupCodes: backupCodes,
    },
  });
};

export default {
  getUserWithTwoFactor,
  saveTotpSecret,
  enableTwoFactor,
  disableTwoFactor,
  updateBackupCodes,
};
