import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { AppError } from '../../common/errors/AppError.js';
import { ErrorCodes } from '../../common/errors/errorCodes.js';
import { HttpStatus } from '../../common/errors/httpStatus.js';
import * as authRepository from './auth.repository.js';
import {
  generateTotpSetup,
  verifyTotpCode,
} from './totp.service.js';

export const login = async ({ email, password }) => {
  const isAllowed = await authRepository.loginIsAllowed(email);

  if (!isAllowed) {
    throw new AppError({
      message:
        'Cuenta bloqueada por múltiples intentos fallidos. Intente de nuevo más tarde',
      code: ErrorCodes.ACCOUNT_LOCKED,
      statusCode: HttpStatus.LOCKED,
    });
  }

  const user = await authRepository.findUserByEmail(email);

  if (!user || !user.isActive) {
    await authRepository.registerFailedLogin(email);
    throw new AppError({
      message: 'Email o contraseña incorrectos',
      code: ErrorCodes.INVALID_CREDENTIALS,
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }

  if (user.authProvider !== 'LOCAL' || !user.password) {
    throw new AppError({
      message: 'Email o contraseña incorrectos',
      code: ErrorCodes.INVALID_CREDENTIALS,
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }

  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    await authRepository.registerFailedLogin(email);
    throw new AppError({
      message: 'Email o contraseña incorrectos',
      code: ErrorCodes.INVALID_CREDENTIALS,
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }

  const twoFactor = await authRepository.getTwoFactorData(user.id);

  if (twoFactor?.two_factor_enabled) {
    const tempToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        purpose: 'TOTP_PENDING',
      },
      env.JWT_SECRET,
      { expiresIn: '5m' },
    );

    return {
      requiresTotp: true,
      tempToken,
    };
  }

  await authRepository.registerSuccessfulLogin(email);

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      isStaff: user.isStaff,
      isSuperuser: user.isSuperuser,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );

  return {
    requiresTotp: false,
    token,
    expiresIn: env.JWT_EXPIRES_IN,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isVerified: user.isVerified,
      mustChangePassword: user.mustChangePassword,
    },
  };
};

export const logout = async ({ userId, email }) => {
  logger.info('User logged out', { userId, email });
  return { loggedOut: true };
};

export const register = async ({
  username,
  email,
  password,
  firstName,
  lastName,
  institutionalId,
}) => {
  const existingUser = await authRepository.findUserByEmail(email);

  if (existingUser) {
    throw new AppError({
      message: 'El email ya está registrado',
      code: ErrorCodes.ALREADY_EXISTS,
      statusCode: HttpStatus.CONFLICT,
    });
  }

  const hashedPassword = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  const user = await authRepository.createUser({
    username,
    email,
    password: hashedPassword,
    firstName,
    lastName,
    institutionalId,
    authProvider: 'LOCAL',
    mustChangePassword: true,
  });

  return user;
};

export const setupTotp = async (userId) => {
  const user = await authRepository.getTwoFactorData(userId);

  if (!user) {
    throw new AppError({
      message: 'Usuario no encontrado o inactivo',
      code: ErrorCodes.USER_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  if (user.two_factor_enabled) {
    throw new AppError({
      message: 'El TOTP ya está habilitado para este usuario',
      code: ErrorCodes.TOTP_ALREADY_CONFIGURED,
      statusCode: HttpStatus.CONFLICT,
    });
  }

  const setup = await generateTotpSetup(user.email);

  await authRepository.saveTwoFactorSecret(userId, setup.secret);

  return {
    qrCode: setup.qrCode,
    otpauthUrl: setup.otpauthUrl,
  };
};

export const verifyTotp = async (userId, token) => {
  const user = await authRepository.getTwoFactorData(userId);

  if (!user) {
    throw new AppError({
      message: 'Usuario no encontrado o inactivo',
      code: ErrorCodes.USER_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  if (!user.two_factor_secret) {
    throw new AppError({
      message:
        'TOTP no configurado para este usuario. Ejecute primero POST /api/auth/totp/setup',
      code: ErrorCodes.TOTP_VERIFY_ERROR,
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }

  const isValid = await verifyTotpCode({
    secret: user.two_factor_secret,
    token,
  });

  if (!isValid) {
    throw new AppError({
      message: 'El código TOTP es inválido o ha expirado',
      code: ErrorCodes.INVALID_CREDENTIALS,
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }

  if (!user.two_factor_enabled) {
    await authRepository.enableTwoFactor(userId);
  }

  return { verified: true };
};

export const verifyLoginTotp = async (userId, token) => {
  const user = await authRepository.getTwoFactorData(userId);

  if (!user) {
    throw new AppError({
      message: 'Usuario no encontrado o inactivo',
      code: ErrorCodes.USER_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  if (!user.two_factor_enabled || !user.two_factor_secret) {
    throw new AppError({
      message: 'TOTP no configurado',
      code: ErrorCodes.TOTP_LOGIN_ERROR,
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }

  const isValid = await verifyTotpCode({
    secret: user.two_factor_secret,
    token,
  });

  if (!isValid) {
    throw new AppError({
      message: 'El código TOTP es inválido o ha expirado',
      code: ErrorCodes.INVALID_CREDENTIALS,
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }

  await authRepository.registerSuccessfulLogin(user.email);

  const finalToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );

  return {
    token: finalToken,
    expiresIn: env.JWT_EXPIRES_IN,
    requiresTotp: false,
  };
};
