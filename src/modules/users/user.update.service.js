// src/modules/users/user.update.service.js
// Actualizaciones: updateUser, setActiveStatus, unlockUser, updateUserRole.

import * as userRepository from './user.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { isValidRole, ROLES, ADMIN_ROLES } from '../../constants/roles.js';
import { formatUserResponse } from '../../shared/utils/formatUserResponse.js';
import { canActorActOnUser } from '../../middlewares/tenantScope.middleware.js';
import { prisma } from '../../database/prisma.js';
import { notFoundIfMissing, normalizeDocumentIdentity, rejectSuperAdminOnTenant } from './user.helpers.js';
import MESSAGES from '../../constants/messages.js';

export const updateUser = async (id, body = {}, actor = {}) => {
  rejectSuperAdminOnTenant(actor, 'updateUser');
  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      documentType: true,
      documentNumber: true,
      role: true,
      siteAssignments: { select: { siteId: true } },
    },
  });
  if (!target) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);

  const siteIds = (target.siteAssignments || []).map((s) => s.siteId);
  const allowed = await canActorActOnUser(actor, target.organizationId, siteIds);
  if (!allowed) {
    throw ApiError.forbidden('No tienes autorización sobre este usuario');
  }

  const data = {};
  if (body.first_name !== undefined) data.firstName = body.first_name;
  if (body.last_name !== undefined) data.lastName = body.last_name;
  if (body.organization_id !== undefined) {
    if (body.organization_id !== target.organizationId) {
      throw ApiError.forbidden('No puedes reasignar usuarios a otra organización');
    }
    data.organizationId = body.organization_id;
  }
  if (body.document_type !== undefined || body.document_number !== undefined) {
    const identity = await normalizeDocumentIdentity({
      document_type: body.document_type ?? target?.documentType,
      document_number: body.document_number ?? target?.documentNumber,
      role: target?.role,
    });
    if (identity) {
      data.documentType = identity.documentType;
      data.documentNumber = identity.documentNumber;
    }
  }

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

export const setActiveStatus = async (id, isActive, actor = {}) => {
  rejectSuperAdminOnTenant(actor, 'setActiveStatus');
  const actorId = actor?.id || actor?.userId;
  if (actorId === id && !isActive) {
    throw ApiError.badRequest('No puedes desactivar tu propia cuenta');
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      siteAssignments: { select: { siteId: true } },
    },
  });
  if (!target) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);

  const siteIds = (target.siteAssignments || []).map((s) => s.siteId);
  const allowed = await canActorActOnUser(actor, target.organizationId, siteIds);
  if (!allowed) {
    throw ApiError.forbidden('No tienes autorización sobre este usuario');
  }

  try {
    const updated = await userRepository.setActive(id, isActive);
    return formatUserResponse(updated);
  } catch (err) {
    notFoundIfMissing(err);
  }
};

export const unlockUser = async (id, actor = {}) => {
  rejectSuperAdminOnTenant(actor, 'unlockUser');

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      siteAssignments: { select: { siteId: true } },
    },
  });
  if (!target) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);

  const siteIds = (target.siteAssignments || []).map((s) => s.siteId);
  const allowed = await canActorActOnUser(actor, target.organizationId, siteIds);
  if (!allowed) {
    throw ApiError.forbidden('No tienes autorización sobre este usuario');
  }

  try {
    const updated = await userRepository.update(id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    return formatUserResponse(updated);
  } catch (err) {
    notFoundIfMissing(err);
  }
};

export const updateUserRole = async (id, role, actor = {}) => {
  rejectSuperAdminOnTenant(actor, 'updateUserRole');
  if (!isValidRole(role)) throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);

  const actorId = actor.userId ?? actor.id;
  if (actorId === id) {
    throw ApiError.badRequest('No puedes modificar tu propio rol');
  }

  if (ADMIN_ROLES.includes(role) && actor.scopeLevel !== 'ORG') {
    throw ApiError.forbidden('Solo ADMIN ORG puede asignar el rol ADMIN dentro del tenant');
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      isSuperuser: true,
      facultyId: true,
      programId: true,
      currentCycle: true,
      admissionPeriodId: true,
      specialty: true,
      department: true,
      scopeLevel: true,
      siteAssignments: { select: { siteId: true } },
    },
  });
  if (!existing) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);

  const siteIds = (existing.siteAssignments || []).map((s) => s.siteId);
  const allowed = await canActorActOnUser(actor, existing.organizationId, siteIds);
  if (!allowed) {
    throw ApiError.forbidden('No tienes autorización sobre este usuario');
  }

  if (existing.isSuperuser && !ADMIN_ROLES.includes(role)) {
    const superuserCount = await prisma.user.count({
      where: { isSuperuser: true, status: 'ACTIVE' },
    });
    if (superuserCount <= 1) {
      throw ApiError.badRequest('No se puede cambiar el rol del último superusuario activo');
    }
  }

  // CHECK académico de la BD exige coherencia rol↔datos académicos.
  const data = { role };
  if (role === 'STUDENT') {
    if (!existing.programId) {
      throw ApiError.badRequest('Un estudiante requiere un programa académico asignado');
    }
  } else {
    data.programId = null;
    data.currentCycle = null;
    data.admissionPeriodId = null;
  }
  // La facultad del docente es opcional (user/023_teacher_faculty_optional.sql):
  // no todas las instituciones tienen facultades.
  if (role !== 'TEACHER') {
    data.specialty = null;
    data.department = null;
  }
  // chk_users_scope_admin_only: todo ADMIN tiene alcance y nadie más lo tiene.
  if (role === 'ADMIN') {
    data.scopeLevel = existing.scopeLevel ?? 'ORG';
  } else {
    data.scopeLevel = null;
    data.regionId = null;
  }

  const updated = await userRepository.updateRole(id, data);
  return formatUserResponse(updated);
};
