import { prisma } from '../../database/prisma.js';

export const findUserByEmail = async (email) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

export const createUser = async (data) => {
  return prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      institutionalId: data.institutionalId,
      authProvider: data.authProvider ?? 'LOCAL',
      mustChangePassword: data.mustChangePassword ?? true,
    },
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isVerified: true,
      mustChangePassword: true,
      dateJoined: true,
    },
  });
};

export const registerFailedLogin = async (email) => {
  await prisma.$executeRaw`
    SELECT register_failed_login(${email}::citext)
  `;
};

export const registerSuccessfulLogin = async (email) => {
  await prisma.$executeRaw`
    SELECT register_successful_login(${email}::citext)
  `;
};

export const loginIsAllowed = async (email) => {
  const result =
    await prisma.$queryRaw`
      SELECT login_is_allowed(${email}::citext) AS allowed
    `;

  return result[0]?.allowed ?? false;
};

export const getTwoFactorData = async (userId) => {
  const result = await prisma.$queryRaw`
    SELECT
      id,
      email,
      role,
      two_factor_enabled,
      two_factor_secret
    FROM users
    WHERE id = ${userId}::uuid
      AND is_active = TRUE
    LIMIT 1
  `;

  return result[0] ?? null;
};

export const saveTwoFactorSecret = async (userId, secret) => {
  await prisma.$executeRaw`
    UPDATE users
    SET two_factor_secret = ${secret}
    WHERE id = ${userId}::uuid
  `;
};

export const enableTwoFactor = async (userId) => {
  await prisma.$executeRaw`
    UPDATE users
    SET two_factor_enabled = TRUE
    WHERE id = ${userId}::uuid
  `;
};