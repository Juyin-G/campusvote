import prisma from '../../../config/prisma.js';

/**
 * Obtiene información 2FA del usuario
 */
export const getUserWithTwoFactor = async (userId) => {
  return prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      two_factor_enabled: true,
      two_factor_secret: true,
      two_factor_backup_codes: true,
    },
  });
};

/**
 * Guarda el secreto TOTP (pendiente de activación)
 */
export const saveTotpSecret = async (userId, secret) => {
  return prisma.users.update({
    where: { id: userId },
    data: {
      two_factor_secret: secret,
      two_factor_enabled: false,
    },
  });
};

/**
 * Habilita 2FA guardando los códigos de respaldo (hasheados)
 */
export const enableTwoFactor = async (userId, hashedBackupCodes) => {
  return prisma.users.update({
    where: { id: userId },
    data: {
      two_factor_enabled: true,
      two_factor_backup_codes: hashedBackupCodes,
    },
  });
};

/**
 * Deshabilita 2FA completamente
 */
export const disableTwoFactor = async (userId) => {
  return prisma.users.update({
    where: { id: userId },
    data: {
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_backup_codes: [],
    },
  });
};

/**
 * Actualiza los códigos de respaldo (ej. al consumir uno)
 */
export const updateBackupCodes = async (userId, backupCodes) => {
  return prisma.users.update({
    where: { id: userId },
    data: { 
      two_factor_backup_codes: backupCodes 
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