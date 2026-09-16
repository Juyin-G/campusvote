// src/modules/users/user.service.js

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import * as userRepository from './user.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { isValidRole, ADMIN_ROLES, ROLES } from '../../constants/roles.js';
import { parsePagination } from '../../shared/utils/pagination.js';
import { formatUserResponse } from '../../shared/utils/formatUserResponse.js';
import MESSAGES from '../../constants/messages.js';
import { prisma } from '../../database/prisma.js';
import * as otpUtil from '../../shared/utils/otp.util.js';
import * as otpRepository from '../auth/repositories/otp.repository.js';
import { isDomainAllowed } from '../../shared/utils/emailDomain.js';
import { identityProvider } from '../../shared/providers/index.js';
import emailService from '../../shared/services/email.service.js';
import { canCreateScope, actorHasSiteAccess, actorHasRegionAccess } from '../../services/adminScope.service.js';
import { canActorActOnUser } from '../../middlewares/tenantScope.middleware.js';

// Roles que SIEMPRE deben registrar su DNI/CE (decisión F1):
// jurados, administradores y docentes.
const REQUIRED_IDENTITY_ROLES = [
  ROLES.ADMIN,
  ROLES.JURY,
  ROLES.TEACHER,
];

const ORGANIZATION_ROLES = [
  ROLES.ADMIN,
  ROLES.STUDENT,
  ROLES.TEACHER,
  ROLES.JURY,
];

/**
 * Normaliza y VERIFICA la identidad nacional (DNI/CE) contra el
 * IdentityProvider. Devuelve { documentType, documentNumber } o null.
 */
const normalizeDocumentIdentity = async ({ document_type, document_number, role }) => {
  const hasType = document_type !== undefined && document_type !== null && document_type !== '';
  const hasNumber =
    document_number !== undefined && document_number !== null && document_number !== '';

  if (!hasType && !hasNumber) {
    if (REQUIRED_IDENTITY_ROLES.includes(role)) {
      throw ApiError.badRequest(
        `Los usuarios con el rol ${role} deben registrar su DNI o Carné de Extranjería`
      );
    }
    return null;
  }

  if (hasType !== hasNumber) {
    throw ApiError.badRequest('document_type y document_number deben enviarse juntos');
  }

  if (!['DNI', 'CE'].includes(document_type)) {
    throw ApiError.badRequest('El tipo de documento debe ser DNI o CE');
  }

  const cleanNumber = String(document_number).trim().toUpperCase();
  const verification = await identityProvider.validateDocument(document_type, cleanNumber);
  if (!verification.verified) {
    throw ApiError.badRequest(verification.reason || 'Documento de identidad no válido');
  }

  return { documentType: document_type, documentNumber: cleanNumber };
};

const notFoundIfMissing = (err) => {
  if (err.code === 'P2025' || err.message.includes('not found')) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  throw err;
};

export const listUsers = async (query = {}, actor = {}) => {
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

  // Defensa: el CRUD de usuarios académicos NO es accesible a SUPERADMIN.
  // El sub-router ya lo bloquea con blockSuperAdminFromTenantRoutes; esta
  // verificación adicional sirve como belt-and-suspenders.
  const isSuperUser =
    actor.role === ROLES.SUPERADMIN || actor.isSuperuser || actor.isSuperAdmin;
  if (isSuperUser) {
    throw ApiError.forbidden(
      'El administrador de plataforma no tiene acceso al CRUD de usuarios de tenant'
    );
  }

  const organizationId = actor.organizationId;
  if (!organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }

  // Filtro de scope multi-sede. Si el sub-router ya inyectó
  // req.scope.userWhere, lo respetamos; en su defecto usamos
  // `actor.scopeLevel` como respaldo.
  const actorScopeWhere = actor._scopeWhere || {};

  if (query.role && !isValidRole(query.role)) {
    throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);
  }

  const filter = {
    organizationId,
    role: query.role,
    search: query.search,
    isActive: query.isActive,
    scopeWhere: actorScopeWhere,
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

  // El sub-router ya bloqueó a SUPERADMIN; esta es la verificación
  // belt-and-suspenders para que, si la ruta se importa desde otro
  // punto, el comportamiento siga siendo seguro.
  rejectSuperAdminOnTenant(actor, 'createUser');

  // Política: solo ADMIN ORG puede crear usuarios con rol ADMIN.
  // (ADMIN REGION/SITE no pueden crear ADMIN ↔ deben usar /admin/admins
  //  con su propio scope y les será rechazado por canCreateScope.)
  if (role === ROLES.ADMIN) {
    if (actor.scopeLevel !== 'ORG') {
      throw ApiError.forbidden(
        'Solo ADMIN ORG puede crear usuarios con rol ADMIN'
      );
    }
  }

  if (!role || !isValidRole(role)) {
    throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);
  }

  if (role === ROLES.SUPERADMIN) {
    throw ApiError.forbidden('El rol SUPERADMIN solo puede provisionarse mediante bootstrap seguro');
  }

  if (ORGANIZATION_ROLES.includes(role) && !organization_id) {
    organization_id = actor.organizationId;
    if (!organization_id) {
      throw ApiError.badRequest('Los usuarios institucionales deben pertenecer a una organización');
    }
  }

  if (organization_id !== actor.organizationId) {
    throw ApiError.forbidden('Solo puedes crear usuarios dentro de tu organización');
  }

  // ── Alcance administrativo (multi-sede): REGION/SITE/ORG ─────────────
  // Si el usuario a crear es un ADMIN con scope, validamos que el actor
  // pueda crearlo según la jerarquía ORG > REGION > SITE (adminScope.service).
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
    // Usuarios académicos (STUDENT/TEACHER/JURY) pueden estar asociados a una
    // sede concreta: el ADMIN que los crea debe tener alcance sobre la sede.
    for (const siteId of site_ids) {
      const has = await actorHasSiteAccess(actor, siteId);
      if (!has) {
        throw ApiError.forbidden(
          'No tienes autorización sobre una de las sedes indicadas'
        );
      }
    }
    normalizedSiteIds = site_ids;
  }

  // F1: Identidad nacional (DNI/CE) — verificación contra IdentityProvider.
  const identity = await normalizeDocumentIdentity({
    document_type,
    document_number,
    role,
  });

  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      firstName: first_name,
      lastName: last_name,
      institutionalId: institutional_id,
      role,
      organizationId: organization_id,
      programId: program_id,
      facultyId: faculty_id,
      currentCycle: current_cycle,
      isVerified: true,
      scopeLevel: normalizedScopeLevel,
      regionId: normalizedRegionId,
      mustChangePassword: true,
      ...(normalizedSiteIds.length > 0 && {
        siteAssignments: {
          create: normalizedSiteIds.map((siteId) => ({ siteId })),
        },
      }),
      ...(identity || {}),
    },
    select: {
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
    },
  });

  return formatUserResponse(newUser);
};

/**
 * SUPERADMIN: crea UNA ORGANIZACIÓN (universidad/proyecto) y su ADMIN en un
 * solo paso, vinculando al admin a esa organización. Le provisiona un 2FA de
 * primer acceso (OTP/QR) que el admin usa para configurar Google Authenticator.
 * @param {Object} body - { organization: {...}, admin: {...} }
 * @param {Object} actor - usuario autenticado
 */
export const provisionAdmin = async (body = {}, actor = {}) => {
  const isSuperUser =
    actor.isSuperuser || actor.isSuperAdmin || actor.role === ROLES.SUPERADMIN;

  if (!isSuperUser) {
    throw ApiError.forbidden('Solo el superadmin puede crear administradores');
  }

  const { organization, admin } = body;

  if (!organization || !admin) {
    throw ApiError.badRequest(
      'Debes enviar la organización y el administrador a crear'
    );
  }

  const {
    username,
    email,
    password,
    first_name,
    last_name,
  } = admin;

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.toLowerCase().trim();

  const existingEmail = await userRepository.findByEmail(cleanEmail);
  if (existingEmail) {
    throw ApiError.conflict(MESSAGES.USER.ALREADY_EXISTS);
  }

  const existingUsername = await userRepository.findByUsername(cleanUsername);
  if (existingUsername) {
    throw ApiError.conflict(MESSAGES.USER.USERNAME_TAKEN);
  }

  // 1. Crear la organización (universidad/proyecto).
  const normalizedCode = (organization.code || '').trim().toUpperCase() ||
    cleanUsername.toUpperCase().slice(0, 10);

  const existingOrg = await prisma.organization.findUnique({
    where: { code: normalizedCode },
  });
  if (existingOrg) {
    throw ApiError.conflict('Ya existe una organización con ese código');
  }

  const newOrg = await prisma.organization.create({
    data: {
      name: organization.name.trim(),
      code: normalizedCode,
      orgType: organization.org_type ?? 'UNIVERSITY',
      logo: organization.logo || null,
      primaryColor: organization.primary_color || '#0066CC',
      secondaryColor: organization.secondary_color || '#FFD700',
      country: organization.country?.trim() || 'Perú',
      timezone: organization.timezone?.trim() || 'America/Lima',
      allowedEmailDomains: organization.allowed_email_domains || [],
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  // 2. Crear el ADMIN asociado a la organización recién creada.
  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = await userRepository.create({
    username: cleanUsername,
    email: cleanEmail,
    password: hashedPassword,
    firstName: first_name,
    lastName: last_name,
    institutionalId: cleanUsername,
    role: ROLES.ADMIN,
    organizationId: newOrg.id,
    mustChangePassword: true,
    isVerified: true,
  });

  // 3. Provisionar credenciales/2FA según el canal de email disponible.
  // - Si hay canal de email configurado: se envía invitación y se devuelve
  //   {mode: 'invitation'} (el admin define su contraseña y 2FA al primer acceso).
  // - Si NO hay canal: credenciales temporales; el admin debe configurar 2FA
  //   al primer acceso (flag must_setup_2fa=true). NO se devuelven qrCode/secret/
  //   backupCodes inline porque el SECRET/QR se generan en el flujo de setup
  //   de TOTP del primer login.
  let qrCode = undefined;
  let secret = undefined;
  let plainBackupCodes = undefined;
  let onboardingMode = 'temp';

  if (emailService.hasEmailConfigured()) {
    onboardingMode = 'invitation';
  }

  return {
    organization: newOrg,
    user: formatUserResponse(newUser),
    qrCode,
    secret,
    backupCodes: plainBackupCodes,
    onboarding_mode: onboardingMode,
    must_change_password: true,
    must_setup_2fa: true,
    mustChangePassword: true,
  };
};

/**
 * SUPERADMIN: crea un ADMIN para una organización EXISTENTE.
 * Reutiliza el patrón de provisionAdmin (mismo bootstrap de 2FA con OTP/QR/backup codes)
 * pero omite la creación de la organización porque la recibe por params.
 *
 * @param {string} organizationId - UUID de la organización destino (ya existente)
 * @param {Object} body - { username, email, password, first_name, last_name, document_type, document_number }
 * @param {Object} actor - usuario autenticado (debe ser SUPERADMIN)
 */
export const provisionExistingAdmin = async (organizationId, body = {}, actor = {}) => {
  const isSuperUser =
    actor.isSuperuser || actor.isSuperAdmin || actor.role === ROLES.SUPERADMIN;

  if (!isSuperUser) {
    throw ApiError.forbidden('Solo el superadmin puede crear administradores');
  }

  const targetOrg = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      code: true,
      allowedEmailDomains: true,
    },
  });

  if (!targetOrg) {
    throw ApiError.notFound('Organización no encontrada');
  }

  const {
    username,
    email,
    password,
    first_name,
    last_name,
    document_type,
    document_number,
  } = body;

  if (!email) {
    throw ApiError.badRequest('El email es obligatorio');
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = (username || cleanEmail.split('@')[0]).toLowerCase().trim();

  await assertValidEmailDomain(cleanEmail, targetOrg.id);

  const existingEmail = await userRepository.findByEmail(cleanEmail);
  if (existingEmail) {
    throw ApiError.conflict(MESSAGES.USER.ALREADY_EXISTS);
  }

  const existingUsername = await userRepository.findByUsername(cleanUsername);
  if (existingUsername) {
    throw ApiError.conflict(MESSAGES.USER.USERNAME_TAKEN);
  }

  const identity = await normalizeDocumentIdentity({
    document_type,
    document_number,
    role: ROLES.ADMIN,
  });

  const finalPassword = password || crypto.randomBytes(18).toString('base64url');
  const hashedPassword = await bcrypt.hash(finalPassword, 12);

  const newUser = await userRepository.create({
    username: cleanUsername,
    email: cleanEmail,
    password: hashedPassword,
    firstName: first_name || cleanUsername,
    lastName: last_name || '',
    institutionalId: cleanUsername,
    role: ROLES.ADMIN,
    organizationId: targetOrg.id,
    mustChangePassword: true,
    isVerified: true,
    ...(identity || {}),
  });

  const secret = otpUtil.generateTotpSecret();
  const uri = otpUtil.generateTotpUri(secret, cleanEmail, newUser.username);
  const plainBackupCodes = otpUtil.generateBackupCodes();
  const hashedBackupCodes = plainBackupCodes.map((code) => otpUtil.hashBackupCode(code));

  await otpRepository.saveTotpSecret(newUser.id, secret);
  await otpRepository.enableTwoFactor(newUser.id, hashedBackupCodes);

  const qrCode = await otpUtil.generateQrCode(uri);

  return {
    organization: { id: targetOrg.id, name: targetOrg.name, code: targetOrg.code },
    user: formatUserResponse(newUser),
    qrCode,
    secret,
    backupCodes: plainBackupCodes,
    mustChangePassword: true,
  };
};

/**
 * Obtiene la organización y valida que el email del jurado pertenezca a un
 * dominio permitido (si la organización define allowed_email_domains).
 */
const assertValidEmailDomain = async (email, organizationId) => {
  if (!organizationId) return;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { allowedEmailDomains: true },
  });

  if (!org) throw ApiError.notFound('Organización no encontrada');

  const allowedDomains = Array.isArray(org.allowedEmailDomains)
    ? org.allowedEmailDomains
    : [];

  if (allowedDomains.length > 0 && !isDomainAllowed(email, allowedDomains)) {
    throw ApiError.badRequest(
      `El dominio del correo no está permitido por la organización (permitidos: ${allowedDomains.join(', ')})`
    );
  }
};

/**
 * ADMIN: crea jurados/usuarios en lote (bulk) con scope-aware.
 * - Valida los correos contra los dominios permitidos de la organización.
 * - Fuerza que todos los usuarios creados pertenezcan a la organización
 *   de la carga (`payload.organization_id`) y opcionalmente a una sede
 *   (`payload.site_id`). El ADMIN solo puede crear usuarios dentro del
 *   alcance de su scope ORG/REGION/SITE.
 *
 * @param {Object|Array} payload - { organization_id, site_id, users: [...] }
 *                              - o array (compatibilidad legacy)
 * @param {Object} actor - usuario autenticado (ADMIN tenant)
 */
export const createUsersBulk = async (payload = {}, actor = {}) => {
  // El sub-router ya bloqueó a SUPERADMIN; verificación adicional.
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

  // Aislamiento tenant: el ADMIN solo opera dentro de su organización.
  if (organization_id !== actor.organizationId) {
    throw ApiError.forbidden(
      'Solo puedes crear usuarios dentro de tu organización'
    );
  }

  // Política: solo ADMIN ORG puede crear lotes con rol ADMIN.
  for (const it of items) {
    const r = it.role || ROLES.JURY;
    if (ADMIN_ROLES.includes(r) && actor.scopeLevel !== 'ORG') {
      throw ApiError.forbidden(
        'Solo ADMIN ORG puede crear lotes con rol ADMIN'
      );
    }
  }

  // Validar sede si viene (debe pertenecer a la org y al alcance del actor).
  let resolvedSiteId = null;
  if (site_id) {
    const site = await prisma.organizationSite.findUnique({
      where: { id: site_id },
      select: { id: true, organizationId: true },
    });
    if (!site) throw ApiError.badRequest('La sede indicada no existe');
    if (site.organizationId !== organization_id) {
      throw ApiError.badRequest(
        'La sede no pertenece a la organización indicada'
      );
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
      if (!isValidRole(role)) {
        throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);
      }

      // Solo ADMIN ORG puede usar roles privilegiados en bulk.
      if (ADMIN_ROLES.includes(role) && actor.scopeLevel !== 'ORG') {
        throw ApiError.forbidden(
          'Solo ADMIN ORG puede crear usuarios con rol ADMIN'
        );
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

      const hashedPassword = await bcrypt.hash(item.password, 12);

      const newUser = await prisma.user.create({
        data: {
          username: item.username.toLowerCase().trim(),
          email: cleanEmail,
          password: hashedPassword,
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
          ...(resolvedSiteId && {
            siteAssignments: { create: [{ siteId: resolvedSiteId }] },
          }),
          ...(identity || {}),
        },
        select: {
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
        },
      });

      created.push(formatUserResponse(newUser));
    } catch (error) {
      errors.push({
        email: item.email,
        message: error.message,
      });
    }
  }

  // Si todos los usuarios creados son válidos y se generó al menos una
  // cuenta, devolvemos también las contraseñas temporales (en texto plano)
  // para que el ADMIN pueda generar el PDF/comunicado correspondiente.
  // Estas contraseñas SOLO se devuelven en la respuesta inmediata: el
  // modelo solo guarda el hash (bcryptjs).
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
// Helper: rechaza SUPERADMIN en cualquier CRUD de tenant.
const rejectSuperAdminOnTenant = (actor, action) => {
  if (
    actor?.role === ROLES.SUPERADMIN ||
    actor?.isSuperuser ||
    actor?.isSuperAdmin
  ) {
    throw ApiError.forbidden(
      `El administrador de plataforma no tiene acceso a la gestión de usuarios de tenant (${action})`
    );
  }
};

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

  // Aislamiento tenant + scope.
  const siteIds = (target.siteAssignments || []).map((s) => s.siteId);
  const allowed = await canActorActOnUser(
    actor,
    target.organizationId,
    siteIds
  );
  if (!allowed) {
    throw ApiError.forbidden('No tienes autorización sobre este usuario');
  }

  const data = {};
  if (body.first_name !== undefined) data.firstName = body.first_name;
  if (body.last_name !== undefined) data.lastName = body.last_name;
  if (body.organization_id !== undefined) {
    if (body.organization_id !== target.organizationId) {
      throw ApiError.forbidden(
        'No puedes reasignar usuarios a otra organización'
      );
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
  const allowed = await canActorActOnUser(
    actor,
    target.organizationId,
    siteIds
  );
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
  const allowed = await canActorActOnUser(
    actor,
    target.organizationId,
    siteIds
  );
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

  // Defensa S2: Auto-modificación prohibida
  const actorId = actor.userId ?? actor.id;
  if (actorId === id) {
    throw ApiError.badRequest('No puedes modificar tu propio rol');
  }

  // Política: solo ADMIN ORG puede asignar/modificar roles ADMIN.
  // ADMIN REGION/SITE pueden cambiar roles académicos de usuarios dentro
  // de su scope (STUDENT/TEACHER/JURY); nunca ADMIN ↔ STALE.
  if (ADMIN_ROLES.includes(role) && actor.scopeLevel !== 'ORG') {
    throw ApiError.forbidden(
      'Solo ADMIN ORG puede asignar el rol ADMIN dentro del tenant'
    );
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
      siteAssignments: { select: { siteId: true } },
    },
  });
  if (!existing) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);

  // Aislamiento tenant + scope multi-sede.
  const siteIds = (existing.siteAssignments || []).map((s) => s.siteId);
  const allowed = await canActorActOnUser(
    actor,
    existing.organizationId,
    siteIds
  );
  if (!allowed) {
    throw ApiError.forbidden('No tienes autorización sobre este usuario');
  }

  if (existing.isSuperuser && !ADMIN_ROLES.includes(role)) {
    const superuserCount = await prisma.user.count({
      where: { isSuperuser: true, status: 'ACTIVE' },
    });
    if (superuserCount <= 1) {
      throw ApiError.badRequest(
        'No se puede cambiar el rol del último superusuario activo'
      );
    }
  }

  // El CHECK académico de la BD exige coherencia entre rol y datos académicos:
  // STUDENT -> program_id + current_cycle; TEACHER -> faculty_id; perfiles no
  // académicos -> sin programa/ciclo/periodo de admisión, etc.
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
  if (role === 'TEACHER') {
    if (!existing.facultyId) {
      throw ApiError.badRequest('Un docente requiere una facultad asignada');
    }
  } else {
    data.specialty = null;
    data.department = null;
  }

  const updated = await userRepository.updateRole(id, data);
  return formatUserResponse(updated);
};

export const updateMyProfile = async (userId, body = {}) => {
  const data = {};
  if (body.first_name !== undefined) data.firstName = body.first_name;
  if (body.last_name !== undefined) data.lastName = body.last_name;
  if (body.document_type !== undefined || body.document_number !== undefined) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, documentType: true, documentNumber: true },
    });
    const identity = await normalizeDocumentIdentity({
      document_type: body.document_type ?? existing?.documentType,
      document_number: body.document_number ?? existing?.documentNumber,
      role: existing?.role,
    });
    if (identity) {
      data.documentType = identity.documentType;
      data.documentNumber = identity.documentNumber;
    }
  }

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
    select: { password: true, status: true },
  });
  if (dbUser?.status !== 'ACTIVE' || !dbUser.password) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  const matches = await bcrypt.compare(currentPassword, dbUser.password);
  if (!matches) {
    throw ApiError.badRequest('La contraseña actual es incorrecta');
  }

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
  provisionAdmin,
  provisionExistingAdmin,
  createUsersBulk,
  updateUser,
  setActiveStatus,
  unlockUser,
  updateUserRole,
  updateMyProfile,
  changeMyPassword,
};