import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { isValidRole } from '../../constants/roles.js';
import { prismaPagination } from '../../shared/utils/pagination.js';
import MESSAGES from '../../constants/messages.js';

const ADMIN_ROLES = ['ADMIN', 'ELECTORAL_COMMISSION'];

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

const pickFields = (body, allowed) =>
  Object.fromEntries(allowed.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

export const listUsers = async (query = {}, actor) => {
  if (!ADMIN_ROLES.includes(actor?.role)) {
    throw ApiError.forbidden(MESSAGES.COMMON.FORBIDDEN);
  }

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

  const isSelf = actor?.userId === id;
  const isAdmin = ADMIN_ROLES.includes(actor?.role);
  if (!isSelf && !isAdmin) throw ApiError.forbidden(MESSAGES.COMMON.FORBIDDEN);

  return user;
};

export const updateUser = async (id, body = {}, actor) => {
  if (!ADMIN_ROLES.includes(actor?.role)) {
    throw ApiError.forbidden(MESSAGES.COMMON.FORBIDDEN);
  }

  const allowed = ['firstName', 'lastName', 'organizationId'];
  const data = pickFields(body, allowed);

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST, { allowedFields: allowed });
  }

  try {
    return await prisma.user.update({ where: { id }, data, select: userSelect });
  } catch (err) {
    notFoundIfMissing(err);
  }
};

export const deactivateUser = async (id, actor) => {
  if (!ADMIN_ROLES.includes(actor?.role)) {
    throw ApiError.forbidden(MESSAGES.COMMON.FORBIDDEN);
  }

  if (actor.userId === id) {
    throw ApiError.badRequest('No puedes desactivar tu propia cuenta');
  }

  try {
    await prisma.user.update({ where: { id }, data: { isActive: false } });
  } catch (err) {
    notFoundIfMissing(err);
  }
};

export const updateUserRole = async (id, role, actor) => {
  if (!ADMIN_ROLES.includes(actor?.role)) {
    throw ApiError.forbidden(MESSAGES.COMMON.FORBIDDEN);
  }
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
        'No se puede cambiar el rol del último superusuario activo',
      );
    }
  }

  return prisma.user.update({ where: { id }, data: { role }, select: userSelect });
};

export const updateMyProfile = async (userId, body = {}, actor) => {
  if (actor?.userId !== userId) {
    throw ApiError.forbidden(MESSAGES.COMMON.FORBIDDEN);
  }

  const allowed = ['firstName', 'lastName'];
  const data = pickFields(body, allowed);

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST, { allowedFields: allowed });
  }

  return prisma.user.update({ where: { id: userId }, data, select: userSelect });
};

export const changeMyPassword = async (userId, body = {}) => {
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST, {
      required: ['currentPassword', 'newPassword'],
    });
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
  if (!matches) throw ApiError.badRequest(MESSAGES.USER.PASSWORD_SAME_AS_OLD);

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
  updateUser,
  deactivateUser,
  updateUserRole,
  updateMyProfile,
  changeMyPassword,
};