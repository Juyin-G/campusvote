import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import * as userRepository from './user.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { isValidRole, ADMIN_ROLES } from '../../constants/roles.js';
import { parsePagination } from '../../shared/utils/pagination.js';
import { formatUserResponse } from '../../shared/utils/formatUserResponse.js';
import MESSAGES from '../../constants/messages.js';
import { prisma } from '../../database/prisma.js'; 

const notFoundIfMissing = (err) => {
  if (err.code === 'P2025' || err.message.includes('not found')) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  throw err;
};

export const listUsers = async (query = {}) => {
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

  if (query.role && !isValidRole(query.role)) {
    throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);
  }

  const [total, users] = await Promise.all([
    userRepository.count({
      organizationId: query.organizationId,
      role: query.role,
      search: query.search,
      isActive: query.isActive,
    }),
    userRepository.list({
      organizationId: query.organizationId,
      role: query.role,
      search: query.search,
      isActive: query.isActive,
      skip,
      take: limit,
    }),
  ]);

  return {
    users: users.map(formatUserResponse),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

export const getMe = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  return formatUserResponse(user);
};

export const getUserById = async (id, actor) => {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);

  const actorId = actor?.id || actor?.userId;
  const isSelf = actorId === id;
  const isAdmin = ADMIN_ROLES.includes(actor?.role);
  if (!isSelf && !isAdmin) throw ApiError.forbidden(MESSAGES.COMMON.FORBIDDEN);

  return formatUserResponse(user);
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

  const newUser = await userRepository.create({
    username,
    email,
    password: hashedPassword,
    firstName: first_name,
    lastName: last_name,
    institutionalId: institutional_id,
    role,
    organizationId: organization_id,
  });

  return formatUserResponse(newUser);
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
    const updated = await userRepository.update(id, data);
    return formatUserResponse(updated);
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
    const updated = await userRepository.setActive(id, isActive);
    return formatUserResponse(updated);
  } catch (err) {
    notFoundIfMissing(err);
  }
};

export const unlockUser = async (id) => {
  try {
    const updated = await userRepository.resetSecurityFlags(id);
    return formatUserResponse(updated);
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

  const updated = await userRepository.updateRole(id, role);
  return formatUserResponse(updated);
};

export const updateMyProfile = async (userId, body = {}) => {
  const data = {};
  if (body.first_name !== undefined) data.firstName = body.first_name;
  if (body.last_name !== undefined) data.lastName = body.last_name;

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST);
  }

  const updated = await userRepository.update(userId, data);
  return formatUserResponse(updated);
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

  // Comparación segura contra ataques de tiempo (Timing Attack Prevention)
  const currentBuf = crypto.createHash('sha256').update(currentPassword).digest();
  const newBuf = crypto.createHash('sha256').update(newPassword).digest();

  if (crypto.timingSafeEqual(currentBuf, newBuf)) {
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
  getMe,
  getUserById,
  createUser,
  updateUser,
  setActiveStatus,
  unlockUser,
  updateUserRole,
  updateMyProfile,
  changeMyPassword,
};