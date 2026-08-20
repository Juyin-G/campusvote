import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import * as authRepository from './auth.repository.js';

import {
  generateTotpSetup,
  verifyTotpCode,
} from './totp.service.js';

export const login = async ({ email, password }) => {
  const isAllowed = await authRepository.loginIsAllowed(email);

  if (!isAllowed) {
    const error = new Error(
      'Cuenta bloqueada temporalmente. Intente más tarde.',
    );
    error.statusCode = 423;
    throw error;
  }

  const user = await authRepository.findUserByEmail(email);

  if (!user || !user.isActive) {
    await authRepository.registerFailedLogin(email);

    const error = new Error('Credenciales inválidas');
    error.statusCode = 401;
    throw error;
  }

  if (user.authProvider !== 'LOCAL' || !user.password) {
    const error = new Error('Credenciales inválidas');
    error.statusCode = 401;
    throw error;
  }

  const isValidPassword = await bcrypt.compare(
    password,
    user.password,
  );

  if (!isValidPassword) {
    await authRepository.registerFailedLogin(email);

    const error = new Error('Credenciales inválidas');
    error.statusCode = 401;
    throw error;
  }

  const twoFactor =
    await authRepository.getTwoFactorData(user.id);

  if (twoFactor?.two_factor_enabled) {
    const tempToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        purpose: 'TOTP_PENDING',
      },
      env.JWT_SECRET,
      {
        expiresIn: '5m',
      },
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
    {
      expiresIn: env.JWT_EXPIRES_IN,
    },
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
  logger.info('User logged out', {
    userId,
    email,
  });

  return {
    loggedOut: true,
  };
};

export const register = async ({
  username,
  email,
  password,
  firstName,
  lastName,
  institutionalId,
}) => {
  const existingUser =
    await authRepository.findUserByEmail(email);

  if (existingUser) {
    const error = new Error('El email ya está registrado');
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(
    password,
    env.BCRYPT_ROUNDS,
  );

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
  const user =
    await authRepository.getTwoFactorData(userId);

  if (!user) {
    const error = new Error(
      'Usuario no encontrado o inactivo',
    );
    error.statusCode = 404;
    throw error;
  }

  if (user.two_factor_enabled) {
    const error = new Error(
      'El TOTP ya está configurado para este usuario',
    );
    error.statusCode = 409;
    throw error;
  }

  const setup =
    await generateTotpSetup(user.email);

  await authRepository.saveTwoFactorSecret(
    userId,
    setup.secret,
  );

  return {
    qrCode: setup.qrCode,
    otpauthUrl: setup.otpauthUrl,
  };
};

export const verifyTotp = async (userId, token) => {
  const user =
    await authRepository.getTwoFactorData(userId);

  if (!user) {
    const error = new Error(
      'Usuario no encontrado o inactivo',
    );
    error.statusCode = 404;
    throw error;
  }

  if (!user.two_factor_secret) {
    const error = new Error('TOTP no configurado');
    error.statusCode = 400;
    throw error;
  }

  const isValid = await verifyTotpCode({
    secret: user.two_factor_secret,
    token,
  });

  if (!isValid) {
    const error = new Error('Código TOTP inválido');
    error.statusCode = 401;
    throw error;
  }

  if (!user.two_factor_enabled) {
    await authRepository.enableTwoFactor(userId);
  }

  return {
    verified: true,
  };
};

export const verifyLoginTotp = async (
  userId,
  token,
) => {
  const user =
    await authRepository.getTwoFactorData(userId);

  if (!user) {
    const error = new Error(
      'Usuario no encontrado o inactivo',
    );
    error.statusCode = 404;
    throw error;
  }

  if (
    !user.two_factor_enabled ||
    !user.two_factor_secret
  ) {
    const error = new Error('TOTP no configurado');
    error.statusCode = 400;
    throw error;
  }

  const isValid = await verifyTotpCode({
    secret: user.two_factor_secret,
    token,
  });

  if (!isValid) {
    const error = new Error('Código TOTP inválido');
    error.statusCode = 401;
    throw error;
  }

  await authRepository.registerSuccessfulLogin(
    user.email,
  );

  const finalToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );

  return {
    token: finalToken,
    expiresIn: env.JWT_EXPIRES_IN,
    requiresTotp: false,
  };
};