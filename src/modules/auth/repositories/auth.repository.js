/**
 * Auth Repository
 * Interacción directa con tabla users, refresh_tokens + funciones SQL nativas
 */
import { prisma } from '../../../database/prisma.js';

const userAuthSelect = {
  id: true,
  email: true,
  username: true,
  password: true,
  authProvider: true,
  role: true,
  isActive: true,
  isVerified: true,
  isStaff: true,
  isSuperuser: true,
  firstName: true,
  lastName: true,
  institutionalId: true,
  organizationId: true,
  facultyId: true,
  programId: true,
  currentCycle: true,
  mustChangePassword: true,
  twoFactorEnabled: true,
  twoFactorSecret: true,
  twoFactorBackupCodes: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  lastLogin: true,
};

// BÚSQUEDAS

export const findByEmail = async (email) => {
  return prisma.user.findUnique({
    where: { email },
    select: userAuthSelect,
  });
};

export const findById = async (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      authProvider: true,
      role: true,
      isActive: true,
      isVerified: true,
      isStaff: true,
      isSuperuser: true,
      firstName: true,
      lastName: true,
      institutionalId: true,
      organizationId: true,
      facultyId: true,
      programId: true,
      currentCycle: true,
      mustChangePassword: true,
      twoFactorEnabled: true,
      lastLogin: true,
      dateJoined: true,
    },
  });
};

export const findByUsername = async (username) => {
  return prisma.user.findUnique({
    where: { username },
  });
};

export const findByGoogleId = async (googleId) => {
  return prisma.user.findFirst({
    where: { googleId },
  });
};

// CREACIÓN DE USUARIO CON CONSTRAINTS ACADÉMICOS

export const createUser = async (data) => {
  return prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      institutionalId: data.institutionalId,
      role: data.role || 'STUDENT',
      authProvider: data.authProvider || 'LOCAL',
      googleId: data.googleId || null,
      organizationId: data.organizationId || null,
      facultyId: data.facultyId || null,
      programId: data.programId || null,
      currentCycle: data.currentCycle || null,
      admissionPeriodId: data.admissionPeriodId || null,
      specialty: data.specialty || null,
      department: data.department || null,
      mustChangePassword: data.mustChangePassword ?? false,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      dateJoined: true,
    },
  });
};

// FUNCIONES SQL NATIVAS - LOGIN SECURITY & AUDITORÍA

export const loginIsAllowed = async (email) => {
  const result = await prisma.$queryRaw`
    SELECT login_is_allowed(${email}::text::citext) AS allowed
  `;

  return result[0]?.allowed ?? false;
};

export const registerFailedLogin = async (email) => {
  await prisma.$executeRaw`
    SELECT register_failed_login(${email}::text::citext)
  `;
};

export const registerSuccessfulLogin = async (email, ipAddress = null, userAgent = null) => {
  await prisma.$executeRaw`
    SELECT register_successful_login(
      ${email}::text::citext, 
      ${ipAddress}::inet, 
      ${userAgent}::text
    )
  `;
};

// FUNCIONES SQL NATIVAS - PASSWORD RESET

export const generatePasswordResetToken = async (email) => {
  const result = await prisma.$queryRaw`
    SELECT generate_password_reset_token(${email}::text::citext) AS token
  `;

  return result[0]?.token;
};

export const resetPasswordWithToken = async (token, newPasswordHash) => {
  const result = await prisma.$queryRaw`
    SELECT reset_password_with_token(${token}::text, ${newPasswordHash}::text) AS success
  `;

  return result[0]?.success ?? false;
};

// FUNCIONES SQL NATIVAS - EMAIL VERIFICATION

export const generateEmailVerificationToken = async (userId) => {
  const result = await prisma.$queryRaw`
    SELECT generate_email_verification_token(${userId}::text::uuid) AS token
  `;

  return result[0]?.token;
};

export const verifyEmailWithToken = async (token) => {
  const result = await prisma.$queryRaw`
    SELECT verify_email_with_token(${token}::text) AS success
  `;

  return result[0]?.success ?? false;
};

// GESTIÓN DE REFRESH TOKENS (SESIONES)

export const createRefreshToken = async ({ userId, tokenHash, expiresAt, ipAddress = null, userAgent = null }) => {
  return prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });
};

export const findRefreshToken = async (tokenHash) => {
  return prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
};

export const revokeRefreshToken = async (tokenHash) => {
  return prisma.refreshToken.deleteMany({
    where: { tokenHash },
  });
};

export const revokeAllUserRefreshTokens = async (userId) => {
  return prisma.refreshToken.deleteMany({
    where: { userId },
  });
};

// ACTUALIZACIONES DE USUARIO

export const updateLastLogin = async (userId) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      lastLogin: new Date(),
    },
  });
};

export const updatePassword = async (userId, newPasswordHash) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      password: newPasswordHash,
      mustChangePassword: false,
    },
  });
};

// 2FA - TOTP

export const saveTwoFactorSecret = async (userId, secret) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
    },
  });
};

export const enableTwoFactor = async (userId, backupCodes) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: backupCodes,
    },
  });
};

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

export const updateBackupCodes = async (userId, backupCodes) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorBackupCodes: backupCodes,
    },
  });
};