// src/modules/ratings/juryAssignment.service.js
// Asignación explícita de jurados a proyectos (doble ciego):
// - El ADMIN/COMISIÓN asigna jurados en DRAFT/SCHEDULED.
// - El jurado firma la declaración de conflicto antes de calificar.
// - El ADMIN aprueba/rechaza la asignación; solo APPROVED + declaración
//   firmada habilita el botón de calificar.
// - Se previene el conflicto de interés (asesor del proyecto o misma facultad).

import * as juryRepository from './juryAssignment.repository.js';
import * as electionRepository from '../elections/elections/election.repository.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import logger from '../../config/logger.js';
import auditService from '../audit/audit.service.js';

const CONFIGURABLE_STATUSES = ['DRAFT', 'SCHEDULED'];

const isSuperAdmin = (actor) =>
  actor.role === ROLES.SUPERADMIN || actor.isSuperAdmin || actor.isSuperuser;

const assertTenantAccess = async ({ electionId, actor }) => {
  if (isSuperAdmin(actor)) return;
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  const ownerOrgId = await electionRepository.findElectionOwnerOrganization(electionId);
  if (ownerOrgId && ownerOrgId !== actor.organizationId) {
    throw ApiError.forbidden('La elección no pertenece a tu organización');
  }
};

/**
 * Conflictos de interés: el jurado no puede evaluar el proyecto que asesora,
 * su propio proyecto, ni proyectos de su misma facultad.
 */
const assertJurorFit = async ({ electionId, candidacyId, juryId }) => {
  const [juror, candidacy] = await Promise.all([
    prisma.user.findUnique({
      where: { id: juryId },
      select: { id: true, role: true, facultyId: true, status: true },
    }),
    prisma.candidacy.findUnique({
      where: { id: candidacyId },
      select: { id: true, electionId: true, userId: true, advisorId: true },
    }),
  ]);

  if (!juror) throw ApiError.notFound('El jurado no existe');
  if (juror.role !== ROLES.JURY) {
    throw ApiError.badRequest('Solo los usuarios con rol JURY pueden ser asignados');
  }
  if (juror.status !== 'ACTIVE') {
    throw ApiError.badRequest('El jurado no está activo');
  }

  if (!candidacy) throw ApiError.notFound('El proyecto no existe');
  if (candidacy.electionId !== electionId) {
    throw ApiError.badRequest('El proyecto no pertenece a esta elección');
  }

  if (candidacy.advisorId === juryId) {
    throw ApiError.conflict('Un jurado no puede evaluar un proyecto que asesora');
  }
  if (candidacy.userId === juryId) {
    throw ApiError.conflict('Un jurado no puede evaluar su propio proyecto');
  }

  const evaluatee = await prisma.user.findUnique({
    where: { id: candidacy.userId },
    select: { facultyId: true },
  });
  if (juror.facultyId && evaluatee?.facultyId && juror.facultyId === evaluatee.facultyId) {
    throw ApiError.conflict('El jurado pertenece a la misma facultad que el expositor');
  }
};

/** Asigna un jurado a un proyecto (PENDING hasta aprobación). */
export const assignJury = async ({ electionId, juryId, candidacyId, isDiriment = false, actor }) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) throw ApiError.notFound('Elección no encontrada');
  await assertTenantAccess({ electionId, actor });

  if (!CONFIGURABLE_STATUSES.includes(election.status)) {
    throw ApiError.conflict('Las asignaciones solo se configuran antes de abrir la feria');
  }

  await assertJurorFit({ electionId, candidacyId, juryId });

  const existing = await prisma.juryAssignment.findFirst({
    where: { electionId, candidacyId, juryId },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict('El jurado ya fue asignado a este proyecto');
  }

  const assignment = await juryRepository.createAssignment({
    electionId,
    candidacyId,
    juryId,
    isDiriment,
    assignedBy: actor.id,
  });

  try {
    await auditService.logAction({
      actorId: actor.id,
      electionId,
      action: 'ASSIGN_JURY',
      metadata: {
        assignment_id: assignment.id,
        jury_id: juryId,
        candidacy_id: candidacyId,
        is_diriment: isDiriment,
      },
    });
  } catch (err) {
    logger.warn('No se pudo registrar la asignación de jurado en auditoría', { error: err.message });
  }

  return assignment;
};

/** El ADMIN/COMISIÓN aprueba o rechaza la asignación. */
export const setAssignmentStatus = async ({ electionId, assignmentId, status, actor }) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) throw ApiError.notFound('Elección no encontrada');
  await assertTenantAccess({ electionId, actor });

  if (!CONFIGURABLE_STATUSES.includes(election.status)) {
    throw ApiError.conflict('Las asignaciones solo se gestionan antes de abrir la feria');
  }

  const assignment = await juryRepository.findAssignmentByElection(electionId, assignmentId);
  if (!assignment) throw ApiError.notFound('Asignación no encontrada');

  return juryRepository.updateAssignment(assignmentId, { status });
};

/** Firmar declaración de conflicto de interés (el propio jurado). */
export const signConflictDeclaration = async ({ electionId, assignmentId, juryId }) => {
  const assignment = await juryRepository.findAssignmentByElection(electionId, assignmentId);
  if (!assignment) throw ApiError.notFound('Asignación no encontrada');
  if (assignment.juryId !== juryId) {
    throw ApiError.forbidden('Solo el jurado asignado puede firmar su declaración');
  }
  if (assignment.status === 'REJECTED') {
    throw ApiError.conflict('La asignación fue rechazada');
  }

  return juryRepository.updateAssignment(assignmentId, {
    conflictDeclaration: true,
    declaredAt: new Date(),
  });
};

/** Lista asignaciones. Un jurado solo ve sus propias asignaciones. */
export const listAssignments = async ({ electionId, candidacyId, status, actor }) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) throw ApiError.notFound('Elección no encontrada');
  await assertTenantAccess({ electionId, actor });

  const isConfigurator =
    isSuperAdmin(actor) || actor.role === ROLES.ADMIN;

  const assignments = await juryRepository.listAssignments({
    electionId,
    candidacyId,
    status,
    // Doble ciego: el jurado solo ve SU panel asignado.
    ...(isConfigurator ? {} : { juryId: actor.id }),
  });

  return { assignments };
};

export default {
  assignJury,
  setAssignmentStatus,
  signConflictDeclaration,
  listAssignments,
};