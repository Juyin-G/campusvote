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
import { isDomainAllowed } from '../../shared/utils/emailDomain.js';
import { identityProvider } from '../../shared/providers/index.js';
import * as authRepository from '../auth/repositories/auth.repository.js';
import { sendActivation, hasEmailConfigured } from '../../shared/services/email.service.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';

// Roles que SIEMPRE deben registrar su DNI/CE (decisión F1):
// jurados, comisión electoral, administradores y docentes.
const REQUIRED_IDENTITY_ROLES = [
  ROLES.ADMIN,
  ROLES.ELECTORAL_COMMISSION,
  ROLES.JURY,
  ROLES.TEACHER,
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

const isGlobalAdmin = (actor = {}) =>
  actor.role === ROLES.SUPERADMIN || actor.isSuperuser || actor.isSuperAdmin;

const organizationScopeFor = (actor = {}, requestedOrganizationId) => {
  if (isGlobalAdmin(actor)) return requestedOrganizationId;
  if (!actor.organizationId) {
    throw ApiError.forbidden('El usuario administrativo no tiene una organización asignada');
  }
  if (requestedOrganizationId && requestedOrganizationId !== actor.organizationId) {
    throw ApiError.forbidden('No puedes acceder a usuarios de otra organización');
  }
  return actor.organizationId;
};

const assertOrganizationCapacity = async (organizationId, additionalSeats = 1) => {
  if (!organizationId) return;
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { memberLimit: true },
  });
  if (!organization) throw ApiError.notFound('Organización no encontrada');

  const currentMembers = await prisma.user.count({
    where: {
      organizationId,
      role: { not: ROLES.SUPERADMIN },
      status: { not: 'DELETED' },
    },
  });
  if (currentMembers + additionalSeats > organization.memberLimit) {
    throw ApiError.badRequest(
      `La organización alcanzó su capacidad de ${organization.memberLimit} miembros. Solicita al SUPERADMIN una ampliación.`
    );
  }
};

export const listUsers = async (query = {}, actor = {}) => {
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;
  const organizationId = organizationScopeFor(actor, query.organizationId);

  if (query.role && !isValidRole(query.role)) {
    throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);
  }

  const [total, users] = await Promise.all([
    userRepository.count({
      organizationId,
      role: query.role,
      search: query.search,
      isActive: query.isActive,
    }),
    userRepository.list({
      organizationId,
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
  if (isAdmin && !isGlobalAdmin(actor) && user.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('No puedes acceder a usuarios de otra organización');
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
  } = body;

  // Defensa S2: Solo superusuarios pueden crear usuarios con roles privilegiados
  // (ADMIN / ELECTORAL_COMMISSION). Los roles electorales regulares pueden
  // ser creados por cualquier administrador de la organización.
  const isSuperUser = actor.isSuperuser || actor.isSuperAdmin || actor.role === ROLES.SUPERADMIN;
  if (role && ADMIN_ROLES.includes(role) && !isSuperUser) {
    throw ApiError.forbidden('Solo superusuarios pueden crear usuarios con roles privilegiados');
  }

  const organizationId = organizationScopeFor(actor, organization_id);
  if (role === ROLES.ADMIN && !organizationId) {
    throw ApiError.badRequest('Todo ADMIN debe estar vinculado a una organización');
  }
  await assertOrganizationCapacity(organizationId);

  // F1: Identidad nacional (DNI/CE) — verificación contra IdentityProvider.
  const identity = await normalizeDocumentIdentity({
    document_type,
    document_number,
    role: role || ROLES.VOTER,
  });

  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = await userRepository.create({
    username,
    email,
    password: hashedPassword,
    firstName: first_name,
    lastName: last_name,
    institutionalId: institutional_id,
    role: role || ROLES.VOTER,
    organizationId,
    programId: program_id,
    facultyId: faculty_id,
    currentCycle: current_cycle,
    ...(identity || {}),
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
    email,
    password,
    first_name,
    last_name,
  } = admin;

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = (admin.username || cleanEmail.split('@')[0]).toLowerCase().trim();

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

  // 2. Crear el ADMIN asociado a la organización recién creada usando el flujo
  //    de onboarding (sin 2FA automático): invitación por email si hay canal de
  //    email, o credenciales temporales (must_setup_2fa) si no lo hay.
  if (hasEmailConfigured()) {
    const newUser = await userRepository.create({
      username: cleanUsername,
      email: cleanEmail,
      password: null,
      firstName: first_name || '',
      lastName: last_name || '',
      institutionalId: cleanUsername,
      role: ROLES.ADMIN,
      organizationId: newOrg.id,
      mustChangePassword: false,
      status: 'PENDING_ACTIVATION',
      isVerified: true,
    });

    let activationEmailSent = false;
    let activationEmailError = null;
    try {
      const token = await authRepository.generateActivationToken(newUser.id);
      if (token) {
        await sendActivation({ email: cleanEmail, token, firstName: first_name ?? 'Administrador' });
        activationEmailSent = true;
      }
    } catch (error) {
      logger.warn('No se pudo enviar la invitación de activación', {
        userId: newUser.id,
        error: error.message,
      });
      activationEmailError = env.NODE_ENV === 'development' ? error.message : null;
    }

    return {
      organization: newOrg,
      user: formatUserResponse(newUser),
      status: 'PENDING_ACTIVATION',
      onboarding_mode: 'email',
      activation_email_sent: activationEmailSent,
      ...(activationEmailError ? { activation_email_error: activationEmailError } : {}),
    };
  }

  if (!password) {
    throw ApiError.badRequest(
      'Debes proporcionar una contraseña temporal (no hay servicio de email configurado)'
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = await userRepository.create({
    username: cleanUsername,
    email: cleanEmail,
    password: hashedPassword,
    firstName: first_name || '',
    lastName: last_name || '',
    institutionalId: cleanUsername,
    role: ROLES.ADMIN,
    organizationId: newOrg.id,
    mustChangePassword: true,
    mustSetup2fa: true,
    status: 'ACTIVE',
    isVerified: true,
  });

  return {
    organization: newOrg,
    user: formatUserResponse(newUser),
    status: 'ACTIVE',
    onboarding_mode: 'temp',
    must_change_password: true,
    must_setup_2fa: true,
  };
};

/**
 * SUPERADMIN: crea el ADMIN de una organización existente usando el flujo de
 * onboarding (sin 2FA forzado al momento de crear la cuenta — el admin lo
 * enróla él mismo en su primer acceso).
 *
 * - Con canal de email configurado (SMTP/Resend) → Opción 1: cuenta en
 *   PENDING_ACTIVATION sin contraseña; se envía invitación con token (24h).
 * - Sin email → Opción 2: cuenta ACTIVE con contraseña temporal, 2FA off y
 *   must_setup_2fa = TRUE (el login emite token de onboarding, no JWT).
 */
export const provisionExistingAdmin = async (organizationId, body = {}, actor = {}) => {
    const isSuperUser =
      actor.isSuperuser || actor.isSuperAdmin || actor.role === ROLES.SUPERADMIN;
    if (!isSuperUser) {
      throw ApiError.forbidden('Solo el superadmin puede crear administradores');
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, code: true, isActive: true },
    });
    if (!organization) throw ApiError.notFound('La organización no existe');
    if (!organization.isActive) throw ApiError.conflict('La organización está inactiva');

    const existingAdmin = await prisma.user.findFirst({
      where: { organizationId, role: ROLES.ADMIN, status: { not: 'DELETED' } },
      select: { id: true },
    });
    if (existingAdmin) {
      throw ApiError.conflict('La organización ya tiene un administrador');
    }

    const cleanEmail = body.email.toLowerCase().trim();
    const cleanUsername = (body.username || cleanEmail.split('@')[0]).toLowerCase().trim();
    if (await userRepository.findByEmail(cleanEmail)) {
      throw ApiError.conflict(MESSAGES.USER.ALREADY_EXISTS);
    }
    if (await userRepository.findByUsername(cleanUsername)) {
      throw ApiError.conflict(MESSAGES.USER.USERNAME_TAKEN);
    }

    // La identidad nacional es opcional durante el onboarding; si se envía se
    // valida contra el IdentityProvider (DNI/CE).
    const hasDocument =
      body.document_type !== undefined && body.document_number !== undefined;
    const identity = hasDocument
      ? await normalizeDocumentIdentity({
          document_type: body.document_type,
          document_number: body.document_number,
          role: ROLES.ADMIN,
        })
      : null;

    const commonData = {
      username: cleanUsername,
      email: cleanEmail,
      firstName: body.first_name ?? '',
      lastName: body.last_name ?? '',
      institutionalId: cleanUsername,
      role: ROLES.ADMIN,
      organizationId,
      isVerified: true,
      ...(identity || {}),
    };

    const createUser = async (data) => {
      try {
        return await userRepository.create(data);
      } catch (error) {
        if (error?.code === 'P2002') {
          throw ApiError.conflict('El usuario o documento ya está registrado');
        }
        throw error;
      }
    };

    // Opción 1 — Invitación por email
    if (hasEmailConfigured()) {
      const newUser = await createUser({
        ...commonData,
        password: null,
        mustChangePassword: false,
        status: 'PENDING_ACTIVATION',
      });

      let activationEmailSent = false;
      let activationEmailError = null;
      try {
        const token = await authRepository.generateActivationToken(newUser.id);
        if (token) {
          await sendActivation({
            email: cleanEmail,
            token,
            firstName: body.first_name ?? 'Administrador',
          });
          activationEmailSent = true;
        }
      } catch (error) {
        logger.warn('No se pudo enviar la invitación de activación', {
          userId: newUser.id,
          error: error.message,
        });
        activationEmailError =
          env.NODE_ENV === 'development' ? error.message : null;
      }

      return {
        organization,
        user: formatUserResponse(newUser),
        status: 'PENDING_ACTIVATION',
        onboarding_mode: 'email',
        activation_email_sent: activationEmailSent,
        ...(activationEmailError ? { activation_email_error: activationEmailError } : {}),
      };
    }

    // Opción 2 — Credenciales temporales (sin email configurado)
    if (!body.password) {
      throw ApiError.badRequest(
        'Debes proporcionar una contraseña temporal (no hay servicio de email configurado)'
      );
    }
    const hashedPassword = await bcrypt.hash(body.password, 12);
    const newUser = await createUser({
      ...commonData,
      password: hashedPassword,
      mustChangePassword: true,
      mustSetup2fa: true,
      status: 'ACTIVE',
    });

    return {
      organization,
      user: formatUserResponse(newUser),
      status: 'ACTIVE',
      onboarding_mode: 'temp',
      must_change_password: true,
      must_setup_2fa: true,
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
 * ADMIN: crea jurados/usuarios en lote (bulk). Valida los correos contra los
 * dominios permitidos de la organización del actor.
 * @param {Array} items - lista de { username, email, password, first_name, last_name, role }
 * @param {Object} actor - usuario autenticado (debe ser admin de su org)
 */
export const createUsersBulk = async (items = [], actor = {}) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Debes enviar al menos un usuario para crear');
  }

  if (items.length > 500) {
    throw ApiError.badRequest('Máximo 500 usuarios por operación');
  }

  const orgId = actor.organizationId || null;
  await assertOrganizationCapacity(orgId, items.length);

  const created = [];
  const errors = [];

  for (const item of items) {
    try {
      const role = item.role || ROLES.JURY;
      if (!isValidRole(role)) {
        throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);
      }

      // Solo superusuarios pueden crear/usar roles privilegiados.
      const isSuperUser =
        actor.isSuperuser || actor.isSuperAdmin || actor.role === ROLES.SUPERADMIN;
      if (role === ROLES.ADMIN && !orgId) {
        throw ApiError.badRequest('Todo ADMIN debe estar vinculado a una organización');
      }
      if (ADMIN_ROLES.includes(role) && !isSuperUser) {
        throw ApiError.forbidden(
          'Solo superusuarios pueden crear usuarios con roles privilegiados'
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

      const newUser = await userRepository.create({
        username: item.username.toLowerCase().trim(),
        email: cleanEmail,
        password: hashedPassword,
        firstName: item.first_name,
        lastName: item.last_name,
        institutionalId: item.institutional_id || item.username.trim(),
        role,
        organizationId: orgId,
        mustChangePassword: item.must_change_password ?? true,
        ...(identity || {}),
      });

      created.push(formatUserResponse(newUser));
    } catch (error) {
      errors.push({
        email: item.email,
        message: error.message,
      });
    }
  }

  return { created, errors, totalOk: created.length, totalFailed: errors.length };
};
export const updateUser = async (id, body = {}, actor = {}) => {
  const existingUser = await userRepository.findById(id);
  if (!existingUser) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  if (!isGlobalAdmin(actor) && existingUser.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('No puedes modificar usuarios de otra organización');
  }

  const data = {};
  if (body.first_name !== undefined) data.firstName = body.first_name;
  if (body.last_name !== undefined) data.lastName = body.last_name;
  if (body.organization_id !== undefined) {
    data.organizationId = organizationScopeFor(actor, body.organization_id);
  }
  if (body.document_type !== undefined || body.document_number !== undefined) {
    const existing = await prisma.user.findUnique({
      where: { id },
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
  const target = await userRepository.findById(id);
  if (!target) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  if (!isGlobalAdmin(actor) && target.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('No puedes modificar usuarios de otra organización');
  }

  try {
    const updated = await userRepository.setActive(id, isActive);
    return formatUserResponse(updated);
  } catch (err) {
    notFoundIfMissing(err);
  }
};

export const unlockUser = async (id, actor = {}) => {
  const target = await userRepository.findById(id);
  if (!target) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  if (!isGlobalAdmin(actor) && target.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('No puedes modificar usuarios de otra organización');
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
  if (!isValidRole(role)) throw ApiError.badRequest(MESSAGES.USER.INVALID_ROLE);

  // Defensa S2: Auto-modificación prohibida
  const actorId = actor.userId ?? actor.id;
  if (actorId === id) {
    throw ApiError.badRequest('No puedes modificar tu propio rol');
  }

  // Defensa S2: Exige privilegios de superusuario solo para asignar roles privilegiados
  const isSuperUser = actor.isSuperuser || actor.isSuperAdmin || actor.role === ROLES.SUPERADMIN;
  if (ADMIN_ROLES.includes(role) && !isSuperUser) {
    throw ApiError.forbidden('Solo superusuarios pueden asignar roles privilegiados');
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      isSuperuser: true,
      facultyId: true,
      programId: true,
      currentCycle: true,
      admissionPeriodId: true,
      specialty: true,
      department: true,
    },
  });
  if (!existing) throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  if (!isGlobalAdmin(actor)) {
    const targetOrganization = await prisma.user.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (targetOrganization?.organizationId !== actor.organizationId) {
      throw ApiError.forbidden('No puedes modificar usuarios de otra organización');
    }
    if (role === ROLES.ADMIN && !existing.organizationId) {
      throw ApiError.badRequest('No se puede asignar ADMIN sin una organización');
    }
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
    select: { password: true, status: true, mustSetup2fa: true, twoFactorEnabled: true },
  });
  if (dbUser?.status !== 'ACTIVE' || !dbUser.password) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }
  if (dbUser.mustSetup2fa || !dbUser.twoFactorEnabled) {
    throw ApiError.badRequest('Primero debes completar la configuración de 2FA');
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