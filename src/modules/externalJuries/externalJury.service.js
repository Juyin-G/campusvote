// src/modules/externalJuries/externalJury.service.js
// Jurados externos aceptados por dominio: el correo del invitado debe pertenecer
// a un dominio listado en `allowed_email_domains` de la organización (Identidad
// institucional). El jurado se provisiona como User rol JURY de la org con
// password temporal (misma mecánica que el bulk de Excel) y su asignación a la
// feria, de modo que reutiliza el flujo de jurado existente.

import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { getAccessibleSiteIds } from '../../services/adminScope.service.js';
import * as userRepository from '../users/user.repository.js';
import {
  assertValidEmailDomain,
  normalizeDocumentIdentity,
  hashPassword,
} from '../users/user.helpers.js';
import { generateTemporaryPassword } from '../users/user.excel.service.js';

const INVITE_STATUS = {
  INVITED: 'INVITED',
  REVOKED: 'REVOKED',
};

const INVITE_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

const JURY_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  scopeLevel: true,
};

/**
 * Aislamiento tenant + scope de sede: ORG ve toda su org; REGION/SITE solo
 * ferias que apunten a una sede dentro de su scope.
 */
const assertFairAccess = async ({ actor, fair }) => {
  if (!actor.organizationId || fair.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La feria no pertenece a tu organización');
  }
  if (!actor.scopeLevel || actor.scopeLevel === 'ORG') return;
  const accessible = await getAccessibleSiteIds(actor);
  if (!fair.siteId || !accessible.includes(fair.siteId)) {
    throw ApiError.forbidden('No tienes acceso a la sede de esta feria');
  }
};

const loadFairForAccess = async (fairId) => {
  const fair = await prisma.fair.findUnique({
    where: { id: fairId },
    select: { id: true, organizationId: true, siteId: true, name: true, status: true },
  });
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  return fair;
};

const mapInvite = (invite) => ({
  id: invite.id,
  fair_id: invite.fairId,
  email: invite.email,
  full_name: invite.fullName,
  document_type: invite.documentType,
  document_number: invite.documentNumber,
  status: invite.status,
  expires_at: invite.expiresAt,
  created_at: invite.createdAt,
  jury: invite.jury
    ? { id: invite.jury.id, email: invite.jury.email, status: invite.jury.status }
    : null,
});

/**
 * Invita a un jurado externo: valida dominio permitido, crea la cuenta JURY y
 * la asignación a la feria. Devuelve password temporal para entregarla por
 * canal seguro (igual que el bulk).
 */
export const inviteExternalJury = async ({ fair_id, email, full_name, document_type, document_number }, actor) => {
  if (actor.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Solo un ADMIN puede invitar jurados externos');
  }

  const fair = await loadFairForAccess(fair_id);
  await assertFairAccess({ actor, fair });

  if (fair.status !== 'DRAFT' && fair.status !== 'OPEN') {
    throw ApiError.conflict('La feria está cerrada y no admite más jurados');
  }

  const cleanEmail = email.toLowerCase().trim();
  await assertValidEmailDomain(cleanEmail, fair.organizationId);

  const existingInvite = await prisma.externalJuryInvite.findFirst({
    where: { email: cleanEmail, fairId: fair.id, status: INVITE_STATUS.INVITED },
    select: { id: true },
  });
  if (existingInvite) {
    throw ApiError.conflict('Ese correo ya tiene una invitación activa para esta feria');
  }

  const existingUser = await userRepository.findByEmail(cleanEmail);
  if (existingUser) {
    throw ApiError.conflict('Ese correo ya está registrado en el sistema');
  }

  const identity = await normalizeDocumentIdentity({
    document_type,
    document_number,
    role: ROLES.JURY,
  });

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);
  const username = cleanEmail.split('@')[0].slice(0, 50);

  try {
    const { invite } = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username,
          email: cleanEmail,
          password: passwordHash,
          firstName: full_name,
          lastName: '',
          institutionalId: identity?.documentNumber ?? username,
          role: ROLES.JURY,
          organizationId: fair.organizationId,
          isVerified: false,
          mustChangePassword: true,
          ...(fair.siteId ? { siteAssignments: { create: [{ siteId: fair.siteId }] } } : {}),
          ...(identity || {}),
        },
        select: JURY_SELECT,
      });

      await tx.fairJuryAssignment.create({
        data: { fairId: fair.id, userId: newUser.id, assignedById: actor.id },
        select: { id: true },
      });

      const inviteRow = await tx.externalJuryInvite.create({
        data: {
          organizationId: fair.organizationId,
          fairId: fair.id,
          email: cleanEmail,
          fullName: full_name.trim(),
          documentType: identity?.documentType ?? null,
          documentNumber: identity?.documentNumber ?? null,
          status: INVITE_STATUS.INVITED,
          invitedBy: actor.id,
          juryUserId: newUser.id,
          expiresAt: new Date(Date.now() + INVITE_EXPIRES_MS),
        },
        include: { jury: { select: { id: true, email: true, status: true } } },
      });

      return { user: newUser, invite: inviteRow };
    });

    return {
      invite: mapInvite(invite),
      onboarding_mode: 'credentials',
      temp_password: tempPassword,
      message: 'Jurado externo creado. Entrega la contraseña temporal por un canal seguro.',
    };
  } catch (error) {
    if (error?.code === 'P2002') {
      throw ApiError.conflict('Ya existe una invitación o un usuario con ese correo para esta feria');
    }
    throw error;
  }
};

/** Lista las invitaciones de una feria (todas si no se filtra por feria). */
export const listExternalJuries = async ({ fair_id, actor }) => {
  if (actor.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Solo un ADMIN puede listar jurados externos');
  }

  const where = { organizationId: actor.organizationId };
  if (fair_id) {
    const fair = await loadFairForAccess(fair_id);
    await assertFairAccess({ actor, fair });
    where.fairId = fair.id;
  } else if (actor.scopeLevel === 'REGION' || actor.scopeLevel === 'SITE') {
    const accessible = await getAccessibleSiteIds(actor);
    where.fair = { siteId: { in: accessible } };
  }

  const invites = await prisma.externalJuryInvite.findMany({
    where,
    include: { jury: { select: { id: true, email: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return { invites: invites.map(mapInvite), total: invites.length };
};

/** Revoca la invitación y suspende la cuenta JURY asociada. */
export const revokeExternalJury = async ({ inviteId, actor }) => {
  if (actor.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Solo un ADMIN puede revocar jurados externos');
  }

  const invite = await prisma.externalJuryInvite.findUnique({
    where: { id: inviteId },
    include: { fair: { select: { id: true, organizationId: true, siteId: true } } },
  });
  if (!invite) throw ApiError.notFound('Invitación no encontrada');
  if (invite.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La invitación no pertenece a tu organización');
  }
  await assertFairAccess({ actor, fair: invite.fair });

  const [updated] = await prisma.$transaction([
    prisma.externalJuryInvite.update({
      where: { id: inviteId },
      data: { status: INVITE_STATUS.REVOKED },
    }),
    ...(invite.juryUserId
      ? [prisma.user.update({ where: { id: invite.juryUserId }, data: { status: 'SUSPENDED' } })]
      : []),
  ]);

  return { invite: mapInvite(updated), revoked: true };
};

export default {
  inviteExternalJury,
  listExternalJuries,
  revokeExternalJury,
};