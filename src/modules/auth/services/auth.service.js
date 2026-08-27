/**
 * Auth Service — login, register, password reset, verificación de email
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as authRepository from '../repositories/auth.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { sendReset, sendVerification } from '../../../shared/services/email.service.js';
import { generateJwt, formatUserResponse } from './auth.helpers.js';
import MESSAGES from '../../../constants/messages.js';
import env from '../../../config/env.js';
import logger from '../../../config/logger.js';

export { setupTotp, verifyTotp, verifyLoginTotp } from './auth.totp.service.js';

const SALT_ROUNDS = 12;
// Hash dummy precalculado para mitigar ataques de timing en login
const DUMMY_HASH = '$2a$12$eImiTXuWVxfM37uY4JANjOL.88KV7VO594dK/WJv5gT2d.B/Xo89a';

export const login = async ({ email, password, ipAddress = null, userAgent = null }) => {
  const cleanEmail = email.toLowerCase().trim();

  const user = await authRepository.findByEmail(cleanEmail);

  // Prevenir enumeración de usuarios mediante comparación de tiempo simulada
  if (!user || user.authProvider !== 'LOCAL') {
    await bcrypt.compare(password, DUMMY_HASH);
    throw ApiError.unauthorized(MESSAGES.AUTH.LOGIN_FAILED);
  }

  const isAllowed = await authRepository.loginIsAllowed(user.email);
  if (!isAllowed) {
    throw new ApiError(423, MESSAGES.AUTH.LOGIN_LOCKED, null, 'ACCOUNT_LOCKED');
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    await authRepository.registerFailedLogin(user.email);
    throw ApiError.unauthorized(MESSAGES.AUTH.LOGIN_FAILED);
  }

  if (!user.isVerified) {
    throw ApiError.forbidden(MESSAGES.AUTH.LOGIN_EMAIL_NOT_VERIFIED);
  }

  if (user.twoFactorEnabled) {
    const tempToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'TOTP_PENDING' },
      env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    return {
      requiresTotp: true,
      tempToken,
      mustChangePassword: user.mustChangePassword,
    };
  }

  // Registrar login exitoso enviando metadata de auditoría a Postgres
  await authRepository.registerSuccessfulLogin(user.email, ipAddress, userAgent);

  const token = generateJwt(user);

  return {
    requiresTotp: false,
    token,
    mustChangePassword: user.mustChangePassword,
    user: formatUserResponse(user),
  };
};

export const register = async (userData) => {
  const {
    email,
    username,
    password,
    institutionalId,
    firstName,
    lastName,
    role = 'STUDENT',
    organizationId,
    facultyId,
    programId,
    currentCycle,
    admissionPeriodId,
    specialty,
    department,
  } = userData;

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.toLowerCase().trim();

  const existingEmail = await authRepository.findByEmail(cleanEmail);
  if (existingEmail) {
    throw ApiError.conflict(MESSAGES.USER.ALREADY_EXISTS);
  }

  const existingUsername = await authRepository.findByUsername(cleanUsername);
  if (existingUsername) {
    throw ApiError.conflict(MESSAGES.USER.USERNAME_TAKEN);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Pasa todos los datos académicos requeridos por los check constraints de PostgreSQL
  const newUser = await authRepository.createUser({
    username: cleanUsername,
    email: cleanEmail,
    password: hashedPassword,
    firstName,
    lastName,
    institutionalId,
    role,
    authProvider: 'LOCAL',
    mustChangePassword: false,
    organizationId,
    facultyId,
    programId,
    currentCycle,
    admissionPeriodId,
    specialty,
    department,
  });

  const verificationToken = await authRepository.generateEmailVerificationToken(newUser.id);

  if (verificationToken) {
    try {
      await sendVerification({
        email: cleanEmail,
        token: verificationToken,
        firstName,
      });
    } catch (error) {
      logger.error('Registro OK pero falló envío de verificación', {
        userId: newUser.id,
        error: error.message,
      });
      throw ApiError.serviceUnavailable(
        MESSAGES.AUTH.REGISTER_EMAIL_FAILED,
        { userId: newUser.id },
        'REGISTER_EMAIL_FAILED'
      );
    }
  } else {
    logger.warn('No se pudo generar token de verificación para el usuario', {
      userId: newUser.id,
    });
  }

  logger.info('Usuario registrado exitosamente', { userId: newUser.id });

  return { user: formatUserResponse(newUser) };
};

export const logout = async ({ userId, tokenHash }) => {
  if (tokenHash) {
    // Invalida la sesión activa en refresh_tokens
    await authRepository.revokeRefreshToken(tokenHash);
  } else if (userId) {
    // Invalida todas las sesiones activas del usuario
    await authRepository.revokeAllUserRefreshTokens(userId);
  }

  logger.info('Logout efectuado correctamente', { userId });
  return { loggedOut: true };
};

export const getProfile = async (userId) => {
  const user = await authRepository.findById(userId);
  if (!user) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  return formatUserResponse(user);
};

export const requestPasswordReset = async (email) => {
  const cleanEmail = email.toLowerCase().trim();
  const token = await authRepository.generatePasswordResetToken(cleanEmail);

  if (token) {
    try {
      await sendReset({ email: cleanEmail, token });
      logger.info('Correo de restablecimiento enviado exitosamente');
    } catch (error) {
      logger.error('Token de restablecimiento generado pero falló el envío del correo', {
        error: error.message,
      });
      throw ApiError.serviceUnavailable(
        MESSAGES.AUTH.EMAIL_SEND_FAILED,
        null,
        'EMAIL_SEND_FAILED'
      );
    }
  } else {
    logger.info('Solicitud de restablecimiento procesada');
  }

  return {
    message: MESSAGES.AUTH.PASSWORD_RESET_REQUESTED,
  };
};

export const resetPassword = async (token, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const success = await authRepository.resetPasswordWithToken(token, hashedPassword);

  if (!success) {
    throw ApiError.badRequest(MESSAGES.AUTH.PASSWORD_RESET_INVALID_TOKEN);
  }

  logger.info('Contraseña restablecida exitosamente');

  return { message: MESSAGES.AUTH.PASSWORD_RESET_SUCCESS };
};

export const verifyEmail = async (token) => {
  const success = await authRepository.verifyEmailWithToken(token);

  if (!success) {
    throw ApiError.badRequest(MESSAGES.AUTH.EMAIL_VERIFICATION_INVALID);
  }

  logger.info('Correo verificado exitosamente');

  return { message: MESSAGES.AUTH.EMAIL_VERIFIED_SUCCESS };
};