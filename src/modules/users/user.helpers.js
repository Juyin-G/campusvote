// src/modules/users/user.helpers.js
// Funciones puras y helpers reutilizables: identidad, errores, scope, tenant.
// Sin acceso a Prisma directo (excepto helpers puntuales con identidad).

import bcrypt from 'bcryptjs';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { isDomainAllowed } from '../../shared/utils/emailDomain.js';
import { identityProvider } from '../../shared/providers/index.js';
import { prisma } from '../../database/prisma.js';
import MESSAGES from '../../constants/messages.js';

// Roles que SIEMPRE deben registrar su DNI/CE (decisión F1):
// jurados, administradores y docentes.
export const REQUIRED_IDENTITY_ROLES = [ROLES.ADMIN, ROLES.JURY, ROLES.TEACHER];

export const ORGANIZATION_ROLES = [ROLES.ADMIN, ROLES.STUDENT, ROLES.TEACHER, ROLES.JURY];

/** Verifica y normaliza identidad nacional (DNI/CE) contra IdentityProvider. */
export const normalizeDocumentIdentity = async ({
  document_type,
  document_number,
  role,
}) => {
  const hasType = document_type !== undefined && document_type !== null && document_type !== '';
  const hasNumber = document_number !== undefined && document_number !== null && document_number !== '';

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

export const notFoundIfMissing = (err) => {
  if (err.code === 'P2025' || err.message.includes('not found')) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }
  throw err;
};

/** Rechaza SUPERADMIN en cualquier CRUD de tenant. */
export const rejectSuperAdminOnTenant = (actor, action) => {
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

/** Valida que el email pertenezca a un dominio permitido por la organización. */
export const assertValidEmailDomain = async (email, organizationId) => {
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

/** Hash de contraseña (coste 12 = bcrypt estándar de CampusVote). */
export const hashPassword = (plain) => bcrypt.hash(plain, 12);
