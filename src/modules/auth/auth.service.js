import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import * as authRepository from './auth.repository.js';

export const login = async ({ email, password }) => {
  // 1. Verificar si el login está permitido (no bloqueado)
  const isAllowed = await authRepository.loginIsAllowed(email);

  if (!isAllowed) {
    const error = new Error('Cuenta bloqueada temporalmente. Intente más tarde.');
    error.statusCode = 423;
    throw error;
  }

  // 2. Buscar usuario
  const user = await authRepository.findUserByEmail(email);

  if (!user || !user.isActive) {
    await authRepository.registerFailedLogin(email);
    const error = new Error('Credenciales inválidas');
    error.statusCode = 401;
    throw error;
  }

  // 3. Verificar contraseña
  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    await authRepository.registerFailedLogin(email);
    const error = new Error('Credenciales inválidas');
    error.statusCode = 401;
    throw error;
  }

  // 4. Registrar login exitoso
  await authRepository.registerSuccessfulLogin(email);

  // 5. Generar JWT
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      isStaff: user.isStaff,
      isSuperuser: user.isSuperuser,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  return {
    token,
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
    const error = new Error('El email ya está registrado');
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, Number(env.BCRYPT_SALT_ROUNDS) || 12);

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