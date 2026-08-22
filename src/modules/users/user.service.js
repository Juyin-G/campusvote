import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { isValidRole, ADMIN_ROLES } from '../../constants/roles.js';
import { prismaPagination } from '../../shared/utils/pagination.js';
import MESSAGES from '../../constants/messages.js';

const userSelect = {
  id: true,
  username: true,
  email: true,
  institutionalId: true,
  firstName: true,
  lastName: true,
  role: true,
  organizationId: true,
  isActive: true,
  isVerified: true,
  isStaff: true,
  isSuperuser: true,
  authProvider: true,
  dateJoined: true,
  lastLogin: true,
  updatedAt: true,
};

const notFoundIfMissing = (err) => {
  if (err.code === 'P2025') throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  throw err;
};

export const listUsers = async (query = {}) => {
  const { page = 1, limit = 20 } = query;
  const where = {};

  if (query.role) {
    if (!isValidRole(query.role)) throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);
    where.role = query.role;
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive === 'true' || query.isActive === true;
  }

  if (query.search) {
    const term = query.search.trim();
    where.OR = ['firstName', 'lastName', 'email', 'username'].map((f) => ({
      [f]: { contains: term, mode: 'insensitive' },
    }));
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { dateJoined: 'desc' },
      ...prismaPagination({ page, limit }),
    }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

export const getUserById = async (id, actor) => {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);

  const actorId = actor?.id || actor?.userId;
  const isSelf = actorId === id;
  const isAdmin = ADMIN_ROLES.includes(actor?.role);
  if (!isSelf && !isAdmin) throw ApiError.forbidden(MESSAGES.COMMON.FORBIDDEN);

  return user;
};

export const createUser = async (body = {}) => {
  const {
    username,
    email,
    password,
    first_name,
    last_name,
    institutional_id,
    role,
    organization_id,
  } = body;

  const hashedPassword = await bcrypt.hash(password, 12);

  return prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      firstName: first_name,
      lastName: last_name,
      institutionalId: institutional_id,
      role,
      organizationId: organization_id,
    },
    select: userSelect,
  });
};

export const updateUser = async (id, body = {}) => {
  const data = {};
  if (body.first_name !== undefined) data.firstName = body.first_name;
  if (body.last_name !== undefined) data.lastName = body.last_name;
  if (body.organization_id !== undefined) data.organizationId = body.organization_id;

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST);
  }

  try {
    return await prisma.user.update({ where: { id }, data, select: userSelect });
  } catch (err) {
    notFoundIfMissing(err);
  }
};

export const setActiveStatus = async (id, isActive, actor) => {
  const actorId = actor?.id || actor?.userId;
  if (actorId === id && !isActive) {
    throw ApiError.badRequest('No puedes desactivar tu propia cuenta');
  }

  try {
    return await prisma.user.update({
      where: { id },
      data: { isActive },
      select: userSelect,
    });
  } catch (err) {
    notFoundIfMissing(err);
  }
};

export const unlockUser = async (id) => {
  try {
    return await prisma.user.update({
      where: { id },
      data: { failedAttempts: 0, lockUntil: null },
      select: userSelect,
    });
  } catch (err) {
    notFoundIfMissing(err);
  }
};

export const updateUserRole = async (id, role) => {
  if (!isValidRole(role)) throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { isSuperuser: true },
  });
  if (!existing) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);

  if (existing.isSuperuser && !ADMIN_ROLES.includes(role)) {
    const superuserCount = await prisma.user.count({
      where: { isSuperuser: true, isActive: true },
    });
    if (superuserCount <= 1) {
      throw ApiError.badRequest(
        'No se puede cambiar el rol del último superusuario activo'
      );
    }
  }

  return prisma.user.update({ where: { id }, data: { role }, select: userSelect });
};

export const updateMyProfile = async (userId, body = {}) => {
  const data = {};
  if (body.first_name !== undefined) data.firstName = body.first_name;
  if (body.last_name !== undefined) data.lastName = body.last_name;

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST);
  }

  return prisma.user.update({ where: { id: userId }, data, select: userSelect });
};

export const changeMyPassword = async (userId, body = {}) => {
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST);
  }

  if (newPassword.length < 8) {
    throw ApiError.badRequest(MESSAGES.USER.PASSWORD_TOO_WEAK);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, isActive: true },
  });
  if (!dbUser?.isActive || !dbUser.password) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  const matches = await bcrypt.compare(currentPassword, dbUser.password);
  if (!matches) {
    throw ApiError.badRequest('La contraseña actual es incorrecta');
  }

  if (currentPassword === newPassword) {
    throw ApiError.badRequest(MESSAGES.USER.PASSWORD_SAME_AS_OLD);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: await bcrypt.hash(newPassword, 12),
      mustChangePassword: false,
    },
  });

  return { changed: true };
};

export default {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  setActiveStatus,
  unlockUser,
  updateUserRole,
  updateMyProfile,
  changeMyPassword,
};