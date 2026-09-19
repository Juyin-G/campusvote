// src/modules/auth/services/auth.lifecycle.service.js
// Activación de cuenta, onboarding, recuperación de contraseña, verificación email.
// Usa prisma directamente (no requiere repos adicionales).

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '../../../database/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { AUTH_MESSAGES, authError } from './auth.helpers.js';
import * as otpRepository from '../repositories/otp.repository.js';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** Busca un token de activación por su hash (helper Prisma). */
const findActivationToken = async (tokenHash) =>
  prisma.activationToken.findUnique({ where: { tokenHash } });

/** Busca un token de password reset por su hash. */
const findPasswordResetToken = async (tokenHash) =>
  prisma.passwordResetToken.findUnique({ where: { tokenHash } });

/** Busca un token de verificación de email por su hash. */
const findEmailVerificationToken = async (tokenHash) =>
  prisma.emailVerificationToken.findUnique({ where: { tokenHash } });

export const activateAccount = async (rawToken, newPassword) => {
  const token = await findActivationToken(sha256(rawToken));
  if (!token || token.usedAt || token.expiresAt < new Date()) {
    throw authError(AUTH_MESSAGES.TOKEN_INVALID);
  }
  await prisma.user.update({
    where: { id: token.userId },
    data: {
      password: await bcrypt.hash(newPassword, 12),
      mustChangePassword: false,
      status: 'ACTIVE',
      isVerified: true,
    },
  });
  await prisma.activationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  return { activated: true };
};

export const finalizeOnboarding = async ({
  userId,
  newPassword,
  totpSecret,
  backupCodes,
}) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: await bcrypt.hash(newPassword, 12),
      mustChangePassword: false,
      mustSetup2fa: false,
      twoFactorEnabled: true,
      status: 'ACTIVE',
    },
  });
  await otpRepository.saveTotpSecret(userId, totpSecret);
  await otpRepository.enableTwoFactor(
    userId,
    (backupCodes || []).map((c) => c)
  );
  return { onboarded: true };
};

export const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      twoFactorEnabled: true,
      mustChangePassword: true,
      lastLogin: true,
    },
  });
  if (!user) throw ApiError.notFound('Usuario no encontrado');
  return user;
};

export const requestPasswordReset = async (email) => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Por seguridad, no revelar si el email existe.
  if (!user) return { requested: true };
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { requested: true, _debugToken: process.env.NODE_ENV === 'production' ? undefined : rawToken };
};

export const resetPassword = async (rawToken, newPassword) => {
  const token = await findPasswordResetToken(sha256(rawToken));
  if (!token || token.usedAt || token.expiresAt < new Date()) {
    throw authError(AUTH_MESSAGES.TOKEN_INVALID);
  }
  await prisma.user.update({
    where: { id: token.userId },
    data: { password: await bcrypt.hash(newPassword, 12) },
  });
  await prisma.passwordResetToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });
  return { reset: true };
};

export const verifyEmail = async (token) => {
  const record = await findEmailVerificationToken(sha256(token));
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw authError(AUTH_MESSAGES.TOKEN_INVALID);
  }
  await prisma.user.update({
    where: { id: record.userId },
    data: { isVerified: true },
  });
  await prisma.emailVerificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return { verified: true };
};

export const resendVerification = async (email) => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return { sent: true };
  return { sent: true, userId: user.id };
};
