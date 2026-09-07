/**
 * Auth Service — login, register, password reset, verificación de email
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as authRepository from '../repositories/auth.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { sendReset, sendVerification } from '../../../shared/services/email.service.js';
import { generateJwt, formatUserResponse, generateRefreshToken, hashToken } from './auth.helpers.js';
import MESSAGES from '../../../constants/messages.js';
import env from '../../../config/env.js';
import logger from '../../../config/logger.js';
import auditService from '../../audit/audit.service.js';
import { extractDomain } from '../../../shared/utils/emailDomain.js';
import { matchCareerFromCode, extractCycleFromCode } from '../../../shared/utils/careerParse.js';

export { setupTotp, verifyTotp, verifyLoginTotp } from './auth.totp.service.js';
export { authenticateWithFirebase } from './google-auth.service.js';

const SALT_ROUNDS = 12;
// Hash dummy precalculado para mitigar ataques de timing en login
const DUMMY_HASH = '$2a$12$eImiTXuWVxfM37uY4JANjOL.88KV7VO594dK/WJv5gT2d.B/Xo89a';

// Convierte una duración estilo jsonwebtoken ('30d', '7h', '15m', '3600') a milisegundos
const durationToMs = (duration) => {
  const str = String(duration ?? '').trim();
  if (!str) return 7 * 24 * 60 * 60 * 1000;
  const match = str.match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();
  const units = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * units[unit];
};

export const login = async ({ email, password, ipAddress = null, userAgent = null }) => {
  const cleanEmail = email.toLowerCase().trim();

  const user = await authRepository.findByEmail(cleanEmail);

  // Prevenir enumeración de usuarios mediante comparación de tiempo simulada
  if (!user || user.authProvider !== 'LOCAL') {
    await bcrypt.compare(password, DUMMY_HASH);
    throw ApiError.unauthorized(MESSAGES.AUTH.LOGIN_FAILED);
  }
  if (user.role === 'ADMIN' && !user.organizationId) {
    throw ApiError.forbidden('La cuenta ADMIN no está vinculada a una organización');
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

  // Onboarding (Opción 2): cuenta con credenciales temporales que aún debe
  // enrolar 2FA. NO se emite JWT final ni se pide TOTP aún; se entrega un
  // token de propósito ONBOARDING que solo permite las rutas /onboarding.
  if (user.mustSetup2fa) {
    const tempToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'ONBOARDING' },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return {
      requiresOnboarding: true,
      tempToken,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
    };
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

  try {
    await auditService.logAction({
      actorId: user.id,
      electionId: null,
      action: 'LOGIN',
      ipAddress,
      metadata: { method: 'password', must_change_password: user.mustChangePassword },
    });
  } catch (error) {
    logger.warn('No se pudo registrar el login en auditoría', { error: error.message });
  }

  // Persistir el refresh token para la sesión actual (flujo completo)
  const { rawToken: refreshToken, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN));
  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return {
    requiresTotp: false,
    token,
    refreshToken,
    mustChangePassword: user.mustChangePassword,
    user: formatUserResponse(user),
  };
};

/**
 * Opción 1 — Activa la cuenta del admin mediante el token de la invitación y
 * define su contraseña. Pasa de PENDING_ACTIVATION a una sesión de onboarding
 * (token ONBOARDING) para configurar 2FA; recién al verificar el TOTP y
 * finalizar se emite el JWT de acceso completo.
 */
export const activateAccount = async (token, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const userId =
    await authRepository.activateAccountWithToken(token, hashedPassword)
    || await authRepository.activateOrganizationRequestWithToken(token, hashedPassword);

  if (!userId) {
    throw ApiError.invalidToken(MESSAGES.AUTH.ACTIVATION_INVALID_TOKEN);
  }

  const user = await authRepository.findById(userId);
  if (!user) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  const tempToken = jwt.sign(
    { userId: user.id, email: user.email, purpose: 'ONBOARDING' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  return {
    requiresOnboarding: true,
    tempToken,
    user: formatUserResponse(user),
  };
};

/**
 * Finaliza el onboarding (Opción 1 y Opción 2): exige 2FA enrólado y
 * contraseña definida, limpia los flags de onboarding y emite el JWT final.
 */
export const finalizeOnboarding = async (userId, { ipAddress = null, userAgent = null } = {}) => {
  const user = await authRepository.findById(userId);
  if (!user) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  if (user.status !== 'PENDING_ACTIVATION' && user.status !== 'ACTIVE') {
    throw ApiError.forbidden(MESSAGES.AUTH.LOGIN_ACCOUNT_INACTIVE);
  }

  if (!user.twoFactorEnabled) {
    throw ApiError.badRequest(MESSAGES.AUTH.ONBOARDING_COMPLETE_2FA_FIRST);
  }

  if (user.mustChangePassword) {
    throw ApiError.badRequest(MESSAGES.AUTH.LOGIN_MUST_CHANGE_PASSWORD);
  }

  await authRepository.finalizeOnboarding(user.id);
  await authRepository.registerSuccessfulLogin(user.email, ipAddress, userAgent);

  const refreshed = await authRepository.findByEmail(user.email);

  const token = generateJwt(refreshed);
  const { rawToken: refreshToken, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN));
  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  });

  try {
    await auditService.logAction({
      actorId: user.id,
      electionId: null,
      action: 'LOGIN',
      ipAddress,
      metadata: { method: 'onboarding' },
    });
  } catch (error) {
    logger.warn('No se pudo registrar el login en auditoría', { error: error.message });
  }

  return {
    requiresOnboarding: false,
    token,
    refreshToken,
    mustChangePassword: false,
    user: formatUserResponse(refreshed),
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
    organizationId,
    facultyId,
    programId,
    careerId,
    currentCycle,
    admissionPeriodId,
    specialty,
    department,
  } = userData;

  // Seguridad: el registro público SIEMPRE crea estudiantes. El rol no se
  // acepta desde el cliente; cualquier rol privilegiado debe asignarse por
  // un administrador vía el módulo de usuarios (updateRole/createUser).
  const role = 'STUDENT';

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

  // Resolución automática de la organización por dominio del correo.
  // Si el cliente no envía organization_id, se busca la organización cuyo
  // allowed_email_domains contenga el dominio del correo. Si hay una única
  // coincidencia, se asigna automáticamente (el usuario no necesita el UUID).
  let resolvedOrgId = organizationId || null;
  if (!resolvedOrgId) {
    const domain = extractDomain(cleanEmail);
    if (domain) {
      const matches = await authRepository.findOrganizationsByEmailDomain(domain);
      if (matches.length === 1) {
        resolvedOrgId = matches[0].id;
      }
    }
  }

  // Derivación automática de carrera (y ciclo) a partir del código institucional.
  // Si el cliente no provee carrera/ciclo, se busca la carrera cuya `code` sea
  // prefijo del código institucional en la organización resuelta.
  let derivedCareerId = careerId ?? null;
  let derivedCycle = currentCycle ?? null;
  if (resolvedOrgId && !derivedCareerId) {
    const careers = await authRepository.findCareersByOrganization(resolvedOrgId);
    if (careers.length > 0) {
      const matched = matchCareerFromCode(institutionalId, careers);
      if (matched) {
        derivedCareerId = matched.id;
        if (derivedCycle === null || derivedCycle === undefined) {
          derivedCycle = extractCycleFromCode(institutionalId, matched);
        }
      }
    }
  }

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
    organizationId: resolvedOrgId,
    facultyId,
    programId,
    careerId: derivedCareerId,
    currentCycle: derivedCycle,
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

export const logout = async ({ userId, tokenHash, refreshToken }) => {
  if (refreshToken) {
    // Invalida la sesión concreta asociada al refresh token proporcionado
    await authRepository.revokeRefreshToken(hashToken(refreshToken));
  } else if (tokenHash) {
    // Invalida la sesión activa en refresh_tokens
    await authRepository.revokeRefreshToken(tokenHash);
  } else if (userId) {
    // Invalida todas las sesiones activas del usuario
    await authRepository.revokeAllUserRefreshTokens(userId);
  }

  logger.info('Logout efectuado correctamente', { userId });
  return { loggedOut: true };
};

/**
 * Renueva la sesión a partir de un refresh token válido y no revocado.
 */
export const refreshSession = async (refreshToken) => {
  const tokenHash = hashToken(refreshToken);
  const stored = await authRepository.findRefreshToken(tokenHash);

  const invalid = !stored ||
    stored.revokedAt ||
    !stored.user ||
    stored.user.status !== 'ACTIVE' ||
    (stored.expiresAt && new Date(stored.expiresAt) < new Date());

  if (invalid) {
    throw ApiError.unauthorized(MESSAGES.AUTH.TOKEN_INVALID);
  }

  const user = stored.user;
  const token = generateJwt(user);

  return {
    token,
    refreshToken,
    user: formatUserResponse(user),
  };
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

export const resendVerification = async (email) => {
  const cleanEmail = email.toLowerCase().trim();
  const user = await authRepository.findByEmail(cleanEmail);

  // Siempre responde lo mismo para no revelar qué correos están registrados.
  if (!user || user.isVerified) {
    return { message: MESSAGES.AUTH.EMAIL_VERIFICATION_SENT };
  }

  const token = await authRepository.generateEmailVerificationToken(user.id);

  if (!token) {
    return { message: MESSAGES.AUTH.EMAIL_VERIFICATION_SENT };
  }

  try {
    await sendVerification({
      email: cleanEmail,
      token,
      firstName: user.firstName,
    });
  } catch (error) {
    logger.error('Reenvío de verificación falló', {
      userId: user.id,
      error: error.message,
    });
    throw ApiError.serviceUnavailable(
      MESSAGES.AUTH.EMAIL_SEND_FAILED,
      null,
      'EMAIL_SEND_FAILED'
    );
  }

  return { message: MESSAGES.AUTH.EMAIL_VERIFICATION_SENT };
};