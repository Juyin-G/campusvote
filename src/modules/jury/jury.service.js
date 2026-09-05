import * as repository from './jury.repository.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import auditService from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.schema.js';

const assertManager = (actor) => {
  if (![ROLES.ADMIN, ROLES.ELECTORAL_COMMISSION, ROLES.SUPERADMIN].includes(actor.role)) {
    throw ApiError.forbidden('Solo la administración electoral puede gestionar jurados');
  }
};

export const assignJuror = async ({ electionId, candidacyId, jurorId, actor }) => {
  assertManager(actor);
  const [election, candidacy, juror] = await Promise.all([
    prisma.election.findUnique({ where: { id: electionId }, select: { id: true, status: true, processType: true, createdBy: true, creator: { select: { organizationId: true } } } }),
    prisma.candidacy.findUnique({ where: { id: candidacyId }, select: { id: true, electionId: true, userId: true } }),
    prisma.user.findUnique({ where: { id: jurorId }, select: { id: true, role: true, status: true, organizationId: true } }),
  ]);
  if (!election || !candidacy || candidacy.electionId !== electionId) throw ApiError.notFound('Elección o proyecto no encontrado');
  if (['CLOSED', 'CERTIFIED', 'PUBLISHED'].includes(election.status)) throw ApiError.conflict('No se pueden cambiar jurados con la elección cerrada');
  if (actor.role !== ROLES.SUPERADMIN && election.creator.organizationId && actor.organizationId !== election.creator.organizationId) {
    throw ApiError.forbidden('La elección no pertenece a tu organización');
  }
  if (!juror || juror.role !== ROLES.JURY || juror.status !== 'ACTIVE') throw ApiError.badRequest('El usuario no es un jurado activo');
  if (election.creator.organizationId && juror.organizationId !== election.creator.organizationId) {
    throw ApiError.forbidden('El jurado pertenece a otra organización');
  }
  if (candidacy.userId === jurorId) throw ApiError.conflict('El expositor no puede evaluar su propio proyecto');
  const conflict = await repository.findConflict({ electionId, candidacyId, jurorId });
  if (conflict?.status === 'OPEN') throw ApiError.conflict('Existe un conflicto de interés abierto para este jurado y proyecto');
  const existing = await repository.findAssignment({ electionId, candidacyId, jurorId });
  if (existing?.status === 'ACTIVE') throw ApiError.conflict('El jurado ya está asignado a este proyecto');
  const assignment = existing?.status === 'REVOKED'
    ? await prisma.juryAssignment.update({ where: { id: existing.id }, data: { status: 'ACTIVE', revokedAt: null, assignedBy: actor.userId ?? actor.id } })
    : await repository.createAssignment({ electionId, candidacyId, jurorId, assignedBy: actor.userId ?? actor.id });
  await auditService.logAction({
    actorId: actor.userId ?? actor.id,
    electionId,
    action: AUDIT_ACTIONS.ASSIGN_JURY,
    metadata: { candidacyId, jurorId, assignmentId: assignment.id },
  });
  return assignment;
};

export const listAssignments = async ({ electionId, actor }) => {
  if (actor.role === ROLES.JURY) return repository.listAssignments(electionId, actor.userId ?? actor.id);
  assertManager(actor);
  return repository.listAssignments(electionId);
};

export const revokeAssignment = async ({ assignmentId, actor }) => {
  assertManager(actor);
  const assignment = await prisma.juryAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw ApiError.notFound('Asignación no encontrada');
  const revoked = await repository.revokeAssignment(assignmentId);
  await auditService.logAction({
    actorId: actor.userId ?? actor.id,
    electionId: assignment.electionId,
    action: AUDIT_ACTIONS.REVOKE_JURY,
    metadata: { assignmentId },
  });
  return revoked;
};

export const declareConflict = async ({ electionId, candidacyId, jurorId, reason, actor }) => {
  if ((actor.userId ?? actor.id) !== jurorId) {
    assertManager(actor);
  } else {
    const assignment = await repository.findAssignment({ electionId, candidacyId, jurorId });
    if (assignment?.status !== 'ACTIVE') throw ApiError.forbidden('Solo puedes declarar conflicto sobre un proyecto asignado');
  }
  const assignment = await repository.findAssignment({ electionId, candidacyId, jurorId });
  if (assignment?.status === 'ACTIVE') await repository.revokeAssignment(assignment.id);
  const conflict = await repository.declareConflict({ electionId, candidacyId, jurorId, reason, declaredBy: actor.userId ?? actor.id });
  await auditService.logAction({
    actorId: actor.userId ?? actor.id,
    electionId,
    action: AUDIT_ACTIONS.DECLARE_JURY_CONFLICT,
    metadata: { candidacyId, jurorId, conflictId: conflict.id },
  });
  return conflict;
};

export const clearConflict = async ({ conflictId, actor }) => {
  assertManager(actor);
  const conflict = await prisma.juryConflict.findUnique({ where: { id: conflictId } });
  if (!conflict) throw ApiError.notFound('Conflicto no encontrado');
  const cleared = await repository.clearConflict(conflictId, actor.userId ?? actor.id);
  await auditService.logAction({
    actorId: actor.userId ?? actor.id,
    electionId: conflict.electionId,
    action: AUDIT_ACTIONS.CLEAR_JURY_CONFLICT,
    metadata: { conflictId },
  });
  return cleared;
};
