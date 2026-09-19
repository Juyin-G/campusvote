// src/modules/ratings/rating.helpers.js
// Helpers de calificación: validación de jurado, conflictos, score ponderado.
// Sin HTTP — funciones puras (reciben prisma como dependencia).

import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { RUBRIC_MAX_SCORE } from './rating.constants.js';

export const isSuperAdmin = (actor) =>
  actor.role === ROLES.SUPERADMIN || actor.isSuperAdmin || actor.isSuperuser;

/**
 * El jurado DEBE tener una asignación APPROVED con declaración de conflicto
 * firmada para la candidatura (F5: asignación explícita + doble ciego).
 */
export const assertJurorAssignment = async ({ prisma, electionId, candidacyId, jurorId }) => {
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
export const assertNoConflictOfInterest = async ({ prisma, electionId, jurorId, candidacyId }) => {
  const [juror, candidacy] = await Promise.all([
    prisma.user.findUnique({ where: { id: jurorId }, select: { facultyId: true, programId: true } }),
    prisma.candidacy.findUnique({
      where: { id: candidacyId },
      select: { userId: true, advisorId: true },
    }),
  ]);
  if (!candidacy) throw ApiError.notFound('Proyecto/candidatura no encontrada');
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
export const computeWeightedScore = async ({ ratingRepository, electionId, details }) => {
  const criteria = await ratingRepository.listCriteria(electionId);
  if (criteria.length === 0) {
    throw ApiError.conflict('La feria aún no tiene criterios de evaluación configurados');
  }
  const criteriaMap = new Map(criteria.map((c) => [c.id, c]));
  const provided = new Set(details.map((d) => d.criterion_id));

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
