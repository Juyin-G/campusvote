// src/modules/juryAssignments/juryAssignment.service.js
// Asignación formal de JURADOS (rol global JURY) a una FERIA.
//
// Estructura:
//   Organization ── Fair ── FairJuryAssignment ── User (role = JURY)
//
// Autorización:
//   - ADMIN gestiona jurados SOLO de las ferias de su organización.
//   - SUPERADMIN conserva el bypass de tenant del sistema para poder gestionar
//     ferias; la invariante de aislamiento "el jurado pertenece a la misma
//     organización que la feria" se exige SIEMPRE (evita mezclar organizaciones
//     aunque el actor sea SUPERADMIN).
//   - ELECTORAL_COMMISSION, STUDENT y TEACHER NO reciben permisos nuevos.
//   - JURY SOLO lee sus propias asignaciones (sin acceso administrativo ni a
//     todas las ferias del sistema).
//
// Estados de feria para modificar jurados:
//   - DRAFT y OPEN: se permite agregar/quitar jurados. Justificación: la feria
//     se configura en DRAFT y sigue siendo corregible durante su ejecución en
//     OPEN (p. ej. reemplazar un jurado que se retira). Sin estados nuevos.
//   - CLOSED: se bloquea (el panel de jurados queda congelado al finalizar).
//     Nota: el módulo electoral solo admite asignaciones en DRAFT/SCHEDULED;
//     las ferias NO tienen SCHEDULED, por eso OPEN mantiene la configuración.

import * as juryRepository from './juryAssignment.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { parsePagination } from '../../shared/utils/pagination.js';

const FAIR_JURY_CONFIGURABLE_STATUSES = ['DRAFT', 'OPEN'];

const isSuperAdmin = (actor) =>
  actor.role === ROLES.SUPERADMIN || actor.isSuperAdmin || actor.isSuperuser;

// ── Helpers de acceso ──────────────────────────────────────────────

const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) {
    throw ApiError.notFound('Feria no encontrada');
  }
  return fair;
};

/** Tenant: el actor administra solo las ferias de su organización. */
const assertTenantMatch = ({ fair, actor }) => {
  if (isSuperAdmin(actor)) return;
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (fair.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La feria no pertenece a tu organización');
  }
};

/** Los jurados solo se configuran en DRAFT/OPEN; CLOSED congela el panel. */
const assertFairJuriesConfigurable = (fair) => {
  if (!FAIR_JURY_CONFIGURABLE_STATUSES.includes(fair.status)) {
    throw ApiError.conflict('La feria está finalizada y no admite cambios en sus jurados');
  }
};

/** Solo usuarios con rol global JURY (y activos) pueden ser jurados de feria. */
const assertJuryUser = (user) => {
  if (user.role !== ROLES.JURY) {
    throw ApiError.badRequest('Solo los usuarios con rol global JURY pueden ser asignados como jurados');
  }
  if (user.status !== 'ACTIVE') {
    throw ApiError.badRequest('El jurado no está activo');
  }
};

/**
 * Aislamiento estricto de organización: el jurado debe pertenecer a la MISMA
 * organización que la feria. Se exige incluso para SUPERADMIN para preservar
 * la invariante de tenant (un jurado de la organización B no evalúa una feria
 * de la organización A).
 */
const assertSameOrganization = ({ fair, user }) => {
  if (user.organizationId !== fair.organizationId) {
    throw ApiError.badRequest('El jurado no pertenece a la misma organización que la feria');
  }
};

// ── Mappers ────────────────────────────────────────────────────────

const mapAssignment = (assignment) => ({
  id: assignment.id,
  fair_id: assignment.fairId,
  user_id: assignment.userId,
  assigned_by: assignment.assignedById,
  created_at: assignment.createdAt,
  updated_at: assignment.updatedAt,
  user: assignment.user
    ? {
        id: assignment.user.id,
        first_name: assignment.user.firstName,
        last_name: assignment.user.lastName,
        institutional_id: assignment.user.institutionalId,
        role: assignment.user.role,
        status: assignment.user.status,
      }
    : null,
});

const mapMyFair = (assignment) => ({
  assigned_at: assignment.createdAt,
  fair: {
    id: assignment.fair.id,
    organization_id: assignment.fair.organizationId,
    name: assignment.fair.name,
    description: assignment.fair.description,
    status: assignment.fair.status,
    starts_at: assignment.fair.startsAt,
    ends_at: assignment.fair.endsAt,
  },
});

// ── Operaciones (ADMIN/SUPERADMIN) ─────────────────────────────────

/** Lista los jurados asignados a una feria. */
export const listJuries = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });

  const assignments = await juryRepository.listByFair(fairId);

  return {
    fair_id: fair.id,
    fair_name: fair.name,
    fair_organization_id: fair.organizationId,
    jury_count: assignments.length,
    juries: assignments.map(mapAssignment),
  };
};

/** Asigna un usuario JURY a una feria. */
export const assignJury = async ({ fairId, userId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertFairJuriesConfigurable(fair);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, organizationId: true },
  });
  if (!user) {
    throw ApiError.notFound('Usuario no encontrado');
  }

  assertJuryUser(user);
  assertSameOrganization({ fair, user });

  const existing = await juryRepository.findByFairUser(fairId, userId);
  if (existing) {
    throw ApiError.conflict('El usuario ya está asignado como jurado de esta feria');
  }

  try {
    const assignment = await juryRepository.create({
      fairId,
      userId,
      assignedById: actor.id,
    });
    return mapAssignment(assignment);
  } catch (err) {
    if (err.message === 'FAIR_JURY_ALREADY_ASSIGNED') {
      throw ApiError.conflict('El usuario ya está asignado como jurado de esta feria');
    }
    if (err.message === 'FAIR_JURY_FOREIGN_KEY') {
      throw ApiError.badRequest('La feria o el usuario no son válidos');
    }
    throw err;
  }
};

/** Consulta si un usuario está asignado como jurado de una feria. */
export const getJuryAssignment = async ({ fairId, userId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });

  const assignment = await juryRepository.findByFairUser(fairId, userId);
  if (!assignment) {
    throw ApiError.notFound('El usuario no está asignado como jurado de esta feria');
  }
  return mapAssignment(assignment);
};

/** Quita un jurado de una feria (elimina la asignación). */
export const removeJury = async ({ fairId, userId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  assertFairJuriesConfigurable(fair);

  const assignment = await juryRepository.findByFairUser(fairId, userId);
  if (!assignment) {
    throw ApiError.notFound('El usuario no está asignado como jurado de esta feria');
  }

  try {
    await juryRepository.remove(fairId, userId);
  } catch (err) {
    // La FK de fair_evaluations -> fair_jury_assignments usa ON DELETE
    // RESTRICT: no se puede quitar un jurado que ya tiene evaluaciones en la
    // feria (los datos de evaluación quedarían huérfanos de responsable).
    if (err?.code === 'P2003') {
      throw ApiError.conflict(
        'El jurado ya tiene evaluaciones registradas en esta feria y no puede ser removido'
      );
    }
    throw err;
  }

  return { deleted: true, fair_id: fairId, user_id: userId };
};

// ── Operaciones (JURY: solo sus propias asignaciones) ──────────────

/** Lista las ferias a las que el JURY autenticado está formalmente asignado. */
export const listMyAssignments = async ({ actor, filters = {} }) => {
  // Defensa en profundidad (la ruta ya está restringida a JURY).
  if (actor.role !== ROLES.JURY) {
    throw ApiError.forbidden('Solo un usuario con rol JURY puede consultar sus asignaciones');
  }

  const { page, limit, offset } = parsePagination(filters || {});

  const [data, total] = await Promise.all([
    juryRepository.listByUser({ userId: actor.id, skip: offset, take: limit }),
    juryRepository.countByUser(actor.id),
  ]);

  return {
    data: data.map(mapMyFair),
    pagination: { page, limit, total },
  };
};

/** Detalle básico de una feria asignada (sin permisos administrativos). */
export const getMyAssignmentFair = async ({ fairId, actor }) => {
  // findMyFair incluye la feria; findByFairUser no (mapMyFair la necesita).
  const assignment = await juryRepository.findMyFair(fairId, actor.id);
  if (!assignment) {
    // No se revela la existencia de la feria a un JURY no asignado.
    throw ApiError.forbidden('No tienes asignación en esta feria');
  }
  return mapMyFair(assignment);
};

export default {
  listJuries,
  assignJury,
  getJuryAssignment,
  removeJury,
  listMyAssignments,
  getMyAssignmentFair,
};