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
  await prisma.$executeRaw`SELECT register_failed_login(${email}::citext)`;
};

export const registerSuccessfulLogin = async (email) => {
  await prisma.$executeRaw`SELECT register_successful_login(${email}::citext)`;
};

export const loginIsAllowed = async (email) => {
  const result =
    await prisma.$queryRaw`SELECT login_is_allowed(${email}::citext) AS allowed`;
  return result[0]?.allowed ?? false;
};
