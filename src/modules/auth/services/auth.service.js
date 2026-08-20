/**
 * Auth Service
 * Lógica de negocio: login, register, 2FA, password reset
 * Integrado con procedimientos almacenados SQL nativos de PostgreSQL
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as authRepository from '../repositories/auth.repository.js';
import * as otpUtil from '../../../shared/utils/otp.util.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import MESSAGES from '../../../constants/messages.js';
import env from '../../../config/env.js';
import logger from '../../../config/logger.js';

const SALT_ROUNDS = 12;

// LOGIN

export const login = async ({ email, password }) => {
  const cleanEmail = email.toLowerCase().trim();

  // 1. Buscar usuario
  const user = await authRepository.findByEmail(cleanEmail);
  if (!user) {
    throw ApiError.unauthorized(MESSAGES.AUTH.LOGIN_FAILED);
  }

  // 2. Verificar cuenta activa
  if (!user.is_active) {
    throw ApiError.forbidden(MESSAGES.AUTH.LOGIN_ACCOUNT_INACTIVE);
  }

  // 3. Verificar si auth_provider es LOCAL
  if (user.auth_provider !== 'LOCAL') {
    throw ApiError.badRequest('Use Google para iniciar sesión');
  }

  // 4. Verificar si el login está permitido (Función SQL con email)
  const isAllowed = await authRepository.loginIsAllowed(user.email);
  if (!isAllowed) {
    throw new ApiError(423, MESSAGES.AUTH.LOGIN_LOCKED, null, 'ACCOUNT_LOCKED');
  }

  // 5. Verificar password
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    // Registrar intento fallido en SQL
    await authRepository.registerFailedLogin(user.email);
    throw ApiError.unauthorized(MESSAGES.AUTH.LOGIN_FAILED);
  }

  // 6. Verificar si requiere verificación de email
  if (!user.is_verified) {
    throw ApiError.forbidden(MESSAGES.AUTH.LOGIN_EMAIL_NOT_VERIFIED);
  }

  // 7. Verificar si tiene 2FA activado
  if (user.two_factor_enabled) {
    const tempToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'TOTP_PENDING' },
      env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    return {
      requiresTotp: true,
      tempToken,
      mustChangePassword: user.must_change_password,
    };
  }

  // 8. Login exitoso - Resetear intentos e incrementar contador en SQL
  await authRepository.registerSuccessfulLogin(user.email);
  await authRepository.updateLastLogin(user.id);

  // 9. Generar JWT principal
  const token = generateJwt(user);

  return {
    requiresTotp: false,
    token,
    mustChangePassword: user.must_change_password,
    user: formatUserResponse(user),
  };
};

// REGISTER

export const register = async (userData) => {
  const { email, username, password, institutional_id, first_name, last_name } = userData;
  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.toLowerCase().trim();

  // Verificar duplicados
  const existingEmail = await authRepository.findByEmail(cleanEmail);
  if (existingEmail) {
    throw ApiError.conflict(MESSAGES.USER.ALREADY_EXISTS);
  }

  const existingUsername = await authRepository.findByUsername(cleanUsername);
  if (existingUsername) {
    throw ApiError.conflict(MESSAGES.USER.USERNAME_TAKEN);
  }

  // Hashear password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Crear usuario
  const newUser = await authRepository.createUser({
    username: cleanUsername,
    email: cleanEmail,
    password: hashedPassword,
    first_name,
    last_name,
    institutional_id,
    role: 'STUDENT',
    auth_provider: 'LOCAL',
    must_change_password: false,
  });

  // Generar token de verificación de email (Función SQL nativa)
  const verificationToken = await authRepository.generateEmailVerificationToken(newUser.id);

  logger.info(`Usuario registrado exitosamente: ${cleanEmail}`);

  return {
    user: newUser,
    verificationToken,
  };
};

// LOGOUT & PERFIL

export const logout = async ({ email }) => {
  logger.info(`Logout efectuado: ${email}`);
  return { loggedOut: true };
};

export const getProfile = async (userId) => {
  const user = await authRepository.findById(userId);
  if (!user) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  return formatUserResponse(user);
};

// 2FA - SETUP

export const setupTotp = async (userId) => {
  const user = await authRepository.findById(userId);
  if (!user) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  if (user.two_factor_enabled) {
    throw ApiError.conflict(MESSAGES.AUTH.TWO_FACTOR_ALREADY_CONFIGURED || 'El 2FA ya está activado');
  }

  // Generar secreto, URI y Código QR
  const secret = otpUtil.generateTotpSecret();
  const uri = otpUtil.generateTotpUri(secret, user.email, 'CampusVote');
  const qrCode = await otpUtil.generateQrCode(uri);

  // Guardar secreto en estado pendiente
  await authRepository.saveTwoFactorSecret(userId, secret);

  return { secret, uri, qrCode };
};

// 2FA - VERIFY & ENABLE

export const verifyTotp = async (userId, code) => {
  const baseUser = await authRepository.findById(userId);
  if (!baseUser) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  // Obtener campos sensibles con findByEmail
  const user = await authRepository.findByEmail(baseUser.email);

  if (!user || !user.two_factor_secret) {
    throw ApiError.badRequest('Primero debes iniciar la configuración 2FA');
  }

  if (user.two_factor_enabled) {
    throw ApiError.conflict('El 2FA ya se encuentra activado');
  }

  // Verificar código TOTP usando el namespace del helper
  const isValid = otpUtil.verifyTotp(code, user.two_factor_secret);
  if (!isValid) {
    throw ApiError.unauthorized(MESSAGES.AUTH.TWO_FACTOR_INVALID_CODE);
  }

  // Generar y hashear códigos de respaldo (SHA-256)
  const plainBackupCodes = otpUtil.generateBackupCodes();
  const hashedBackupCodes = plainBackupCodes.map((c) => otpUtil.hashBackupCode(c));

  // Activar 2FA en BD
  await authRepository.enableTwoFactor(userId, hashedBackupCodes);

  logger.info(`2FA activado exitosamente para el usuario: ${userId}`);

  return {
    enabled: true,
    backupCodes: plainBackupCodes,
  };
};

// 2FA - VERIFY LOGIN TOTP

export const verifyLoginTotp = async (userId, code) => {
  const baseUser = await authRepository.findById(userId);
  if (!baseUser) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  const user = await authRepository.findByEmail(baseUser.email);

  if (!user?.two_factor_enabled || !user?.two_factor_secret) {
    throw ApiError.badRequest(MESSAGES.AUTH.TWO_FACTOR_NOT_CONFIGURED);
  }

  // 1. Intentar validar con TOTP principal
  let isValid = otpUtil.verifyTotp(code, user.two_factor_secret);

  // 2. Si no es válido, probar con Códigos de Respaldo
  if (!isValid) {
    const backupResult = otpUtil.verifyBackupCode(
      code,
      user.two_factor_backup_codes || []
    );

    if (!backupResult.valid) {
      throw ApiError.unauthorized(MESSAGES.AUTH.TWO_FACTOR_INVALID_CODE);
    }

    // Consumir el código de respaldo usado
    const updatedCodes = [...(user.two_factor_backup_codes || [])];
    updatedCodes.splice(backupResult.index, 1);
    await authRepository.updateBackupCodes(userId, updatedCodes);
    isValid = true;
  }

  // Login 2FA exitoso -> Registrar en SQL
  await authRepository.registerSuccessfulLogin(user.email);
  await authRepository.updateLastLogin(user.id);

  const token = generateJwt(user);

  return {
    token,
    user: formatUserResponse(user),
  };
};

// PASSWORD RESET & EMAIL VERIFICATION

export const requestPasswordReset = async (email) => {
  const cleanEmail = email.toLowerCase().trim();
  const token = await authRepository.generatePasswordResetToken(cleanEmail);

  logger.info(`Password reset solicitado para: ${cleanEmail}`);

  return {
    message: MESSAGES.AUTH.PASSWORD_RESET_REQUESTED,
    token,
  };
};

export const resetPassword = async (token, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const success = await authRepository.resetPasswordWithToken(token, hashedPassword);

  if (!success) {
    throw ApiError.badRequest(MESSAGES.AUTH.PASSWORD_RESET_INVALID_TOKEN);
  }

  logger.info('Password restablecido exitosamente');

  return { message: MESSAGES.AUTH.PASSWORD_RESET_SUCCESS };
};

export const verifyEmail = async (token) => {
  const success = await authRepository.verifyEmailWithToken(token);

  if (!success) {
    throw ApiError.badRequest(MESSAGES.AUTH.EMAIL_VERIFICATION_INVALID);
  }

  return { message: MESSAGES.AUTH.EMAIL_VERIFIED_SUCCESS };
};

// HELPERS PRIVADOS

const generateJwt = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
      isSuperuser: user.is_superuser,
      isStaff: user.is_staff,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN || '24h' }
  );
};

const formatUserResponse = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  first_name: user.first_name,
  last_name: user.last_name,
  role: user.role,
  institutional_id: user.institutional_id,
  organization_id: user.organization_id,
  is_verified: user.is_verified,
  is_active: user.is_active,
  is_staff: user.is_staff,
  is_superuser: user.is_superuser,
  two_factor_enabled: user.two_factor_enabled,
  must_change_password: user.must_change_password,
  last_login: user.last_login,
  date_joined: user.date_joined,
});