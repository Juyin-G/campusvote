// src/modules/objections/objection.service.js
// Lógica de tachas (SCHEDULED) e impugnaciones (CLOSED/CERTIFIED):
// - Una sola objeción PENDING por lista y por candidato (UNIQUE parcial en BD).
// - La resolución pertenece a ELECTORAL_COMMISSION/ADMIN; FOUNDED queda
//   registrada con revisión y puede desactivar la candidatura cuestionada.
// - El tránsito a OPEN exige 0 tachas pendientes (election.service).
// La ventana y la máquina de estados se refuerzan en el trigger
// enforce_objection_rules() (objections/001).

import * as objectionRepository from './objection.repository.js';
import * as electionRepository from '../elections/elections/election.repository.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import logger from '../../config/logger.js';
import auditService from '../audit/audit.service.js';

const logAudit = async (logData) => {
  try {
    await auditService.logAction(logData);
  } catch (err) {
    logger.warn('No se pudo registrar la acción de auditoría', { error: err.message });
  }
};

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

/** Presenta una tacha/impugnación. */
export const fileObjection = async ({
  electionId,
  objectionType,
  candidate_list_id,
  candidacy_id,
  reason,
  evidence_urls = [],
  actor,
}) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) throw ApiError.notFound('Elección no encontrada');
  await assertTenantAccess({ electionId, actor });

  const isTacha = objectionType.startsWith('TACHA_');
  const isResolutionPhase =
    election.status === 'SCHEDULED' && isTacha ||
    !isTacha && (election.status === 'CLOSED' || election.status === 'CERTIFIED');

  if (!isResolutionPhase) {
    throw ApiError.conflict(
      isTacha
        ? 'Las tachas solo se admiten durante la fase SCHEDULED'
        : 'Las impugnaciones solo se admiten en CLOSED/CERTIFIED'
    );
  }

  // Verifica que el objetivo exista y pertenezca a la elección.
  if (candidate_list_id) {
    const list = await prisma.candidateList.findFirst({
      where: { id: candidate_list_id, electionId },
      select: { id: true },
    });
    if (!list) throw ApiError.badRequest('La lista objetivo no pertenece a esta elección');
  } else if (candidacy_id) {
    const candidacy = await prisma.candidacy.findFirst({
      where: { id: candidacy_id, electionId },
      select: { id: true },
    });
    if (!candidacy) throw ApiError.badRequest('El candidato/proyecto objetivo no pertenece a esta elección');
  }

  const objection = await objectionRepository.createObjection({
    electionId,
    candidateListId: candidate_list_id ?? null,
    candidacyId: candidacy_id ?? null,
    objectionType,
    reason,
    evidenceUrls: Array.isArray(evidence_urls) ? evidence_urls : [],
    filedBy: actor.id,
    status: 'PENDING',
  });

  await logAudit({
    actorId: actor.id,
    electionId,
    action: 'FILE_OBJECTION',
    metadata: { objection_id: objection.id, objection_type: objectionType, status: 'PENDING' },
  });

  return objection;
};

/** Resuelve una objeción (solo ELECTORAL_COMMISSION/ADMIN). */
export const resolveObjection = async ({ electionId, objectionId, status, resolution_notes, actor }) => {
  const isSuperUser =
    actor.role === ROLES.ADMIN || actor.role === ROLES.ELECTORAL_COMMISSION || isSuperAdmin(actor);
  if (!isSuperUser) {
    throw ApiError.forbidden('Solo la comisión electoral o el administrador pueden resolver objeciones');
  }

  const objection = await objectionRepository.findObjectionInElection(electionId, objectionId);
  if (!objection) throw ApiError.notFound('Objeción no encontrada');
  if (objection.status !== 'PENDING') {
    throw ApiError.conflict('La objeción ya fue resuelta');
  }

  const resolved = await objectionRepository.resolveObjection(objectionId, {
    status,
    resolutionNotes: resolution_notes,
    reviewedBy: actor.id,
    reviewedAt: new Date(),
  });

  // FOUNDED sobre una tacha de candidato: desactiva la candidatura para que
  // el tránsito a OPEN se haga solo con proyectos legítimos (la regeneración
  // de papeletas se documenta en la fase F3 del MD).
  if (status === 'FOUNDED' && objection.objectionType === 'TACHA_CANDIDATE' && objection.candidacyId) {
    await prisma.candidacy.update({
      where: { id: objection.candidacyId },
      data: { status: 'REJECTED' },
    });
  }
  if (status === 'FOUNDED' && objection.objectionType === 'TACHA_LIST' && objection.candidateListId) {
    await prisma.candidacy.updateMany({
      where: { candidateListId: objection.candidateListId },
      data: { status: 'REJECTED' },
    });
  }

  await logAudit({
    actorId: actor.id,
    electionId,
    action: 'RESOLVE_OBJECTION',
    metadata: { objection_id: objectionId, resolution: status },
  });

  return resolved;
};

/** Lista las objeciones de una elección (pantalla de resolución). */
export const listObjections = async ({ electionId, status, objectionType, limit = 50, offset = 0, actor }) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) throw ApiError.notFound('Elección no encontrada');
  await assertTenantAccess({ electionId, actor });

  const [items, total] = await Promise.all([
    objectionRepository.listObjections({
      electionId,
      status,
      objectionType,
      skip: offset,
      take: limit,
    }),
    objectionRepository.countObjections({ electionId, status, objectionType }),
  ]);

  const pending = await objectionRepository.countPendingObjections(electionId);

  return { items, total, pending, limit, offset };
};

export default {
  fileObjection,
  resolveObjection,
  listObjections,
};