/**
 * Auth Repository
 * Interacción directa con tabla users + funciones SQL nativas
 */
import { prisma } from '../../../config/prisma.js';

// BÚSQUEDAS

export const findByEmail = async (email) => {
  return prisma.users.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      password: true,
      auth_provider: true,
      role: true,
      is_active: true,
      is_verified: true,
      is_staff: true,
      is_superuser: true,
      first_name: true,
      last_name: true,
      institutional_id: true,
      organization_id: true,
      must_change_password: true,
      two_factor_enabled: true,
      two_factor_secret: true,
      two_factor_backup_codes: true,
      failed_login_attempts: true,
      locked_until: true,
      last_login: true,
    },
  });
};

export const findById = async (id) => {
  return prisma.users.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      auth_provider: true,
      role: true,
      is_active: true,
      is_verified: true,
      is_staff: true,
      is_superuser: true,
      first_name: true,
      last_name: true,
      institutional_id: true,
      organization_id: true,
      must_change_password: true,
      two_factor_enabled: true,
      last_login: true,
      date_joined: true,
    },
  });
};

export const findByUsername = async (username) => {
  return prisma.users.findUnique({
    where: { username },
  });
};

export const findByGoogleId = async (googleId) => {
  return prisma.users.findFirst({
    where: { google_id: googleId },
  });
};

// CREACIÓN

export const createUser = async (data) => {
  return prisma.users.create({
    data: {
      username: data.username,
      email: data.email,
      password: data.password,
      first_name: data.first_name,
      last_name: data.last_name,
      institutional_id: data.institutional_id,
      role: data.role || 'STUDENT',
      auth_provider: data.auth_provider || 'LOCAL',
      google_id: data.google_id || null,
      organization_id: data.organization_id || null,
      must_change_password: data.must_change_password ?? true,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      is_active: true,
      date_joined: true,
    },
  });
};

// FUNCIONES SQL NATIVAS - LOGIN SECURITY

export const loginIsAllowed = async (email) => {
  const result = await prisma.$queryRaw`
    SELECT login_is_allowed(${email}) AS allowed
  `;
  return result[0]?.allowed ?? false;
};

export const registerFailedLogin = async (email) => {
  await prisma.$queryRaw`
    SELECT register_failed_login(${email})
  `;
};

export const registerSuccessfulLogin = async (email) => {
  await prisma.$queryRaw`
    SELECT register_successful_login(${email})
  `;
};

// FUNCIONES SQL NATIVAS - PASSWORD RESET

export const generatePasswordResetToken = async (email) => {
  const result = await prisma.$queryRaw`
    SELECT generate_password_reset_token(${email}) AS token
  `;
  return result[0]?.token;
};

export const resetPasswordWithToken = async (token, newPasswordHash) => {
  const result = await prisma.$queryRaw`
    SELECT reset_password_with_token(${token}, ${newPasswordHash}) AS success
  `;
  return result[0]?.success ?? false;
};

// FUNCIONES SQL NATIVAS - EMAIL VERIFICATION

export const generateEmailVerificationToken = async (userId) => {
  const result = await prisma.$queryRaw`
    SELECT generate_email_verification_token(${userId}::uuid) AS token
  `;
  return result[0]?.token;
};

export const verifyEmailWithToken = async (token) => {
  const result = await prisma.$queryRaw`
    SELECT verify_email_with_token(${token}) AS success
  `;
  return result[0]?.success ?? false;
};

// ACTUALIZACIONES

export const updateLastLogin = async (userId) => {
  return prisma.users.update({
    where: { id: userId },
    data: { last_login: new Date() },
  });
};

export const updatePassword = async (userId, newPasswordHash) => {
  return prisma.users.update({
    where: { id: userId },
    data: {
      password: newPasswordHash,
      must_change_password: false,
    },
  });
};

// 2FA - TOTP

export const saveTwoFactorSecret = async (userId, secret) => {
  return prisma.users.update({
    where: { id: userId },
    data: { two_factor_secret: secret },
  });
};

export const enableTwoFactor = async (userId, backupCodes) => {
  return prisma.users.update({
    where: { id: userId },
    data: {
      two_factor_enabled: true,
      two_factor_backup_codes: backupCodes,
    },
  });
};

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

export const updateBackupCodes = async (userId, backupCodes) => {
  return prisma.users.update({
    where: { id: userId },
    data: { two_factor_backup_codes: backupCodes },
  });
};