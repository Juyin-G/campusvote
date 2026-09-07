// src/modules/ratings/rating.service.js
// Lógica de negocio para la calificación por rúbrica multicriterio en ferias:
// - Los ADMIN/COMISIÓN configuran criterios ponderados (Σ pesos = 1.00).
// - Solo jurados con asignación APPROVED y declaración de conflicto firmada
//   pueden calificar (doble ciego).
// - score FINAL = Σ (nota por criterio × peso del criterio); nunca lo manda
//   el cliente ni se guarda un promedio simple.

import * as ratingRepository from './rating.repository.js';
import * as electionRepository from '../elections/elections/election.repository.js';
import * as notificationService from '../notification/notification.service.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import logger from '../../config/logger.js';
import auditService from '../audit/audit.service.js';

// Tipos de proceso que admiten rating de proyectos (jurados).
const RATING_PROCESS_TYPES = ['FAIR', 'AWARD', 'EVENT_POLL'];

// Estados en los que se permite calificar.
const RATING_ALLOWED_STATUS = ['OPEN'];

// Puntos máximos de la escala de rúbrica (vigesimal, decisión F4).
const RUBRIC_MAX_SCORE = 20;

const RUBRIC_CONFIGURABLE_STATUSES = ['DRAFT', 'SCHEDULED'];

const isSuperAdmin = (actor) =>
  actor.role === ROLES.SUPERADMIN || actor.isSuperAdmin || actor.isSuperuser;

/**
 * Valida que el actor pertenezca a la organización de la elección (tenant).
 */
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
 * Carga la elección, valida proceso y estado.
 */
const loadElectionForRating = async (electionId) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) {
    throw ApiError.notFound('Elección no encontrada');
  }
  if (!RATING_PROCESS_TYPES.includes(election.processType)) {
    throw ApiError.badRequest('Esta elección no admite calificación por rúbrica');
  }
  return election;
};

/**
 * El jurado DEBE tener una asignación APPROVED con declaración de conflicto
 * firmada para la candidatura (F5: asignación explícita + doble ciego).
 */
const assertJurorAssignment = async ({ electionId, candidacyId, jurorId }) => {
  const assignment = await prisma.juryAssignment.findFirst({
    where: { electionId, candidacyId, juryId: jurorId },
    select: { id: true, status: true, conflictDeclaration: true },
  });

  if (!assignment) {
    throw ApiError.forbidden('No tienes asignación para evaluar este proyecto');
  }
  if (assignment.status !== 'APPROVED') {
    throw ApiError.conflict('Tu asignación de jurado aún no ha sido aprobada');
  }
  if (!assignment.conflictDeclaration) {
    throw ApiError.conflict('Debes firmar la declaración de conflicto de interés antes de calificar');
  }
  return assignment;
};

/**
 * Conflicto de interés (F5): el jurado no debe asesorar ni pertenecer a la
 * misma facultad que los evaluados.
 */
const assertNoConflictOfInterest = async ({ electionId, jurorId, candidacyId }) => {
  const [juror, candidacy] = await Promise.all([
    prisma.user.findUnique({
      where: { id: jurorId },
      select: { facultyId: true, programId: true },
    }),
    prisma.candidacy.findUnique({
      where: { id: candidacyId },
      select: { userId: true, advisorId: true },
    }),
  ]);
  if (!candidacy) {
    throw ApiError.notFound('Proyecto/candidatura no encontrada');
  }

  if (candidacy.advisorId === jurorId) {
    throw ApiError.conflict('Un jurado no puede evaluar un proyecto que asesora');
  }

  if (candidacy.userId === jurorId) {
    throw ApiError.conflict('Un jurado no puede evaluar su propio proyecto');
  }

  const evaluatee = await prisma.user.findUnique({
    where: { id: candidacy.userId },
    select: { facultyId: true, programId: true },
  });

  if (juror?.facultyId && evaluatee?.facultyId && juror.facultyId === evaluatee.facultyId) {
    throw ApiError.conflict('Conflictos de interés dentro de la misma facultad');
  }
};

/**
 * Valida el cuerpo de calificación contra los criterios configurados y
 * calcula el puntaje ponderado final.
 */
const computeWeightedScore = async ({ electionId, details }) => {
  const criteria = await ratingRepository.listCriteria(electionId);
  if (criteria.length === 0) {
    throw ApiError.conflict('La feria aún no tiene criterios de evaluación configurados');
  }

  const criteriaMap = new Map(criteria.map((c) => [c.id, c]));
  const provided = new Set(details.map((d) => d.criterion_id));

  // Rúbrica COMPLETA: no puede faltar ni sobrar ningún criterio.
  const missing = criteria.filter((c) => !provided.has(c.id));
  if (missing.length > 0) {
    throw ApiError.badRequest(
      `Debes calificar todos los criterios. Faltan: ${missing.map((m) => m.name).join(', ')}`
    );
  }

  let finalScore = 0;
  for (const d of details) {
    const criterion = criteriaMap.get(d.criterion_id);
    if (!criterion) {
      throw ApiError.badRequest('Uno de los criterios no pertenece a esta feria');
    }
    if (d.score > RUBRIC_MAX_SCORE) {
      throw ApiError.badRequest(`La nota no puede superar ${RUBRIC_MAX_SCORE}`);
    }
    finalScore += Number(d.score) * Number(criterion.weight);
  }

  return {
    finalScore: Number(finalScore.toFixed(2)),
    details: details.map((d) => ({
      criterionId: d.criterion_id,
      score: Number(d.score.toFixed(2)),
    })),
  };
};

/** Crea un criterio de rúbrica validando que la suma de pesos sea exactamente 1.00. */
export const createCriterion = async ({ electionId, name, weight, maxScore, actor }) => {
  const election = await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  if (!RUBRIC_CONFIGURABLE_STATUSES.includes(election.status)) {
    throw ApiError.conflict('Los criterios de evaluación solo se configuran antes de abrir la feria');
  }

  const current = await ratingRepository.sumCriteriaWeights(electionId);
  const existingWeight = Number(current?._sum?.weight ?? 0);
  const newWeight = Number(weight) || 0;

  if ((existingWeight + newWeight).toFixed(2) !== '1.00') {
    throw ApiError.badRequest(
      `La suma de pesos debe ser exactamente 1.00. Peso actual configurado: ${existingWeight.toFixed(2)}`
    );
  }

  return ratingRepository.createCriterion({
    electionId,
    name,
    weight: newWeight,
    maxScore: maxScore ?? RUBRIC_MAX_SCORE,
  });
};

/** Lista los criterios configurados de una feria. */
export const getCriteria = async ({ electionId }) => {
  const elections = await electionRepository.findElectionById(electionId);
  if (!elections) {
    throw ApiError.notFound('Elección no encontrada');
  }
  const criteria = await ratingRepository.listCriteria(electionId);
  return {
    election_id: electionId,
    max_score: RUBRIC_MAX_SCORE,
    weight_sum: Number(
      criteria.reduce((acc, c) => acc + Number(c.weight), 0).toFixed(2)
    ),
    complete: criteria.reduce((acc, c) => acc + Number(c.weight), 0).toFixed(2) === '1.00',
    criteria,
  };
};

/** Elimina un criterio (solo mientras la feria está en DRAFT/SCHEDULED). */
export const removeCriterion = async ({ electionId, criterionId, actor }) => {
  const election = await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  if (!RUBRIC_CONFIGURABLE_STATUSES.includes(election.status)) {
    throw ApiError.conflict('Los criterios de evaluación solo se pueden modificar antes de abrir la feria');
  }

  const criterion = await ratingRepository.findCriterion(criterionId, electionId);
  if (!criterion) {
    throw ApiError.notFound('Criterio no encontrado');
  }
  if (criterion.ratingDetails.length > 0) {
    throw ApiError.conflict('No puedes eliminar un criterio que ya tiene calificaciones');
  }

  try {
    await ratingRepository.deleteCriterion(criterionId);
    return { deleted: true };
  } catch (err) {
    if (err?.code === 'P2025') throw ApiError.notFound('Criterio no encontrado');
    throw err;
  }
};

/**
 * Revocación administrativa de una calificación (ADMIN/COMISIÓN).
 * El rating pasa a REVOKED y se excluye del resumen (la vista ya filtra por ACTIVE).
 */
export const revokeRating = async ({ electionId, ratingId, reason, actor }) => {
  await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  const rating = await ratingRepository.findRatingById(ratingId, electionId);
  if (!rating) {
    throw ApiError.notFound('Calificación no encontrada en esta elección');
  }
  if (rating.status === 'REVOKED') {
    throw ApiError.conflict('La calificación ya está revocada');
  }

  const revoked = await ratingRepository.updateRatingStatus(ratingId, 'REVOKED');

  try {
    await auditService.logAction({
      actorId: actor.id,
      electionId,
      action: 'REVOKE_RATING',
      metadata: { rating_id: ratingId, juror_id: rating.jurorId, reason },
    });
  } catch (err) {
    logger.warn('No se pudo registrar la revocación en auditoría', { error: err.message });
  }

  return { ...revoked, revoked: true, reason };
};

/**
 * Reactivación de una calificación revocada. SOLO vía revisión administrativa
 * (ADMIN/COMISIÓN): la re-subida directa del jurado nunca reactiva un REVOKED.
 */
export const restoreRating = async ({ electionId, ratingId, actor }) => {
  await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  const rating = await ratingRepository.findRatingById(ratingId, electionId);
  if (!rating) {
    throw ApiError.notFound('Calificación no encontrada en esta elección');
  }
  if (rating.status !== 'REVOKED') {
    throw ApiError.conflict('Solo se pueden restaurar calificaciones revocadas');
  }

  const restored = await ratingRepository.updateRatingStatus(ratingId, 'ACTIVE');

  try {
    await auditService.logAction({
      actorId: actor.id,
      electionId,
      action: 'RESTORE_RATING',
      metadata: { rating_id: ratingId, juror_id: rating.jurorId },
    });
  } catch (err) {
    logger.warn('No se pudo registrar la restauración en auditoría', { error: err.message });
  }

  return { ...restored, restored: true };
};

/**
 * Un jurado califica un proyecto con la rúbrica completa.
 * `score` (final ponderado) se calcula aquí: nunca se confía en el cliente.
 */
export const rateProject = async ({ electionId, candidacyId, details, comment, actor }) => {
  const election = await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  if (!RATING_ALLOWED_STATUS.includes(election.status)) {
    throw ApiError.conflict('Las calificaciones solo se aceptan mientras la feria está abierta');
  }

  const candidacy = await prisma.candidacy.findUnique({
    where: { id: candidacyId },
    select: { id: true, electionId: true, status: true, userId: true, candidateListId: true, advisorId: true },
  });
  if (!candidacy) {
    throw ApiError.notFound('Proyecto/candidatura no encontrada');
  }
  if (candidacy.electionId !== electionId) {
    throw ApiError.badRequest('La candidatura no pertenece a esta elección');
  }

  await assertJurorAssignment({ electionId, candidacyId, jurorId: actor.id });
  await assertNoConflictOfInterest({ electionId, jurorId: actor.id, candidacyId });

  // Una calificación REVOKED NO se resucita por re-subida del jurado:
  // solo se reactiva vía revisión administrativa (restoreRating).
  const existingRating = await ratingRepository.findRating(candidacyId, actor.id);
  if (existingRating?.status === 'REVOKED') {
    throw ApiError.conflict(
      'Esta calificación fue revocada por la comisión. ' +
        'Contacta a la comisión electoral para su revisión antes de recalificar.'
    );
  }

  const { finalScore, details: normalizedDetails } = await computeWeightedScore({
    electionId,
    details,
  });

  const rating = await ratingRepository.upsertRating({
    electionId,
    candidacyId,
    jurorId: actor.id,
    score: finalScore,
    comment: comment || null,
    details: normalizedDetails,
  });

  try {
    const project = await prisma.candidateList.findUnique({
      where: { id: candidacy.candidateListId },
      select: { name: true },
    });
    await notificationService.createNotification({
      user_id: candidacy.userId,
      type: 'RATING_RECEIVED',
      title: '¡Tu proyecto fue evaluado!',
      message: `${project?.name || 'Tu proyecto'} recibió una nueva evaluación de la feria`,
      metadata: { election_id: electionId, candidacy_id: candidacyId, score: finalScore },
      channels: ['IN_APP', 'PUSH'],
    });
  } catch (err) {
    logger.warn('No se pudo notificar al expositor del rating', { error: err.message });
  }

  try {
    await auditService.logAction({
      actorId: actor.id,
      electionId,
      action: 'SUBMIT_RATING',
      metadata: { rating_id: rating.id, candidacy_id: candidacyId, score: finalScore },
    });
  } catch (err) {
    logger.warn('No se pudo registrar la calificación en auditoría', { error: err.message });
  }

  return rating;
};

/** Resultados de una feria con el promedio ponderado por proyecto. */
export const getRatingResults = async ({ electionId, actor }) => {
  const election = await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  const criteria = await ratingRepository.listCriteria(electionId);
  const summary = await ratingRepository.ratingsSummaryByCandidacy(electionId);

  const candidacies = await prisma.candidacy.findMany({
    where: { electionId },
    select: {
      id: true,
      userId: true,
      status: true,
      candidateList: { select: { id: true, name: true, acronym: true } },
      user: { select: { id: true, firstName: true, lastName: true, institutionalId: true } },
    },
  });

  const scoreMap = new Map((summary || []).map((r) => [String(r.candidacy_id), r]));

  const projects = candidacies
    .map((c) => {
      const s = scoreMap.get(c.id) || {
        rating_count: 0,
        average_score: 0,
        total_score: 0,
      };
      return {
        project_id: c.id,
        project_name: c.candidateList?.name || 'Proyecto',
        project_acronym: c.candidateList?.acronym || null,
        expositor_id: c.user?.id || null,
        expositor_name: c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() : null,
        rating_count: s.rating_count,
        average_score: Number(s.average_score) || 0,
        total_score: Number(s.total_score) || 0,
      };
    })
    .sort((a, b) => b.average_score - a.average_score || b.total_score - a.total_score);

  return {
    election_id: electionId,
    process_type: election.processType,
    status: election.status,
    max_score: RUBRIC_MAX_SCORE,
    criteria,
    projects,
    rated_projects: projects.filter((p) => p.rating_count > 0).length,
  };
};

/**
 * Lista las calificaciones trazables de una feria. Doble ciego: el nombre del
 * jurado solo se expone a ADMIN/COMISIÓN; el resto ve la matriz anónima.
 */
export const listRatings = async ({ electionId, candidacyId, status, limit, offset, actor }) => {
  await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  const items = await ratingRepository.listRatingsByElection({
    electionId,
    candidacyId,
    status,
    limit,
    offset,
  });
  const total = await prisma.rating.count({
    where: { electionId, ...(candidacyId ? { candidacyId } : {}), ...(status ? { status } : {}) },
  });

  const revealJuror = isSuperAdmin(actor) || actor.role === ROLES.ADMIN;

  return {
    items: items.map((r) => ({
      id: r.id,
      election_id: r.electionId,
      candidacy_id: r.candidacyId,
      juror: revealJuror ? r.juror : null,
      score: r.score,
      comment: r.comment,
      status: r.status,
      details: r.ratingDetails || [],
      created_at: r.createdAt,
    })),
    total,
    limit: limit ?? 50,
    offset: offset ?? 0,
    double_blind: !revealJuror,
  };
};

export default {
  createCriterion,
  getCriteria,
  removeCriterion,
  revokeRating,
  restoreRating,
  rateProject,
  getRatingResults,
  listRatings,
};