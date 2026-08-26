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

/**
 * Hash señuelo para igualar el tiempo de respuesta cuando el correo no existe
 * o la cuenta no tiene contraseña local. Sin esto, bcrypt.compare solo se
 * ejecutaba para usuarios reales y la diferencia de tiempo (~70 ms frente a
 * ~460 ms) permitía enumerar qué cuentas existen.
 *
 * Se calcula una sola vez, de forma perezosa, para no penalizar el arranque.
 */
let dummyPasswordHash = null;

const getDummyPasswordHash = async () => {
  dummyPasswordHash ??= await bcrypt.hash(
    'campusvote-cuenta-inexistente',
    SALT_ROUNDS
  );
  return dummyPasswordHash;
};

export const login = async ({ email, password }) => {
  const cleanEmail = email.toLowerCase().trim();

  const user = await authRepository.findByEmail(cleanEmail);

  if (!user) {
    // Se compara igualmente para que el tiempo de respuesta no delate
    // que el correo no está registrado.
    await bcrypt.compare(password, await getDummyPasswordHash());
    throw ApiError.unauthorized(MESSAGES.AUTH.LOGIN_FAILED);
  }

  // login_is_allowed() devuelve FALSE tanto por bloqueo temporal como por
  // cuenta inactiva. Solo el bloqueo debe cortar aquí: responder 423 a una
  // cuenta desactivada la delataba frente a un correo inexistente. El estado
  // inactivo se comunica más abajo, ya con la contraseña acreditada.
  const isAllowed = await authRepository.loginIsAllowed(user.email);
  const estaBloqueado =
    user.lockedUntil !== null && new Date(user.lockedUntil) > new Date();

  if (!isAllowed && estaBloqueado) {
    throw new ApiError(423, MESSAGES.AUTH.LOGIN_LOCKED, null, 'ACCOUNT_LOCKED');
  }

  // Las cuentas externas no tienen contraseña local: se comparan contra el
  // señuelo para que el fallo sea indistinguible de una contraseña errónea.
  const storedHash = user.password ?? (await getDummyPasswordHash());
  const isValidPassword = await bcrypt.compare(password, storedHash);

  if (!isValidPassword) {
    await authRepository.registerFailedLogin(user.email);
    throw ApiError.unauthorized(MESSAGES.AUTH.LOGIN_FAILED);
  }

  // El estado de la cuenta solo se revela DESPUÉS de acreditar la contraseña.
  // Comprobarlo antes permitía distinguir una cuenta inactiva (403) de un
  // correo inexistente (401) sin conocer ninguna credencial.
  if (user.authProvider !== 'LOCAL') {
    throw ApiError.badRequest('Use Google para iniciar sesión');
  }

  if (!user.isActive) {
    throw ApiError.forbidden(MESSAGES.AUTH.LOGIN_ACCOUNT_INACTIVE);
  }

  if (!user.isVerified) {
    throw ApiError.forbidden(MESSAGES.AUTH.LOGIN_EMAIL_NOT_VERIFIED);
  }

  if (user.twoFactorEnabled) {
    const tempToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'TOTP_PENDING' },
      env.JWT_SECRET,
      { expiresIn: '5m' },
    );

    return {
      requiresTotp: true,
      tempToken,
      mustChangePassword: user.mustChangePassword,
    };
  }

  await authRepository.registerSuccessfulLogin(user.email);
  await authRepository.updateLastLogin(user.id);

  const token = generateJwt(user);

  return {
    requiresTotp: false,
    token,
    mustChangePassword: user.mustChangePassword,
    user: formatUserResponse(user),
  };
};

export const register = async (userData) => {
  const { email, username, password, institutionalId, firstName, lastName } = userData;
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

  const newUser = await authRepository.createUser({
    username: cleanUsername,
    email: cleanEmail,
    password: hashedPassword,
    firstName,
    lastName,
    institutionalId,
    role: 'STUDENT',
    authProvider: 'LOCAL',
    mustChangePassword: false,
  });

  const verificationToken =
    await authRepository.generateEmailVerificationToken(newUser.id);

  let verificationEmailSent = false;

  if (verificationToken) {
    try {
      await sendVerification({
        email: cleanEmail,
        token: verificationToken,
        firstName,
      });
      verificationEmailSent = true;
    } catch (error) {
      // No se lanza error: el usuario YA está creado y revertirlo aquí no es
      // posible. Antes se devolvía 503 y la cuenta quedaba inservible —no podía
      // registrarse de nuevo (email ocupado) ni entrar (sin verificar) ni
      // verificar (nunca recibió el enlace)—. Ahora el alta se confirma y el
      // reenvío queda disponible en POST /api/auth/verify-email/resend.
      logger.error('Registro OK pero falló envío de verificación', {
        userId: newUser.id,
        error: error.message,
      });
    }
  } else {
    logger.warn('No se pudo generar token de verificación para el usuario', {
      userId: newUser.id,
    });
  }

  logger.info('Usuario registrado exitosamente', {
    userId: newUser.id,
    verificationEmailSent,
  });

  return { user: newUser, verificationEmailSent };
};

/**
 * Reenvía el correo de verificación a una cuenta pendiente.
 *
 * Responde siempre lo mismo —exista la cuenta, esté ya verificada o falle el
 * SMTP— para no permitir averiguar qué correos están registrados. El fallo de
 * envío queda en los logs para que lo vea el equipo, no el cliente.
 */
// La respuesta es idéntica en todos los caminos de forma deliberada: hacerla
// variar según el resultado es exactamente lo que permitiría deducir qué
// correos están registrados. Por eso se silencia la regla aquí.
// eslint-disable-next-line sonarjs/no-invariant-returns
export const resendVerification = async (email) => {
  const cleanEmail = email.toLowerCase().trim();
  const respuestaGenerica = { message: MESSAGES.AUTH.EMAIL_VERIFICATION_SENT };

  const user = await authRepository.findByEmail(cleanEmail);

  if (!user || user.isVerified) {
    logger.info('Reenvío de verificación solicitado sin efecto');
    return respuestaGenerica;
  }

  const token = await authRepository.generateEmailVerificationToken(user.id);

  if (!token) {
    logger.warn('No se pudo generar token de verificación en el reenvío', {
      userId: user.id,
    });
    return respuestaGenerica;
  }

  try {
    await sendVerification({
      email: cleanEmail,
      token,
      firstName: user.firstName,
    });
    logger.info('Correo de verificación reenviado', { userId: user.id });
  } catch (error) {
    logger.error('Falló el reenvío del correo de verificación', {
      userId: user.id,
      error: error.message,
    });
  }

  return respuestaGenerica;
};

export const logout = async ({ email }) => {
  logger.info('Logout efectuado correctamente');
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
        'EMAIL_SEND_FAILED',
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