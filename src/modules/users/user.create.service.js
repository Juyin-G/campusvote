// src/modules/users/user.create.service.js
// Creación de usuarios académicos (createUser) y bulk (createUsersBulk).
// ADMIN tenant — SUPERADMIN bloqueado.

import bcrypt from 'bcryptjs';
import * as userRepository from './user.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { isValidRole, ROLES, ADMIN_ROLES } from '../../constants/roles.js';
import { formatUserResponse } from '../../shared/utils/formatUserResponse.js';
import {
  canCreateScope,
  actorHasSiteAccess,
} from '../../services/adminScope.service.js';
import { prisma } from '../../database/prisma.js';
import {
  ORGANIZATION_ROLES,
  assertValidEmailDomain,
  hashPassword,
  normalizeDocumentIdentity,
  rejectSuperAdminOnTenant,
} from './user.helpers.js';
import MESSAGES from '../../constants/messages.js';

const USER_CREATE_SELECT = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  institutionalId: true,
  documentType: true,
  documentNumber: true,
  role: true,
  status: true,
  isVerified: true,
  isStaff: true,
  isSuperuser: true,
  organizationId: true,
  scopeLevel: true,
  regionId: true,
  twoFactorEnabled: true,
  mustChangePassword: true,
  lastLogin: true,
  dateJoined: true,
};

export const createUser = async (body = {}, actor = {}) => {
  const {
    username,
    email,
    password,
    first_name,
    last_name,
    institutional_id,
    role,
    organization_id,
    program_id,
    faculty_id,
    current_cycle,
    document_type,
    document_number,
    scope_level,
    region_id,
    site_ids,
  } = body;

  rejectSuperAdminOnTenant(actor, 'createUser');

  if (role === ROLES.ADMIN && actor.scopeLevel !== 'ORG') {
    throw ApiError.forbidden('Solo ADMIN ORG puede crear usuarios con rol ADMIN');
  }
  if (!role || !isValidRole(role)) {
    throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);
  }
  if (role === ROLES.SUPERADMIN) {
    throw ApiError.forbidden('El rol SUPERADMIN solo puede provisionarse mediante bootstrap seguro');
  }
  if (ORGANIZATION_ROLES.includes(role) && !organization_id) {
    throw ApiError.badRequest('Los usuarios institucionales deben pertenecer a una organización');
  }
  if (organization_id !== actor.organizationId) {
    throw ApiError.forbidden('Solo puedes crear usuarios dentro de tu organización');
  }

  let normalizedScopeLevel = null;
  let normalizedRegionId = null;
  let normalizedSiteIds = [];

  if (role === ROLES.ADMIN) {
    await canCreateScope(actor, {
      role: ROLES.ADMIN,
      organizationId: organization_id,
      scopeLevel: scope_level || 'ORG',
      regionId: region_id || null,
      siteIds: site_ids || [],
    });
    normalizedScopeLevel = scope_level || 'ORG';
    normalizedRegionId = region_id || null;
    normalizedSiteIds = site_ids || [];
  } else if (site_ids && site_ids.length > 0) {
    for (const siteId of site_ids) {
      const has = await actorHasSiteAccess(actor, siteId);
      if (!has) {
        throw ApiError.forbidden('No tienes autorización sobre una de las sedes indicadas');
      }
    }
    normalizedSiteIds = site_ids;
  }

  const identity = await normalizeDocumentIdentity({
    document_type,
    document_number,
    role,
  });

  const newUser = await prisma.user.create({
    data: {
      username,
      email,
      password: await hashPassword(password),
      firstName: first_name,
      lastName: last_name,
      institutionalId: institutional_id,
      role,
      organizationId: organization_id,
      programId: program_id,
      facultyId: faculty_id,
      currentCycle: current_cycle,
      isVerified: true,
      // Sin status explícito la BD lo deja en PENDING y login_is_allowed
      // lo rechaza: el usuario nunca podría entrar a cambiar su contraseña.
      status: 'ACTIVE',
      scopeLevel: normalizedScopeLevel,
      regionId: normalizedRegionId,
      mustChangePassword: true,
      ...(normalizedSiteIds.length > 0 && {
        siteAssignments: { create: normalizedSiteIds.map((siteId) => ({ siteId })) },
      }),
      ...(identity || {}),
    },
    select: USER_CREATE_SELECT,
  });

  return formatUserResponse(newUser);
};

export const createUsersBulk = async (payload = {}, actor = {}) => {
  rejectSuperAdminOnTenant(actor, 'createUsersBulk');

  let organization_id;
  let site_id;
  let items;
  if (Array.isArray(payload)) {
    items = payload;
    organization_id = actor.organizationId;
  } else {
    items = payload.users;
    organization_id = payload.organization_id || actor.organizationId;
    site_id = payload.site_id;
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Debes enviar al menos un usuario para crear');
  }
  if (items.length > 500) {
    throw ApiError.badRequest('Máximo 500 usuarios por operación');
  }
  if (!organization_id) {
    throw ApiError.badRequest('Debes indicar la organización del lote');
  }
  if (organization_id !== actor.organizationId) {
    throw ApiError.forbidden('Solo puedes crear usuarios dentro de tu organización');
  }

  for (const it of items) {
    const r = it.role || ROLES.JURY;
    if (ADMIN_ROLES.includes(r) && actor.scopeLevel !== 'ORG') {
      throw ApiError.forbidden('Solo ADMIN ORG puede crear lotes con rol ADMIN');
    }
  }

  let resolvedSiteId = null;
  if (site_id) {
    const site = await prisma.organizationSite.findUnique({
      where: { id: site_id },
      select: { id: true, organizationId: true },
    });
    if (!site) throw ApiError.badRequest('La sede indicada no existe');
    if (site.organizationId !== organization_id) {
      throw ApiError.badRequest('La sede no pertenece a la organización indicada');
    }
    const hasAccess = await actorHasSiteAccess(actor, site_id);
    if (!hasAccess) {
      throw ApiError.forbidden('No tienes autorización sobre esa sede');
    }
    resolvedSiteId = site_id;
  }

  const orgId = organization_id;
  const created = [];
  const errors = [];

  for (const item of items) {
    try {
      const role = item.role || ROLES.JURY;
      if (!isValidRole(role)) throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);
      if (ADMIN_ROLES.includes(role) && actor.scopeLevel !== 'ORG') {
        throw ApiError.forbidden('Solo ADMIN ORG puede crear usuarios con rol ADMIN');
      }

      const cleanEmail = item.email.toLowerCase().trim();
      await assertValidEmailDomain(cleanEmail, orgId);

      const identity = await normalizeDocumentIdentity({
        document_type: item.document_type,
        document_number: item.document_number,
        role,
      });

      const existing = await userRepository.findByEmail(cleanEmail);
      if (existing) {
        throw ApiError.conflict(`El correo ${cleanEmail} ya está registrado`);
      }

      const newUser = await prisma.user.create({
        data: {
          username: item.username.toLowerCase().trim(),
          email: cleanEmail,
          password: await hashPassword(item.password),
          firstName: item.first_name,
          lastName: item.last_name,
          institutionalId: item.institutional_id || item.username.trim(),
          role,
          organizationId: orgId,
          programId: item.program_id || null,
          careerId: item.career_id || null,
          facultyId: null,
          currentCycle: item.current_cycle ?? null,
          mustChangePassword: item.must_change_password ?? true,
          isVerified: true,
          // Sin status explícito la BD lo deja en PENDING y login_is_allowed
          // lo rechaza: el usuario nunca podría entrar a cambiar su contraseña.
          status: 'ACTIVE',
          ...(resolvedSiteId && {
            siteAssignments: { create: [{ siteId: resolvedSiteId }] },
          }),
          ...(identity || {}),
        },
        select: USER_CREATE_SELECT,
      });

      created.push(formatUserResponse(newUser));
    } catch (error) {
      errors.push({ email: item.email, message: error.message });
    }
  }

  // Solo en respuesta inmediata: contraseñas temporales (no se guardan en BD).
  const tempPasswords = {};
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (created[i] && it.email) {
      tempPasswords[it.email.toLowerCase().trim()] = it.password;
    }
  }

  return {
    created,
    errors,
    totalOk: created.length,
    totalFailed: errors.length,
    temp_passwords: tempPasswords,
    pdf_endpoint: '/api/users/bulk/pdf',
  };
};
