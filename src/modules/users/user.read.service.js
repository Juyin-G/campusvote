// src/modules/users/user.read.service.js
// Operaciones de lectura: listUsers, getMe, getUserById.

import * as userRepository from './user.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { isValidRole, ROLES } from '../../constants/roles.js';
import { parsePagination } from '../../shared/utils/pagination.js';
import { formatUserResponse } from '../../shared/utils/formatUserResponse.js';
import { canActorActOnUser } from '../../middlewares/tenantScope.middleware.js';
import { prisma } from '../../database/prisma.js';
import MESSAGES from '../../constants/messages.js';

export const listUsers = async (query = {}, actor = {}) => {
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

  const isSuperUser = actor.role === ROLES.SUPERADMIN || actor.isSuperuser || actor.isSuperAdmin;
  if (isSuperUser) {
    throw ApiError.forbidden('El administrador de plataforma no tiene acceso al CRUD de usuarios de tenant');
  }

  const organizationId = actor.organizationId;
  if (!organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }

  if (query.role && !isValidRole(query.role)) {
    throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);
  }

  const filter = {
    organizationId,
    role: query.role,
    search: query.search,
    isActive: query.isActive,
    scopeWhere: actor._scopeWhere || {},
  };

  const [total, users] = await Promise.all([
    userRepository.count(filter),
    userRepository.list({ ...filter, skip, take: limit }),
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

export const getUserById = async (id, actor = {}) => {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);

  const actorId = actor?.id || actor?.userId;
  const isSelf = actorId === id;
  const isAdmin = actor?.role === ROLES.ADMIN;
  if (!isSelf && !isAdmin) throw ApiError.forbidden(MESSAGES.COMMON.FORBIDDEN);

  if (isAdmin && !isSelf) {
    const full = await prisma.user.findUnique({
      where: { id },
      select: {
        organizationId: true,
        siteAssignments: { select: { siteId: true } },
      },
    });
    if (!full) throw ApiError.notFound('Usuario no encontrado');
    const siteIds = (full.siteAssignments || []).map((s) => s.siteId);
    const allowed = await canActorActOnUser(actor, full.organizationId, siteIds);
    if (!allowed) {
      throw ApiError.forbidden('No tienes autorización sobre este usuario');
    }
  }

  return formatUserResponse(user);
};
