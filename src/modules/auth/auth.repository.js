// src/modules/auth/auth.repository.js
import { prisma } from '../../database/prisma.js';

export const findUserByEmail = async (email) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

export const registerFailedLogin = async (email) => {
  await prisma.$executeRaw`SELECT register_failed_login(${email}::citext)`;
};

export const registerSuccessfulLogin = async (email) => {
  await prisma.$executeRaw`SELECT register_successful_login(${email}::citext)`;
};

export const loginIsAllowed = async (email) => {
  const result = await prisma.$queryRaw`SELECT login_is_allowed(${email}::citext) AS allowed`;
  return result[0]?.allowed ?? false;
};